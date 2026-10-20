import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import { uploadVideoAsset } from "@/lib/portfolio/repository";
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

    const assetTypeRaw = String(formData.get("assetType") || "video");
    if (assetTypeRaw !== "video" && assetTypeRaw !== "poster" && assetTypeRaw !== "thumbnail") {
      return NextResponse.json(
        { ok: false, error: "Invalid assetType. Must be 'video', 'poster', or 'thumbnail'." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const videoSlug = String(formData.get("videoSlug") || "new-video").trim();
    const videoId = formData.get("videoId") ? String(formData.get("videoId")).trim() : null;
    const width = formData.get("width") ? Number(formData.get("width")) : null;
    const height = formData.get("height") ? Number(formData.get("height")) : null;
    const durationSeconds = formData.get("durationSeconds") ? Number(formData.get("durationSeconds")) : null;

    const savedAsset = await uploadVideoAsset({
      buffer,
      filename: blob.name || `asset-${Date.now()}`,
      mimeType: blob.type || (assetTypeRaw === "video" ? "video/mp4" : "image/webp"),
      videoId,
      videoSlug,
      assetType: assetTypeRaw,
      actorEmail: auth.session.email,
      width,
      height,
      durationSeconds
    });

    return NextResponse.json(
      { ok: true, asset: savedAsset, publicUrl: savedAsset.publicUrl },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video asset upload failed";
    const status = error instanceof CmsStorageUnavailableError ? 503 : 400;
    return NextResponse.json(
      {
        ok: false,
        code: error instanceof CmsStorageUnavailableError ? error.code : "VIDEO_ASSET_UPLOAD_ERROR",
        error: message
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
