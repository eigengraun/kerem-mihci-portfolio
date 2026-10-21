import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminWorkspaceNotes,
  saveAdminWorkspaceNote
} from "@/lib/portfolio/repository";
import {
  CmsStorageUnavailableError,
  type UpsertWorkspaceNoteInput,
  type WorkspaceCategory
} from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = (searchParams.get("workspaceId") || searchParams.get("workspace")) as WorkspaceCategory | null;

    const notes = await getAdminWorkspaceNotes(workspaceId || undefined);
    return NextResponse.json(
      { ok: true, notes },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to load workspace notes";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    let body: UpsertWorkspaceNoteInput;
    try {
      body = (await request.json()) as UpsertWorkspaceNoteInput;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!body.workspaceId) {
      return NextResponse.json(
        { ok: false, error: "workspaceId is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const note = await saveAdminWorkspaceNote(body, auth.session.email);
    return NextResponse.json(
      { ok: true, note },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to create workspace note";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
