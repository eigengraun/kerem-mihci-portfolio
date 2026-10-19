import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  uploadMediaToR2AndD1,
  listMediaFromD1,
  deleteMediaFromD1AndR2
} from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError, type CmsMediaRecord } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") || undefined;
    const media = await listMediaFromD1(projectId);

    return NextResponse.json(
      { ok: true, media },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to list media";
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
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { ok: false, error: "Missing file in upload request." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const blob = file as File;
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const projectId = formData.get("projectId") ? String(formData.get("projectId")) : null;
    const projectSlug = String(formData.get("projectSlug") || "general");
    const kind = String(formData.get("kind") || "gallery") as CmsMediaRecord["kind"];
    const altTR = String(formData.get("altTR") || "");
    const altEN = String(formData.get("altEN") || "");
    const captionTR = formData.get("captionTR") ? String(formData.get("captionTR")) : undefined;
    const captionEN = formData.get("captionEN") ? String(formData.get("captionEN")) : undefined;

    const savedMedia = await uploadMediaToR2AndD1({
      buffer,
      filename: blob.name || "asset.webp",
      mimeType: blob.type || "image/webp",
      projectId,
      projectSlug,
      kind,
      altTR,
      altEN,
      captionTR,
      captionEN,
      actorEmail: auth.session.email
    });

    return NextResponse.json(
      { ok: true, media: savedMedia },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 400;
    const message = error instanceof Error ? error.message : "Media upload failed";
    return NextResponse.json(
      {
        ok: false,
        code: error instanceof CmsStorageUnavailableError ? error.code : "MEDIA_UPLOAD_ERROR",
        error: message
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing media id" }, { status: 400 });
    }
    const result = await deleteMediaFromD1AndR2(id, auth.session.email);
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 400;
    const message = error instanceof Error ? error.message : "Media deletion failed";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
