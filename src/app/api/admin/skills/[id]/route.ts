import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminSkillById,
  saveAdminSkill,
  deleteAdminSkill
} from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError, type UpsertSkillInput } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await params;
  try {
    const item = await getAdminSkillById(id);
    if (!item) {
      return NextResponse.json(
        { ok: false, error: "Skill not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json({ ok: true, item }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to get skill";
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
    let body: UpsertSkillInput;
    try {
      body = (await request.json()) as UpsertSkillInput;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const updated = await saveAdminSkill({ ...body, id }, auth.session.email);
    return NextResponse.json({ ok: true, item: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to update skill";
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
    const result = await deleteAdminSkill(id, auth.session.email);
    return NextResponse.json({ ok: true, deletedId: result.deletedId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to delete skill";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
