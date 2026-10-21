import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminExperienceById,
  saveAdminExperience,
  deleteAdminExperience
} from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError, type UpsertExperienceInput } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await params;
  try {
    const item = await getAdminExperienceById(id);
    if (!item) {
      return NextResponse.json(
        { ok: false, error: "Experience item not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json({ ok: true, item }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to get experience item";
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
    let body: UpsertExperienceInput;
    try {
      body = (await request.json()) as UpsertExperienceInput;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const updated = await saveAdminExperience({ ...body, id }, auth.session.email);
    return NextResponse.json({ ok: true, item: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to update experience item";
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
    const result = await deleteAdminExperience(id, auth.session.email);
    return NextResponse.json({ ok: true, deletedId: result.deletedId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to delete experience item";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
