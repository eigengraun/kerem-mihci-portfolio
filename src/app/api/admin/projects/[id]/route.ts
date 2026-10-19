import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminProjectByIdOrSlug,
  saveAdminProject,
  changeAdminProjectStatus,
  removeAdminProject,
  listProjectRevisionsFromD1,
  rollbackProjectRevisionInD1
} from "@/lib/portfolio/repository";
import {
  CmsStorageUnavailableError,
  calculateProjectCompleteness,
  type CmsPublishStatus,
  type UpsertProjectInput
} from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await context.params;
  try {
    const project = await getAdminProjectByIdOrSlug(decodeURIComponent(id));
    if (!project) {
      return NextResponse.json(
        { ok: false, error: "Project not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const revisions = await listProjectRevisionsFromD1(project.id);
    return NextResponse.json(
      {
        ok: true,
        project: {
          ...project,
          status: project.cmsStatus,
          completeness: calculateProjectCompleteness(project)
        },
        revisions
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to fetch project";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await context.params;
  try {
    let body: UpsertProjectInput & { status?: CmsPublishStatus };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const saved = await saveAdminProject(
      {
        ...body,
        id: body.id || decodeURIComponent(id),
        cmsStatus: body.cmsStatus || body.status
      },
      auth.session.email,
      "update"
    );
    const revisions = await listProjectRevisionsFromD1(saved.id);
    return NextResponse.json(
      {
        ok: true,
        project: {
          ...saved,
          status: saved.cmsStatus,
          completeness: calculateProjectCompleteness(saved)
        },
        revisions
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 400;
    const message = error instanceof Error ? error.message : "Failed to update project";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await context.params;
  try {
    let body: {
      status?: CmsPublishStatus;
      cmsStatus?: CmsPublishStatus;
      notes?: string;
      rollbackRevisionNumber?: number;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (typeof body.rollbackRevisionNumber === "number") {
      const target = await getAdminProjectByIdOrSlug(decodeURIComponent(id));
      if (!target) {
        return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
      }
      const restored = await rollbackProjectRevisionInD1(
        target.id,
        body.rollbackRevisionNumber,
        auth.session.email
      );
      return NextResponse.json(
        {
          ok: true,
          project: {
            ...restored,
            status: restored.cmsStatus,
            completeness: calculateProjectCompleteness(restored)
          },
          revisions: await listProjectRevisionsFromD1(restored.id)
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const desiredStatus = body.cmsStatus || body.status;
    if (!desiredStatus || !["draft", "published", "archived"].includes(desiredStatus)) {
      return NextResponse.json(
        { ok: false, error: "Invalid status value." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const updated = await changeAdminProjectStatus(
      decodeURIComponent(id),
      desiredStatus,
      auth.session.email,
      body.notes
    );
    return NextResponse.json(
      {
        ok: true,
        project: {
          ...updated,
          status: updated.cmsStatus,
          completeness: calculateProjectCompleteness(updated)
        },
        revisions: await listProjectRevisionsFromD1(updated.id)
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 400;
    const message = error instanceof Error ? error.message : "Failed to change project status";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await context.params;
  try {
    const result = await removeAdminProject(decodeURIComponent(id), auth.session.email);
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 400;
    const message = error instanceof Error ? error.message : "Failed to delete project";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
