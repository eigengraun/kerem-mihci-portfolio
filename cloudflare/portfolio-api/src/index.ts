/**
 * Kerem Mıhçı Portfolio OS — Cloudflare Worker API
 * Bindings:
 *  - DB: D1Database (kerem-portfolio-db)
 *  - MEDIA_BUCKET: R2Bucket (kerem-portfolio-media)
 *  - CLOUDFLARE_API_SERVICE_TOKEN: Secret token for server-to-server admin mutations
 *  - PUBLIC_SITE_ORIGIN: Allowed origin (https://keremmihci.com)
 *  - R2_PUBLIC_BASE_URL: Base URL for R2 public assets
 */

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: Record<string, unknown> }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>;
}

export interface R2ObjectBody {
  body: ReadableStream;
  httpMetadata?: { contentType?: string; cacheControl?: string };
  size: number;
  etag: string;
}

export interface R2Bucket {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
      customMetadata?: Record<string, string>;
    }
  ): Promise<{ key: string; size: number; etag: string }>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
  head(key: string): Promise<{ key: string; size: number } | null>;
}

export interface Env {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  CLOUDFLARE_API_SERVICE_TOKEN?: string;
  PUBLIC_SITE_ORIGIN?: string;
  R2_PUBLIC_BASE_URL?: string;
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "image/gif",
  "video/mp4",
  "video/webm"
]);

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function verifyServiceToken(request: Request, env: Env): boolean {
  const configuredToken = env.CLOUDFLARE_API_SERVICE_TOKEN;
  if (!configuredToken || configuredToken.trim().length < 16) {
    return false;
  }
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return false;
  }
  const provided = authHeader.slice("Bearer ".length).trim();
  return timingSafeEqual(provided, configuredToken.trim());
}

function jsonResponse(
  data: unknown,
  status = 200,
  origin = "https://keremmihci.com",
  cacheControl = "no-store"
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Actor-Email"
    }
  });
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function hydrateProjectsFromD1(
  db: D1Database,
  whereClause: string,
  params: unknown[]
): Promise<Record<string, unknown>[]> {
  const projectsStmt = db
    .prepare(
      `SELECT * FROM projects ${whereClause} ORDER BY sort_order ASC, created_at DESC`
    )
    .bind(...params);
  const { results: projectRows } = await projectsStmt.all<Record<string, unknown>>();
  if (!projectRows || projectRows.length === 0) return [];

  const { results: translationRows } = await db
    .prepare(`SELECT * FROM project_translations`)
    .all<Record<string, unknown>>();
  const { results: mediaRows } = await db
    .prepare(`SELECT * FROM project_media ORDER BY sort_order ASC`)
    .all<Record<string, unknown>>();

  const translationsByProject = new Map<string, Record<string, Record<string, unknown>>>();
  for (const row of translationRows || []) {
    const pid = String(row.project_id);
    const locale = String(row.locale);
    if (!translationsByProject.has(pid)) {
      translationsByProject.set(pid, {});
    }
    translationsByProject.get(pid)![locale] = row;
  }

  const mediaByProject = new Map<string, Record<string, unknown>[]>();
  for (const row of mediaRows || []) {
    if (!row.project_id) continue;
    const pid = String(row.project_id);
    if (!mediaByProject.has(pid)) {
      mediaByProject.set(pid, []);
    }
    mediaByProject.get(pid)!.push(row);
  }

  return projectRows.map((p) => {
    const pid = String(p.id);
    const tr = translationsByProject.get(pid)?.tr || {};
    const en = translationsByProject.get(pid)?.en || {};
    const media = mediaByProject.get(pid) || [];
    return {
      ...p,
      translations: { tr, en },
      media
    };
  });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.PUBLIC_SITE_ORIGIN || "https://keremmihci.com";
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return jsonResponse({ ok: true }, 204, origin);
    }

    try {
      // ---------------------------------------------------------
      // PUBLIC READ ENDPOINTS (Published projects & R2 media only)
      // ---------------------------------------------------------
      if (pathname === "/api/v1/public/health" && request.method === "GET") {
        const countRow = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM projects WHERE status = ?`
        )
          .bind("published")
          .first<{ count: number }>();
        return jsonResponse(
          {
            ok: true,
            service: "kerem-mihci-portfolio-api",
            publishedCount: countRow?.count ?? 0,
            timestamp: new Date().toISOString()
          },
          200,
          origin,
          "public, max-age=15"
        );
      }

      if (pathname === "/api/v1/public/projects" && request.method === "GET") {
        const projects = await hydrateProjectsFromD1(
          env.DB,
          "WHERE status = ?",
          ["published"]
        );
        return jsonResponse(
          { ok: true, projects },
          200,
          origin,
          "public, max-age=10, stale-while-revalidate=60"
        );
      }

      if (pathname.startsWith("/api/v1/public/projects/") && request.method === "GET") {
        const slug = decodeURIComponent(pathname.replace("/api/v1/public/projects/", ""));
        const projects = await hydrateProjectsFromD1(
          env.DB,
          "WHERE slug = ? AND status = ?",
          [slug, "published"]
        );
        if (projects.length === 0) {
          return jsonResponse({ ok: false, error: "Project not found" }, 404, origin);
        }
        return jsonResponse(
          { ok: true, project: projects[0] },
          200,
          origin,
          "public, max-age=10, stale-while-revalidate=60"
        );
      }

      if (pathname.startsWith("/api/v1/public/media/") && request.method === "GET") {
        const key = decodeURIComponent(pathname.replace("/api/v1/public/media/", ""));
        if (!key || key.includes("..")) {
          return jsonResponse({ ok: false, error: "Invalid media key" }, 400, origin);
        }
        const obj = await env.MEDIA_BUCKET.get(key);
        if (!obj) {
          return jsonResponse({ ok: false, error: "Media not found" }, 404, origin);
        }
        return new Response(obj.body, {
          status: 200,
          headers: {
            "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": origin
          }
        });
      }

      // ---------------------------------------------------------
      // ADMIN ENDPOINTS (Require CLOUDFLARE_API_SERVICE_TOKEN)
      // ---------------------------------------------------------
      if (pathname.startsWith("/api/v1/admin/")) {
        if (!verifyServiceToken(request, env)) {
          return jsonResponse(
            { ok: false, error: "Unauthorized: Invalid or missing service token" },
            401,
            origin
          );
        }

        const actorEmail = request.headers.get("X-Actor-Email") || "admin@keremmihci.com";

        if (pathname === "/api/v1/admin/health" && request.method === "GET") {
          const stats = await env.DB.prepare(
            `SELECT status, COUNT(*) as count FROM projects GROUP BY status`
          ).all<{ status: string; count: number }>();
          const mediaCount = await env.DB.prepare(
            `SELECT COUNT(*) as count FROM project_media`
          ).first<{ count: number }>();
          return jsonResponse(
            {
              ok: true,
              d1Connected: true,
              r2Connected: Boolean(env.MEDIA_BUCKET),
              statusCounts: stats.results || [],
              mediaCount: mediaCount?.count ?? 0,
              timestamp: new Date().toISOString()
            },
            200,
            origin
          );
        }

        if (pathname === "/api/v1/admin/projects" && request.method === "GET") {
          const projects = await hydrateProjectsFromD1(env.DB, "", []);
          return jsonResponse({ ok: true, projects }, 200, origin);
        }

        if (pathname === "/api/v1/admin/media/upload" && request.method === "POST") {
          const formData = await request.formData();
          const file = formData.get("file");
          if (!file || typeof file === "string") {
            return jsonResponse({ ok: false, error: "Missing file in form data" }, 400, origin);
          }
          const blob = file as File;
          const mimeType = blob.type || "application/octet-stream";
          if (!ALLOWED_MIME_TYPES.has(mimeType)) {
            return jsonResponse(
              { ok: false, error: `Unsupported file type: ${mimeType}` },
              400,
              origin
            );
          }

          const isVideo = mimeType.startsWith("video/");
          const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
          if (blob.size > maxBytes) {
            return jsonResponse(
              { ok: false, error: `File exceeds maximum size (${maxBytes} bytes)` },
              400,
              origin
            );
          }

          const projectSlug = sanitizeFilename(String(formData.get("projectSlug") || "general"));
          const kind = String(formData.get("kind") || "gallery");
          const projectId = formData.get("projectId") ? String(formData.get("projectId")) : null;
          const altTR = String(formData.get("altTR") || "");
          const altEN = String(formData.get("altEN") || "");
          const now = new Date();
          const yyyy = String(now.getUTCFullYear());
          const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
          const uuid = crypto.randomUUID().slice(0, 8);
          const safeName = sanitizeFilename(blob.name || "asset.webp");
          const storageKey = `projects/${projectSlug}/${kind}/${yyyy}/${mm}/${uuid}-${safeName}`;

          await env.MEDIA_BUCKET.put(storageKey, blob.stream(), {
            httpMetadata: {
              contentType: mimeType,
              cacheControl: "public, max-age=31536000, immutable"
            }
          });

          const baseUrl = (env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
          const publicUrl = baseUrl
            ? `${baseUrl}/${storageKey}`
            : `/api/v1/public/media/${storageKey}`;
          const mediaId = `media-${crypto.randomUUID()}`;
          const isoNow = now.toISOString();

          await env.DB.prepare(
            `INSERT INTO project_media (
              id, project_id, kind, media_type, storage_key, public_url, filename,
              mime_type, byte_size, alt_tr, alt_en, sort_order, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(
              mediaId,
              projectId,
              kind,
              isVideo ? "video" : "image",
              storageKey,
              publicUrl,
              safeName,
              mimeType,
              blob.size,
              altTR,
              altEN,
              0,
              isoNow,
              isoNow
            )
            .run();

          await env.DB.prepare(
            `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(
              `audit-${crypto.randomUUID()}`,
              actorEmail,
              "media_upload",
              "project_media",
              mediaId,
              JSON.stringify({ storageKey, publicUrl, size: blob.size, mimeType }),
              isoNow
            )
            .run();

          return jsonResponse(
            {
              ok: true,
              media: {
                id: mediaId,
                projectId,
                kind,
                mediaType: isVideo ? "video" : "image",
                storageKey,
                publicUrl,
                filename: safeName,
                mimeType,
                byteSize: blob.size,
                altTR,
                altEN,
                createdAt: isoNow
              }
            },
            201,
            origin
          );
        }
      }

      return jsonResponse({ ok: false, error: "Route not found" }, 404, origin);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal Worker Error";
      return jsonResponse({ ok: false, error: message }, 500, origin);
    }
  }
};

export default worker;
