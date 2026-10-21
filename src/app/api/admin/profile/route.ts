import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminProfile,
  saveAdminProfile,
  getD1HealthAndStats
} from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError, type UpsertProfileInput } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const profile = await getAdminProfile();
    const health = await getD1HealthAndStats();

    return NextResponse.json(
      { ok: true, profile, health },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to load admin profile";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    let body: UpsertProfileInput;
    try {
      body = (await request.json()) as UpsertProfileInput;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim().length === 0)) {
      return NextResponse.json(
        { ok: false, error: "name must be a non-empty string" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const updated = await saveAdminProfile(body, auth.session.email);

    return NextResponse.json(
      { ok: true, profile: updated },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to save profile";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
