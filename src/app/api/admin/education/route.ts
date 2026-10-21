import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminEducation,
  saveAdminEducation
} from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError, type UpsertEducationInput } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const education = await getAdminEducation();
    return NextResponse.json(
      { ok: true, education },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to load education items";
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
    let body: UpsertEducationInput;
    try {
      body = (await request.json()) as UpsertEducationInput;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!body.institutionTR || !body.programTR) {
      return NextResponse.json(
        { ok: false, error: "institution and program are required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const item = await saveAdminEducation(body, auth.session.email);
    return NextResponse.json(
      { ok: true, item },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to create education item";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
