import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import { updateWorkspaceNotesOrdering } from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    let body: { items: Array<{ id: string; sortOrder: number }> };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!Array.isArray(body.items)) {
      return NextResponse.json(
        { ok: false, error: "items array is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const result = await updateWorkspaceNotesOrdering(body.items, auth.session.email);
    return NextResponse.json(
      { ok: true, updatedCount: result.updated },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to reorder workspace notes";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
