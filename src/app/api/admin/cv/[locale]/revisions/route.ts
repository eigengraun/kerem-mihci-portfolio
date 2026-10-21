import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import { listCvRevisions } from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError } from "@/lib/portfolio/types";

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
    const revisions = await listCvRevisions(locale);
    return NextResponse.json(
      { ok: true, revisions },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to list CV revisions";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
