import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminGalleryItems,
  saveAdminGalleryItem,
  updateGalleryOrderingInD1,
  getD1HealthAndStats
} from "@/lib/portfolio/repository";
import {
  CmsStorageUnavailableError,
  type CmsPublishStatus,
  type UpsertGalleryItemInput
} from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const gallery = await getAdminGalleryItems();
    const health = await getD1HealthAndStats();

    return NextResponse.json(
      {
        ok: true,
        gallery,
        health
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to load admin gallery";
    return NextResponse.json(
      {
        ok: false,
        code: error instanceof CmsStorageUnavailableError ? error.code : "ADMIN_GALLERY_ERROR",
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
    let body: UpsertGalleryItemInput & {
      actionType?: "create" | "update" | "reorder";
      orderings?: { id: string; sortOrder: number }[];
      status?: CmsPublishStatus;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (body.actionType === "reorder" && Array.isArray(body.orderings)) {
      const result = await updateGalleryOrderingInD1(body.orderings, auth.session.email);
      const updated = await getAdminGalleryItems();
      return NextResponse.json(
        {
          ok: true,
          updatedCount: result.updated,
          gallery: updated
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const actionType: "create" | "update" =
      body.actionType === "update" ? "update" : "create";

    const saved = await saveAdminGalleryItem(
      {
        ...body,
        cmsStatus: body.cmsStatus || body.status || "draft"
      },
      auth.session.email,
      actionType
    );

    return NextResponse.json(
      {
        ok: true,
        item: saved
      },
      { status: actionType === "create" ? 201 : 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    const err = error as Error & { statusCode?: number; code?: string };
    const status =
      err instanceof CmsStorageUnavailableError
        ? 503
        : typeof err.statusCode === "number"
        ? err.statusCode
        : 400;
    return NextResponse.json(
      {
        ok: false,
        code: err.code || (err instanceof CmsStorageUnavailableError ? err.code : "GALLERY_SAVE_ERROR"),
        error: err.message || "Failed to save gallery item"
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
