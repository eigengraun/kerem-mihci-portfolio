import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminCvDocument,
  saveAdminCvDocument
} from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError, type UpsertCvInput } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { locale } = await params;
  if (locale !== "tr" && locale !== "en") {
    return NextResponse.json(
      { ok: false, error: "Invalid locale" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const doc = await getAdminCvDocument(locale);
    if (!doc) {
      return NextResponse.json(
        { ok: false, error: "CV document not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json({ ok: true, cv: doc }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to get CV document";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { locale } = await params;
  if (locale !== "tr" && locale !== "en") {
    return NextResponse.json(
      { ok: false, error: "Invalid locale" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

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

    const updated = await saveAdminCvDocument({ ...body, locale }, auth.session.email);
    return NextResponse.json({ ok: true, cv: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to update CV document";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
