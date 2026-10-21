import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminExperience,
  saveAdminExperience
} from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError, type UpsertExperienceInput } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const experience = await getAdminExperience(category || undefined);
    return NextResponse.json(
      { ok: true, experience },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to load experience items";
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
    let body: UpsertExperienceInput;
    try {
      body = (await request.json()) as UpsertExperienceInput;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!body.organization || !body.startDate) {
      return NextResponse.json(
        { ok: false, error: "organization and startDate are required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const item = await saveAdminExperience(body, auth.session.email);
    return NextResponse.json(
      { ok: true, item },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to create experience item";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
