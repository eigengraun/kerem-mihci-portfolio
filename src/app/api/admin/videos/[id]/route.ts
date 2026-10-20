import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminVideoById,
  saveAdminVideo,
  deleteAdminVideo,
  listVideoRevisionsFromD1,
  rollbackVideoRevisionInD1
} from "@/lib/portfolio/repository";
import {
  CmsStorageUnavailableError,
  calculateVideoCompleteness,
  type CmsPublishStatus,
  type UpsertVideoInput
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
    const video = await getAdminVideoById(decodeURIComponent(id));
    if (!video) {
      return NextResponse.json(
        { ok: false, error: "Video not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const revisions = await listVideoRevisionsFromD1(video.id);
    return NextResponse.json(
      {
        ok: true,
        video: {
          ...video,
          completeness: calculateVideoCompleteness(video)
        },
        revisions
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to fetch video";
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
    let body: UpsertVideoInput & { status?: CmsPublishStatus };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const saved = await saveAdminVideo(
      {
        ...body,
        id: body.id || decodeURIComponent(id),
        cmsStatus: body.cmsStatus || body.status
      },
      auth.session.email,
      "update"
    );
    const revisions = await listVideoRevisionsFromD1(saved.id);
    return NextResponse.json(
      {
        ok: true,
        video: {
          ...saved,
          completeness: calculateVideoCompleteness(saved)
        },
        revisions
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 400;
    const message = error instanceof Error ? error.message : "Failed to update video";
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

    const decodedId = decodeURIComponent(id);

    if (typeof body.rollbackRevisionNumber === "number") {
      const restored = await rollbackVideoRevisionInD1(
        decodedId,
        body.rollbackRevisionNumber,
        auth.session.email
      );
      const revisions = await listVideoRevisionsFromD1(restored.id);
      return NextResponse.json(
        {
          ok: true,
          video: {
            ...restored,
            completeness: calculateVideoCompleteness(restored)
          },
          revisions
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const desiredStatus = body.cmsStatus || body.status;
    if (!desiredStatus || !["draft", "published", "archived"].includes(desiredStatus)) {
      return NextResponse.json(
        { ok: false, error: "Invalid status value. Must be 'draft', 'published', or 'archived'." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const existing = await getAdminVideoById(decodedId);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Video not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const updated = await saveAdminVideo(
      {
        ...existing,
        cmsStatus: desiredStatus
      },
      auth.session.email,
      "update"
    );
    const revisions = await listVideoRevisionsFromD1(updated.id);
    return NextResponse.json(
      {
        ok: true,
        video: {
          ...updated,
          completeness: calculateVideoCompleteness(updated)
        },
        revisions
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 400;
    const message = error instanceof Error ? error.message : "Failed to change video status";
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
    const result = await deleteAdminVideo(decodeURIComponent(id), auth.session.email);
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 400;
    const message = error instanceof Error ? error.message : "Failed to delete video";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
