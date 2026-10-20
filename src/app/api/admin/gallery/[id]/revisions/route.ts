import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  listGalleryRevisionsFromD1,
  rollbackGalleryRevisionInD1
} from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await context.params;
  try {
    const revisions = await listGalleryRevisionsFromD1(decodeURIComponent(id));
    return NextResponse.json(
      { ok: true, revisions },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to load revisions";
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
    const body = (await request.json()) as { revisionNumber?: number };
    if (typeof body.revisionNumber !== "number") {
      return NextResponse.json(
        { ok: false, error: "revisionNumber is required." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const restored = await rollbackGalleryRevisionInD1(
      decodeURIComponent(id),
      body.revisionNumber,
      auth.session.email
    );
    const revisions = await listGalleryRevisionsFromD1(restored.id);

    return NextResponse.json(
      { ok: true, item: restored, revisions },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    const status =
      err instanceof CmsStorageUnavailableError
        ? 503
        : typeof err.statusCode === "number"
        ? err.statusCode
        : 400;
    const message = err.message || "Failed to rollback revision";
    return NextResponse.json(
      { ok: false, error: message, code: err.code },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
