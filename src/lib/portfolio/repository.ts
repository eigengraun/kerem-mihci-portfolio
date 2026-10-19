import { projectsData, type Project, type WorkspaceId } from "@/data/projects";
import {
  assertLocalSimulationAllowed,
  deleteMediaFromD1AndR2 as deleteMediaLocal,
  deleteProjectInD1 as deleteProjectLocal,
  getCmsDataSource,
  getCmsStorageMode,
  getD1HealthAndStats as getLocalD1HealthAndStats,
  getProjectByIdOrSlugForAdminFromD1,
  getPublishedProjectBySlugFromD1,
  listAllProjectsForAdminFromD1,
  listAuditLogsFromD1 as listAuditLogsLocal,
  listMediaFromD1 as listMediaLocal,
  listProjectRevisionsFromD1 as listRevisionsLocal,
  listPublishedProjectsFromD1,
  listPublishingEventsFromD1 as listPublishingEventsLocal,
  reconcileProjectsListWithCanonical,
  rollbackProjectRevisionInD1 as rollbackRevisionLocal,
  updateFeaturedOrderingInD1 as updateFeaturedLocal,
  updateProjectStatusInD1 as updateStatusLocal,
  uploadMediaToR2AndD1 as uploadMediaLocal,
  upsertProjectInD1 as upsertProjectLocal
} from "./d1Engine";
import {
  CmsStorageUnavailableError,
  validateMediaFileSignature,
  type CmsAuditLogRecord,
  type CmsMediaRecord,
  type CmsProjectRecord,
  type CmsPublishStatus,
  type CmsPublishingEventRecord,
  type CmsRevisionRecord,
  type UpsertProjectInput
} from "./types";

const WORKER_TIMEOUT_MS = 8000;

// In-memory last-known-good published snapshot for post-cutover resilience
let lastKnownPublishedSnapshot: CmsProjectRecord[] | null = null;

function toLegacyCmsRecord(p: Project, index: number): CmsProjectRecord {
  return {
    ...p,
    cmsStatus: "published",
    featuredOrder: p.featuredOrder ?? (p.featured ? index + 1 : 0),
    sortOrder: p.sortOrder ?? index + 1,
    createdAt: "2025-01-15T12:00:00.000Z",
    updatedAt: "2025-01-15T12:00:00.000Z",
    publishedAt: "2025-01-15T12:00:00.000Z",
    archivedAt: null
  };
}

function getWorkerBaseUrl(): string | null {
  const raw = (process.env.CLOUDFLARE_CMS_API_URL || "").trim().replace(/\/$/, "");
  return raw || null;
}

function getWorkerServiceToken(): string | null {
  const raw = (process.env.CLOUDFLARE_API_SERVICE_TOKEN || "").trim();
  return raw.length >= 16 ? raw : null;
}

function shouldUseWorkerApi(): boolean {
  const mode = getCmsStorageMode();
  if (mode === "staging" || mode === "production") {
    return true;
  }
  return Boolean(getWorkerBaseUrl());
}

function requireWorkerConfigForMutation(operation: string): {
  baseUrl: string;
  token: string;
} {
  const baseUrl = getWorkerBaseUrl();
  const token = getWorkerServiceToken();
  const mode = getCmsStorageMode();

  if (!baseUrl || !token) {
    throw new CmsStorageUnavailableError(
      `[CMS Fail-Closed] Cannot execute "${operation}" in "${mode}" mode: CLOUDFLARE_CMS_API_URL and/or CLOUDFLARE_API_SERVICE_TOKEN is missing or invalid.`
    );
  }
  return { baseUrl, token };
}

async function fetchWorkerJson<T>(
  pathUrl: string,
  init: RequestInit & { requireServiceAuth?: boolean; actorEmail?: string } = {}
): Promise<T> {
  const baseUrl = getWorkerBaseUrl();
  const mode = getCmsStorageMode();
  if (!baseUrl) {
    throw new CmsStorageUnavailableError(
      `[CMS Fail-Closed] CLOUDFLARE_CMS_API_URL is not configured (mode="${mode}").`
    );
  }

  const headers = new Headers(init.headers || {});
  if (init.requireServiceAuth) {
    const token = getWorkerServiceToken();
    if (!token) {
      throw new CmsStorageUnavailableError(
        `[CMS Fail-Closed] CLOUDFLARE_API_SERVICE_TOKEN is not configured or shorter than 16 chars (mode="${mode}").`
      );
    }
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.actorEmail) {
    headers.set("X-Actor-Email", init.actorEmail);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${pathUrl}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timer);
    throw new CmsStorageUnavailableError(
      `[CMS Fail-Closed] Cloudflare Worker at "${baseUrl}${pathUrl}" is unreachable: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  } finally {
    clearTimeout(timer);
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // non-json response
  }

  if (!response.ok) {
    const errMsg = String(data.error || `Worker HTTP ${response.status}`);
    if (response.status === 401 || response.status === 403 || response.status >= 500) {
      throw new CmsStorageUnavailableError(`[Cloudflare Worker ${response.status}] ${errMsg}`);
    }
    throw new Error(errMsg);
  }

  return data as T;
}

/**
 * Public read: returns all published projects according to CMS_DATA_SOURCE and CMS_STORAGE_MODE.
 * - Pre-cutover (`CMS_DATA_SOURCE=legacy`): serves canonical `projectsData` from `src/data/projects.ts`.
 * - Post-cutover (`CMS_DATA_SOURCE=cloudflare`):
 *    - Queries Cloudflare Worker `/api/v1/public/projects` (or local D1 when in `local` mode without Worker URL).
 *    - Caches verified published projects in `lastKnownPublishedSnapshot`.
 *    - Never exposes drafts and never revives archived/unpublished legacy projects after cutover.
 */
export async function getPublishedProjects(): Promise<CmsProjectRecord[]> {
  const dataSource = getCmsDataSource();
  if (dataSource === "legacy") {
    return projectsData.map(toLegacyCmsRecord);
  }

  if (shouldUseWorkerApi()) {
    try {
      const res = await fetchWorkerJson<{ ok: boolean; projects: CmsProjectRecord[] }>(
        "/api/v1/public/projects"
      );
      const publishedOnly = (res.projects || []).filter((p) => p.cmsStatus === "published");
      lastKnownPublishedSnapshot = publishedOnly;
      return publishedOnly;
    } catch (error) {
      console.error(
        "[portfolio/repository] Worker public projects read failed in cloudflare mode:",
        error
      );
      if (lastKnownPublishedSnapshot) {
        return lastKnownPublishedSnapshot;
      }
      return [];
    }
  }

  // Local mode without remote Worker URL
  const published = listPublishedProjectsFromD1().filter((p) => p.cmsStatus === "published");
  lastKnownPublishedSnapshot = published;
  return published;
}

/**
 * Public read: returns a single published project by slug.
 * Draft and archived projects always return null.
 */
export async function getPublishedProjectBySlug(slug: string): Promise<CmsProjectRecord | null> {
  const dataSource = getCmsDataSource();
  if (dataSource === "legacy") {
    const idx = projectsData.findIndex((p) => p.slug === slug);
    return idx >= 0 ? toLegacyCmsRecord(projectsData[idx], idx) : null;
  }

  if (shouldUseWorkerApi()) {
    try {
      const res = await fetchWorkerJson<{ ok: boolean; project: CmsProjectRecord }>(
        `/api/v1/public/projects/${encodeURIComponent(slug)}`
      );
      if (res.project && res.project.cmsStatus === "published") {
        return res.project;
      }
      return null;
    } catch (error) {
      if (error instanceof Error && !(error instanceof CmsStorageUnavailableError)) {
        // 404 from Worker
        return null;
      }
      if (lastKnownPublishedSnapshot) {
        return (
          lastKnownPublishedSnapshot.find(
            (p) => p.slug === slug && p.cmsStatus === "published"
          ) || null
        );
      }
      return null;
    }
  }

  return getPublishedProjectBySlugFromD1(slug);
}

/**
 * Admin-only repository methods (Fail-Closed in staging & production when Worker is unavailable)
 */
export async function getAdminProjects(): Promise<CmsProjectRecord[]> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("getAdminProjects");
    const res = await fetchWorkerJson<{ ok: boolean; projects: CmsProjectRecord[] }>(
      "/api/v1/admin/projects",
      { requireServiceAuth: true }
    );
    return res.projects || [];
  }
  assertLocalSimulationAllowed("getAdminProjects");
  return listAllProjectsForAdminFromD1();
}

export async function getAdminProjectByIdOrSlug(
  idOrSlug: string
): Promise<CmsProjectRecord | null> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("getAdminProjectByIdOrSlug");
    try {
      const res = await fetchWorkerJson<{ ok: boolean; project: CmsProjectRecord }>(
        `/api/v1/admin/projects/${encodeURIComponent(idOrSlug)}`,
        { requireServiceAuth: true }
      );
      return res.project || null;
    } catch (err) {
      if (err instanceof CmsStorageUnavailableError) throw err;
      return null;
    }
  }
  assertLocalSimulationAllowed("getAdminProjectByIdOrSlug");
  return getProjectByIdOrSlugForAdminFromD1(idOrSlug);
}

export async function saveAdminProject(
  input: UpsertProjectInput & { status?: string },
  actorEmail: string,
  actionLabel = "update"
): Promise<CmsProjectRecord> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("saveAdminProject");
    const isUpdate = actionLabel === "update" && Boolean(input.id || input.slug);
    const targetPath = isUpdate
      ? `/api/v1/admin/projects/${encodeURIComponent(input.id || input.slug)}`
      : "/api/v1/admin/projects";
    const res = await fetchWorkerJson<{ ok: boolean; project: CmsProjectRecord }>(targetPath, {
      method: isUpdate ? "PUT" : "POST",
      requireServiceAuth: true,
      actorEmail,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, actionType: actionLabel })
    });
    // Refresh snapshot asynchronously
    lastKnownPublishedSnapshot = null;
    return res.project;
  }

  assertLocalSimulationAllowed("saveAdminProject");
  const saved = upsertProjectLocal(input, actorEmail, actionLabel);
  lastKnownPublishedSnapshot = null;
  return saved;
}

export async function changeAdminProjectStatus(
  idOrSlug: string,
  newStatus: CmsPublishStatus,
  actorEmail: string,
  notes?: string
): Promise<CmsProjectRecord> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("changeAdminProjectStatus");
    const res = await fetchWorkerJson<{ ok: boolean; project: CmsProjectRecord }>(
      `/api/v1/admin/projects/${encodeURIComponent(idOrSlug)}`,
      {
        method: "PATCH",
        requireServiceAuth: true,
        actorEmail,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmsStatus: newStatus, notes })
      }
    );
    lastKnownPublishedSnapshot = null;
    return res.project;
  }

  assertLocalSimulationAllowed("changeAdminProjectStatus");
  const updated = updateStatusLocal(idOrSlug, newStatus, actorEmail, notes);
  lastKnownPublishedSnapshot = null;
  return updated;
}

export async function removeAdminProject(
  idOrSlug: string,
  actorEmail: string
): Promise<{ deletedId: string; slug: string }> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("removeAdminProject");
    const res = await fetchWorkerJson<{ ok: boolean; deletedId: string; slug: string }>(
      `/api/v1/admin/projects/${encodeURIComponent(idOrSlug)}`,
      {
        method: "DELETE",
        requireServiceAuth: true,
        actorEmail
      }
    );
    lastKnownPublishedSnapshot = null;
    return { deletedId: res.deletedId, slug: res.slug };
  }

  assertLocalSimulationAllowed("removeAdminProject");
  const deleted = deleteProjectLocal(idOrSlug, actorEmail);
  lastKnownPublishedSnapshot = null;
  return deleted;
}

export async function updateFeaturedOrderingInD1(
  workspace: WorkspaceId,
  featuredItems: { id: string; featured: boolean; featuredOrder: number }[],
  actorEmail: string
): Promise<void> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("updateFeaturedOrderingInD1");
    await fetchWorkerJson("/api/v1/admin/projects", {
      method: "POST",
      requireServiceAuth: true,
      actorEmail,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionType: "reorder-featured",
        workspace,
        featuredItems
      })
    });
    lastKnownPublishedSnapshot = null;
    return;
  }

  assertLocalSimulationAllowed("updateFeaturedOrderingInD1");
  updateFeaturedLocal(workspace, featuredItems, actorEmail);
  lastKnownPublishedSnapshot = null;
}

export async function listProjectRevisionsFromD1(
  projectId: string
): Promise<CmsRevisionRecord[]> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("listProjectRevisionsFromD1");
    const res = await fetchWorkerJson<{
      ok: boolean;
      project: CmsProjectRecord;
      revisions: CmsRevisionRecord[];
    }>(`/api/v1/admin/projects/${encodeURIComponent(projectId)}`, {
      requireServiceAuth: true
    });
    return res.revisions || [];
  }

  assertLocalSimulationAllowed("listProjectRevisionsFromD1");
  return listRevisionsLocal(projectId);
}

export async function rollbackProjectRevisionInD1(
  projectId: string,
  revisionNumber: number,
  actorEmail: string
): Promise<CmsProjectRecord> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("rollbackProjectRevisionInD1");
    const res = await fetchWorkerJson<{ ok: boolean; project: CmsProjectRecord }>(
      `/api/v1/admin/projects/${encodeURIComponent(projectId)}`,
      {
        method: "PATCH",
        requireServiceAuth: true,
        actorEmail,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollbackRevisionNumber: revisionNumber })
      }
    );
    lastKnownPublishedSnapshot = null;
    return res.project;
  }

  assertLocalSimulationAllowed("rollbackProjectRevisionInD1");
  const restored = rollbackRevisionLocal(projectId, revisionNumber, actorEmail);
  lastKnownPublishedSnapshot = null;
  return restored;
}

export async function listAuditLogsFromD1(limit = 50): Promise<CmsAuditLogRecord[]> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("listAuditLogsFromD1");
    const res = await fetchWorkerJson<{ ok: boolean; auditLogs: CmsAuditLogRecord[] }>(
      "/api/v1/admin/system",
      { requireServiceAuth: true }
    );
    return (res.auditLogs || []).slice(0, limit);
  }

  assertLocalSimulationAllowed("listAuditLogsFromD1");
  return listAuditLogsLocal(limit);
}

export async function listPublishingEventsFromD1(
  limit = 50
): Promise<CmsPublishingEventRecord[]> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("listPublishingEventsFromD1");
    const res = await fetchWorkerJson<{
      ok: boolean;
      publishingEvents: CmsPublishingEventRecord[];
    }>("/api/v1/admin/system", { requireServiceAuth: true });
    return (res.publishingEvents || []).slice(0, limit);
  }

  assertLocalSimulationAllowed("listPublishingEventsFromD1");
  return listPublishingEventsLocal(limit);
}

export async function uploadMediaToR2AndD1(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  projectId?: string | null;
  projectSlug?: string;
  kind?: CmsMediaRecord["kind"];
  altTR?: string;
  altEN?: string;
  captionTR?: string;
  captionEN?: string;
  actorEmail: string;
}): Promise<CmsMediaRecord> {
  const sigCheck = validateMediaFileSignature(
    params.buffer,
    params.mimeType,
    params.filename
  );
  if (!sigCheck.valid) {
    throw new Error(sigCheck.error || "Invalid media file.");
  }

  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("uploadMediaToR2AndD1");
    const form = new FormData();
    const uint8 = new Uint8Array(
      params.buffer.buffer,
      params.buffer.byteOffset,
      params.buffer.byteLength
    );
    const blob = new Blob([uint8.slice().buffer], { type: params.mimeType });
    form.append("file", blob, params.filename);
    if (params.projectId) form.append("projectId", params.projectId);
    if (params.projectSlug) form.append("projectSlug", params.projectSlug);
    if (params.kind) form.append("kind", params.kind);
    if (params.altTR) form.append("altTR", params.altTR);
    if (params.altEN) form.append("altEN", params.altEN);
    if (params.captionTR) form.append("captionTR", params.captionTR);
    if (params.captionEN) form.append("captionEN", params.captionEN);

    const res = await fetchWorkerJson<{ ok: boolean; media: CmsMediaRecord }>(
      "/api/v1/admin/media/upload",
      {
        method: "POST",
        requireServiceAuth: true,
        actorEmail: params.actorEmail,
        body: form
      }
    );
    return res.media;
  }

  assertLocalSimulationAllowed("uploadMediaToR2AndD1");
  return uploadMediaLocal(params);
}

export async function listMediaFromD1(projectId?: string): Promise<CmsMediaRecord[]> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("listMediaFromD1");
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const res = await fetchWorkerJson<{ ok: boolean; media: CmsMediaRecord[] }>(
      `/api/v1/admin/media${qs}`,
      { requireServiceAuth: true }
    );
    return res.media || [];
  }

  assertLocalSimulationAllowed("listMediaFromD1");
  return listMediaLocal(projectId);
}

export async function deleteMediaFromD1AndR2(
  mediaId: string,
  actorEmail: string
): Promise<{ deletedId: string }> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("deleteMediaFromD1AndR2");
    const res = await fetchWorkerJson<{ ok: boolean; deletedId: string }>(
      `/api/v1/admin/media?id=${encodeURIComponent(mediaId)}`,
      {
        method: "DELETE",
        requireServiceAuth: true,
        actorEmail
      }
    );
    return { deletedId: res.deletedId };
  }

  assertLocalSimulationAllowed("deleteMediaFromD1AndR2");
  return deleteMediaLocal(mediaId, actorEmail);
}

export async function getD1HealthAndStats() {
  if (shouldUseWorkerApi()) {
    try {
      const res = await fetchWorkerJson<Record<string, unknown>>("/api/v1/admin/health", {
        requireServiceAuth: true
      });
      return {
        ...res,
        storageMode: getCmsStorageMode(),
        dataSource: getCmsDataSource(),
        remoteWorkerUrl: getWorkerBaseUrl(),
        remoteServiceTokenConfigured: Boolean(getWorkerServiceToken())
      };
    } catch {
      return getLocalD1HealthAndStats();
    }
  }
  return getLocalD1HealthAndStats();
}

export async function reconcileCanonicalProjectsWithD1() {
  const projects = await getAdminProjects();
  return reconcileProjectsListWithCanonical(projects);
}

export { getCmsStorageMode, getCmsDataSource };
