import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminSkills,
  saveAdminSkill
} from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError, type UpsertSkillInput, type CmsSkillCategory } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as CmsSkillCategory | null;

    const skills = await getAdminSkills(category || undefined);
    return NextResponse.json(
      { ok: true, skills },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to load skills";
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
    let body: UpsertSkillInput;
    try {
      body = (await request.json()) as UpsertSkillInput;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const VALID_SKILL_CATEGORIES = new Set(["design", "web", "production", "ai", "strategy", "tools"]);
    if (!body.category || !VALID_SKILL_CATEGORIES.has(body.category) || !body.nameTR) {
      return NextResponse.json(
        { ok: false, error: "Valid category and name are required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const item = await saveAdminSkill(body, auth.session.email);
    return NextResponse.json(
      { ok: true, item },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to create skill";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
