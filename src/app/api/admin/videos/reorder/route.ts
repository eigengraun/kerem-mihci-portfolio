import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import { updateVideoOrderingInD1, getAdminVideos } from "@/lib/portfolio/repository";
import {
  CmsStorageUnavailableError,
  calculateVideoCompleteness
} from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    let body: { orderings?: { id: string; sortOrder: number }[] };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!Array.isArray(body.orderings)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid 'orderings' array" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const result = await updateVideoOrderingInD1(body.orderings, auth.session.email);
    const updated = await getAdminVideos();

    return NextResponse.json(
      {
        ok: true,
        updatedCount: result.updatedCount,
        videos: updated.map((v) => ({
          ...v,
          completeness: calculateVideoCompleteness(v)
        }))
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 400;
    const message = error instanceof Error ? error.message : "Failed to reorder videos";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
