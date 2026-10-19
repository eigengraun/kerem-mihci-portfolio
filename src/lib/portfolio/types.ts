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
  WorkspaceId
} from "@/data/projects";

export type CmsPublishStatus = "draft" | "published" | "archived";
export type WorkspaceCategory = WorkspaceId;

export interface CmsProjectRecord extends Project {
  cmsStatus: CmsPublishStatus;
  featuredOrder: number;
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

export interface UpsertProjectInput {
  id?: string;
  slug: string;
  cmsStatus?: CmsPublishStatus;
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
  initialWindow?: InitialWindowBounds;
  tags?: string[];
  titleTR: string;
  titleEN: string;
  desktopLabelTR?: string;
  desktopLabelEN?: string;
  subtitleTR?: string;
  subtitleEN?: string;
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

export function normalizeSlug(raw: string): string {
  return raw
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
