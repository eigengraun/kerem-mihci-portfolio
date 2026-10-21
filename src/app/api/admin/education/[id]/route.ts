import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminEducationById,
  saveAdminEducation,
  deleteAdminEducation
} from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError, type UpsertEducationInput } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await params;
  try {
    const item = await getAdminEducationById(id);
    if (!item) {
      return NextResponse.json(
        { ok: false, error: "Education item not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json({ ok: true, item }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to get education item";
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
    let body: UpsertEducationInput;
    try {
      body = (await request.json()) as UpsertEducationInput;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const updated = await saveAdminEducation({ ...body, id }, auth.session.email);
    return NextResponse.json({ ok: true, item: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to update education item";
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
    const result = await deleteAdminEducation(id, auth.session.email);
    return NextResponse.json({ ok: true, deletedId: result.deletedId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to delete education item";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
