import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminWorkspaceNoteById,
  saveAdminWorkspaceNote,
  deleteAdminWorkspaceNote
} from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError, type UpsertWorkspaceNoteInput } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await params;
  try {
    const note = await getAdminWorkspaceNoteById(id);
    if (!note) {
      return NextResponse.json(
        { ok: false, error: "Note not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json({ ok: true, note }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to get workspace note";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await params;
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

    const updated = await saveAdminWorkspaceNote({ ...body, id }, auth.session.email);
    return NextResponse.json({ ok: true, note: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to update workspace note";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await params;
  try {
    const result = await deleteAdminWorkspaceNote(id, auth.session.email);
    return NextResponse.json({ ok: true, deletedId: result.deletedId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to delete workspace note";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
