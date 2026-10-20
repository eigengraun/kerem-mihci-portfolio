import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  listVideoRevisionsFromD1,
  rollbackVideoRevisionInD1
} from "@/lib/portfolio/repository";
import {
  CmsStorageUnavailableError,
  calculateVideoCompleteness
} from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await context.params;
  try {
    const revisions = await listVideoRevisionsFromD1(decodeURIComponent(id));
    return NextResponse.json(
      { ok: true, revisions },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to load video revisions";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await context.params;
  try {
    let body: { revisionNumber?: number };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (typeof body.revisionNumber !== "number") {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid 'revisionNumber'" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const restored = await rollbackVideoRevisionInD1(
      decodeURIComponent(id),
      body.revisionNumber,
      auth.session.email
    );
    const revisions = await listVideoRevisionsFromD1(restored.id);

    return NextResponse.json(
      {
        ok: true,
        video: {
          ...restored,
          completeness: calculateVideoCompleteness(restored)
        },
        revisions
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 400;
    const message = error instanceof Error ? error.message : "Failed to rollback video revision";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
