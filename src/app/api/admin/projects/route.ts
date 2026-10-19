import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminProjects,
  saveAdminProject,
  getD1HealthAndStats,
  updateFeaturedOrderingInD1
} from "@/lib/portfolio/repository";
import {
  CmsStorageUnavailableError,
  calculateProjectCompleteness,
  type CmsPublishStatus,
  type UpsertProjectInput,
  type WorkspaceCategory
} from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const projects = await getAdminProjects();
    const projectsWithCompleteness = projects.map((p) => ({
      ...p,
      status: p.cmsStatus,
      completeness: calculateProjectCompleteness(p)
    }));
    const health = await getD1HealthAndStats();

    return NextResponse.json(
      {
        ok: true,
        projects: projectsWithCompleteness,
        health
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to load admin projects";
    return NextResponse.json(
      {
        ok: false,
        code: error instanceof CmsStorageUnavailableError ? error.code : "ADMIN_PROJECTS_ERROR",
        error: message
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    let body: UpsertProjectInput & {
      status?: CmsPublishStatus;
      actionType?: "create" | "update" | "reorder-featured";
      workspace?: WorkspaceCategory;
      featuredItems?: { id: string; featured: boolean; featuredOrder: number }[];
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (
      body.actionType === "reorder-featured" &&
      body.workspace &&
      Array.isArray(body.featuredItems)
    ) {
      await updateFeaturedOrderingInD1(
        body.workspace,
        body.featuredItems,
        auth.session.email
      );
      const updated = await getAdminProjects();
      return NextResponse.json(
        { ok: true, projects: updated },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const saved = await saveAdminProject(
      {
        ...body,
        cmsStatus: body.cmsStatus || body.status || "draft"
      },
      auth.session.email,
      body.actionType || (body.id ? "update" : "create")
    );
    return NextResponse.json(
      {
        ok: true,
        project: {
          ...saved,
          status: saved.cmsStatus,
          completeness: calculateProjectCompleteness(saved)
        }
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 400;
    const message = error instanceof Error ? error.message : "Failed to save project";
    return NextResponse.json(
      {
        ok: false,
        code: error instanceof CmsStorageUnavailableError ? error.code : "PROJECT_MUTATION_ERROR",
        error: message
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
