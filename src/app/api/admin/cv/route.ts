import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminCvDocuments,
  saveAdminCvDocument
} from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError, type UpsertCvInput } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const documents = await getAdminCvDocuments();
    return NextResponse.json(
      { ok: true, documents },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to load CV documents";
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
    let body: UpsertCvInput;
    try {
      body = (await request.json()) as UpsertCvInput;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!body.locale || (body.locale !== "tr" && body.locale !== "en")) {
      return NextResponse.json(
        { ok: false, error: "Valid locale ('tr' or 'en') is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const doc = await saveAdminCvDocument(body, auth.session.email);
    return NextResponse.json(
      { ok: true, cv: doc },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to update CV document";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
