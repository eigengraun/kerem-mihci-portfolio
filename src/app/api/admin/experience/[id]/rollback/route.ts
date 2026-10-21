import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import { rollbackExperienceRevision } from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await params;
  try {
    let body: { revisionNumber: number };
    try {
      body = (await request.json()) as { revisionNumber: number };
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (typeof body.revisionNumber !== "number") {
      return NextResponse.json(
        { ok: false, error: "revisionNumber is required and must be a number" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const restored = await rollbackExperienceRevision(id, body.revisionNumber, auth.session.email);
    return NextResponse.json(
      { ok: true, item: restored },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to rollback experience revision";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
