import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import { rollbackWorkspaceNoteRevision } from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    let body: { workspaceId: string; revisionNumber: number };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!body.workspaceId || typeof body.revisionNumber !== "number") {
      return NextResponse.json(
        { ok: false, error: "workspaceId and revisionNumber are required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    await rollbackWorkspaceNoteRevision(body.workspaceId, body.revisionNumber, auth.session.email);
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to rollback workspace note revision";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
