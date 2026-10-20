import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminGalleryItemById,
  saveAdminGalleryItem,
  deleteAdminGalleryItem,
  listGalleryRevisionsFromD1
} from "@/lib/portfolio/repository";
import {
  CmsStorageUnavailableError,
  type CmsPublishStatus,
  type UpsertGalleryItemInput
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
    const item = await getAdminGalleryItemById(decodeURIComponent(id));
    if (!item) {
      return NextResponse.json(
        { ok: false, error: "Gallery item not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const revisions = await listGalleryRevisionsFromD1(item.id);
    return NextResponse.json(
      {
        ok: true,
        item,
        revisions
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to fetch gallery item";
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
    let body: UpsertGalleryItemInput & { status?: CmsPublishStatus };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const saved = await saveAdminGalleryItem(
      {
        ...body,
        id: body.id || decodeURIComponent(id),
        cmsStatus: body.cmsStatus || body.status
      },
      auth.session.email,
      "update"
    );
    const revisions = await listGalleryRevisionsFromD1(saved.id);
    return NextResponse.json(
      {
        ok: true,
        item: saved,
        revisions
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    const status =
      err instanceof CmsStorageUnavailableError
        ? 503
        : typeof err.statusCode === "number"
        ? err.statusCode
        : 400;
    const message = err.message || "Failed to update gallery item";
    return NextResponse.json(
      { ok: false, error: message, code: err.code },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await context.params;
  try {
    const decodedId = decodeURIComponent(id);
    const result = await deleteAdminGalleryItem(decodedId, auth.session.email);
    return NextResponse.json(
      { ok: true, deletedId: result.deletedId },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    const status =
      err instanceof CmsStorageUnavailableError
        ? 503
        : typeof err.statusCode === "number"
        ? err.statusCode
        : 400;
    const message = err.message || "Failed to delete gallery item";
    return NextResponse.json(
      { ok: false, error: message, code: err.code },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
