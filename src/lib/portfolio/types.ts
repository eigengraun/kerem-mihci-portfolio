import type {
  DesktopPosition,
  DesktopThumbnailConfig,
  InitialWindowBounds,
  Project,
  ProjectCategoryId,
  ProjectContentBlock,
  ProjectExternalLink,
  ProjectMediaItem,
  ProjectSeoConfig,
  ProjectStatus,
  WorkspaceId
} from "../../data/projects";
import type {
  PortfolioVideo,
  VideoType,
  VideoOrientation,
  ProductionMethod
} from "../../data/videos";
import type { GalleryItem } from "../../data/gallery";

export type {
  PortfolioVideo,
  VideoType,
  VideoOrientation,
  ProductionMethod,
  GalleryItem
};

export type CmsPublishStatus = "draft" | "published" | "archived";
export type WorkspaceCategory = WorkspaceId;
export type CmsStorageMode = "local" | "staging" | "production";
export type CmsDataSource = "legacy" | "cloudflare";

export class CmsStorageUnavailableError extends Error {
  public readonly statusCode = 503;
  public readonly code = "CMS_STORAGE_UNAVAILABLE";

  constructor(message: string) {
    super(message);
    this.name = "CmsStorageUnavailableError";
  }
}

export interface CmsProjectRecord extends Project {
  cmsStatus: CmsPublishStatus;
  featuredOrder?: number;
  sortOrder: number;
  liveUrl?: string;
  sourceUrl?: string;
  subtitleTR?: string;
  subtitleEN?: string;
  deliverablesTR?: string[];
  deliverablesEN?: string[];
  highlightsTR?: string[];
  highlightsEN?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  archivedAt?: string | null;
}

export interface CmsMediaRecord {
  id: string;
  projectId: string | null;
  kind: "cover" | "thumbnail" | "desktop_icon" | "og_image" | "gallery" | "video";
  mediaType: "image" | "video";
  storageKey: string;
  publicUrl: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  width?: number | null;
  height?: number | null;
  altTR: string;
  altEN: string;
  captionTR?: string | null;
  captionEN?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CmsRevisionRecord {
  id: string;
  projectId: string;
  revisionNumber: number;
  action: string;
  snapshotJson: string;
  actorEmail: string;
  createdAt: string;
}

export interface CmsPublishingEventRecord {
  id: string;
  projectId: string;
  eventType: "publish" | "unpublish" | "archive" | "draft_saved" | "rollback";
  previousStatus: string | null;
  newStatus: string;
  actorEmail: string;
  notes?: string | null;
  createdAt: string;
}

export interface CmsAuditLogRecord {
  id: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  detailsJson?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface CmsVideoAssetRecord {
  id: string;
  videoId: string;
  assetType: "video" | "poster" | "thumbnail";
  storageMode: "local_static" | "r2" | "external";
  storageKey: string;
  publicUrl: string;
  mimeType: string;
  byteSize: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsVideoRevisionRecord {
  id: string;
  videoId: string;
  revisionNumber: number;
  action: string;
  snapshotJson: string;
  actorEmail: string;
  createdAt: string;
}

export interface CmsVideoRecord extends PortfolioVideo {
  cmsStatus: CmsPublishStatus;
  aspectRatio: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  archivedAt?: string | null;
  assets?: CmsVideoAssetRecord[];
}

export interface CmsGalleryAssetRecord {
  id: string;
  itemId: string;
  storageMode: "local_static" | "r2" | "external";
  storageKey: string;
  publicUrl: string;
  mimeType: string;
  byteSize: number;
  width?: number | null;
  height?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsGalleryRevisionRecord {
  id: string;
  itemId: string;
  revisionNumber: number;
  action: string;
  snapshotJson: string;
  actorEmail: string;
  createdAt: string;
}

export interface CmsGalleryItem extends GalleryItem {
  cmsStatus: CmsPublishStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  archivedAt?: string | null;
  asset?: CmsGalleryAssetRecord | null;
}

export interface UpsertGalleryItemInput {
  id?: string;
  cmsStatus?: CmsPublishStatus;
  src: string;
  altTR: string;
  altEN: string;
  captionTR?: string;
  captionEN?: string;
  year?: string;
  location?: string;
  sortOrder?: number;
  asset?: Partial<CmsGalleryAssetRecord>;
}

export interface UpsertVideoInput {
  id?: string;
  slug: string;
  cmsStatus?: CmsPublishStatus;
  type: VideoType;
  orientation?: VideoOrientation;
  aiAssisted?: boolean;
  productionMethod?: ProductionMethod;
  titleTR: string;
  titleEN: string;
  shortTitleTR?: string;
  shortTitleEN?: string;
  descriptionTR?: string;
  descriptionEN?: string;
  fullDescriptionTR?: string;
  fullDescriptionEN?: string;
  client?: string;
  year?: number;
  poster: string;
  thumbnail?: string;
  src?: string;
  duration?: string;
  aspectRatio?: string;
  servicesTR?: string[];
  servicesEN?: string[];
  services?: string[];
  tools?: string[];
  tags?: string[];
  autoplayPreview?: boolean;
  externalUrl?: string;
  projectSlug?: string;
  featured?: boolean;
  sortOrder?: number;
}

export interface UpsertProjectInput {
  id?: string;
  slug: string;
  cmsStatus?: CmsPublishStatus;
  projectStatus?: ProjectStatus;
  workspace: WorkspaceId;
  categoryIds?: ProjectCategoryId[];
  featured: boolean;
  featuredOrder?: number;
  sortOrder?: number;
  client: string;
  year?: string;
  liveUrl?: string;
  sourceUrl?: string;
  initials?: string;
  cover?: string;
  thumbnail?: string;
  desktopIcon?: string;
  ogImage?: string;
  desktopThumbnail?: DesktopThumbnailConfig | null;
  desktop?: DesktopPosition;
  desktopWeight?: "small" | "normal" | "large";
  initialWindow?: InitialWindowBounds;
  tags?: string[];
  titleTR: string;
  titleEN: string;
  desktopLabelTR?: string;
  desktopLabelEN?: string;
  subtitleTR?: string;
  subtitleEN?: string;
  projectTypeTR?: string;
  projectTypeEN?: string;
  summaryTR?: string;
  summaryEN?: string;
  descriptionTR?: string;
  descriptionEN?: string;
  challengeTR?: string;
  challengeEN?: string;
  solutionTR?: string;
  solutionEN?: string;
  resultTR?: string;
  resultEN?: string;
  roleTR?: string;
  roleEN?: string;
  categoryTR: string;
  categoryEN: string;
  services?: string[];
  servicesTR?: string[];
  servicesEN?: string[];
  tools?: string[];
  externalLinks?: ProjectExternalLink[];
  contentBlocks?: ProjectContentBlock[];
  deliverablesTR?: string[];
  deliverablesEN?: string[];
  highlightsTR?: string[];
  highlightsEN?: string[];
  seo?: ProjectSeoConfig;
  media?: ProjectMediaItem[];
}

export interface CompletenessCheck {
  score: number;
  trScore: number;
  enScore: number;
  mediaScore: number;
  missingFields: string[];
  readyToPublish: boolean;
}

export function calculateProjectCompleteness(project: Partial<UpsertProjectInput>): CompletenessCheck {
  const missingFields: string[] = [];

  const trChecks = [
    { ok: Boolean(project.titleTR?.trim()), label: "TR Title" },
    { ok: Boolean(project.categoryTR?.trim()), label: "TR Category" },
    {
      ok: Boolean(project.descriptionTR?.trim() || project.summaryTR?.trim()),
      label: "TR Description"
    },
    {
      ok: Boolean(
        project.summaryTR?.trim() ||
          project.seo?.descriptionTR?.trim() ||
          project.descriptionTR?.trim()
      ),
      label: "TR Summary/SEO"
    }
  ];

  const enChecks = [
    { ok: Boolean(project.titleEN?.trim()), label: "EN Title" },
    { ok: Boolean(project.categoryEN?.trim()), label: "EN Category" },
    {
      ok: Boolean(project.descriptionEN?.trim() || project.summaryEN?.trim()),
      label: "EN Description"
    },
    {
      ok: Boolean(
        project.summaryEN?.trim() ||
          project.seo?.descriptionEN?.trim() ||
          project.descriptionEN?.trim()
      ),
      label: "EN Summary/SEO"
    }
  ];

  const mediaChecks = [
    {
      ok: Boolean(
        project.cover ||
          project.thumbnail ||
          project.desktopThumbnail?.src ||
          project.desktopIcon
      ),
      label: "Cover / Thumbnail"
    },
    {
      ok: Boolean(project.media && project.media.length > 0),
      label: "Gallery Media"
    }
  ];

  for (const c of [...trChecks, ...enChecks, ...mediaChecks]) {
    if (!c.ok) missingFields.push(c.label);
  }

  const trScore = Math.round((trChecks.filter((c) => c.ok).length / trChecks.length) * 100);
  const enScore = Math.round((enChecks.filter((c) => c.ok).length / enChecks.length) * 100);
  const mediaScore = Math.round(
    (mediaChecks.filter((c) => c.ok).length / mediaChecks.length) * 100
  );
  const totalChecks = trChecks.length + enChecks.length + mediaChecks.length;
  const passedChecks = [...trChecks, ...enChecks, ...mediaChecks].filter((c) => c.ok).length;
  const score = Math.round((passedChecks / totalChecks) * 100);

  const readyToPublish = Boolean(
    project.slug?.trim() &&
      project.titleTR?.trim() &&
      project.titleEN?.trim() &&
      project.categoryTR?.trim() &&
      project.categoryEN?.trim() &&
      (project.descriptionTR?.trim() || project.summaryTR?.trim()) &&
      (project.descriptionEN?.trim() || project.summaryEN?.trim())
  );

  return {
    score,
    trScore,
    enScore,
    mediaScore,
    missingFields,
    readyToPublish
  };
}

export function calculateVideoCompleteness(video: Partial<CmsVideoRecord>): {
  score: number;
  trScore: number;
  enScore: number;
  mediaScore: number;
  missingFields: string[];
  readyToPublish: boolean;
} {
  const missingFields: string[] = [];

  const trChecks = [
    { ok: Boolean(video.titleTR?.trim()), label: "TR Title" },
    { ok: Boolean(video.shortTitleTR?.trim()), label: "TR Short Title" },
    { ok: Boolean(video.descriptionTR?.trim() || video.fullDescriptionTR?.trim()), label: "TR Description" }
  ];

  const enChecks = [
    { ok: Boolean(video.titleEN?.trim()), label: "EN Title" },
    { ok: Boolean(video.shortTitleEN?.trim()), label: "EN Short Title" },
    { ok: Boolean(video.descriptionEN?.trim() || video.fullDescriptionEN?.trim()), label: "EN Description" }
  ];

  const mediaChecks = [
    { ok: Boolean(video.poster?.trim()), label: "Poster Image" },
    { ok: Boolean(video.src?.trim()), label: "Video Source" },
    { ok: Boolean(video.duration?.trim()), label: "Duration" }
  ];

  for (const c of [...trChecks, ...enChecks, ...mediaChecks]) {
    if (!c.ok) missingFields.push(c.label);
  }

  const trScore = Math.round((trChecks.filter((c) => c.ok).length / trChecks.length) * 100);
  const enScore = Math.round((enChecks.filter((c) => c.ok).length / enChecks.length) * 100);
  const mediaScore = Math.round(
    (mediaChecks.filter((c) => c.ok).length / mediaChecks.length) * 100
  );
  const totalChecks = trChecks.length + enChecks.length + mediaChecks.length;
  const passedChecks = [...trChecks, ...enChecks, ...mediaChecks].filter((c) => c.ok).length;
  const score = Math.round((passedChecks / totalChecks) * 100);

  const readyToPublish = Boolean(
    video.slug?.trim() &&
      video.titleTR?.trim() &&
      video.titleEN?.trim() &&
      video.poster?.trim() &&
      video.src?.trim() &&
      (video.descriptionTR?.trim() || video.fullDescriptionTR?.trim()) &&
      (video.descriptionEN?.trim() || video.fullDescriptionEN?.trim())
  );

  return {
    score,
    trScore,
    enScore,
    mediaScore,
    missingFields,
    readyToPublish
  };
}

export function normalizeSlug(raw: string): string {
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

export function validateMediaFileSignature(
  bytes: Uint8Array,
  mimeType: string,
  filename: string
): { valid: boolean; error?: string } {
  const allowedExts = ALLOWED_EXTENSIONS_BY_MIME[mimeType];
  if (!allowedExts) {
    return { valid: false, error: `Unsupported MIME type: ${mimeType}` };
  }

  const lowerName = (filename || "").toLowerCase().trim();
  const dotIdx = lowerName.lastIndexOf(".");
  const ext = dotIdx >= 0 ? lowerName.slice(dotIdx) : "";
  if (ext && !allowedExts.includes(ext)) {
    return {
      valid: false,
      error: `File extension "${ext}" does not match declared MIME type "${mimeType}".`
    };
  }

  if (bytes.byteLength === 0) {
    return { valid: false, error: "Uploaded file is empty." };
  }

  const isVideo = mimeType.startsWith("video/");
  const maxBytes = isVideo ? 100 * 1024 * 1024 : 15 * 1024 * 1024;
  if (bytes.byteLength > maxBytes) {
    return {
      valid: false,
      error: `File size (${bytes.byteLength} bytes) exceeds limit (${maxBytes} bytes).`
    };
  }

  // Magic byte inspection
  if (mimeType === "image/png") {
    if (
      bytes.byteLength < 8 ||
      bytes[0] !== 0x89 ||
      bytes[1] !== 0x50 ||
      bytes[2] !== 0x4e ||
      bytes[3] !== 0x47
    ) {
      return { valid: false, error: "Invalid PNG file signature." };
    }
  } else if (mimeType === "image/jpeg") {
    if (bytes.byteLength < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      return { valid: false, error: "Invalid JPEG file signature." };
    }
  } else if (mimeType === "image/webp") {
    if (
      bytes.byteLength < 12 ||
      bytes[0] !== 0x52 || // R
      bytes[1] !== 0x49 || // I
      bytes[2] !== 0x46 || // F
      bytes[3] !== 0x46 || // F
      bytes[8] !== 0x57 || // W
      bytes[9] !== 0x45 || // E
      bytes[10] !== 0x42 || // B
      bytes[11] !== 0x50 // P
    ) {
      return { valid: false, error: "Invalid WebP file signature." };
    }
  } else if (mimeType === "image/gif") {
    if (
      bytes.byteLength < 6 ||
      bytes[0] !== 0x47 || // G
      bytes[1] !== 0x49 || // I
      bytes[2] !== 0x46 || // F
      bytes[3] !== 0x38 // 8
    ) {
      return { valid: false, error: "Invalid GIF file signature." };
    }
  } else if (mimeType === "image/avif" || mimeType === "video/mp4") {
    // ISO BMFF box header contains 'ftyp' at bytes 4..7
    if (
      bytes.byteLength < 12 ||
      bytes[4] !== 0x66 || // f
      bytes[5] !== 0x74 || // t
      bytes[6] !== 0x79 || // y
      bytes[7] !== 0x70 // p
    ) {
      return { valid: false, error: `Invalid ${mimeType} ftyp box signature.` };
    }
  } else if (mimeType === "video/webm") {
    if (
      bytes.byteLength < 4 ||
      bytes[0] !== 0x1a ||
      bytes[1] !== 0x45 ||
      bytes[2] !== 0xdf ||
      bytes[3] !== 0xa3
    ) {
      return { valid: false, error: "Invalid WebM EBML header signature." };
    }
  } else if (mimeType === "image/svg+xml") {
    const textSample = new TextDecoder("utf-8", { fatal: false }).decode(
      bytes.subarray(0, Math.min(bytes.byteLength, 8192))
    );
    if (!/<svg[\s>]/i.test(textSample)) {
      return { valid: false, error: "Invalid SVG content." };
    }
    if (/<script[\s>]|javascript:|onload\s*=|onerror\s*=/i.test(textSample)) {
      return { valid: false, error: "SVG contains disallowed executable script content." };
    }
  }

  return { valid: true };
}

export function validateVideoAssetSignature(
  bytes: Uint8Array,
  mimeType: string,
  filename: string,
  assetType: "video" | "poster" | "thumbnail"
): { valid: boolean; error?: string } {
  if (bytes.byteLength === 0) {
    return { valid: false, error: "Uploaded file is empty." };
  }

  if (assetType === "video") {
    if (mimeType !== "video/mp4" && mimeType !== "video/webm") {
      return {
        valid: false,
        error: `Invalid video MIME type "${mimeType}". Supported web formats: video/mp4, video/webm.`
      };
    }
    const maxBytes = 100 * 1024 * 1024; // 100 MB
    if (bytes.byteLength > maxBytes) {
      return {
        valid: false,
        error: `Video exceeds maximum allowed size of 100 MB (${bytes.byteLength} bytes).`
      };
    }
  } else if (assetType === "poster") {
    if (mimeType !== "image/webp" && mimeType !== "image/jpeg" && mimeType !== "image/png") {
      return {
        valid: false,
        error: `Invalid poster MIME type "${mimeType}". Supported image formats: image/webp, image/jpeg, image/png.`
      };
    }
    const maxBytes = 5 * 1024 * 1024; // 5 MB
    if (bytes.byteLength > maxBytes) {
      return {
        valid: false,
        error: `Poster image exceeds maximum allowed size of 5 MB (${bytes.byteLength} bytes).`
      };
    }
  } else if (assetType === "thumbnail") {
    if (mimeType !== "image/webp" && mimeType !== "image/jpeg" && mimeType !== "image/png") {
      return {
        valid: false,
        error: `Invalid thumbnail MIME type "${mimeType}". Supported image formats: image/webp, image/jpeg, image/png.`
      };
    }
    const maxBytes = 2 * 1024 * 1024; // 2 MB
    if (bytes.byteLength > maxBytes) {
      return {
        valid: false,
        error: `Thumbnail image exceeds maximum allowed size of 2 MB (${bytes.byteLength} bytes).`
      };
    }
  }

  return validateMediaFileSignature(bytes, mimeType, filename);
}

export function validateGalleryImageSignature(
  bytes: Uint8Array,
  mimeType: string,
  filename: string
): { valid: boolean; error?: string } {
  if (bytes.byteLength === 0) {
    return { valid: false, error: "Uploaded file is empty." };
  }

  if (mimeType !== "image/jpeg" && mimeType !== "image/png" && mimeType !== "image/webp") {
    return {
      valid: false,
      error: `Invalid gallery image MIME type "${mimeType}". Supported formats: image/jpeg, image/png, image/webp.`
    };
  }

  const maxBytes = 10 * 1024 * 1024; // 10 MB
  if (bytes.byteLength > maxBytes) {
    return {
      valid: false,
      error: `Gallery image exceeds maximum allowed size of 10 MB (${bytes.byteLength} bytes).`
    };
  }

  return validateMediaFileSignature(bytes, mimeType, filename);
}

