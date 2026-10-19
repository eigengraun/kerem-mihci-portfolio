/**
 * Kerem Mıhçı Portfolio OS — Cloudflare Worker API
 * Canonical Bindings:
 *  - PORTFOLIO_DB: D1Database (kerem-portfolio-db)
 *  - PORTFOLIO_MEDIA: R2Bucket (kerem-portfolio-media)
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
  httpEtag?: string;
  range?: { offset: number; length: number };
}

export interface R2GetOptions {
  range?: Headers | { offset?: number; length?: number; suffix?: number };
  onlyIf?: Headers | { etagMatches?: string; etagDoesNotMatch?: string };
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
  get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
  head(key: string): Promise<{ key: string; size: number } | null>;
}

export interface Env {
  PORTFOLIO_DB?: D1Database;
  DB?: D1Database;
  PORTFOLIO_MEDIA?: R2Bucket;
  MEDIA_BUCKET?: R2Bucket;
  CLOUDFLARE_API_SERVICE_TOKEN?: string;
  PUBLIC_SITE_ORIGIN?: string;
  R2_PUBLIC_BASE_URL?: string;
  ALLOW_CANONICAL_SEED?: string;
  ENVIRONMENT?: string;
}

interface MediaItemMeta {
  originalId?: string;
  layout?: string;
  poster?: string;
  thumbnail?: string;
  aspectRatio?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: "none" | "metadata" | "auto";
  priority?: boolean;
}

interface ExtraProjectMetadataJson {
  categoryIds?: string[];
  tags?: string[];
  tools?: string[];
  services?: string[];
  servicesTR?: string[];
  servicesEN?: string[];
  externalLinks?: Record<string, unknown>[];
  hasExplicitExternalLinks?: boolean;
  contentBlocks?: Record<string, unknown>[];
  desktopLabelTR?: string;
  desktopLabelEN?: string;
  challengeTR?: string;
  challengeEN?: string;
  solutionTR?: string;
  solutionEN?: string;
  resultTR?: string;
  resultEN?: string;
  desktopWidth?: number;
  desktopWeight?: "small" | "normal" | "large";
  desktopPlacement?: { x: number; y: number };
  desktopClusterId?: string;
  projectStatus?: "completed" | "ongoing" | "concept";
  hasExplicitSeo?: boolean;
  hasExplicitOgImage?: boolean;
  mediaMeta?: MediaItemMeta[];
}

const ALLOWED_EXTENSIONS_BY_MIME: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/avif": [".avif"],
  "image/svg+xml": [".svg"],
  "image/gif": [".gif"],
  "video/mp4": [".mp4"],
  "video/webm": [".webm"]
};

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

function getDb(env: Env): D1Database {
  const db = env.PORTFOLIO_DB || env.DB;
  if (!db) {
    throw new Error("PORTFOLIO_DB D1 binding is not configured on Worker.");
  }
  return db;
}

function getBucket(env: Env): R2Bucket {
  const bucket = env.PORTFOLIO_MEDIA || env.MEDIA_BUCKET;
  if (!bucket) {
    throw new Error("PORTFOLIO_MEDIA R2 binding is not configured on Worker.");
  }
  return bucket;
}

function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length, 64);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= ca ^ cb;
  }
  return mismatch === 0;
}

function verifyServiceToken(request: Request, env: Env): { ok: boolean; status: number; error?: string } {
  const configuredToken = env.CLOUDFLARE_API_SERVICE_TOKEN;
  if (!configuredToken || configuredToken.trim().length < 16) {
    return {
      ok: false,
      status: 503,
      error: "Service unavailable: CLOUDFLARE_API_SERVICE_TOKEN is not configured on Worker."
    };
  }
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized: Missing Bearer service token."
    };
  }
  const provided = authHeader.slice("Bearer ".length).trim();
  if (!provided || !timingSafeEqual(provided, configuredToken.trim())) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized: Invalid service token."
    };
  }
  return { ok: true, status: 200 };
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
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Actor-Email"
    }
  });
}

function normalizeSlug(raw: unknown): string {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function parseJsonSafe<T>(raw: unknown, fallback: T): T {
  if (!raw || typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function validateMediaBufferSignature(
  bytes: Uint8Array,
  mimeType: string,
  filename: string
): { valid: boolean; status?: number; error?: string } {
  const allowedExts = ALLOWED_EXTENSIONS_BY_MIME[mimeType];
  if (!allowedExts) {
    return { valid: false, status: 400, error: `Unsupported MIME type: ${mimeType}` };
  }
  const lowerName = (filename || "").toLowerCase().trim();
  const dotIdx = lowerName.lastIndexOf(".");
  const ext = dotIdx >= 0 ? lowerName.slice(dotIdx) : "";
  if (ext && !allowedExts.includes(ext)) {
    return {
      valid: false,
      status: 400,
      error: `File extension "${ext}" does not match declared MIME type "${mimeType}".`
    };
  }
  if (bytes.byteLength === 0) {
    return { valid: false, status: 400, error: "Uploaded file is empty." };
  }
  const isVideo = mimeType.startsWith("video/");
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (bytes.byteLength > maxBytes) {
    return {
      valid: false,
      status: 413,
      error: `File exceeds maximum size (${maxBytes} bytes).`
    };
  }

  if (mimeType === "image/png") {
    if (
      bytes.byteLength < 8 ||
      bytes[0] !== 0x89 ||
      bytes[1] !== 0x50 ||
      bytes[2] !== 0x4e ||
      bytes[3] !== 0x47
    ) {
      return { valid: false, status: 400, error: "Invalid PNG file signature." };
    }
  } else if (mimeType === "image/jpeg") {
    if (bytes.byteLength < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      return { valid: false, status: 400, error: "Invalid JPEG file signature." };
    }
  } else if (mimeType === "image/webp") {
    if (
      bytes.byteLength < 12 ||
      bytes[0] !== 0x52 ||
      bytes[1] !== 0x49 ||
      bytes[2] !== 0x46 ||
      bytes[3] !== 0x46 ||
      bytes[8] !== 0x57 ||
      bytes[9] !== 0x45 ||
      bytes[10] !== 0x42 ||
      bytes[11] !== 0x50
    ) {
      return { valid: false, status: 400, error: "Invalid WebP file signature." };
    }
  } else if (mimeType === "image/gif") {
    if (
      bytes.byteLength < 6 ||
      bytes[0] !== 0x47 ||
      bytes[1] !== 0x49 ||
      bytes[2] !== 0x46 ||
      bytes[3] !== 0x38
    ) {
      return { valid: false, status: 400, error: "Invalid GIF file signature." };
    }
  } else if (mimeType === "image/avif" || mimeType === "video/mp4") {
    if (
      bytes.byteLength < 12 ||
      bytes[4] !== 0x66 ||
      bytes[5] !== 0x74 ||
      bytes[6] !== 0x79 ||
      bytes[7] !== 0x70
    ) {
      return { valid: false, status: 400, error: `Invalid ${mimeType} ftyp box signature.` };
    }
  } else if (mimeType === "video/webm") {
    if (
      bytes.byteLength < 4 ||
      bytes[0] !== 0x1a ||
      bytes[1] !== 0x45 ||
      bytes[2] !== 0xdf ||
      bytes[3] !== 0xa3
    ) {
      return { valid: false, status: 400, error: "Invalid WebM EBML header signature." };
    }
  } else if (mimeType === "image/svg+xml") {
    const textSample = new TextDecoder("utf-8", { fatal: false }).decode(
      bytes.subarray(0, Math.min(bytes.byteLength, 8192))
    );
    if (!/<svg[\s>]/i.test(textSample)) {
      return { valid: false, status: 400, error: "Invalid SVG content." };
    }
    if (/<script[\s>]|javascript:|onload\s*=|onerror\s*=/i.test(textSample)) {
      return { valid: false, status: 400, error: "SVG contains disallowed executable script content." };
    }
  }

  return { valid: true };
}

function mapRowsToCmsProjects(
  projectRows: Record<string, unknown>[],
  translationRows: Record<string, unknown>[],
  mediaRows: Record<string, unknown>[]
): Record<string, unknown>[] {
  const trMap = new Map<string, Record<string, unknown>>();
  const enMap = new Map<string, Record<string, unknown>>();

  for (const row of translationRows) {
    const pid = String(row.project_id);
    if (row.locale === "tr") trMap.set(pid, row);
    if (row.locale === "en") enMap.set(pid, row);
  }

  const rawMediaByProject = new Map<string, Record<string, unknown>[]>();
  for (const row of mediaRows) {
    if (!row.project_id) continue;
    const pid = String(row.project_id);
    const kind = String(row.kind || "gallery");
    if (kind !== "gallery" && kind !== "video") continue;
    if (!rawMediaByProject.has(pid)) rawMediaByProject.set(pid, []);
    rawMediaByProject.get(pid)!.push(row);
  }

  return projectRows.map((row) => {
    const id = String(row.id);
    const tr = trMap.get(id) || {};
    const en = enMap.get(id) || {};
    const desktopThumbnail = parseJsonSafe<Record<string, unknown> | undefined>(
      row.desktop_thumbnail_json,
      undefined
    );
    const parsedMeta = parseJsonSafe<ExtraProjectMetadataJson | string[]>(row.tags_json, {});
    const extra: ExtraProjectMetadataJson = Array.isArray(parsedMeta)
      ? { tags: parsedMeta }
      : parsedMeta;

    const deliverablesTR = parseJsonSafe<string[]>(tr.deliverables_json, []);
    const deliverablesEN = parseJsonSafe<string[]>(en.deliverables_json, []);
    const highlightsTR = parseJsonSafe<string[]>(tr.highlights_json, []);
    const highlightsEN = parseJsonSafe<string[]>(en.highlights_json, []);

    const seoTitleTR = tr.seo_title ? String(tr.seo_title) : undefined;
    const seoTitleEN = en.seo_title ? String(en.seo_title) : undefined;
    const seoDescTR = tr.seo_description ? String(tr.seo_description) : undefined;
    const seoDescEN = en.seo_description ? String(en.seo_description) : undefined;
    const ogImg = row.og_image_url ? String(row.og_image_url) : undefined;

    const showSeo =
      extra.hasExplicitSeo !== undefined
        ? extra.hasExplicitSeo
        : Boolean(seoTitleTR || seoTitleEN || seoDescTR || seoDescEN || ogImg);

    const workspace = String(row.workspace || "design");
    const defaultCategory =
      workspace === "web"
        ? "website"
        : workspace === "motion-ai"
        ? "video-production"
        : "graphic-design";

    const liveUrl = row.live_url ? String(row.live_url) : undefined;
    const externalLinks =
      extra.hasExplicitExternalLinks === false
        ? undefined
        : extra.externalLinks !== undefined
        ? extra.externalLinks
        : liveUrl
        ? [
            {
              id: `${id}-live`,
              type: "live",
              labelTR: "Canlı Siteyi Ziyaret Et",
              labelEN: "Visit Live Website",
              href: liveUrl
            }
          ]
        : [];

    const pMediaRows = rawMediaByProject.get(id) || [];
    const mediaMetaList = extra.mediaMeta || [];
    const media = pMediaRows.map((mRow, idx) => {
      const mMeta = mediaMetaList[idx] || {};
      const item: Record<string, unknown> = {
        id: mMeta.originalId || String(mRow.id),
        type: mRow.media_type === "video" ? "video" : "image",
        src: String(mRow.public_url)
      };
      if (mRow.alt_tr) item.altTR = String(mRow.alt_tr);
      if (mRow.alt_en) item.altEN = String(mRow.alt_en);
      if (mRow.caption_tr) item.captionTR = String(mRow.caption_tr);
      if (mRow.caption_en) item.captionEN = String(mRow.caption_en);
      if (mMeta.layout) item.layout = mMeta.layout;
      if (mRow.width !== null && mRow.width !== undefined) item.width = Number(mRow.width);
      if (mRow.height !== null && mRow.height !== undefined) item.height = Number(mRow.height);
      if (mMeta.poster) item.poster = mMeta.poster;
      if (mMeta.thumbnail) item.thumbnail = mMeta.thumbnail;
      if (mMeta.aspectRatio) item.aspectRatio = mMeta.aspectRatio;
      if (mMeta.autoplay !== undefined) item.autoplay = mMeta.autoplay;
      if (mMeta.muted !== undefined) item.muted = mMeta.muted;
      if (mMeta.loop !== undefined) item.loop = mMeta.loop;
      if (mMeta.preload) item.preload = mMeta.preload;
      if (mMeta.priority !== undefined) item.priority = mMeta.priority;
      return item;
    });

    const rawYear = row.year !== null && row.year !== undefined ? String(row.year) : "";
    const rawDescTR = tr.description !== null && tr.description !== undefined ? String(tr.description) : "";
    const rawDescEN = en.description !== null && en.description !== undefined ? String(en.description) : "";
    const rawFeaturedOrder = Number(row.featured_order || 0);

    return {
      id,
      slug: String(row.slug),
      cmsStatus: String(row.status || "draft"),
      status: extra.projectStatus || "completed",
      workspace,
      workspaceId: workspace,
      categoryIds:
        extra.categoryIds && extra.categoryIds.length > 0
          ? extra.categoryIds
          : [defaultCategory],
      featured: Number(row.featured) === 1,
      featuredOrder: rawFeaturedOrder > 0 ? rawFeaturedOrder : undefined,
      sortOrder: Number(row.sort_order || 0),
      titleTR: String(tr.title || row.slug),
      titleEN: String(en.title || tr.title || row.slug),
      desktopLabelTR: extra.desktopLabelTR,
      desktopLabelEN: extra.desktopLabelEN,
      subtitleTR: tr.subtitle ? String(tr.subtitle) : undefined,
      subtitleEN: en.subtitle ? String(en.subtitle) : undefined,
      projectTypeTR: tr.subtitle ? String(tr.subtitle) : undefined,
      projectTypeEN: en.subtitle ? String(en.subtitle) : undefined,
      categoryTR: String(tr.category_label || ""),
      categoryEN: String(en.category_label || tr.category_label || ""),
      client: String(row.client_name || ""),
      year: rawYear !== "" ? rawYear : undefined,
      summaryTR: tr.summary ? String(tr.summary) : undefined,
      summaryEN: en.summary ? String(en.summary) : undefined,
      descriptionTR: rawDescTR !== "" ? rawDescTR : undefined,
      descriptionEN: rawDescEN !== "" ? rawDescEN : undefined,
      challengeTR: extra.challengeTR,
      challengeEN: extra.challengeEN,
      solutionTR: extra.solutionTR,
      solutionEN: extra.solutionEN,
      resultTR: extra.resultTR,
      resultEN: extra.resultEN,
      roleTR: tr.role ? String(tr.role) : undefined,
      roleEN: en.role ? String(en.role) : undefined,
      services: extra.services,
      servicesTR: extra.servicesTR || deliverablesTR,
      servicesEN: extra.servicesEN || deliverablesEN,
      tools: extra.tools ?? [],
      externalLinks,
      contentBlocks: extra.contentBlocks,
      deliverablesTR,
      deliverablesEN,
      highlightsTR,
      highlightsEN,
      tags: extra.tags || [],
      liveUrl,
      sourceUrl: row.source_url ? String(row.source_url) : undefined,
      initials: row.initials ? String(row.initials) : undefined,
      cover: row.cover_image_url ? String(row.cover_image_url) : undefined,
      thumbnail: row.thumbnail_url ? String(row.thumbnail_url) : undefined,
      desktopIcon: row.desktop_icon_url ? String(row.desktop_icon_url) : undefined,
      ogImage: extra.hasExplicitOgImage === false ? undefined : ogImg,
      desktopThumbnail,
      seo: showSeo
        ? {
            titleTR: seoTitleTR,
            titleEN: seoTitleEN,
            descriptionTR: seoDescTR,
            descriptionEN: seoDescEN,
            ogImage: ogImg
          }
        : undefined,
      media,
      desktop: {
        x: Number(row.desktop_position_x ?? 25),
        y: Number(row.desktop_position_y ?? 25),
        ...(extra.desktopWidth !== undefined ? { width: extra.desktopWidth } : {})
      },
      desktopWeight: extra.desktopWeight,
      desktopPlacement: extra.desktopPlacement,
      desktopClusterId: extra.desktopClusterId,
      initialWindow: {
        width: Number(row.window_width ?? 820),
        height: Number(row.window_height ?? 600)
      },
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      publishedAt: row.published_at ? String(row.published_at) : null,
      archivedAt: row.archived_at ? String(row.archived_at) : null
    };
  });
}

async function queryCmsProjectsFromWorkerD1(
  db: D1Database,
  whereClause: string,
  params: unknown[]
): Promise<Record<string, unknown>[]> {
  const stmt = db
    .prepare(`SELECT * FROM projects ${whereClause} ORDER BY sort_order ASC, created_at DESC`)
    .bind(...params);
  const { results: projectRows } = await stmt.all<Record<string, unknown>>();
  if (!projectRows || projectRows.length === 0) return [];

  const { results: translationRows } = await db
    .prepare(`SELECT * FROM project_translations`)
    .all<Record<string, unknown>>();
  const { results: mediaRows } = await db
    .prepare(`SELECT * FROM project_media ORDER BY sort_order ASC`)
    .all<Record<string, unknown>>();

  return mapRowsToCmsProjects(projectRows, translationRows || [], mediaRows || []);
}

async function getWorkerD1Health(db: D1Database, r2Available: boolean) {
  const statusRes = await db
    .prepare(`SELECT status, COUNT(*) as count FROM projects GROUP BY status`)
    .all<{ status: string; count: number }>();
  const workspaceRes = await db
    .prepare(`SELECT workspace, status, COUNT(*) as count FROM projects GROUP BY workspace, status`)
    .all<{ workspace: string; status: string; count: number }>();
  const featuredRow = await db
    .prepare(`SELECT COUNT(*) as count FROM projects WHERE featured = 1 AND status = 'published'`)
    .first<{ count: number }>();
  const mediaRow = await db
    .prepare(`SELECT COUNT(*) as count FROM project_media`)
    .first<{ count: number }>();
  const translationRow = await db
    .prepare(`SELECT COUNT(*) as count FROM project_translations`)
    .first<{ count: number }>();

  const statusMap: Record<string, number> = { published: 0, draft: 0, archived: 0 };
  for (const r of statusRes.results || []) {
    statusMap[String(r.status)] = Number(r.count);
  }

  return {
    ok: true,
    mode: "cloudflare-worker-d1-r2",
    d1Connected: true,
    r2Connected: r2Available,
    counts: {
      total: statusMap.published + statusMap.draft + statusMap.archived,
      published: statusMap.published,
      draft: statusMap.draft,
      archived: statusMap.archived,
      featuredPublished: Number(featuredRow?.count || 0),
      mediaItems: Number(mediaRow?.count || 0),
      translations: Number(translationRow?.count || 0)
    },
    workspaceBreakdown: (workspaceRes.results || []).map((r) => ({
      workspace: String(r.workspace),
      status: String(r.status),
      count: Number(r.count)
    }))
  };
}

async function listRevisionsInWorkerD1(db: D1Database, projectId: string) {
  const { results } = await db
    .prepare(
      `SELECT * FROM project_revisions WHERE project_id = ? ORDER BY revision_number DESC LIMIT 50`
    )
    .bind(projectId)
    .all<Record<string, unknown>>();
  return (results || []).map((r) => ({
    id: String(r.id),
    projectId: String(r.project_id),
    revisionNumber: Number(r.revision_number),
    action: String(r.action),
    snapshotJson: String(r.snapshot_json),
    actorEmail: String(r.actor_email),
    createdAt: String(r.created_at)
  }));
}

async function upsertProjectInWorkerD1(
  db: D1Database,
  input: Record<string, unknown>,
  actorEmail: string,
  actionLabel = "update"
): Promise<{ status: number; project?: Record<string, unknown>; error?: string }> {
  const cleanSlug = normalizeSlug(input.slug || input.titleEN || input.titleTR);
  if (!cleanSlug) {
    return { status: 400, error: "Project slug is required." };
  }

  const inputId = input.id ? String(input.id) : "";
  const existingById = inputId
    ? await db.prepare(`SELECT * FROM projects WHERE id = ?`).bind(inputId).first<Record<string, unknown>>()
    : null;
  const existingBySlug = await db
    .prepare(`SELECT * FROM projects WHERE slug = ?`)
    .bind(cleanSlug)
    .first<Record<string, unknown>>();

  if (existingBySlug && existingById && String(existingBySlug.id) !== String(existingById.id)) {
    return { status: 409, error: `Slug "${cleanSlug}" is already in use by another project.` };
  }
  if (existingBySlug && !existingById && actionLabel === "create") {
    return { status: 409, error: `Slug "${cleanSlug}" is already in use.` };
  }

  const existing = existingById || existingBySlug;
  const projectId = existing ? String(existing.id) : inputId || cleanSlug;
  const now = new Date().toISOString();

  const prevStatus = existing ? String(existing.status) : null;
  const rawReqStatus = String(input.cmsStatus || input.status || "");
  const nextStatus = ["draft", "published", "archived"].includes(rawReqStatus)
    ? rawReqStatus
    : prevStatus || "draft";

  const titleTR = String(input.titleTR || "").trim();
  const titleEN = String(input.titleEN || "").trim();
  const summaryTR = input.summaryTR !== undefined ? String(input.summaryTR) : undefined;
  const summaryEN = input.summaryEN !== undefined ? String(input.summaryEN) : undefined;
  const descriptionTR = input.descriptionTR !== undefined ? String(input.descriptionTR) : undefined;
  const descriptionEN = input.descriptionEN !== undefined ? String(input.descriptionEN) : undefined;

  if (nextStatus === "published") {
    if (!titleTR || !titleEN) {
      return {
        status: 400,
        error: "Both Turkish and English titles are required before publishing."
      };
    }
    if (
      !(descriptionTR?.trim() || summaryTR?.trim()) ||
      !(descriptionEN?.trim() || summaryEN?.trim())
    ) {
      return {
        status: 400,
        error: "Both Turkish and English descriptions are required before publishing."
      };
    }
  }

  const workspace = String(input.workspace || existing?.workspace || "design");
  if (!["design", "web", "motion-ai"].includes(workspace)) {
    return { status: 400, error: `Invalid workspace: ${workspace}` };
  }

  const maxSortRow = await db
    .prepare(`SELECT COALESCE(MAX(sort_order), 0) as maxSort FROM projects`)
    .first<{ maxSort: number }>();
  const sortOrder =
    typeof input.sortOrder === "number"
      ? input.sortOrder
      : existing
      ? Number(existing.sort_order || 0)
      : Number(maxSortRow?.maxSort || 0) + 1;
  const featuredOrder =
    typeof input.featuredOrder === "number"
      ? input.featuredOrder
      : existing
      ? Number(existing.featured_order || 0)
      : 0;

  const seoInput = (input.seo as Record<string, unknown> | undefined) || undefined;
  const cover =
    input.cover !== undefined
      ? input.cover
        ? String(input.cover)
        : null
      : existing?.cover_image_url
      ? String(existing.cover_image_url)
      : null;
  const thumbnail =
    input.thumbnail !== undefined
      ? input.thumbnail
        ? String(input.thumbnail)
        : null
      : cover ?? (existing?.thumbnail_url ? String(existing.thumbnail_url) : null);
  const desktopIcon =
    input.desktopIcon !== undefined
      ? input.desktopIcon
        ? String(input.desktopIcon)
        : null
      : thumbnail ?? (existing?.desktop_icon_url ? String(existing.desktop_icon_url) : null);
  const ogImage =
    input.ogImage !== undefined
      ? input.ogImage
        ? String(input.ogImage)
        : null
      : seoInput?.ogImage
      ? String(seoInput.ogImage)
      : cover ?? (existing?.og_image_url ? String(existing.og_image_url) : null);

  const desktopThumbnail =
    input.desktopThumbnail !== undefined
      ? input.desktopThumbnail
      : existing?.desktop_thumbnail_json
      ? parseJsonSafe<Record<string, unknown> | null>(existing.desktop_thumbnail_json, null)
      : thumbnail
      ? { src: thumbnail, width: 120, height: 90, scale: 1.0 }
      : null;

  const existingMeta = existing?.tags_json
    ? parseJsonSafe<ExtraProjectMetadataJson>(existing.tags_json, {})
    : {};
  const desktopInput = (input.desktop as Record<string, unknown> | undefined) || undefined;
  const initialWindowInput =
    (input.initialWindow as Record<string, unknown> | undefined) || undefined;

  const mediaInput = Array.isArray(input.media)
    ? (input.media as Record<string, unknown>[])
    : undefined;
  const mediaMeta: MediaItemMeta[] | undefined = mediaInput
    ? mediaInput.map((m) => ({
        originalId: m.id ? String(m.id) : undefined,
        layout: m.layout ? String(m.layout) : undefined,
        poster: m.poster ? String(m.poster) : undefined,
        thumbnail: m.thumbnail ? String(m.thumbnail) : undefined,
        aspectRatio: m.aspectRatio ? String(m.aspectRatio) : undefined,
        autoplay: typeof m.autoplay === "boolean" ? m.autoplay : undefined,
        muted: typeof m.muted === "boolean" ? m.muted : undefined,
        loop: typeof m.loop === "boolean" ? m.loop : undefined,
        preload: m.preload as "none" | "metadata" | "auto" | undefined,
        priority: typeof m.priority === "boolean" ? m.priority : undefined
      }))
    : existingMeta.mediaMeta;

  const extraMeta: ExtraProjectMetadataJson = {
    ...existingMeta,
    categoryIds: (input.categoryIds as string[] | undefined) ?? existingMeta.categoryIds,
    tags: (input.tags as string[] | undefined) ?? existingMeta.tags ?? [],
    tools: (input.tools as string[] | undefined) ?? existingMeta.tools ?? [],
    services: (input.services as string[] | undefined) ?? existingMeta.services,
    servicesTR: (input.servicesTR as string[] | undefined) ?? existingMeta.servicesTR,
    servicesEN: (input.servicesEN as string[] | undefined) ?? existingMeta.servicesEN,
    externalLinks:
      (input.externalLinks as Record<string, unknown>[] | undefined) ??
      existingMeta.externalLinks,
    hasExplicitExternalLinks:
      input.externalLinks !== undefined
        ? Boolean(input.externalLinks)
        : existingMeta.hasExplicitExternalLinks ?? false,
    contentBlocks:
      (input.contentBlocks as Record<string, unknown>[] | undefined) ??
      existingMeta.contentBlocks,
    desktopLabelTR:
      input.desktopLabelTR !== undefined
        ? String(input.desktopLabelTR)
        : existingMeta.desktopLabelTR,
    desktopLabelEN:
      input.desktopLabelEN !== undefined
        ? String(input.desktopLabelEN)
        : existingMeta.desktopLabelEN,
    challengeTR:
      input.challengeTR !== undefined ? String(input.challengeTR) : existingMeta.challengeTR,
    challengeEN:
      input.challengeEN !== undefined ? String(input.challengeEN) : existingMeta.challengeEN,
    solutionTR:
      input.solutionTR !== undefined ? String(input.solutionTR) : existingMeta.solutionTR,
    solutionEN:
      input.solutionEN !== undefined ? String(input.solutionEN) : existingMeta.solutionEN,
    resultTR: input.resultTR !== undefined ? String(input.resultTR) : existingMeta.resultTR,
    resultEN: input.resultEN !== undefined ? String(input.resultEN) : existingMeta.resultEN,
    desktopWidth:
      desktopInput?.width !== undefined
        ? Number(desktopInput.width)
        : existingMeta.desktopWidth,
    desktopWeight:
      (input.desktopWeight as "small" | "normal" | "large" | undefined) ??
      existingMeta.desktopWeight,
    projectStatus:
      (input.projectStatus as "completed" | "ongoing" | "concept" | undefined) ??
      existingMeta.projectStatus ??
      "completed",
    hasExplicitSeo:
      input.seo !== undefined ? Boolean(input.seo) : existingMeta.hasExplicitSeo ?? false,
    hasExplicitOgImage:
      input.ogImage !== undefined
        ? Boolean(input.ogImage)
        : existingMeta.hasExplicitOgImage ?? false,
    mediaMeta
  };

  const publishedAt =
    nextStatus === "published"
      ? existing?.published_at
        ? String(existing.published_at)
        : now
      : existing?.published_at
      ? String(existing.published_at)
      : null;

  const archivedAt =
    nextStatus === "archived"
      ? now
      : nextStatus === "published" || nextStatus === "draft"
      ? null
      : existing?.archived_at
      ? String(existing.archived_at)
      : null;

  const revRow = await db
    .prepare(
      `SELECT COALESCE(MAX(revision_number), 0) as maxRev FROM project_revisions WHERE project_id = ?`
    )
    .bind(projectId)
    .first<{ maxRev: number }>();
  const nextRev = Number(revRow?.maxRev || 0) + 1;

  const statements: D1PreparedStatement[] = [];

  const yearStr = input.year !== undefined ? String(input.year || "") : String(existing?.year ?? "");

  if (!existing) {
    statements.push(
      db
        .prepare(
          `INSERT INTO projects (
            id, slug, status, workspace, featured, featured_order, sort_order,
            client_name, year, live_url, source_url, initials,
            cover_image_url, thumbnail_url, desktop_icon_url, og_image_url,
            desktop_thumbnail_json, desktop_position_x, desktop_position_y,
            window_width, window_height, tags_json,
            created_at, updated_at, published_at, archived_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          projectId,
          cleanSlug,
          nextStatus,
          workspace,
          input.featured ? 1 : 0,
          featuredOrder,
          sortOrder,
          String(input.client || ""),
          yearStr,
          input.liveUrl ? String(input.liveUrl) : null,
          input.sourceUrl ? String(input.sourceUrl) : null,
          input.initials ? String(input.initials) : cleanSlug.slice(0, 2).toUpperCase(),
          cover,
          thumbnail,
          desktopIcon,
          ogImage,
          desktopThumbnail ? JSON.stringify(desktopThumbnail) : null,
          Number(desktopInput?.x ?? 28),
          Number(desktopInput?.y ?? 28),
          Number(initialWindowInput?.width ?? 820),
          Number(initialWindowInput?.height ?? 600),
          JSON.stringify(extraMeta),
          now,
          now,
          publishedAt,
          archivedAt
        )
    );
  } else {
    statements.push(
      db
        .prepare(
          `UPDATE projects SET
            slug = ?, status = ?, workspace = ?, featured = ?, featured_order = ?, sort_order = ?,
            client_name = ?, year = ?, live_url = ?, source_url = ?, initials = ?,
            cover_image_url = ?, thumbnail_url = ?, desktop_icon_url = ?, og_image_url = ?,
            desktop_thumbnail_json = ?, desktop_position_x = ?, desktop_position_y = ?,
            window_width = ?, window_height = ?, tags_json = ?,
            updated_at = ?, published_at = ?, archived_at = ?
          WHERE id = ?`
        )
        .bind(
          cleanSlug,
          nextStatus,
          workspace,
          input.featured ? 1 : 0,
          featuredOrder,
          sortOrder,
          String(input.client ?? existing.client_name ?? ""),
          yearStr,
          input.liveUrl ? String(input.liveUrl) : null,
          input.sourceUrl ? String(input.sourceUrl) : null,
          input.initials
            ? String(input.initials)
            : existing.initials
            ? String(existing.initials)
            : cleanSlug.slice(0, 2).toUpperCase(),
          cover,
          thumbnail,
          desktopIcon,
          ogImage,
          desktopThumbnail ? JSON.stringify(desktopThumbnail) : null,
          Number(desktopInput?.x ?? existing.desktop_position_x ?? 28),
          Number(desktopInput?.y ?? existing.desktop_position_y ?? 28),
          Number(initialWindowInput?.width ?? existing.window_width ?? 820),
          Number(initialWindowInput?.height ?? existing.window_height ?? 600),
          JSON.stringify(extraMeta),
          now,
          publishedAt,
          archivedAt,
          projectId
        )
    );
  }

  const subtitleTR =
    input.subtitleTR !== undefined
      ? String(input.subtitleTR)
      : input.projectTypeTR !== undefined
      ? String(input.projectTypeTR)
      : null;
  const subtitleEN =
    input.subtitleEN !== undefined
      ? String(input.subtitleEN)
      : input.projectTypeEN !== undefined
      ? String(input.projectTypeEN)
      : null;

  statements.push(
    db
      .prepare(
        `INSERT INTO project_translations (
          id, project_id, locale, title, subtitle, summary, description, role,
          category_label, seo_title, seo_description, deliverables_json, highlights_json, updated_at
        ) VALUES (?, ?, 'tr', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, locale) DO UPDATE SET
          title = excluded.title,
          subtitle = excluded.subtitle,
          summary = excluded.summary,
          description = excluded.description,
          role = excluded.role,
          category_label = excluded.category_label,
          seo_title = excluded.seo_title,
          seo_description = excluded.seo_description,
          deliverables_json = excluded.deliverables_json,
          highlights_json = excluded.highlights_json,
          updated_at = excluded.updated_at`
      )
      .bind(
        `${projectId}:tr`,
        projectId,
        titleTR || cleanSlug,
        subtitleTR,
        summaryTR ?? null,
        descriptionTR ?? "",
        input.roleTR ? String(input.roleTR) : null,
        String(input.categoryTR || ""),
        seoInput?.titleTR ? String(seoInput.titleTR) : null,
        seoInput?.descriptionTR ? String(seoInput.descriptionTR) : null,
        JSON.stringify(input.deliverablesTR || input.servicesTR || []),
        JSON.stringify(input.highlightsTR || []),
        now
      )
  );

  statements.push(
    db
      .prepare(
        `INSERT INTO project_translations (
          id, project_id, locale, title, subtitle, summary, description, role,
          category_label, seo_title, seo_description, deliverables_json, highlights_json, updated_at
        ) VALUES (?, ?, 'en', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, locale) DO UPDATE SET
          title = excluded.title,
          subtitle = excluded.subtitle,
          summary = excluded.summary,
          description = excluded.description,
          role = excluded.role,
          category_label = excluded.category_label,
          seo_title = excluded.seo_title,
          seo_description = excluded.seo_description,
          deliverables_json = excluded.deliverables_json,
          highlights_json = excluded.highlights_json,
          updated_at = excluded.updated_at`
      )
      .bind(
        `${projectId}:en`,
        projectId,
        titleEN || titleTR || cleanSlug,
        subtitleEN,
        summaryEN ?? null,
        descriptionEN ?? "",
        input.roleEN ? String(input.roleEN) : null,
        String(input.categoryEN || input.categoryTR || ""),
        seoInput?.titleEN ? String(seoInput.titleEN) : null,
        seoInput?.descriptionEN ? String(seoInput.descriptionEN) : null,
        JSON.stringify(input.deliverablesEN || input.servicesEN || []),
        JSON.stringify(input.highlightsEN || []),
        now
      )
  );

  if (mediaInput) {
    // Deterministic gallery IDs (`<projectId>-media-N`) can collide with orphaned rows left
    // behind by `ON DELETE SET NULL` when a project ID is deleted and later re-created.
    const plannedGalleryIds = mediaInput
      .map((m, i) => (m?.src ? `${projectId}-media-${i + 1}` : null))
      .filter((v): v is string => Boolean(v));
    for (const gid of plannedGalleryIds) {
      const owner = await db
        .prepare(`SELECT project_id FROM project_media WHERE id = ? LIMIT 1`)
        .bind(gid)
        .first<{ project_id: string | null }>();
      if (owner && owner.project_id && owner.project_id !== projectId) {
        return {
          status: 409,
          error: `Media id "${gid}" is already owned by another project.`
        };
      }
    }
    statements.push(
      db
        .prepare(`DELETE FROM project_media WHERE project_id = ? AND kind = 'gallery'`)
        .bind(projectId)
    );
    for (const gid of plannedGalleryIds) {
      statements.push(
        db
          .prepare(`DELETE FROM project_media WHERE id = ? AND project_id IS NULL`)
          .bind(gid)
      );
    }
    for (let i = 0; i < mediaInput.length; i++) {
      const m = mediaInput[i];
      if (!m?.src) continue;
      const srcStr = String(m.src);
      const filename = srcStr.split("/").pop() || "asset.webp";
      const mId = `${projectId}-media-${i + 1}`;
      statements.push(
        db
          .prepare(
            `INSERT INTO project_media (
              id, project_id, kind, media_type, storage_key, public_url, filename,
              mime_type, byte_size, width, height, alt_tr, alt_en, caption_tr, caption_en,
              sort_order, created_at, updated_at
            ) VALUES (?, ?, 'gallery', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            mId,
            projectId,
            m.type === "video" ? "video" : "image",
            srcStr.replace(/^\//, ""),
            srcStr,
            filename,
            m.type === "video" ? "video/mp4" : "image/webp",
            m.width !== undefined && m.width !== null ? Number(m.width) : null,
            m.height !== undefined && m.height !== null ? Number(m.height) : null,
            m.altTR ? String(m.altTR) : titleTR || cleanSlug,
            m.altEN ? String(m.altEN) : titleEN || cleanSlug,
            m.captionTR ? String(m.captionTR) : null,
            m.captionEN ? String(m.captionEN) : null,
            i + 1,
            now,
            now
          )
      );
    }
  }

  // Associate any unassociated project_media rows for this project slug/id
  statements.push(
    db
      .prepare(
        `UPDATE project_media SET project_id = ? WHERE (project_id IS NULL OR project_id = '') AND (storage_key LIKE ? OR storage_key LIKE ?)`
      )
      .bind(projectId, `projects/${cleanSlug}/%`, `projects/${projectId}/%`)
  );

  statements.push(
    db
      .prepare(
        `INSERT INTO project_revisions (id, project_id, revision_number, action, snapshot_json, actor_email, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        `rev-${projectId}-${nextRev}-${crypto.randomUUID().slice(0, 6)}`,
        projectId,
        nextRev,
        existing ? actionLabel : "create",
        JSON.stringify(input),
        actorEmail,
        now
      )
  );

  if (!existing || prevStatus !== nextStatus) {
    const eventType =
      nextStatus === "published"
        ? "publish"
        : nextStatus === "archived"
        ? "archive"
        : prevStatus === "published" && nextStatus === "draft"
        ? "unpublish"
        : "draft_saved";
    statements.push(
      db
        .prepare(
          `INSERT INTO publishing_events (id, project_id, event_type, previous_status, new_status, actor_email, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `pub-${crypto.randomUUID()}`,
          projectId,
          eventType,
          prevStatus,
          nextStatus,
          actorEmail,
          `Status set to ${nextStatus}`,
          now
        )
    );
  }

  statements.push(
    db
      .prepare(
        `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
         VALUES (?, ?, ?, 'project', ?, ?, ?)`
      )
      .bind(
        `audit-${crypto.randomUUID()}`,
        actorEmail,
        existing ? `project_${actionLabel}` : "project_create",
        projectId,
        JSON.stringify({ slug: cleanSlug, status: nextStatus, workspace }),
        now
      )
  );

  await db.batch(statements);

  const hydrated = await queryCmsProjectsFromWorkerD1(db, "WHERE id = ?", [projectId]);
  if (!hydrated[0]) {
    return { status: 500, error: "Failed to load project after D1 batch write." };
  }
  return { status: existing ? 200 : 201, project: hydrated[0] };
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
      const db = getDb(env);
      const bucket = getBucket(env);

      // ---------------------------------------------------------
      // PUBLIC READ ENDPOINTS (Published projects & R2 media only)
      // ---------------------------------------------------------
      if (pathname === "/api/v1/public/health" && request.method === "GET") {
        const countRow = await db
          .prepare(`SELECT COUNT(*) as count FROM projects WHERE status = ?`)
          .bind("published")
          .first<{ count: number }>();
        return jsonResponse(
          {
            ok: true,
            service: "kerem-mihci-portfolio-api",
            bindings: {
              d1: "PORTFOLIO_DB",
              r2: "PORTFOLIO_MEDIA"
            },
            publishedCount: countRow?.count ?? 0,
            timestamp: new Date().toISOString()
          },
          200,
          origin,
          "public, max-age=5"
        );
      }

      if (pathname === "/api/v1/public/projects" && request.method === "GET") {
        const projects = await queryCmsProjectsFromWorkerD1(db, "WHERE status = ?", ["published"]);
        return jsonResponse(
          { ok: true, projects },
          200,
          origin,
          "no-store"
        );
      }

      if (pathname.startsWith("/api/v1/public/projects/") && request.method === "GET") {
        const slug = decodeURIComponent(pathname.replace("/api/v1/public/projects/", ""));
        const projects = await queryCmsProjectsFromWorkerD1(
          db,
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
          "no-store"
        );
      }

      if (pathname.startsWith("/api/v1/public/media/") && request.method === "GET") {
        const key = decodeURIComponent(pathname.replace("/api/v1/public/media/", ""));
        if (!key || key.includes("..") || key.startsWith("/")) {
          return jsonResponse(
            { ok: false, error: "Invalid media key" },
            400,
            origin,
            "no-store, no-cache, must-revalidate"
          );
        }

        // Strict authorization check: Only media with an explicit project_media record
        // associated with an active published project is authorized for public delivery.
        // Zero database writes occur during public GET requests.
        // Unregistered objects, missing project_media rows, draft, and archived media return 404 with no-store.
        const mediaAssoc = await db
          .prepare(
            `SELECT pm.id, pm.project_id, pm.kind, p.status as project_status, p.slug as project_slug
             FROM project_media pm
             INNER JOIN projects p ON pm.project_id = p.id
             WHERE pm.storage_key = ?
             LIMIT 1`
          )
          .bind(key)
          .first<{
            id: string;
            project_id: string;
            kind: string;
            project_status: string;
            project_slug: string;
          }>();

        const isAuthorized = Boolean(
          mediaAssoc &&
          mediaAssoc.project_id &&
          mediaAssoc.project_status === "published"
        );

        if (!isAuthorized) {
          return jsonResponse(
            { ok: false, error: "Media asset not found or not published" },
            404,
            origin,
            "no-store, no-cache, must-revalidate"
          );
        }

        // Support Range requests (video streaming) and conditional ETag revalidation
        const rangeHeader = request.headers.get("Range");
        const getOptions: R2GetOptions = {};
        if (rangeHeader) {
          getOptions.range = request.headers;
        }

        const obj = await bucket.get(key, getOptions);
        if (!obj) {
          return jsonResponse(
            { ok: false, error: "Media not found" },
            404,
            origin,
            "no-store, no-cache, must-revalidate"
          );
        }

        // Bounded public cache policy with conditional ETag validation
        const objectEtag =
          obj.httpEtag || (obj.etag ? (obj.etag.startsWith('"') ? obj.etag : `"${obj.etag}"`) : undefined);
        const ifNoneMatch = request.headers.get("If-None-Match");
        if (ifNoneMatch && objectEtag && ifNoneMatch === objectEtag) {
          return new Response(null, {
            status: 304,
            headers: {
              ETag: objectEtag,
              "Cache-Control":
                "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
              "Access-Control-Allow-Origin": origin
            }
          });
        }

        const headers = new Headers();
        headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
        headers.set(
          "Cache-Control",
          "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
        );
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Accept-Ranges", "bytes");
        if (objectEtag) {
          headers.set("ETag", objectEtag);
        }

        // Handle partial content (206) if Range was requested and fulfilled
        const isRange = Boolean(rangeHeader && obj.range);
        if (isRange && obj.range) {
          const start = obj.range.offset;
          const end = obj.range.offset + obj.range.length - 1;
          headers.set("Content-Range", `bytes ${start}-${end}/${obj.size}`);
          headers.set("Content-Length", String(obj.range.length));
          return new Response(obj.body, {
            status: 206,
            headers
          });
        }

        headers.set("Content-Length", String(obj.size));
        return new Response(obj.body, {
          status: 200,
          headers
        });
      }

      // ---------------------------------------------------------
      // ADMIN ENDPOINTS (Require CLOUDFLARE_API_SERVICE_TOKEN)
      // ---------------------------------------------------------
      if (pathname.startsWith("/api/v1/admin/")) {
        const tokenCheck = verifyServiceToken(request, env);
        if (!tokenCheck.ok) {
          return jsonResponse(
            { ok: false, error: tokenCheck.error || "Unauthorized" },
            tokenCheck.status,
            origin
          );
        }

        const actorEmail = request.headers.get("X-Actor-Email") || "admin@keremmihci.com";

        if (pathname === "/api/v1/admin/health" && request.method === "GET") {
          const d1Health = await getWorkerD1Health(db, Boolean(bucket));
          return jsonResponse(d1Health, 200, origin);
        }

        // Durable Admin Session Store Endpoint (D1-backed)
        if (pathname === "/api/v1/admin/auth/sessions" && request.method === "POST") {
          let body: Record<string, unknown>;
          try {
            body = (await request.json()) as Record<string, unknown>;
          } catch {
            return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400, origin);
          }

          const action = String(body.action || "");
          const nowSec = Math.floor(Date.now() / 1000);

          try {
            // Opportunistic expired session cleanup (> 24h past expiry)
          await db
            .prepare(`DELETE FROM admin_sessions WHERE expires_at < ? AND revoked_at IS NULL`)
            .bind(nowSec - 86400)
            .run();

          if (action === "create") {
            const jtiHash = String(body.jtiHash || "");
            const csrfTokenHash = String(body.csrfTokenHash || "");
            const sessEmail = String(body.actorEmail || "");
            const role = String(body.role || "owner");
            const issuedAt = Number(body.issuedAt || nowSec);
            const expiresAt = Number(body.expiresAt || nowSec + 28800);
            const ipHash = body.ipHash ? String(body.ipHash) : null;
            const userAgent = body.userAgent ? String(body.userAgent).slice(0, 250) : null;

            if (!jtiHash || !csrfTokenHash || !sessEmail) {
              return jsonResponse(
                { ok: false, error: "Missing required session fields" },
                400,
                origin
              );
            }

            await db
              .prepare(
                `INSERT INTO admin_sessions (
                  jti_hash, actor_email, role, csrf_token_hash, issued_at, expires_at,
                  revoked_at, revoked_reason, ip_hash, user_agent, last_seen_at
                ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
                ON CONFLICT(jti_hash) DO UPDATE SET
                  actor_email = excluded.actor_email,
                  role = excluded.role,
                  csrf_token_hash = excluded.csrf_token_hash,
                  issued_at = excluded.issued_at,
                  expires_at = excluded.expires_at,
                  revoked_at = NULL,
                  revoked_reason = NULL,
                  last_seen_at = excluded.last_seen_at`
              )
              .bind(
                jtiHash,
                sessEmail,
                role,
                csrfTokenHash,
                issuedAt,
                expiresAt,
                ipHash,
                userAgent,
                nowSec
              )
              .run();

            return jsonResponse({ ok: true, created: true }, 201, origin);
          }

          if (action === "verify") {
            const jtiHash = String(body.jtiHash || "");
            if (!jtiHash) {
              return jsonResponse({ ok: true, valid: false, reason: "missing_jti" }, 200, origin);
            }
            const row = await db
              .prepare(`SELECT * FROM admin_sessions WHERE jti_hash = ? LIMIT 1`)
              .bind(jtiHash)
              .first<Record<string, unknown>>();
            if (!row) {
              return jsonResponse(
                { ok: true, valid: false, reason: "session_not_found" },
                200,
                origin
              );
            }
            const revokedAt =
              row.revoked_at !== null && row.revoked_at !== undefined
                ? Number(row.revoked_at)
                : null;
            const expiresAt = Number(row.expires_at);
            if (revokedAt !== null) {
              return jsonResponse(
                { ok: true, valid: false, reason: "session_revoked" },
                200,
                origin
              );
            }
            if (expiresAt <= nowSec) {
              return jsonResponse(
                { ok: true, valid: false, reason: "session_expired" },
                200,
                origin
              );
            }

            await db
              .prepare(`UPDATE admin_sessions SET last_seen_at = ? WHERE jti_hash = ?`)
              .bind(nowSec, jtiHash)
              .run();

            return jsonResponse(
              {
                ok: true,
                valid: true,
                session: {
                  jtiHash: String(row.jti_hash),
                  actorEmail: String(row.actor_email),
                  role: String(row.role),
                  csrfTokenHash: String(row.csrf_token_hash),
                  issuedAt: Number(row.issued_at),
                  expiresAt,
                  revokedAt: null,
                  revokedReason: null
                }
              },
              200,
              origin
            );
          }

          if (action === "revoke") {
            const jtiHash = body.jtiHash ? String(body.jtiHash) : "";
            const sessEmail = body.actorEmail ? String(body.actorEmail) : "";
            const revokeAllForActor = Boolean(body.revokeAllForActor);
            const reason = String(body.reason || "user_logout");

            let revokedCount = 0;
            if (revokeAllForActor && sessEmail) {
              const res = await db
                .prepare(
                  `UPDATE admin_sessions
                   SET revoked_at = ?, revoked_reason = ?
                   WHERE actor_email = ? AND revoked_at IS NULL`
                )
                .bind(nowSec, reason, sessEmail)
                .run();
              revokedCount += Number(res.meta?.changes || 0);
            }
            if (jtiHash) {
              const res = await db
                .prepare(
                  `UPDATE admin_sessions
                   SET revoked_at = ?, revoked_reason = ?
                   WHERE jti_hash = ? AND revoked_at IS NULL`
                )
                .bind(nowSec, reason, jtiHash)
                .run();
              revokedCount += Number(res.meta?.changes || 0);
            }

            return jsonResponse({ ok: true, revoked: true, revokedCount }, 200, origin);
          }

          return jsonResponse({ ok: false, error: "Invalid session action" }, 400, origin);
        } catch (dbErr) {
          console.error("D1 session store error:", dbErr);
          return jsonResponse(
            { ok: false, error: "Database session store temporarily unavailable" },
            503,
            origin
          );
        }
      }

      // Durable Login Rate Limit Endpoint (D1-backed)
        if (pathname === "/api/v1/admin/auth/rate-limit" && request.method === "POST") {
          let body: Record<string, unknown>;
          try {
            body = (await request.json()) as Record<string, unknown>;
          } catch {
            return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400, origin);
          }

          const action = String(body.action || "");
          const scopeKeys = Array.isArray(body.scopeKeys)
            ? body.scopeKeys.map((k) => String(k)).filter(Boolean)
            : [];
          const nowMs = typeof body.nowMs === "number" ? body.nowMs : Date.now();
          const nowSec = Math.floor(nowMs / 1000);
          const windowSec = typeof body.windowSec === "number" ? body.windowSec : 900;
          const maxAttempts = typeof body.maxAttempts === "number" ? body.maxAttempts : 5;
          const lockoutSec = typeof body.lockoutSec === "number" ? body.lockoutSec : 900;

          try {

          // Prune expired buckets
          await db
            .prepare(
              `DELETE FROM admin_rate_limits WHERE (locked_until <= ? AND window_started_at <= ?)`
            )
            .bind(nowSec, nowSec - windowSec)
            .run();

          if (action === "check") {
            let worstRetryAfter = 0;
            let minRemaining = maxAttempts;

            for (const key of scopeKeys) {
              const row = await db
                .prepare(`SELECT * FROM admin_rate_limits WHERE scope_key = ? LIMIT 1`)
                .bind(key)
                .first<Record<string, unknown>>();
              if (!row) continue;

              const lockedUntil = Number(row.locked_until || 0);
              const windowStartedAt = Number(row.window_started_at || 0);
              const attemptCount = Number(row.attempt_count || 0);

              if (lockedUntil > nowSec) {
                const retry = Math.max(1, lockedUntil - nowSec);
                if (retry > worstRetryAfter) worstRetryAfter = retry;
                minRemaining = 0;
                continue;
              }

              if (nowSec - windowStartedAt > windowSec) {
                await db
                  .prepare(`DELETE FROM admin_rate_limits WHERE scope_key = ?`)
                  .bind(key)
                  .run();
                continue;
              }

              const rem = Math.max(0, maxAttempts - attemptCount);
              if (rem < minRemaining) minRemaining = rem;
            }

            if (worstRetryAfter > 0) {
              return jsonResponse(
                {
                  ok: true,
                  allowed: false,
                  retryAfterSec: worstRetryAfter,
                  remainingAttempts: 0
                },
                200,
                origin
              );
            }

            return jsonResponse(
              {
                ok: true,
                allowed: true,
                retryAfterSec: 0,
                remainingAttempts: minRemaining
              },
              200,
              origin
            );
          }

          if (action === "record_failure") {
            const countRow = await db
              .prepare(`SELECT COUNT(*) as count FROM admin_rate_limits`)
              .first<{ count: number }>();
            if (Number(countRow?.count || 0) >= 1000) {
              await db
                .prepare(
                  `DELETE FROM admin_rate_limits
                   WHERE scope_key IN (
                     SELECT scope_key FROM admin_rate_limits
                     ORDER BY updated_at ASC
                     LIMIT 200
                   )`
                )
                .run();
            }

            let anyLocked = false;
            let maxRetrySec = 0;
            let minRemaining = maxAttempts;

            for (const key of scopeKeys) {
              const existing = await db
                .prepare(`SELECT * FROM admin_rate_limits WHERE scope_key = ? LIMIT 1`)
                .bind(key)
                .first<Record<string, unknown>>();

              let count = 1;
              let windowStart = nowSec;
              let lockedUntil = 0;

              if (existing) {
                const prevWindow = Number(existing.window_started_at || 0);
                const prevLocked = Number(existing.locked_until || 0);
                if (nowSec - prevWindow <= windowSec && prevLocked <= nowSec) {
                  count = Number(existing.attempt_count || 0) + 1;
                  windowStart = prevWindow;
                } else if (prevLocked > nowSec) {
                  count = Number(existing.attempt_count || 0) + 1;
                  windowStart = prevWindow;
                  lockedUntil = prevLocked;
                }
              }

              if (count >= maxAttempts && lockedUntil <= nowSec) {
                lockedUntil = nowSec + lockoutSec;
              }

              await db
                .prepare(
                  `INSERT INTO admin_rate_limits (scope_key, attempt_count, window_started_at, locked_until, updated_at)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(scope_key) DO UPDATE SET
                     attempt_count = excluded.attempt_count,
                     window_started_at = excluded.window_started_at,
                     locked_until = excluded.locked_until,
                     updated_at = excluded.updated_at`
                )
                .bind(key, count, windowStart, lockedUntil, nowSec)
                .run();

              if (lockedUntil > nowSec) {
                anyLocked = true;
                const retry = Math.max(1, lockedUntil - nowSec);
                if (retry > maxRetrySec) maxRetrySec = retry;
                minRemaining = 0;
              } else {
                const rem = Math.max(0, maxAttempts - count);
                if (rem < minRemaining) minRemaining = rem;
              }
            }

            return jsonResponse(
              {
                ok: true,
                locked: anyLocked,
                retryAfterSec: maxRetrySec,
                remainingAttempts: minRemaining
              },
              200,
              origin
            );
          }

          if (action === "clear") {
            for (const key of scopeKeys) {
              await db
                .prepare(`DELETE FROM admin_rate_limits WHERE scope_key = ?`)
                .bind(key)
                .run();
            }
            return jsonResponse({ ok: true, cleared: true }, 200, origin);
          }

          return jsonResponse({ ok: false, error: "Invalid rate-limit action" }, 400, origin);
        } catch (dbErr) {
          console.error("D1 rate-limit store error:", dbErr);
          return jsonResponse(
            { ok: false, error: "Database rate-limit store temporarily unavailable" },
            503,
            origin
          );
        }
      }

        if (pathname === "/api/v1/admin/system" && request.method === "GET") {
          const d1Health = await getWorkerD1Health(db, Boolean(bucket));
          const auditRes = await db
            .prepare(`SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 40`)
            .all<Record<string, unknown>>();
          const pubRes = await db
            .prepare(`SELECT * FROM publishing_events ORDER BY created_at DESC LIMIT 40`)
            .all<Record<string, unknown>>();

          return jsonResponse(
            {
              ok: true,
              d1Health,
              auditLogs: (auditRes.results || []).map((r) => ({
                id: String(r.id),
                actorEmail: String(r.actor_email),
                action: String(r.action),
                entityType: String(r.entity_type),
                entityId: r.entity_id ? String(r.entity_id) : null,
                detailsJson: r.details_json ? String(r.details_json) : null,
                ipAddress: r.ip_address ? String(r.ip_address) : null,
                createdAt: String(r.created_at)
              })),
              publishingEvents: (pubRes.results || []).map((r) => ({
                id: String(r.id),
                projectId: String(r.project_id),
                eventType: String(r.event_type),
                previousStatus: r.previous_status ? String(r.previous_status) : null,
                newStatus: String(r.new_status),
                actorEmail: String(r.actor_email),
                notes: r.notes ? String(r.notes) : null,
                createdAt: String(r.created_at)
              }))
            },
            200,
            origin
          );
        }

        if (pathname === "/api/v1/admin/projects" && request.method === "GET") {
          const projects = await queryCmsProjectsFromWorkerD1(db, "", []);
          const health = await getWorkerD1Health(db, Boolean(bucket));
          return jsonResponse({ ok: true, projects, health }, 200, origin);
        }

        if (pathname === "/api/v1/admin/projects" && request.method === "POST") {
          let body: Record<string, unknown>;
          try {
            body = (await request.json()) as Record<string, unknown>;
          } catch {
            return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400, origin);
          }

          if (
            body.actionType === "reorder-featured" &&
            body.workspace &&
            Array.isArray(body.featuredItems)
          ) {
            const workspace = String(body.workspace);
            const items = body.featuredItems as {
              id: string;
              featured: boolean;
              featuredOrder: number;
            }[];
            const now = new Date().toISOString();
            const stmts: D1PreparedStatement[] = items.map((item) =>
              db
                .prepare(
                  `UPDATE projects SET featured = ?, featured_order = ?, updated_at = ? WHERE id = ? AND workspace = ?`
                )
                .bind(item.featured ? 1 : 0, item.featuredOrder, now, item.id, workspace)
            );
            stmts.push(
              db
                .prepare(
                  `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
                   VALUES (?, ?, 'featured_order_update', 'workspace', ?, ?, ?)`
                )
                .bind(
                  `audit-${crypto.randomUUID()}`,
                  actorEmail,
                  workspace,
                  JSON.stringify({ count: items.length }),
                  now
                )
            );
            await db.batch(stmts);
            const updated = await queryCmsProjectsFromWorkerD1(db, "", []);
            return jsonResponse({ ok: true, projects: updated }, 200, origin);
          }

          const res = await upsertProjectInWorkerD1(
            db,
            body,
            actorEmail,
            String(body.actionType || (body.id ? "update" : "create"))
          );
          if (res.error || !res.project) {
            return jsonResponse({ ok: false, error: res.error }, res.status, origin);
          }
          return jsonResponse({ ok: true, project: res.project }, 201, origin);
        }

        if (pathname.startsWith("/api/v1/admin/projects/")) {
          const idOrSlug = decodeURIComponent(pathname.replace("/api/v1/admin/projects/", ""));
          if (!idOrSlug) {
            return jsonResponse({ ok: false, error: "Missing project identifier" }, 400, origin);
          }

          if (request.method === "GET") {
            const found = await queryCmsProjectsFromWorkerD1(
              db,
              "WHERE id = ? OR slug = ?",
              [idOrSlug, idOrSlug]
            );
            if (!found[0]) {
              return jsonResponse({ ok: false, error: "Project not found" }, 404, origin);
            }
            const revisions = await listRevisionsInWorkerD1(db, String(found[0].id));
            return jsonResponse({ ok: true, project: found[0], revisions }, 200, origin);
          }

          if (request.method === "PUT") {
            let body: Record<string, unknown>;
            try {
              body = (await request.json()) as Record<string, unknown>;
            } catch {
              return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400, origin);
            }
            const res = await upsertProjectInWorkerD1(
              db,
              { ...body, id: body.id || idOrSlug },
              actorEmail,
              "update"
            );
            if (res.error || !res.project) {
              return jsonResponse({ ok: false, error: res.error }, res.status, origin);
            }
            const revisions = await listRevisionsInWorkerD1(db, String(res.project.id));
            return jsonResponse({ ok: true, project: res.project, revisions }, 200, origin);
          }

          if (request.method === "PATCH") {
            let body: Record<string, unknown>;
            try {
              body = (await request.json()) as Record<string, unknown>;
            } catch {
              return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400, origin);
            }

            const found = await queryCmsProjectsFromWorkerD1(
              db,
              "WHERE id = ? OR slug = ?",
              [idOrSlug, idOrSlug]
            );
            if (!found[0]) {
              return jsonResponse({ ok: false, error: "Project not found" }, 404, origin);
            }
            const target = found[0];
            const projectId = String(target.id);

            if (typeof body.rollbackRevisionNumber === "number") {
              const revNum = body.rollbackRevisionNumber;
              const revRow = await db
                .prepare(
                  `SELECT * FROM project_revisions WHERE project_id = ? AND revision_number = ? LIMIT 1`
                )
                .bind(projectId, revNum)
                .first<Record<string, unknown>>();
              if (!revRow) {
                return jsonResponse(
                  { ok: false, error: `Revision #${revNum} not found.` },
                  404,
                  origin
                );
              }
              const snapshot = parseJsonSafe<Record<string, unknown>>(revRow.snapshot_json, {});
              const res = await upsertProjectInWorkerD1(
                db,
                { ...snapshot, id: projectId },
                actorEmail,
                `rollback_rev_${revNum}`
              );
              if (res.error || !res.project) {
                return jsonResponse({ ok: false, error: res.error }, res.status, origin);
              }
              const revisions = await listRevisionsInWorkerD1(db, projectId);
              return jsonResponse({ ok: true, project: res.project, revisions }, 200, origin);
            }

            const desiredStatus = String(body.cmsStatus || body.status || "");
            if (!["draft", "published", "archived"].includes(desiredStatus)) {
              return jsonResponse({ ok: false, error: "Invalid status value." }, 400, origin);
            }
            const actionLabel =
              desiredStatus === "published"
                ? "publish"
                : desiredStatus === "archived"
                ? "archive"
                : target.cmsStatus === "published"
                ? "unpublish"
                : "status_change";

            const res = await upsertProjectInWorkerD1(
              db,
              { ...target, cmsStatus: desiredStatus },
              actorEmail,
              body.notes ? `${actionLabel}:${String(body.notes)}` : actionLabel
            );
            if (res.error || !res.project) {
              return jsonResponse({ ok: false, error: res.error }, res.status, origin);
            }
            const revisions = await listRevisionsInWorkerD1(db, projectId);
            return jsonResponse({ ok: true, project: res.project, revisions }, 200, origin);
          }

          if (request.method === "DELETE") {
            const existing = await db
              .prepare(`SELECT id, slug FROM projects WHERE id = ? OR slug = ? LIMIT 1`)
              .bind(idOrSlug, idOrSlug)
              .first<{ id: string; slug: string }>();
            if (!existing) {
              return jsonResponse({ ok: false, error: "Project not found" }, 404, origin);
            }
            const now = new Date().toISOString();
            await db.batch([
              db
                .prepare(`DELETE FROM project_media WHERE project_id = ? AND kind = 'gallery'`)
                .bind(existing.id),
              db.prepare(`DELETE FROM projects WHERE id = ?`).bind(existing.id),
              db
                .prepare(
                  `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
                   VALUES (?, ?, 'project_delete', 'project', ?, ?, ?)`
                )
                .bind(
                  `audit-${crypto.randomUUID()}`,
                  actorEmail,
                  existing.id,
                  JSON.stringify({ slug: existing.slug }),
                  now
                )
            ]);
            return jsonResponse(
              { ok: true, deletedId: existing.id, slug: existing.slug },
              200,
              origin
            );
          }
        }

        if (pathname.startsWith("/api/v1/admin/media/object/") && request.method === "GET") {
          const key = decodeURIComponent(pathname.replace("/api/v1/admin/media/object/", ""));
          if (!key || key.includes("..") || key.startsWith("/")) {
            return jsonResponse({ ok: false, error: "Invalid media key" }, 400, origin);
          }
          const rangeHeader = request.headers.get("Range");
          const getOptions: R2GetOptions = {};
          if (rangeHeader) {
            getOptions.range = request.headers;
          }
          const obj = await bucket.get(key, getOptions);
          if (!obj) {
            return jsonResponse({ ok: false, error: "Media not found" }, 404, origin);
          }
          const objectEtag =
            obj.httpEtag || (obj.etag ? (obj.etag.startsWith('"') ? obj.etag : `"${obj.etag}"`) : undefined);
          const ifNoneMatch = request.headers.get("If-None-Match");
          if (ifNoneMatch && objectEtag && ifNoneMatch === objectEtag) {
            return new Response(null, {
              status: 304,
              headers: {
                ETag: objectEtag,
                "Cache-Control": "private, no-store, no-cache, must-revalidate",
                "Access-Control-Allow-Origin": origin
              }
            });
          }
          const headers = new Headers();
          headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
          headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
          headers.set("Access-Control-Allow-Origin", origin);
          headers.set("Accept-Ranges", "bytes");
          if (objectEtag) {
            headers.set("ETag", objectEtag);
          }
          const isRange = Boolean(rangeHeader && obj.range);
          if (isRange && obj.range) {
            const start = obj.range.offset;
            const end = obj.range.offset + obj.range.length - 1;
            headers.set("Content-Range", `bytes ${start}-${end}/${obj.size}`);
            headers.set("Content-Length", String(obj.range.length));
            return new Response(obj.body, {
              status: 206,
              headers
            });
          }
          headers.set("Content-Length", String(obj.size));
          return new Response(obj.body, {
            status: 200,
            headers
          });
        }

        if (pathname === "/api/v1/admin/media" && request.method === "GET") {
          const projectId = url.searchParams.get("projectId");
          const stmt = projectId
            ? db
                .prepare(
                  `SELECT * FROM project_media WHERE project_id = ? ORDER BY created_at DESC, sort_order ASC`
                )
                .bind(projectId)
            : db.prepare(`SELECT * FROM project_media ORDER BY created_at DESC LIMIT 300`);
          const { results } = await stmt.all<Record<string, unknown>>();
          const media = (results || []).map((r) => ({
            id: String(r.id),
            projectId: r.project_id ? String(r.project_id) : null,
            kind: String(r.kind),
            mediaType: r.media_type === "video" ? "video" : "image",
            storageKey: String(r.storage_key),
            publicUrl: String(r.public_url),
            filename: String(r.filename),
            mimeType: String(r.mime_type),
            byteSize: Number(r.byte_size || 0),
            width: r.width ? Number(r.width) : null,
            height: r.height ? Number(r.height) : null,
            altTR: String(r.alt_tr || ""),
            altEN: String(r.alt_en || ""),
            captionTR: r.caption_tr ? String(r.caption_tr) : null,
            captionEN: r.caption_en ? String(r.caption_en) : null,
            sortOrder: Number(r.sort_order || 0),
            createdAt: String(r.created_at),
            updatedAt: String(r.updated_at)
          }));
          return jsonResponse({ ok: true, media }, 200, origin);
        }

        if (pathname === "/api/v1/admin/media/upload" && request.method === "POST") {
          let formData: FormData;
          try {
            formData = await request.formData();
          } catch {
            return jsonResponse({ ok: false, error: "Invalid multipart form data" }, 400, origin);
          }
          const file = formData.get("file");
          if (!file || typeof file === "string") {
            return jsonResponse({ ok: false, error: "Missing file in form data" }, 400, origin);
          }
          const blob = file as File;
          const mimeType = blob.type || "application/octet-stream";
          const safeName = sanitizeFilename(blob.name || "asset.webp");
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);

          const sigCheck = validateMediaBufferSignature(bytes, mimeType, safeName);
          if (!sigCheck.valid) {
            return jsonResponse(
              { ok: false, error: sigCheck.error },
              sigCheck.status || 400,
              origin
            );
          }

          const isVideo = mimeType.startsWith("video/");
          const projectSlug = normalizeSlug(formData.get("projectSlug") || "general") || "general";
          const rawKind = String(formData.get("kind") || "gallery");
          const kind = [
            "cover",
            "thumbnail",
            "desktop_icon",
            "og_image",
            "gallery",
            "video"
          ].includes(rawKind)
            ? rawKind
            : "gallery";
          let projectId = formData.get("projectId") ? String(formData.get("projectId")) : null;
          if (!projectId && projectSlug && projectSlug !== "general") {
            const foundProj = await db
              .prepare(`SELECT id FROM projects WHERE slug = ? OR id = ? LIMIT 1`)
              .bind(projectSlug, projectSlug)
              .first<{ id: string }>();
            if (foundProj?.id) {
              projectId = String(foundProj.id);
            }
          }
          const altTR = String(formData.get("altTR") || "");
          const altEN = String(formData.get("altEN") || "");
          const captionTR = formData.get("captionTR") ? String(formData.get("captionTR")) : null;
          const captionEN = formData.get("captionEN") ? String(formData.get("captionEN")) : null;
          const customStorageKey = formData.get("customStorageKey")
            ? String(formData.get("customStorageKey")).trim()
            : "";
          const simulateD1Error = String(formData.get("simulateD1Error") || "") === "true";

          const now = new Date();
          const yyyy = String(now.getUTCFullYear());
          const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
          const uuid = crypto.randomUUID().slice(0, 8);
          const storageKey =
            customStorageKey && !customStorageKey.includes("..") && !customStorageKey.startsWith("/")
              ? customStorageKey
              : `projects/${projectSlug}/${kind}/${yyyy}/${mm}/${uuid}-${safeName}`;

          // Ensure no accidental overwrite
          const existingObj = await bucket.head(storageKey);
          if (existingObj) {
            return jsonResponse(
              { ok: false, error: "Storage key collision detected; please retry upload." },
              409,
              origin
            );
          }

          await bucket.put(storageKey, arrayBuffer, {
            httpMetadata: {
              contentType: mimeType,
              cacheControl: "public, max-age=31536000, immutable"
            }
          });

          const baseUrl = (env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
          const publicUrl = baseUrl ? `${baseUrl}/${storageKey}` : `/api/media/${storageKey}`;
          const mediaId = `media-${crypto.randomUUID()}`;
          const isoNow = now.toISOString();

          try {
            if (projectId) {
              const existingProj = await db
                .prepare(`SELECT id FROM projects WHERE id = ? LIMIT 1`)
                .bind(projectId)
                .first<{ id: string }>();
              if (!existingProj) {
                throw new Error(`NONEXISTENT_PROJECT:${projectId}`);
              }
            }
            if (simulateD1Error) {
              throw new Error("SIMULATED_D1_WRITE_FAILURE");
            }

            await db.batch([
              db
                .prepare(
                  `INSERT INTO project_media (
                    id, project_id, kind, media_type, storage_key, public_url, filename,
                    mime_type, byte_size, alt_tr, alt_en, caption_tr, caption_en,
                    sort_order, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
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
                  bytes.byteLength,
                  altTR,
                  altEN,
                  captionTR,
                  captionEN,
                  isoNow,
                  isoNow
                ),
              db
                .prepare(
                  `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
                   VALUES (?, ?, 'media_upload', 'project_media', ?, ?, ?)`
                )
                .bind(
                  `audit-${crypto.randomUUID()}`,
                  actorEmail,
                  mediaId,
                  JSON.stringify({
                    storageKey,
                    publicUrl,
                    byteSize: bytes.byteLength,
                    mimeType
                  }),
                  isoNow
                )
            ]);
          } catch (dbErr) {
            // Rollback R2 object if D1 metadata insert fails so no orphan R2 object remains
            await bucket.delete(storageKey);
            const errMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
            if (errMsg.startsWith("NONEXISTENT_PROJECT:")) {
              return jsonResponse(
                {
                  ok: false,
                  error: `Referenced project "${projectId}" does not exist; R2 object rolled back.`,
                  r2RolledBack: true,
                  rolledBackStorageKey: storageKey
                },
                400,
                origin
              );
            }
            return jsonResponse(
              {
                ok: false,
                error: "D1 metadata write failed; R2 object rolled back.",
                r2RolledBack: true,
                rolledBackStorageKey: storageKey
              },
              500,
              origin
            );
          }

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
                byteSize: bytes.byteLength,
                altTR,
                altEN,
                captionTR,
                captionEN,
                sortOrder: 0,
                createdAt: isoNow,
                updatedAt: isoNow
              }
            },
            201,
            origin
          );
        }

        if (pathname === "/api/v1/admin/media" && request.method === "DELETE") {
          const mediaId = url.searchParams.get("id");
          if (!mediaId) {
            return jsonResponse({ ok: false, error: "Missing media id" }, 400, origin);
          }
          const row = await db
            .prepare(`SELECT * FROM project_media WHERE id = ?`)
            .bind(mediaId)
            .first<Record<string, unknown>>();
          if (!row) {
            return jsonResponse({ ok: false, error: "Media record not found" }, 404, origin);
          }
          const storageKey = String(row.storage_key);
          await bucket.delete(storageKey);
          const now = new Date().toISOString();
          await db.batch([
            db.prepare(`DELETE FROM project_media WHERE id = ?`).bind(mediaId),
            db
              .prepare(
                `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
                 VALUES (?, ?, 'media_delete', 'project_media', ?, ?, ?)`
              )
              .bind(
                `audit-${crypto.randomUUID()}`,
                actorEmail,
                mediaId,
                JSON.stringify({ storageKey }),
                now
              )
          ]);
          return jsonResponse({ ok: true, deletedId: mediaId }, 200, origin);
        }

        if (pathname === "/api/v1/admin/seed" && request.method === "POST") {
          if (env.ALLOW_CANONICAL_SEED === "false") {
            return jsonResponse(
              {
                ok: false,
                error: "Canonical seed endpoint is disabled via ALLOW_CANONICAL_SEED=false."
              },
              403,
              origin
            );
          }

          let body: {
            projects?: Record<string, unknown>[];
            upsertExisting?: boolean;
            lockAfterSeed?: boolean;
            forceUnlockSeed?: boolean;
            allowDestructiveOverwrite?: boolean;
            action?: string;
          };
          try {
            body = (await request.json()) as {
              projects?: Record<string, unknown>[];
              upsertExisting?: boolean;
              lockAfterSeed?: boolean;
              forceUnlockSeed?: boolean;
              allowDestructiveOverwrite?: boolean;
              action?: string;
            };
          } catch {
            return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400, origin);
          }

          const nowIso = new Date().toISOString();

          if (body.action === "lock_seed") {
            await db
              .prepare(
                `INSERT INTO site_settings (key, value_json, updated_at, updated_by)
                 VALUES ('canonical_seed_locked', ?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET
                   value_json = excluded.value_json,
                   updated_at = excluded.updated_at,
                   updated_by = excluded.updated_by`
              )
              .bind(JSON.stringify({ locked: true, lockedAt: nowIso }), nowIso, actorEmail)
              .run();
            return jsonResponse({ ok: true, seedLocked: true }, 200, origin);
          }

          if (body.action === "unlock_seed") {
            if (env.ENVIRONMENT === "production" && !body.allowDestructiveOverwrite) {
              return jsonResponse(
                {
                  ok: false,
                  error:
                    "Unlocking canonical seed in production requires explicit allowDestructiveOverwrite=true."
                },
                403,
                origin
              );
            }
            await db
              .prepare(
                `INSERT INTO site_settings (key, value_json, updated_at, updated_by)
                 VALUES ('canonical_seed_locked', ?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET
                   value_json = excluded.value_json,
                   updated_at = excluded.updated_at,
                   updated_by = excluded.updated_by`
              )
              .bind(JSON.stringify({ locked: false, unlockedAt: nowIso }), nowIso, actorEmail)
              .run();
            return jsonResponse({ ok: true, seedLocked: false }, 200, origin);
          }

          const lockRow = await db
            .prepare(`SELECT value_json FROM site_settings WHERE key = 'canonical_seed_locked' LIMIT 1`)
            .first<{ value_json: string }>();
          const lockData = parseJsonSafe<{ locked?: boolean }>(lockRow?.value_json, {});

          if (lockData.locked && !body.forceUnlockSeed) {
            return jsonResponse(
              {
                ok: false,
                error:
                  "Canonical seed is locked after initial migration to protect live editorial changes."
              },
              409,
              origin
            );
          }

          const items = Array.isArray(body.projects) ? body.projects : [];
          const upsertExisting = Boolean(body.upsertExisting);

          if (upsertExisting && !body.allowDestructiveOverwrite) {
            const editorialRevs = await db
              .prepare(
                `SELECT COUNT(*) as count FROM project_revisions WHERE action != 'seed_migration'`
              )
              .first<{ count: number }>();
            if (Number(editorialRevs?.count || 0) > 0) {
              return jsonResponse(
                {
                  ok: false,
                  error:
                    "Refusing upsertExisting seed because editorial revisions exist in D1. Pass allowDestructiveOverwrite=true only for explicit migration resets."
                },
                409,
                origin
              );
            }
          }

          let inserted = 0;
          let updated = 0;
          let skipped = 0;

          for (let idx = 0; idx < items.length; idx++) {
            const p = items[idx];
            const pid = String(p.id || p.slug || "");
            const slug = String(p.slug || "");
            if (!pid || !slug) continue;

            const existing = await db
              .prepare(`SELECT id FROM projects WHERE id = ? OR slug = ?`)
              .bind(pid, slug)
              .first<{ id: string }>();

            if (existing && !upsertExisting) {
              skipped++;
              continue;
            }

            const res = await upsertProjectInWorkerD1(
              db,
              {
                ...p,
                id: pid,
                slug,
                cmsStatus: "published",
                sortOrder: typeof p.sortOrder === "number" ? p.sortOrder : idx + 1,
                featuredOrder: typeof p.featuredOrder === "number" ? p.featuredOrder : 0
              },
              actorEmail,
              "seed_migration"
            );
            if (!res.error) {
              if (existing) updated++;
              else inserted++;
            }
          }

          if (body.lockAfterSeed !== false && items.length > 0) {
            await db
              .prepare(
                `INSERT INTO site_settings (key, value_json, updated_at, updated_by)
                 VALUES ('canonical_seed_locked', ?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET
                   value_json = excluded.value_json,
                   updated_at = excluded.updated_at,
                   updated_by = excluded.updated_by`
              )
              .bind(
                JSON.stringify({
                  locked: true,
                  lockedAt: nowIso,
                  seededCount: inserted + updated + skipped
                }),
                nowIso,
                actorEmail
              )
              .run();
          }

          const d1Health = await getWorkerD1Health(db, Boolean(bucket));
          return jsonResponse(
            {
              ok: true,
              inserted,
              updated,
              skipped,
              seedLocked: body.lockAfterSeed !== false && items.length > 0,
              d1Health
            },
            200,
            origin
          );
        }
      }

      return jsonResponse({ ok: false, error: "Route not found" }, 404, origin);
    } catch (err) {
      // Server-side diagnostics only; never echo internals to the client.
      console.error(
        `[portfolio-api] Unhandled error on ${request.method} ${pathname}:`,
        err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      );
      return jsonResponse({ ok: false, error: "Internal Worker Error" }, 500, origin);
    }
  }
};

export default worker;
