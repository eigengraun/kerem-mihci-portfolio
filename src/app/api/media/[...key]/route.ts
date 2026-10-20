import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import {
  getCmsStorageMode,
  getLocalR2DirPath,
  isMediaKeyPubliclyAccessibleInLocalD1
} from "@/lib/portfolio/d1Engine";

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
  request: Request,
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

  const ifNoneMatch = request.headers.get("if-none-match");
  const rangeHeader = request.headers.get("range");

  const workerBase = (process.env.CLOUDFLARE_CMS_API_URL || "").trim().replace(/\/$/, "");
  const serviceToken = (process.env.CLOUDFLARE_API_SERVICE_TOKEN || "").trim();

  if (workerBase) {
    try {
      const upstreamHeaders: Record<string, string> = {};
      if (ifNoneMatch) upstreamHeaders["If-None-Match"] = ifNoneMatch;
      if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;

      const upstream = await fetch(
        `${workerBase}/api/v1/public/media/${joinedKey}`,
        {
          cache: "no-store",
          headers: upstreamHeaders
        }
      );

      // 304 Not Modified conditional response forwarding
      if (upstream.status === 304) {
        const upstreamCache =
          upstream.headers.get("cache-control") ||
          "public, max-age=0, must-revalidate, s-maxage=3600";
        return new Response(null, {
          status: 304,
          headers: {
            ETag: upstream.headers.get("etag") || ifNoneMatch || "",
            "Cache-Control": upstreamCache
          }
        });
      }

      // Stream media response (200 OK or 206 Partial Content) directly without full-buffering
      if (upstream.status === 200 || upstream.status === 206) {
        const ext = path.extname(joinedKey).toLowerCase();
        const contentType =
          upstream.headers.get("content-type") ||
          MIME_BY_EXT[ext] ||
          "application/octet-stream";

        const headers = new Headers();
        headers.set("Content-Type", contentType);
        const upstreamCache =
          upstream.headers.get("cache-control") ||
          "public, max-age=0, must-revalidate, s-maxage=3600";
        headers.set("Cache-Control", upstreamCache);
        headers.set("Accept-Ranges", "bytes");

        const etag = upstream.headers.get("etag");
        if (etag) headers.set("ETag", etag);
        const contentLength = upstream.headers.get("content-length");
        if (contentLength) headers.set("Content-Length", contentLength);
        const contentRange = upstream.headers.get("content-range");
        if (contentRange) headers.set("Content-Range", contentRange);

        return new Response(upstream.body, {
          status: upstream.status,
          headers
        });
      }

      // If 404 on public media route, check if requester is an authenticated admin previewing draft media
      if (upstream.status === 404 && serviceToken) {
        const adminSession = await getAdminSession();
        if (adminSession) {
          const adminHeaders: Record<string, string> = {
            Authorization: `Bearer ${serviceToken}`,
            "X-Actor-Email": adminSession.email
          };
          if (ifNoneMatch) adminHeaders["If-None-Match"] = ifNoneMatch;
          if (rangeHeader) adminHeaders["Range"] = rangeHeader;

          const adminUpstream = await fetch(
            `${workerBase}/api/v1/admin/media/object/${joinedKey}`,
            {
              cache: "no-store",
              headers: adminHeaders
            }
          );

          if (adminUpstream.status === 304) {
            return new Response(null, {
              status: 304,
              headers: {
                ETag: adminUpstream.headers.get("etag") || ifNoneMatch || "",
                "Cache-Control": "private, no-store, no-cache, must-revalidate"
              }
            });
          }

          if (adminUpstream.status === 200 || adminUpstream.status === 206) {
            const ext = path.extname(joinedKey).toLowerCase();
            const contentType =
              adminUpstream.headers.get("content-type") ||
              MIME_BY_EXT[ext] ||
              "application/octet-stream";

            const headers = new Headers();
            headers.set("Content-Type", contentType);
            headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
            headers.set("Accept-Ranges", "bytes");

            const etag = adminUpstream.headers.get("etag");
            if (etag) headers.set("ETag", etag);
            const contentLength = adminUpstream.headers.get("content-length");
            if (contentLength) headers.set("Content-Length", contentLength);
            const contentRange = adminUpstream.headers.get("content-range");
            if (contentRange) headers.set("Content-Range", contentRange);

            return new Response(adminUpstream.body, {
              status: adminUpstream.status,
              headers
            });
          }
        }
      }

      return NextResponse.json(
        { ok: false, error: "Media asset not found in R2" },
        {
          status: upstream.status,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
        }
      );
    } catch {
      return NextResponse.json(
        { ok: false, error: "Failed to fetch media from Cloudflare R2 Worker" },
        {
          status: 503,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
        }
      );
    }
  }

  if (getCmsStorageMode() !== "local") {
    return NextResponse.json(
      {
        ok: false,
        error: "Cloudflare R2 Worker is not configured in staging/production mode."
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
      }
    );
  }

  const isPublic = isMediaKeyPubliclyAccessibleInLocalD1(joinedKey);
  if (!isPublic) {
    const adminSession = await getAdminSession();
    if (!adminSession) {
      return NextResponse.json(
        { ok: false, error: "Media belongs to an unpublished project" },
        {
          status: 404,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
        }
      );
    }
  }

  const r2Root = path.resolve(getLocalR2DirPath());
  const resolvedPath = path.resolve(r2Root, joinedKey);
  if (!resolvedPath.startsWith(r2Root + path.sep)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden path" },
      {
        status: 403,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
      }
    );
  }

  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    return NextResponse.json(
      { ok: false, error: "Media asset not found" },
      {
        status: 404,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
      }
    );
  }

  const stat = fs.statSync(resolvedPath);
  const localEtag = `"${Math.floor(stat.mtimeMs).toString(36)}-${stat.size.toString(36)}"`;
  if (ifNoneMatch && ifNoneMatch === localEtag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: localEtag,
        "Cache-Control": isPublic
          ? "public, max-age=0, must-revalidate, s-maxage=3600"
          : "private, no-store, no-cache, must-revalidate"
      }
    });
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  const contentType = MIME_BY_EXT[ext] || "application/octet-stream";

  // Local Range request support for videos/media
  if (rangeHeader && rangeHeader.startsWith("bytes=")) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (match) {
      const total = stat.size;
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : total - 1;
      if (start >= total || end < start) {
        return new Response(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${total}`,
            "Content-Type": contentType
          }
        });
      }
      const chunkLen = end - start + 1;
      const fileStream = fs.createReadStream(resolvedPath, { start, end });
      const webStream = Readable.toWeb(fileStream);
      const headers = new Headers({
        "Content-Type": contentType,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkLen),
        ETag: localEtag,
        "Cache-Control": isPublic
          ? "public, max-age=0, must-revalidate, s-maxage=3600"
          : "private, no-store, no-cache, must-revalidate"
      });
      return new Response(webStream as BodyInit, {
        status: 206,
        headers
      });
    }
  }

  const fileStream = fs.createReadStream(resolvedPath);
  const webStream = Readable.toWeb(fileStream);
  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Length": String(stat.size),
    "Accept-Ranges": "bytes",
    ETag: localEtag,
    "Cache-Control": isPublic
      ? "public, max-age=0, must-revalidate, s-maxage=3600"
      : "private, no-store, no-cache, must-revalidate"
  });

  return new Response(webStream as BodyInit, {
    status: 200,
    headers
  });
}
