import { Project, WorkspaceId } from "@/data/projects";

/**
 * Returns all featured projects for a specific workspace, sorted by featuredOrder (or sortOrder fallback).
 */
export function getFeaturedProjects(
  projects: Project[],
  workspaceId: WorkspaceId
): Project[] {
  return projects
    .filter(
      (p) =>
        ((p.workspaceId || p.workspace) === workspaceId) &&
        p.featured === true
    )
    .sort((a, b) => {
      const orderA = a.featuredOrder ?? a.sortOrder ?? 9999;
      const orderB = b.featuredOrder ?? b.sortOrder ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return a.slug.localeCompare(b.slug);
    });
}

/**
 * Returns curated featured projects for the Desktop Workspace home screen (up to limit, default 16).
 */
export function getFeaturedProjectsForDesktop(
  projects: Project[],
  workspaceId: WorkspaceId,
  limit: number = 16
): Project[] {
  return getFeaturedProjects(projects, workspaceId).slice(0, limit);
}

/**
 * Returns curated featured projects for the Mobile Workspace home screen (count based on viewport width).
 */
export function getFeaturedProjectsForMobile(
  projects: Project[],
  workspaceId: WorkspaceId,
  viewportWidth: number = 390
): Project[] {
  let limit = 5;
  if (viewportWidth <= 375) {
    limit = 4;
  } else if (viewportWidth <= 430) {
    limit = 5;
  } else if (viewportWidth < 768) {
    limit = 6;
  } else {
    limit = 8; // Tablet
  }

  return getFeaturedProjects(projects, workspaceId).slice(0, limit);
}

/**
 * Returns all projects for a specific workspace (for Projects app archive filtering).
 */
export function getAllProjectsForWorkspace(
  projects: Project[],
  workspaceId: WorkspaceId
): Project[] {
  return projects
    .filter((p) => (p.workspaceId || p.workspace) === workspaceId)
    .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
}

/**
 * Returns all projects in the portfolio (complete portfolio archive).
 */
export function getAllProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
}
