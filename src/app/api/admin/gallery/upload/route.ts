import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import { uploadGalleryAsset } from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

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

    const MAX_GALLERY_BYTES = 10 * 1024 * 1024; // 10 MB
    if (buffer.byteLength > MAX_GALLERY_BYTES) {
      return NextResponse.json(
        { ok: false, error: `Gallery image exceeds maximum allowed size of 10 MB (${buffer.byteLength} bytes).` },
        { status: 413, headers: { "Cache-Control": "no-store" } }
      );
    }

    const itemId = formData.get("itemId") ? String(formData.get("itemId")).trim() : null;
    const width = formData.get("width") ? Number(formData.get("width")) : null;
    const height = formData.get("height") ? Number(formData.get("height")) : null;

    const savedAsset = await uploadGalleryAsset({
      buffer,
      filename: blob.name || `photo-${Date.now()}`,
      mimeType: blob.type || "image/webp",
      itemId,
      actorEmail: auth.session.email,
      width,
      height
    });

    return NextResponse.json(
      { ok: true, asset: savedAsset, publicUrl: savedAsset.publicUrl },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    const isExceeds = err.statusCode === 413 || Boolean(err.message && err.message.includes("exceeds"));
    const status =
      err instanceof CmsStorageUnavailableError
        ? 503
        : isExceeds
        ? 413
        : typeof err.statusCode === "number"
        ? err.statusCode
        : 400;
    const message = err.message || "Gallery image upload failed";
    return NextResponse.json(
      {
        ok: false,
        code: err.code || (err instanceof CmsStorageUnavailableError ? err.code : "GALLERY_ASSET_UPLOAD_ERROR"),
        error: message
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
