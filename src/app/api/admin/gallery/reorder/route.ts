import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  updateGalleryOrderingInD1,
  getAdminGalleryItems
} from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    let body: {
      items?: { id: string; sortOrder: number }[];
      orderings?: { id: string; sortOrder: number }[];
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const itemsToReorder = body.items || body.orderings;
    if (!Array.isArray(itemsToReorder)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid items array" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const result = await updateGalleryOrderingInD1(itemsToReorder, auth.session.email);
    const updated = await getAdminGalleryItems();

    return NextResponse.json(
      {
        ok: true,
        updatedCount: result.updated,
        gallery: updated
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to reorder gallery";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
