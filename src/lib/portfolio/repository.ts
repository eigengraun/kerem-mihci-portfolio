import { projectsData, type Project } from "@/data/projects";
import {
  getPublishedProjectBySlugFromD1,
  listAllProjectsForAdminFromD1,
  listPublishedProjectsFromD1,
  getProjectByIdOrSlugForAdminFromD1,
  upsertProjectInD1,
  updateProjectStatusInD1,
  deleteProjectInD1,
  updateFeaturedOrderingInD1,
  listProjectRevisionsFromD1,
  rollbackProjectRevisionInD1,
  listAuditLogsFromD1,
  listPublishingEventsFromD1,
  uploadMediaToR2AndD1,
  listMediaFromD1,
  deleteMediaFromD1AndR2,
  getD1HealthAndStats,
  reconcileCanonicalProjectsWithD1
} from "./d1Engine";
import type { CmsProjectRecord, CmsPublishStatus, UpsertProjectInput } from "./types";

function toLegacyCmsRecord(p: Project, index: number): CmsProjectRecord {
  return {
    ...p,
    cmsStatus: "published",
    featuredOrder: p.featured ? index + 1 : 0,
    sortOrder: index + 1,
    createdAt: "2025-01-15T12:00:00.000Z",
    updatedAt: "2025-01-15T12:00:00.000Z",
    publishedAt: "2025-01-15T12:00:00.000Z",
    archivedAt: null
  };
}

/**
 * Returns all published projects for public routes (/tr, /en, /sitemap.xml, /api/projects).
 * Reads from D1 database (and/or remote Cloudflare Worker if configured), with safe fallback to legacy static data if D1 fails.
 */
export async function getPublishedProjects(): Promise<CmsProjectRecord[]> {
  if (process.env.CMS_DATA_SOURCE === "legacy") {
    return projectsData.map(toLegacyCmsRecord);
  }

  try {
    return listPublishedProjectsFromD1();
  } catch (error) {
    console.error("[portfolio/repository] Failed to read published projects from D1, falling back to legacy:", error);
    return projectsData.map(toLegacyCmsRecord);
  }
}

/**
 * Returns a single published project by slug for public /tr/project/[slug] and /en/project/[slug].
 * Draft and archived projects return null.
 */
export async function getPublishedProjectBySlug(slug: string): Promise<CmsProjectRecord | null> {
  if (process.env.CMS_DATA_SOURCE === "legacy") {
    const idx = projectsData.findIndex((p) => p.slug === slug);
    return idx >= 0 ? toLegacyCmsRecord(projectsData[idx], idx) : null;
  }

  try {
    return getPublishedProjectBySlugFromD1(slug);
  } catch (error) {
    console.error(`[portfolio/repository] Failed to read project "${slug}" from D1, falling back to legacy:`, error);
    const idx = projectsData.findIndex((p) => p.slug === slug);
    return idx >= 0 ? toLegacyCmsRecord(projectsData[idx], idx) : null;
  }
}

/**
 * Admin-only repository methods
 */
export async function getAdminProjects(): Promise<CmsProjectRecord[]> {
  return listAllProjectsForAdminFromD1();
}

export async function getAdminProjectByIdOrSlug(idOrSlug: string): Promise<CmsProjectRecord | null> {
  return getProjectByIdOrSlugForAdminFromD1(idOrSlug);
}

export async function saveAdminProject(
  input: UpsertProjectInput & { status?: string },
  actorEmail: string,
  actionLabel = "update"
): Promise<CmsProjectRecord> {
  return upsertProjectInD1(input, actorEmail, actionLabel);
}

export async function changeAdminProjectStatus(
  idOrSlug: string,
  newStatus: CmsPublishStatus,
  actorEmail: string,
  notes?: string
): Promise<CmsProjectRecord> {
  return updateProjectStatusInD1(idOrSlug, newStatus, actorEmail, notes);
}

export async function removeAdminProject(idOrSlug: string, actorEmail: string) {
  return deleteProjectInD1(idOrSlug, actorEmail);
}

export {
  updateFeaturedOrderingInD1,
  listProjectRevisionsFromD1,
  rollbackProjectRevisionInD1,
  listAuditLogsFromD1,
  listPublishingEventsFromD1,
  uploadMediaToR2AndD1,
  listMediaFromD1,
  deleteMediaFromD1AndR2,
  getD1HealthAndStats,
  reconcileCanonicalProjectsWithD1
};
