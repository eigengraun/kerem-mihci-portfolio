import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCmsStorageMode, getLocalR2DirPath } from "@/lib/portfolio/d1Engine";

export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> }
) {
  const { key } = await context.params;
  if (!Array.isArray(key) || key.length === 0) {
    return NextResponse.json({ ok: false, error: "Missing media key" }, { status: 400 });
  }

  const joinedKey = key.join("/");
  if (joinedKey.includes("..") || joinedKey.startsWith("/")) {
    return NextResponse.json({ ok: false, error: "Invalid media key" }, { status: 400 });
  }

  const workerBase = (process.env.CLOUDFLARE_CMS_API_URL || "").trim().replace(/\/$/, "");
  if (workerBase) {
    try {
      const upstream = await fetch(
        `${workerBase}/api/v1/public/media/${joinedKey}`,
        { cache: "no-store" }
      );
      if (!upstream.ok) {
        return NextResponse.json(
          { ok: false, error: "Media asset not found in R2" },
          { status: upstream.status }
        );
      }
      const buf = await upstream.arrayBuffer();
      const ext = path.extname(joinedKey).toLowerCase();
      const contentType =
        upstream.headers.get("content-type") ||
        MIME_BY_EXT[ext] ||
        "application/octet-stream";
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(buf.byteLength),
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    } catch {
      return NextResponse.json(
        { ok: false, error: "Failed to fetch media from Cloudflare R2 Worker" },
        { status: 503 }
      );
    }
  }

  if (getCmsStorageMode() !== "local") {
    return NextResponse.json(
      {
        ok: false,
        error: "Cloudflare R2 Worker is not configured in staging/production mode."
      },
      { status: 503 }
    );
  }

  const r2Root = path.resolve(getLocalR2DirPath());
  const resolvedPath = path.resolve(r2Root, joinedKey);
  if (!resolvedPath.startsWith(r2Root + path.sep)) {
    return NextResponse.json({ ok: false, error: "Forbidden path" }, { status: 403 });
  }

  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    return NextResponse.json({ ok: false, error: "Media asset not found" }, { status: 404 });
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  const contentType = MIME_BY_EXT[ext] || "application/octet-stream";
  const fileBuffer = fs.readFileSync(resolvedPath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileBuffer.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
