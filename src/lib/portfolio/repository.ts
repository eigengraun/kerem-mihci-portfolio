import fs from "node:fs";
import path from "node:path";
import { projectsData, type Project, type WorkspaceId } from "../../data/projects";
import { videosData, type PortfolioVideo } from "../../data/videos";
import { galleryItems, type GalleryItem } from "../../data/gallery";
import {
  assertLocalSimulationAllowed,
  deleteMediaFromD1AndR2 as deleteMediaLocal,
  deleteProjectInD1 as deleteProjectLocal,
  deleteVideoFromD1 as deleteVideoLocal,
  deleteGalleryItemFromD1 as deleteGalleryItemLocal,
  getCmsDataSource,
  getCmsStorageMode,
  getD1HealthAndStats as getLocalD1HealthAndStats,
  getProjectByIdOrSlugForAdminFromD1,
  getPublishedProjectBySlugFromD1,
  getVideoByIdFromD1 as getVideoByIdLocal,
  getVideoBySlugFromD1 as getVideoBySlugLocal,
  getGalleryItemByIdFromD1 as getGalleryItemByIdLocal,
  listAllProjectsForAdminFromD1,
  listAllVideosForAdminFromD1 as listVideosLocal,
  listAllGalleryItemsForAdminFromD1 as listGalleryLocal,
  listAuditLogsFromD1 as listAuditLogsLocal,
  listMediaFromD1 as listMediaLocal,
  listProjectRevisionsFromD1 as listRevisionsLocal,
  listPublishedProjectsFromD1,
  listPublishedVideosFromD1 as listPublishedVideosLocal,
  listPublishedGalleryItemsFromD1 as listPublishedGalleryLocal,
  listPublishingEventsFromD1 as listPublishingEventsLocal,
  listVideoRevisionsFromD1 as listVideoRevisionsLocal,
  listGalleryRevisionsFromD1 as listGalleryRevisionsLocal,
  reconcileProjectsListWithCanonical,
  reconcileVideosListWithCanonical,
  rollbackProjectRevisionInD1 as rollbackRevisionLocal,
  rollbackVideoRevisionInD1 as rollbackVideoRevisionLocal,
  rollbackGalleryRevisionInD1 as rollbackGalleryRevisionLocal,
  seedCanonicalVideosInLocalD1 as seedCanonicalVideosLocal,
  updateFeaturedOrderingInD1 as updateFeaturedLocal,
  updateProjectStatusInD1 as updateStatusLocal,
  updateVideoOrderingInD1 as updateVideoOrderingLocal,
  updateGalleryOrderingInD1 as updateGalleryOrderingLocal,
  uploadMediaToR2AndD1 as uploadMediaLocal,
  uploadVideoAssetToStorageAndD1 as uploadVideoAssetLocal,
  uploadGalleryAssetToStorageAndD1 as uploadGalleryAssetLocal,
  upsertProjectInD1 as upsertProjectLocal,
  upsertVideoInD1 as upsertVideoLocal,
  upsertGalleryItemInD1 as upsertGalleryItemLocal
} from "./d1Engine";
import {
  CmsStorageUnavailableError,
  validateMediaFileSignature,
  validateGalleryImageSignature,
  type CmsAuditLogRecord,
  type CmsMediaRecord,
  type CmsProjectRecord,
  type CmsPublishStatus,
  type CmsPublishingEventRecord,
  type CmsRevisionRecord,
  type CmsVideoRecord,
  type CmsVideoAssetRecord,
  type CmsVideoRevisionRecord,
  type CmsGalleryItem,
  type CmsGalleryAssetRecord,
  type CmsGalleryRevisionRecord,
  type UpsertProjectInput,
  type UpsertVideoInput,
  type UpsertGalleryItemInput
} from "./types";

const WORKER_TIMEOUT_MS = 8000;
const DEFAULT_SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 minutes max stale snapshot TTL during Worker outage

export interface PublishedProjectsReadResult {
  projects: CmsProjectRecord[];
  degraded: boolean;
  source:
    | "legacy-static"
    | "cloudflare-worker-live"
    | "local-d1-live"
    | "stale-verified-snapshot"
    | "degraded-cold-start-outage";
  reason?: string;
}

interface SnapshotCoordinationState {
  generation: number;
  updatedAtMs: number;
  tombstonedIds: Record<string, number>;
  tombstonedSlugs: Record<string, number>;
  tombstonedVideoIds: Record<string, number>;
  tombstonedVideoSlugs: Record<string, number>;
  videoGeneration: number;
  videoUpdatedAtMs: number;
}

interface VerifiedSnapshotCache {
  projects: CmsProjectRecord[];
  capturedAtMs: number;
  generation: number;
}

interface VerifiedVideosSnapshotCache {
  videos: PortfolioVideo[];
  capturedAtMs: number;
  generation: number;
}

// Process-local verified snapshot, coordinated via shared host tombstone ledger + strict TTL
let lastKnownPublishedSnapshot: VerifiedSnapshotCache | null = null;
let lastKnownPublishedVideosSnapshot: VerifiedVideosSnapshotCache | null = null;

const DEFAULT_VIDEO_SNAPSHOT_TTL_MS = 30 * 1000; // 30 seconds max stale TTL during Worker outage

function getSnapshotTtlMs(): number {
  const raw = Number(process.env.CMS_SNAPSHOT_MAX_STALE_MS || DEFAULT_SNAPSHOT_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SNAPSHOT_TTL_MS;
}

function getVideoSnapshotTtlMs(): number {
  const raw = Number(process.env.CMS_VIDEO_SNAPSHOT_MAX_STALE_MS || DEFAULT_VIDEO_SNAPSHOT_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_VIDEO_SNAPSHOT_TTL_MS;
}

function getCoordinationFilePath(): string {
  if (process.env.CMS_SNAPSHOT_COORDINATION_PATH) {
    return path.resolve(process.env.CMS_SNAPSHOT_COORDINATION_PATH);
  }
  return path.join(process.cwd(), ".local-d1", "snapshot-coordination.json");
}

function readCoordinationState(): SnapshotCoordinationState {
  const filePath = getCoordinationFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<SnapshotCoordinationState>;
      return {
        generation: Number(parsed.generation || 1),
        updatedAtMs: Number(parsed.updatedAtMs || 0),
        tombstonedIds: parsed.tombstonedIds || {},
        tombstonedSlugs: parsed.tombstonedSlugs || {},
        tombstonedVideoIds: parsed.tombstonedVideoIds || {},
        tombstonedVideoSlugs: parsed.tombstonedVideoSlugs || {},
        videoGeneration: Number(parsed.videoGeneration || 1),
        videoUpdatedAtMs: Number(parsed.videoUpdatedAtMs || 0)
      };
    }
  } catch {
    // ignore read error
  }
  return {
    generation: 1,
    updatedAtMs: 0,
    tombstonedIds: {},
    tombstonedSlugs: {},
    tombstonedVideoIds: {},
    tombstonedVideoSlugs: {},
    videoGeneration: 1,
    videoUpdatedAtMs: 0
  };
}

function writeCoordinationState(state: SnapshotCoordinationState): void {
  const filePath = getCoordinationFilePath();
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmpFile = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(state), "utf8");
    fs.renameSync(tmpFile, filePath);
  } catch {
    // ignore write error on read-only fs
  }
}

/**
 * Coordinates snapshot invalidation and unpublish/archive/delete tombstones across all Node processes on the host.
 */
export function recordSnapshotMutation(params: {
  tombstoneId?: string;
  tombstoneSlug?: string;
  publishedProject?: CmsProjectRecord;
  clearAllSnapshots?: boolean;
}): void {
  const state = readCoordinationState();
  const now = Date.now();
  state.generation += 1;
  state.updatedAtMs = now;

  // Prune tombstones older than 24h
  const cutoff = now - 86400 * 1000;
  for (const [k, ts] of Object.entries(state.tombstonedIds)) {
    if (ts < cutoff) delete state.tombstonedIds[k];
  }
  for (const [k, ts] of Object.entries(state.tombstonedSlugs)) {
    if (ts < cutoff) delete state.tombstonedSlugs[k];
  }

  if (params.tombstoneId) {
    state.tombstonedIds[params.tombstoneId] = now;
  }
  if (params.tombstoneSlug) {
    state.tombstonedSlugs[params.tombstoneSlug] = now;
  }

  if (params.publishedProject && params.publishedProject.cmsStatus === "published") {
    delete state.tombstonedIds[params.publishedProject.id];
    delete state.tombstonedSlugs[params.publishedProject.slug];
  }

  writeCoordinationState(state);

  if (params.clearAllSnapshots) {
    lastKnownPublishedSnapshot = null;
    return;
  }

  if (lastKnownPublishedSnapshot) {
    let updatedList = lastKnownPublishedSnapshot.projects.filter(
      (p) => !state.tombstonedIds[p.id] && !state.tombstonedSlugs[p.slug]
    );
    if (params.publishedProject) {
      if (params.publishedProject.cmsStatus === "published") {
        const idx = updatedList.findIndex(
          (p) =>
            p.id === params.publishedProject!.id || p.slug === params.publishedProject!.slug
        );
        if (idx >= 0) {
          updatedList[idx] = params.publishedProject;
        } else {
          updatedList = [...updatedList, params.publishedProject].sort(
            (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
          );
        }
      } else {
        updatedList = updatedList.filter(
          (p) =>
            p.id !== params.publishedProject!.id && p.slug !== params.publishedProject!.slug
        );
      }
    }
    lastKnownPublishedSnapshot = {
      projects: updatedList,
      capturedAtMs: lastKnownPublishedSnapshot.capturedAtMs,
      generation: state.generation
    };
  }
}

function getValidCoordinatedSnapshot(): CmsProjectRecord[] | null {
  if (!lastKnownPublishedSnapshot) {
    return null;
  }
  const now = Date.now();
  if (now - lastKnownPublishedSnapshot.capturedAtMs > getSnapshotTtlMs()) {
    lastKnownPublishedSnapshot = null;
    return null;
  }
  const coord = readCoordinationState();
  // Filter out any project tombstoned (unpublished/archived/deleted) by any Node process
  return lastKnownPublishedSnapshot.projects.filter(
    (p) =>
      p.cmsStatus === "published" &&
      !coord.tombstonedIds[p.id] &&
      !coord.tombstonedSlugs[p.slug]
  );
}

function setVerifiedPublishedSnapshot(projects: CmsProjectRecord[]): void {
  const coord = readCoordinationState();
  const now = Date.now();
  // Clear tombstones for projects confirmed published by fresh upstream D1 read
  let coordChanged = false;
  for (const p of projects) {
    if (p.cmsStatus === "published") {
      if (coord.tombstonedIds[p.id]) {
        delete coord.tombstonedIds[p.id];
        coordChanged = true;
      }
      if (coord.tombstonedSlugs[p.slug]) {
        delete coord.tombstonedSlugs[p.slug];
        coordChanged = true;
      }
    }
  }
  if (coordChanged) {
    coord.updatedAtMs = now;
    writeCoordinationState(coord);
  }
  lastKnownPublishedSnapshot = {
    projects: projects.filter(
      (p) =>
        p.cmsStatus === "published" &&
        !coord.tombstonedIds[p.id] &&
        !coord.tombstonedSlugs[p.slug]
    ),
    capturedAtMs: now,
    generation: coord.generation
  };
}

function toLegacyCmsRecord(p: Project, index: number): CmsProjectRecord {
  return {
    ...p,
    cmsStatus: "published",
    featuredOrder: p.featuredOrder,
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
  if (mode === "local") {
    return false;
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
 * Public read with explicit health/degraded metadata:
 * - Pre-cutover (`CMS_DATA_SOURCE=legacy`): serves canonical `projectsData` from `src/data/projects.ts`.
 * - Post-cutover (`CMS_DATA_SOURCE=cloudflare`):
 *   - Queries Cloudflare Worker `/api/v1/public/projects`.
 *   - Updates coordinated `lastKnownPublishedSnapshot`.
 *   - If Worker becomes unreachable:
 *     - If a valid TTL-bounded snapshot exists, returns it with any tombstoned (unpublished/archived/deleted) projects stripped out (`source: "stale-verified-snapshot", degraded: true`).
 *     - If this is a fresh Node process (cold start) or the snapshot TTL expired, returns `projects: [], degraded: true, source: "degraded-cold-start-outage"` — NEVER silently reverting to static `src/data/projects.ts`.
 */
export async function getPublishedProjectsWithMeta(): Promise<PublishedProjectsReadResult> {
  const dataSource = getCmsDataSource();
  if (dataSource === "legacy") {
    return {
      projects: projectsData.map(toLegacyCmsRecord),
      degraded: false,
      source: "legacy-static"
    };
  }

  if (shouldUseWorkerApi()) {
    try {
      const res = await fetchWorkerJson<{ ok: boolean; projects: CmsProjectRecord[] }>(
        "/api/v1/public/projects"
      );
      const publishedOnly = (res.projects || []).filter((p) => p.cmsStatus === "published");
      setVerifiedPublishedSnapshot(publishedOnly);
      return {
        projects: getValidCoordinatedSnapshot() || publishedOnly,
        degraded: false,
        source: "cloudflare-worker-live"
      };
    } catch (error) {
      const errReason = error instanceof Error ? error.message : String(error);
      const validSnapshot = getValidCoordinatedSnapshot();
      if (validSnapshot !== null) {
        return {
          projects: validSnapshot,
          degraded: true,
          source: "stale-verified-snapshot",
          reason: errReason
        };
      }
      return {
        projects: [],
        degraded: true,
        source: "degraded-cold-start-outage",
        reason:
          "Cloudflare Worker is unreachable and no verified snapshot exists on this Node process."
      };
    }
  }

  const published = listPublishedProjectsFromD1().filter((p) => p.cmsStatus === "published");
  setVerifiedPublishedSnapshot(published);
  return {
    projects: getValidCoordinatedSnapshot() || published,
    degraded: false,
    source: "local-d1-live"
  };
}

export async function getPublishedProjects(): Promise<CmsProjectRecord[]> {
  const res = await getPublishedProjectsWithMeta();
  return res.projects;
}

/**
 * Public read: returns a single published project by slug.
 * Draft, unpublished, archived, and tombstoned projects always return null.
 */
export async function getPublishedProjectBySlug(slug: string): Promise<CmsProjectRecord | null> {
  const dataSource = getCmsDataSource();
  if (dataSource === "legacy") {
    const idx = projectsData.findIndex((p) => p.slug === slug);
    return idx >= 0 ? toLegacyCmsRecord(projectsData[idx], idx) : null;
  }

  const coord = readCoordinationState();
  if (coord.tombstonedSlugs[slug]) {
    return null;
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
      const validSnapshot = getValidCoordinatedSnapshot();
      if (validSnapshot) {
        return (
          validSnapshot.find((p) => p.slug === slug && p.cmsStatus === "published") || null
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
    const saved = res.project;
    if (saved.cmsStatus !== "published") {
      recordSnapshotMutation({
        tombstoneId: saved.id,
        tombstoneSlug: saved.slug,
        publishedProject: saved
      });
    } else {
      recordSnapshotMutation({ publishedProject: saved });
    }
    return saved;
  }

  assertLocalSimulationAllowed("saveAdminProject");
  const saved = upsertProjectLocal(input, actorEmail, actionLabel);
  if (saved.cmsStatus !== "published") {
    recordSnapshotMutation({
      tombstoneId: saved.id,
      tombstoneSlug: saved.slug,
      publishedProject: saved
    });
  } else {
    recordSnapshotMutation({ publishedProject: saved });
  }
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
    const updated = res.project;
    if (updated.cmsStatus !== "published") {
      recordSnapshotMutation({
        tombstoneId: updated.id,
        tombstoneSlug: updated.slug,
        publishedProject: updated
      });
    } else {
      recordSnapshotMutation({ publishedProject: updated });
    }
    return updated;
  }

  assertLocalSimulationAllowed("changeAdminProjectStatus");
  const updated = updateStatusLocal(idOrSlug, newStatus, actorEmail, notes);
  if (updated.cmsStatus !== "published") {
    recordSnapshotMutation({
      tombstoneId: updated.id,
      tombstoneSlug: updated.slug,
      publishedProject: updated
    });
  } else {
    recordSnapshotMutation({ publishedProject: updated });
  }
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
    recordSnapshotMutation({
      tombstoneId: res.deletedId,
      tombstoneSlug: res.slug
    });
    return { deletedId: res.deletedId, slug: res.slug };
  }

  assertLocalSimulationAllowed("removeAdminProject");
  const deleted = deleteProjectLocal(idOrSlug, actorEmail);
  recordSnapshotMutation({
    tombstoneId: deleted.deletedId,
    tombstoneSlug: deleted.slug
  });
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
    recordSnapshotMutation({ clearAllSnapshots: true });
    return;
  }

  assertLocalSimulationAllowed("updateFeaturedOrderingInD1");
  updateFeaturedLocal(workspace, featuredItems, actorEmail);
  recordSnapshotMutation({ clearAllSnapshots: true });
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
    const restored = res.project;
    if (restored.cmsStatus !== "published") {
      recordSnapshotMutation({
        tombstoneId: restored.id,
        tombstoneSlug: restored.slug,
        publishedProject: restored
      });
    } else {
      recordSnapshotMutation({ publishedProject: restored });
    }
    return restored;
  }

  assertLocalSimulationAllowed("rollbackProjectRevisionInD1");
  const restored = rollbackRevisionLocal(projectId, revisionNumber, actorEmail);
  if (restored.cmsStatus !== "published") {
    recordSnapshotMutation({
      tombstoneId: restored.id,
      tombstoneSlug: restored.slug,
      publishedProject: restored
    });
  } else {
    recordSnapshotMutation({ publishedProject: restored });
  }
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
  customStorageKey?: string;
  simulateD1Error?: boolean;
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
    if (params.customStorageKey) form.append("customStorageKey", params.customStorageKey);
    if (params.simulateD1Error) form.append("simulateD1Error", "true");

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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[getD1HealthAndStats] Failed to fetch worker health:", err);
      return {
        ok: false,
        mode: `cloudflare-${getCmsStorageMode()}-unreachable`,
        d1Connected: false,
        r2Connected: false,
        error: `Remote Worker Health Check Failed: ${message}`,
        storageMode: getCmsStorageMode(),
        dataSource: getCmsDataSource(),
        remoteWorkerUrl: getWorkerBaseUrl(),
        remoteServiceTokenConfigured: Boolean(getWorkerServiceToken()),
        counts: {
          total: 0,
          published: 0,
          draft: 0,
          archived: 0,
          featuredPublished: 0,
          mediaItems: 0,
          translations: 0,
          totalVideos: 0,
          publishedVideos: 0,
          draftVideos: 0,
          archivedVideos: 0,
          portraitVideos: 0,
          landscapeVideos: 0,
          aiAssistedVideos: 0
        },
        workspaceBreakdown: []
      };
    }
  }
  return getLocalD1HealthAndStats();
}

/**
 * Coordinates video snapshot invalidation and unpublish/archive/delete tombstones across all Node processes on the host.
 */
export function recordVideoSnapshotMutation(params: {
  tombstoneId?: string;
  tombstoneSlug?: string;
  publishedVideo?: PortfolioVideo | CmsVideoRecord;
  clearAllSnapshots?: boolean;
}): void {
  const state = readCoordinationState();
  const now = Date.now();
  state.videoGeneration = (state.videoGeneration || 1) + 1;
  state.videoUpdatedAtMs = now;
  if (!state.tombstonedVideoIds) state.tombstonedVideoIds = {};
  if (!state.tombstonedVideoSlugs) state.tombstonedVideoSlugs = {};

  // Prune tombstones older than 24h
  const cutoff = now - 86400 * 1000;
  for (const [k, ts] of Object.entries(state.tombstonedVideoIds)) {
    if (ts < cutoff) delete state.tombstonedVideoIds[k];
  }
  for (const [k, ts] of Object.entries(state.tombstonedVideoSlugs)) {
    if (ts < cutoff) delete state.tombstonedVideoSlugs[k];
  }

  if (params.tombstoneId) {
    state.tombstonedVideoIds[params.tombstoneId] = now;
  }
  if (params.tombstoneSlug) {
    state.tombstonedVideoSlugs[params.tombstoneSlug] = now;
  }

  if (params.publishedVideo && (params.publishedVideo as { cmsStatus?: string }).cmsStatus === "published") {
    delete state.tombstonedVideoIds[params.publishedVideo.id];
    delete state.tombstonedVideoSlugs[params.publishedVideo.slug];
  }

  writeCoordinationState(state);

  if (params.clearAllSnapshots) {
    lastKnownPublishedVideosSnapshot = null;
    return;
  }

  if (lastKnownPublishedVideosSnapshot) {
    let updatedList = lastKnownPublishedVideosSnapshot.videos.filter(
      (v) => !state.tombstonedVideoIds[v.id] && !state.tombstonedVideoSlugs[v.slug]
    );
    if (params.publishedVideo) {
      if ((params.publishedVideo as { cmsStatus?: string }).cmsStatus === "published") {
        const pVideo = params.publishedVideo as PortfolioVideo;
        const idx = updatedList.findIndex((v) => v.id === pVideo.id || v.slug === pVideo.slug);
        if (idx >= 0) {
          updatedList[idx] = pVideo;
        } else {
          updatedList.push(pVideo);
        }
        updatedList.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      } else {
        updatedList = updatedList.filter(
          (v) => v.id !== params.publishedVideo!.id && v.slug !== params.publishedVideo!.slug
        );
      }
    }
    lastKnownPublishedVideosSnapshot = {
      videos: updatedList,
      capturedAtMs: lastKnownPublishedVideosSnapshot.capturedAtMs,
      generation: state.videoGeneration
    };
  }
}

export function getValidCoordinatedVideosSnapshot(): PortfolioVideo[] | null {
  if (!lastKnownPublishedVideosSnapshot) {
    return null;
  }
  const now = Date.now();
  if (now - lastKnownPublishedVideosSnapshot.capturedAtMs > getVideoSnapshotTtlMs()) {
    lastKnownPublishedVideosSnapshot = null;
    return null;
  }
  const coord = readCoordinationState();
  const tombstonedIds = coord.tombstonedVideoIds || {};
  const tombstonedSlugs = coord.tombstonedVideoSlugs || {};
  return lastKnownPublishedVideosSnapshot.videos.filter(
    (v) => !tombstonedIds[v.id] && !tombstonedSlugs[v.slug]
  );
}

export function setVerifiedPublishedVideosSnapshot(videos: PortfolioVideo[]): void {
  const coord = readCoordinationState();
  const now = Date.now();
  if (!coord.tombstonedVideoIds) coord.tombstonedVideoIds = {};
  if (!coord.tombstonedVideoSlugs) coord.tombstonedVideoSlugs = {};

  let coordChanged = false;
  for (const v of videos) {
    if (coord.tombstonedVideoIds[v.id]) {
      delete coord.tombstonedVideoIds[v.id];
      coordChanged = true;
    }
    if (coord.tombstonedVideoSlugs[v.slug]) {
      delete coord.tombstonedVideoSlugs[v.slug];
      coordChanged = true;
    }
  }
  if (coordChanged) {
    coord.videoUpdatedAtMs = now;
    writeCoordinationState(coord);
  }

  const tombstonedIds = coord.tombstonedVideoIds;
  const tombstonedSlugs = coord.tombstonedVideoSlugs;
  lastKnownPublishedVideosSnapshot = {
    videos: videos.filter((v) => !tombstonedIds[v.id] && !tombstonedSlugs[v.slug]),
    capturedAtMs: now,
    generation: coord.videoGeneration || 1
  };
}

export function getVerifiedPublishedVideosSnapshot(): PortfolioVideo[] | null {
  return getValidCoordinatedVideosSnapshot();
}

export async function getPublishedVideosWithMeta(): Promise<{
  videos: PortfolioVideo[];
  degraded: boolean;
  source: string;
  reason?: string;
}> {
  const dataSource = getCmsDataSource();
  if (dataSource === "legacy") {
    return {
      videos: videosData,
      degraded: false,
      source: "legacy-static"
    };
  }

  if (shouldUseWorkerApi()) {
    try {
      const res = await fetchWorkerJson<{ ok: boolean; videos: PortfolioVideo[] }>(
        "/api/v1/public/videos",
        { cache: "no-store" }
      );
      const videos = Array.isArray(res.videos) ? res.videos : [];
      setVerifiedPublishedVideosSnapshot(videos);
      return {
        videos,
        degraded: false,
        source: "cloudflare-worker-live"
      };
    } catch (error) {
      const errReason = error instanceof Error ? error.message : String(error);
      // In remote CMS mode, when the remote Worker becomes unavailable, fail closed:
      // Do not serve unverified stale in-memory snapshots that may have been unpublished on remote hosts/Worker.
      return {
        videos: [],
        degraded: true,
        source: "degraded-worker-outage",
        reason: errReason
      };
    }
  }

  assertLocalSimulationAllowed("getPublishedVideos");
  const d1Videos = listPublishedVideosLocal();
  setVerifiedPublishedVideosSnapshot(d1Videos);
  return {
    videos: d1Videos,
    degraded: false,
    source: "local-d1-live"
  };
}

export async function getPublishedVideos(): Promise<PortfolioVideo[]> {
  const res = await getPublishedVideosWithMeta();
  return res.videos;
}

export async function getAdminVideos(): Promise<CmsVideoRecord[]> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("getAdminVideos");
    const res = await fetchWorkerJson<{ ok: boolean; videos: CmsVideoRecord[] }>(
      "/api/v1/admin/videos",
      { requireServiceAuth: true }
    );
    return res.videos || [];
  }

  assertLocalSimulationAllowed("getAdminVideos");
  return listVideosLocal();
}

export async function getAdminVideoById(id: string): Promise<CmsVideoRecord | null> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("getAdminVideoById");
    const res = await fetchWorkerJson<{ ok: boolean; video: CmsVideoRecord | null }>(
      `/api/v1/admin/videos/${encodeURIComponent(id)}`,
      { requireServiceAuth: true }
    );
    return res.video || null;
  }

  assertLocalSimulationAllowed("getAdminVideoById");
  return getVideoByIdLocal(id);
}

export async function getPublishedVideoBySlug(slug: string): Promise<PortfolioVideo | null> {
  const dataSource = getCmsDataSource();
  if (dataSource === "legacy") {
    return videosData.find((v) => v.slug === slug) || null;
  }

  if (shouldUseWorkerApi()) {
    try {
      const res = await fetchWorkerJson<{ ok: boolean; video: PortfolioVideo | null }>(
        `/api/v1/public/videos/${encodeURIComponent(slug)}`,
        { cache: "no-store" }
      );
      if (res.video) return res.video;
      return null;
    } catch {
      // In remote CMS mode, fail closed when Worker is unreachable
      return null;
    }
  }

  assertLocalSimulationAllowed("getPublishedVideoBySlug");
  const found = getVideoBySlugLocal(slug);
  if (found && found.cmsStatus === "published") return found;
  return null;
}

export async function saveAdminVideo(
  input: UpsertVideoInput,
  actorEmail: string,
  actionType: "create" | "update" = "update"
): Promise<CmsVideoRecord> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("saveAdminVideo");
    const isCreate = actionType === "create";
    const method = isCreate ? "POST" : (input.id ? "PUT" : "POST");
    const path = isCreate
      ? "/api/v1/admin/videos"
      : (input.id ? `/api/v1/admin/videos/${encodeURIComponent(input.id)}` : "/api/v1/admin/videos");
    const res = await fetchWorkerJson<{ ok: boolean; video: CmsVideoRecord }>(path, {
      method,
      requireServiceAuth: true,
      actorEmail,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, actionType })
    });
    const saved = res.video;
    if (saved.cmsStatus !== "published") {
      recordVideoSnapshotMutation({
        tombstoneId: saved.id,
        tombstoneSlug: saved.slug,
        publishedVideo: saved
      });
    } else {
      recordVideoSnapshotMutation({ publishedVideo: saved });
    }
    return saved;
  }

  assertLocalSimulationAllowed("saveAdminVideo");
  const saved = upsertVideoLocal(input, actorEmail, actionType);
  if (saved.cmsStatus !== "published") {
    recordVideoSnapshotMutation({
      tombstoneId: saved.id,
      tombstoneSlug: saved.slug,
      publishedVideo: saved
    });
  } else {
    recordVideoSnapshotMutation({ publishedVideo: saved });
  }
  return saved;
}

export async function deleteAdminVideo(
  id: string,
  actorEmail: string
): Promise<{ deletedId: string }> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("deleteAdminVideo");
    const res = await fetchWorkerJson<{ ok: boolean; deletedId: string; slug?: string }>(
      `/api/v1/admin/videos/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        requireServiceAuth: true,
        actorEmail
      }
    );
    recordVideoSnapshotMutation({
      tombstoneId: res.deletedId,
      tombstoneSlug: res.slug
    });
    return { deletedId: res.deletedId };
  }

  assertLocalSimulationAllowed("deleteAdminVideo");
  const deleted = deleteVideoLocal(id, actorEmail);
  recordVideoSnapshotMutation({
    tombstoneId: deleted.deletedId,
    tombstoneSlug: (deleted as { deletedId: string; slug?: string }).slug
  });
  return deleted;
}

export async function updateVideoOrderingInD1(
  orderings: { id: string; sortOrder: number }[],
  actorEmail: string
): Promise<{ updatedCount: number }> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("updateVideoOrderingInD1");
    const res = await fetchWorkerJson<{ ok: boolean; updatedCount: number }>(
      "/api/v1/admin/videos/reorder",
      {
        method: "POST",
        requireServiceAuth: true,
        actorEmail,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderings })
      }
    );
    recordVideoSnapshotMutation({ clearAllSnapshots: true });
    return { updatedCount: res.updatedCount };
  }

  assertLocalSimulationAllowed("updateVideoOrderingInD1");
  const res = updateVideoOrderingLocal(orderings, actorEmail);
  recordVideoSnapshotMutation({ clearAllSnapshots: true });
  return res;
}

export async function listVideoRevisionsFromD1(videoId: string): Promise<CmsVideoRevisionRecord[]> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("listVideoRevisionsFromD1");
    const res = await fetchWorkerJson<{ ok: boolean; revisions: CmsVideoRevisionRecord[] }>(
      `/api/v1/admin/videos/${encodeURIComponent(videoId)}/revisions`,
      { requireServiceAuth: true }
    );
    return res.revisions || [];
  }

  assertLocalSimulationAllowed("listVideoRevisionsFromD1");
  return listVideoRevisionsLocal(videoId);
}

export async function rollbackVideoRevisionInD1(
  videoId: string,
  revisionNumber: number,
  actorEmail: string
): Promise<CmsVideoRecord> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("rollbackVideoRevisionInD1");
    const res = await fetchWorkerJson<{ ok: boolean; video: CmsVideoRecord }>(
      `/api/v1/admin/videos/${encodeURIComponent(videoId)}/revisions`,
      {
        method: "POST",
        requireServiceAuth: true,
        actorEmail,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionNumber })
      }
    );
    const restored = res.video;
    if (restored.cmsStatus !== "published") {
      recordVideoSnapshotMutation({
        tombstoneId: restored.id,
        tombstoneSlug: restored.slug,
        publishedVideo: restored
      });
    } else {
      recordVideoSnapshotMutation({ publishedVideo: restored });
    }
    return restored;
  }

  assertLocalSimulationAllowed("rollbackVideoRevisionInD1");
  const restored = rollbackVideoRevisionLocal(videoId, revisionNumber, actorEmail);
  if (restored.cmsStatus !== "published") {
    recordVideoSnapshotMutation({
      tombstoneId: restored.id,
      tombstoneSlug: restored.slug,
      publishedVideo: restored
    });
  } else {
    recordVideoSnapshotMutation({ publishedVideo: restored });
  }
  return restored;
}

export async function uploadVideoAsset(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  videoId?: string | null;
  videoSlug: string;
  assetType: "video" | "poster" | "thumbnail";
  actorEmail: string;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
}): Promise<CmsVideoAssetRecord> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("uploadVideoAsset");
    const workerUrl = (process.env.CLOUDFLARE_CMS_API_URL || "").trim().replace(/\/$/, "");
    const serviceToken = (process.env.CLOUDFLARE_API_SERVICE_TOKEN || "").trim();

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(params.buffer)], { type: params.mimeType });
    formData.append("file", blob, params.filename);
    formData.append("assetType", params.assetType);
    formData.append("videoSlug", params.videoSlug);
    if (params.videoId) formData.append("videoId", params.videoId);

    const res = await fetch(`${workerUrl}/api/v1/admin/videos/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        "X-Actor-Email": params.actorEmail
      },
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Worker video upload failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as { ok: boolean; asset: CmsVideoAssetRecord };
    return data.asset;
  }

  assertLocalSimulationAllowed("uploadVideoAsset");
  return uploadVideoAssetLocal(params);
}

export async function seedCanonicalVideosInLocalD1(
  force = false
): Promise<{ insertedCount: number; skippedCount: number; totalVideos: number }> {
  assertLocalSimulationAllowed("seedCanonicalVideosInLocalD1");
  return seedCanonicalVideosLocal(force);
}

export async function reconcileCanonicalProjectsWithD1() {
  try {
    const projects = await getAdminProjects();
    return reconcileProjectsListWithCanonical(projects);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[reconcileCanonicalProjectsWithD1] Reconciliation failed:", err);
    return {
      checkCompleted: false,
      status: "unexecuted" as const,
      canonicalCount: 30,
      d1TotalCount: 0,
      missingSlugs: [] as string[],
      nonCanonicalSlugs: [] as string[],
      fieldMismatches: [] as { slug: string; field: string; expected: unknown; actual: unknown }[],
      reconciled: false,
      error: `Reconciliation check failed: ${message}`
    };
  }
}

export async function reconcileCanonicalVideosWithD1() {
  try {
    const videos = await getAdminVideos();
    return reconcileVideosListWithCanonical(videos);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[reconcileCanonicalVideosWithD1] Video reconciliation failed:", err);
    return {
      checkCompleted: false,
      status: "unexecuted" as const,
      canonicalCount: videosData.length,
      d1TotalCount: 0,
      missingSlugs: [] as string[],
      nonCanonicalSlugs: [] as string[],
      fieldMismatches: [] as { slug: string; field: string; expected: unknown; actual: unknown }[],
      reconciled: false,
      error: `Video reconciliation check failed: ${message}`
    };
  }
}

// ============================================================
// Personal Gallery Functions (Additive Phase 4)
// ============================================================

export async function getPublishedGalleryWithMeta(): Promise<{
  gallery: GalleryItem[];
  degraded: boolean;
  source: string;
  reason?: string;
}> {
  const dataSource = getCmsDataSource();
  if (dataSource === "legacy") {
    return {
      gallery: galleryItems,
      degraded: false,
      source: "legacy-static"
    };
  }

  if (shouldUseWorkerApi()) {
    try {
      const res = await fetchWorkerJson<{ ok: boolean; gallery: GalleryItem[] }>(
        "/api/v1/public/gallery",
        { cache: "no-store" }
      );
      const items = Array.isArray(res.gallery) ? res.gallery : [];
      return {
        gallery: items,
        degraded: false,
        source: "cloudflare-worker-live"
      };
    } catch (error) {
      const errReason = error instanceof Error ? error.message : String(error);
      return {
        gallery: [],
        degraded: true,
        source: "degraded-worker-outage",
        reason: errReason
      };
    }
  }

  assertLocalSimulationAllowed("getPublishedGallery");
  const d1Items = listPublishedGalleryLocal();
  return {
    gallery: d1Items,
    degraded: false,
    source: "local-d1-live"
  };
}

export async function getPublishedGallery(): Promise<GalleryItem[]> {
  const res = await getPublishedGalleryWithMeta();
  return res.gallery;
}

export async function getAdminGalleryItems(): Promise<CmsGalleryItem[]> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("getAdminGalleryItems");
    const res = await fetchWorkerJson<{ ok: boolean; gallery: CmsGalleryItem[] }>(
      "/api/v1/admin/gallery",
      { requireServiceAuth: true }
    );
    return res.gallery || [];
  }

  assertLocalSimulationAllowed("getAdminGalleryItems");
  return listGalleryLocal();
}

export async function getAdminGalleryItemById(id: string): Promise<CmsGalleryItem | null> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("getAdminGalleryItemById");
    const res = await fetchWorkerJson<{ ok: boolean; item: CmsGalleryItem | null }>(
      `/api/v1/admin/gallery/${encodeURIComponent(id)}`,
      { requireServiceAuth: true }
    );
    return res.item || null;
  }

  assertLocalSimulationAllowed("getAdminGalleryItemById");
  return getGalleryItemByIdLocal(id);
}

export async function upsertGalleryItem(
  input: UpsertGalleryItemInput,
  actorEmail: string,
  actionLabel = "update"
): Promise<CmsGalleryItem> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("upsertGalleryItem");
    const isCreate = actionLabel === "create" || !input.id;
    const url = isCreate ? "/api/v1/admin/gallery" : `/api/v1/admin/gallery/${encodeURIComponent(input.id!)}`;
    const method = isCreate ? "POST" : "PUT";
    const res = await fetchWorkerJson<{ ok: boolean; item: CmsGalleryItem }>(url, {
      method,
      body: JSON.stringify(input),
      requireServiceAuth: true,
      headers: { "Content-Type": "application/json" }
    });
    return res.item;
  }

  assertLocalSimulationAllowed("upsertGalleryItem");
  return upsertGalleryItemLocal(input, actorEmail, actionLabel);
}

export async function deleteGalleryItem(
  id: string,
  actorEmail: string
): Promise<{ deletedId: string }> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("deleteGalleryItem");
    const res = await fetchWorkerJson<{ ok: boolean; deletedId: string }>(
      `/api/v1/admin/gallery/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        requireServiceAuth: true
      }
    );
    return { deletedId: res.deletedId || id };
  }

  assertLocalSimulationAllowed("deleteGalleryItem");
  return deleteGalleryItemLocal(id, actorEmail);
}

export async function updateGalleryOrdering(
  items: Array<{ id: string; sortOrder: number }>,
  actorEmail: string
): Promise<{ updated: number }> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("updateGalleryOrdering");
    const res = await fetchWorkerJson<{ ok: boolean; updated: number }>(
      "/api/v1/admin/gallery/reorder",
      {
        method: "POST",
        body: JSON.stringify({ items }),
        requireServiceAuth: true,
        headers: { "Content-Type": "application/json" }
      }
    );
    return { updated: res.updated || 0 };
  }

  assertLocalSimulationAllowed("updateGalleryOrdering");
  return updateGalleryOrderingLocal(items, actorEmail);
}

export async function listGalleryRevisions(itemId: string): Promise<CmsGalleryRevisionRecord[]> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("listGalleryRevisions");
    const res = await fetchWorkerJson<{ ok: boolean; revisions: CmsGalleryRevisionRecord[] }>(
      `/api/v1/admin/gallery/${encodeURIComponent(itemId)}/revisions`,
      { requireServiceAuth: true }
    );
    return res.revisions || [];
  }

  assertLocalSimulationAllowed("listGalleryRevisions");
  return listGalleryRevisionsLocal(itemId);
}

export async function rollbackGalleryRevision(
  itemId: string,
  revisionNumber: number,
  actorEmail: string
): Promise<CmsGalleryItem> {
  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("rollbackGalleryRevision");
    const res = await fetchWorkerJson<{ ok: boolean; item: CmsGalleryItem }>(
      `/api/v1/admin/gallery/${encodeURIComponent(itemId)}/rollback`,
      {
        method: "POST",
        body: JSON.stringify({ revisionNumber }),
        requireServiceAuth: true,
        headers: { "Content-Type": "application/json" }
      }
    );
    return res.item;
  }

  assertLocalSimulationAllowed("rollbackGalleryRevision");
  return rollbackGalleryRevisionLocal(itemId, revisionNumber, actorEmail);
}

export async function uploadGalleryAsset(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  itemId?: string | null;
  actorEmail: string;
  width?: number | null;
  height?: number | null;
}): Promise<CmsGalleryAssetRecord> {
  const sigCheck = validateGalleryImageSignature(params.buffer, params.mimeType, params.filename);
  if (!sigCheck.valid) {
    throw new Error(sigCheck.error || "Invalid gallery image signature");
  }

  if (shouldUseWorkerApi()) {
    requireWorkerConfigForMutation("uploadGalleryAsset");
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(params.buffer)], { type: params.mimeType });
    formData.append("file", blob, params.filename);
    if (params.itemId) formData.append("itemId", params.itemId);
    if (params.width) formData.append("width", String(params.width));
    if (params.height) formData.append("height", String(params.height));

    const workerUrl = `${process.env.CLOUDFLARE_CMS_API_URL!.replace(/\/+$/, "")}/api/v1/admin/gallery/upload`;
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "CF-Access-Client-Id": process.env.CLOUDFLARE_API_SERVICE_TOKEN || "",
        "CF-Access-Client-Secret": process.env.CLOUDFLARE_API_SERVICE_SECRET || ""
      },
      body: formData
    });
    if (!response.ok) {
      throw new Error(`Worker gallery upload failed: HTTP ${response.status}`);
    }
    const data = (await response.json()) as { ok: boolean; asset: CmsGalleryAssetRecord };
    return data.asset;
  }

  assertLocalSimulationAllowed("uploadGalleryAsset");
  return uploadGalleryAssetLocal(params);
}

export const saveAdminGalleryItem = upsertGalleryItem;
export const deleteAdminGalleryItem = deleteGalleryItem;
export const updateGalleryOrderingInD1 = updateGalleryOrdering;
export const listGalleryRevisionsFromD1 = listGalleryRevisions;
export const rollbackGalleryRevisionInD1 = rollbackGalleryRevision;

export { getCmsStorageMode, getCmsDataSource };
