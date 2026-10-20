"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import type { AdminSessionPayload } from "@/lib/admin/auth";
import {
  calculateProjectCompleteness,
  normalizeSlug,
  type CmsAuditLogRecord,
  type CmsMediaRecord,
  type CmsProjectRecord,
  type CmsPublishStatus,
  type CmsPublishingEventRecord,
  type CmsRevisionRecord,
  type CompletenessCheck,
  type UpsertProjectInput,
  type WorkspaceCategory
} from "@/lib/portfolio/types";
type AdminTab =
  | "overview"
  | "projects"
  | "editor"
  | "media"
  | "featured"
  | "system"
  | "settings";

interface ProjectWithCompleteness extends CmsProjectRecord {
  completeness: CompletenessCheck;
}

interface D1HealthSummary {
  ok: boolean;
  mode: string;
  storageMode?: string;
  dataSource?: string;
  dbPath?: string | null;
  r2Path?: string | null;
  d1Connected?: boolean;
  r2Connected?: boolean;
  error?: string;
  remoteWorkerUrl: string | null;
  remoteServiceTokenConfigured: boolean;
  counts: {
    total: number;
    published: number;
    draft: number;
    archived: number;
    featuredPublished: number;
    mediaItems: number;
    translations: number;
  };
  workspaceBreakdown: { workspace: string; status: string; count: number }[];
}

interface ReconciliationSummary {
  checkCompleted?: boolean;
  status?: "verified" | "modified" | "mismatch" | "error" | "unexecuted";
  canonicalCount: number;
  d1TotalCount: number;
  missingSlugs: string[];
  nonCanonicalSlugs?: string[];
  fieldMismatches: { slug: string; field: string; expected: unknown; actual: unknown }[];
  reconciled: boolean;
  error?: string;
}

interface SystemPayload {
  d1Health: D1HealthSummary;
  reconciliation: ReconciliationSummary;
  auditLogs: CmsAuditLogRecord[];
  publishingEvents: CmsPublishingEventRecord[];
  environment: {
    nodeEnv: string;
    gaMeasurementIdConfigured: boolean;
    ga4PropertyIdConfigured: boolean;
    googleServiceAccountConfigured: boolean;
    gscSiteUrl: string;
    cloudflareRemoteWorkerConfigured: boolean;
  };
}

interface AdminDashboardClientProps {
  initialSession: AdminSessionPayload | null;
  authConfig: {
    productionReady: boolean;
    hasGoogleOAuth: boolean;
    hasMasterPassword: boolean;
    devFixtureEnabled: boolean;
  };
}

const EMPTY_FORM: UpsertProjectInput = {
  id: "",
  slug: "",
  cmsStatus: "draft",
  workspace: "web",
  featured: false,
  featuredOrder: 0,
  sortOrder: 0,
  client: "",
  year: "2025",
  liveUrl: "",
  sourceUrl: "",
  initials: "",
  cover: "",
  thumbnail: "",
  desktopIcon: "",
  ogImage: "",
  titleTR: "",
  titleEN: "",
  subtitleTR: "",
  subtitleEN: "",
  summaryTR: "",
  summaryEN: "",
  descriptionTR: "",
  descriptionEN: "",
  roleTR: "",
  roleEN: "",
  categoryTR: "",
  categoryEN: "",
  tags: [],
  seo: {
    titleTR: "",
    titleEN: "",
    descriptionTR: "",
    descriptionEN: "",
    ogImage: ""
  },
  media: []
};

export function AdminDashboardClient({
  initialSession,
  authConfig
}: AdminDashboardClientProps) {
  const [session, setSession] = useState<AdminSessionPayload | null>(initialSession);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  // Data state
  const [projects, setProjects] = useState<ProjectWithCompleteness[]>([]);
  const [health, setHealth] = useState<D1HealthSummary | null>(null);
  const [mediaList, setMediaList] = useState<CmsMediaRecord[]>([]);
  const [mediaDisplayLimit, setMediaDisplayLimit] = useState(60);
  const [systemInfo, setSystemInfo] = useState<SystemPayload | null>(null);
  const [loadingCore, setLoadingCore] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("all");

  // Derived CMS statistics
  const workspaceCounts = useMemo(() => {
    const counts = { design: 0, web: 0, "motion-ai": 0 };
    for (const p of projects) {
      if (p.workspace in counts) {
        counts[p.workspace as keyof typeof counts]++;
      }
    }
    return counts;
  }, [projects]);

  const recentlyModifiedProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6);
  }, [projects]);

  // Editor state
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editorLocaleTab, setEditorLocaleTab] = useState<"tr" | "en">("tr");
  const [formState, setFormState] = useState<UpsertProjectInput>(EMPTY_FORM);
  const [revisions, setRevisions] = useState<CmsRevisionRecord[]>([]);
  const [saveMessage, setSaveMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Featured manager state
  const [featuredWorkspace, setFeaturedWorkspace] = useState<WorkspaceCategory>("web");

  const csrfHeaders = useMemo((): Record<string, string> => {
    return session?.csrfToken ? { "x-csrf-token": session.csrfToken } : {};
  }, [session]);

  const loadCoreData = useCallback(async () => {
    if (!session) return;
    setLoadingCore(true);
    try {
      const [projRes, sysRes, mediaRes] = await Promise.all([
        fetch("/api/admin/projects", { cache: "no-store" }),
        fetch("/api/admin/system", { cache: "no-store" }),
        fetch("/api/admin/media", { cache: "no-store" })
      ]);

      if (projRes.ok) {
        const pj = await projRes.json();
        setProjects(pj.projects || []);
        setHealth(pj.health || null);
      }
      if (sysRes.ok) {
        const sj = await sysRes.json();
        setSystemInfo(sj);
      }
      if (mediaRes.ok) {
        const mj = await mediaRes.json();
        setMediaList(mj.media || []);
      }
    } catch (err) {
      console.error("Failed to load admin core data:", err);
    } finally {
      setLoadingCore(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => {
      void loadCoreData();
    }, 0);
    return () => clearTimeout(timer);
  }, [session, loadCoreData]);

  // Reset scroll to top and ensure stage focusability on tab switch
  useEffect(() => {
    const main = document.getElementById("admin-main-stage");
    if (main) {
      main.scrollTop = 0;
    }
  }, [activeTab]);

  // Dynamic environment health status based on verified connection
  const healthStatus = useMemo(() => {
    if (!health) {
      return {
        isOperational: false,
        label: loadingCore ? "CHECKING" : "CONNECTING",
        badgeText: loadingCore ? "Checking..." : "Connecting...",
        colorClass: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
        dotClass: "bg-neutral-500"
      };
    }
    const isOk = Boolean(health.ok && health.d1Connected === true);
    if (isOk) {
      const isRemote = health.storageMode !== "local";
      return {
        isOperational: true,
        label: "OPERATIONAL",
        badgeText: isRemote ? "D1 Staging Active" : "Local D1 Active",
        colorClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
        dotClass: "bg-emerald-400 animate-pulse"
      };
    }
    return {
      isOperational: false,
      label: health.error ? "UNAVAILABLE" : "DEGRADED",
      badgeText: health.error ? "Worker Unreachable" : "D1 Degraded",
      colorClass: "bg-amber-500/10 text-amber-300 border-amber-500/20",
      dotClass: "bg-amber-400"
    };
  }, [health, loadingCore]);

  // Reconciliation status helper to strictly distinguish:
  // CHECKING | BASELINE_VERIFIED | CONTENT_MODIFIED | UNAVAILABLE | GENUINE_ERROR
  const reconciliationStatus = useMemo(() => {
    if (!systemInfo) {
      if (loadingCore) {
        return {
          code: "CHECKING",
          badgeLabel: "CHECKING",
          color: "text-amber-400 font-mono",
          badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/20",
          dotClass: "bg-amber-400",
          summary: "Checking baseline parity...",
          isVerified: false
        };
      }
      return {
        code: "UNAVAILABLE",
        badgeLabel: "UNAVAILABLE",
        color: "text-neutral-400 font-mono",
        badgeBg: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
        dotClass: "bg-neutral-500",
        summary: "System reconciliation data unavailable",
        isVerified: false
      };
    }

    const { reconciliation } = systemInfo;

    // Must strictly distinguish unexecuted or failed checks from verified passes
    if (reconciliation.checkCompleted === false || reconciliation.status === "unexecuted") {
      return {
        code: "UNAVAILABLE",
        badgeLabel: "RECONCILIATION UNAVAILABLE",
        color: "text-amber-400 font-mono",
        badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/20",
        dotClass: "bg-amber-400",
        summary: reconciliation.error || "Reconciliation check could not be executed",
        isVerified: false
      };
    }

    const hasMissing = reconciliation.missingSlugs && reconciliation.missingSlugs.length > 0;
    const hasFieldDiff = reconciliation.fieldMismatches && reconciliation.fieldMismatches.length > 0;
    const nonCanonicalCount = reconciliation.nonCanonicalSlugs?.length || 0;

    if (hasMissing || reconciliation.status === "error") {
      return {
        code: "GENUINE_ERROR",
        badgeLabel: "ERROR: MISSING CANONICAL",
        color: "text-red-400 font-mono",
        badgeBg: "bg-red-500/10 text-red-300 border-red-500/20",
        dotClass: "bg-red-400",
        summary: `Missing ${reconciliation.missingSlugs?.length || 0} canonical project(s)`,
        isVerified: false
      };
    }

    if (!hasFieldDiff && reconciliation.status === "verified") {
      return {
        code: "BASELINE_VERIFIED",
        badgeLabel: "BASELINE VERIFIED",
        color: "text-emerald-400 font-mono",
        badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
        dotClass: "bg-emerald-400",
        summary: `${reconciliation.canonicalCount}/${reconciliation.canonicalCount} Baseline Reconciled${
          nonCanonicalCount > 0 ? ` (+${nonCanonicalCount} CMS Draft${nonCanonicalCount > 1 ? "s" : ""})` : ""
        }`,
        isVerified: true
      };
    }

    // Baseline present (30/30) but legitimate admin edits modified fields in staging CMS
    const diffNames = (reconciliation.fieldMismatches || []).map((m) => `${m.slug} (${m.field})`).join(", ");
    return {
      code: "CONTENT_MODIFIED",
      badgeLabel: "CONTENT MODIFIED FROM BASELINE",
      color: "text-amber-400 font-mono",
      badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/20",
      dotClass: "bg-amber-400",
      summary: `${reconciliation.canonicalCount}/${reconciliation.canonicalCount} Baseline Present • ${(reconciliation.fieldMismatches || []).length} CMS Modification(s)`,
      detail: `Modified in Staging CMS: ${diffNames}`,
      isVerified: false
    };
  }, [systemInfo, loadingCore]);

  const handleLogin = async (mode: "master-password" | "dev-fixture") => {
    setLoginBusy(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          email: loginEmail,
          password: loginPassword
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setLoginError(data.error || "Authentication failed.");
      } else {
        setSession(data.session);
      }
    } catch {
      setLoginError("Network error while signing in.");
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", {
      method: "DELETE",
      headers: csrfHeaders
    });
    setSession(null);
  };

  const openCreateEditor = () => {
    setEditorMode("create");
    setFormState({ ...EMPTY_FORM });
    setRevisions([]);
    setSaveMessage(null);
    setActiveTab("editor");
  };

  const openEditEditor = async (project: ProjectWithCompleteness) => {
    setEditorMode("edit");
    setSaveMessage(null);
    setFormState({
      id: project.id,
      slug: project.slug,
      cmsStatus: project.cmsStatus,
      workspace: project.workspace,
      featured: project.featured,
      featuredOrder: project.featuredOrder,
      sortOrder: project.sortOrder,
      client: project.client,
      year: project.year ?? "",
      liveUrl: project.liveUrl || "",
      sourceUrl: project.sourceUrl || "",
      initials: project.initials || "",
      cover: project.cover || "",
      thumbnail: project.thumbnail || "",
      desktopIcon: project.desktopIcon || "",
      ogImage: project.ogImage || "",
      desktopThumbnail: project.desktopThumbnail || null,
      desktop: project.desktop,
      desktopWeight: project.desktopWeight,
      initialWindow: project.initialWindow,
      projectStatus: project.status,
      services: project.services || [],
      tags: project.tags || [],
      titleTR: project.titleTR,
      titleEN: project.titleEN,
      subtitleTR: project.subtitleTR || "",
      subtitleEN: project.subtitleEN || "",
      summaryTR: project.summaryTR || "",
      summaryEN: project.summaryEN || "",
      descriptionTR: project.descriptionTR || "",
      descriptionEN: project.descriptionEN || "",
      roleTR: project.roleTR || "",
      roleEN: project.roleEN || "",
      categoryTR: project.categoryTR,
      categoryEN: project.categoryEN,
      seo: {
        titleTR: project.seo?.titleTR || "",
        titleEN: project.seo?.titleEN || "",
        descriptionTR: project.seo?.descriptionTR || "",
        descriptionEN: project.seo?.descriptionEN || "",
        ogImage: project.seo?.ogImage || ""
      },
      media: project.media || []
    });
    setActiveTab("editor");

    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(project.id)}`);
      if (res.ok) {
        const detail = await res.json();
        setRevisions(detail.revisions || []);
      }
    } catch {
      // ignore
    }
  };

  const handleSaveProject = async (overrideStatus?: CmsPublishStatus) => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const payload: UpsertProjectInput = {
        ...formState,
        slug: normalizeSlug(formState.slug || formState.titleEN || formState.titleTR),
        cmsStatus: overrideStatus || formState.cmsStatus || "draft"
      };

      const isEdit = editorMode === "edit" && Boolean(formState.id);
      const url = isEdit
        ? `/api/admin/projects/${encodeURIComponent(formState.id!)}`
        : "/api/admin/projects";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...csrfHeaders
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSaveMessage({ type: "err", text: data.error || "Failed to save project." });
      } else {
        const saved: ProjectWithCompleteness = data.project;
        setEditorMode("edit");
        setFormState((prev) => ({
          ...prev,
          id: saved.id,
          slug: saved.slug,
          cmsStatus: saved.cmsStatus
        }));
        if (data.revisions) setRevisions(data.revisions);
        setSaveMessage({
          type: "ok",
          text: `Saved "${saved.titleEN}" (${saved.cmsStatus.toUpperCase()}) at ${new Date().toLocaleTimeString()}`
        });
        await loadCoreData();
      }
    } catch {
      setSaveMessage({ type: "err", text: "Network error while saving project." });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (projectId: string, newStatus: CmsPublishStatus) => {
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...csrfHeaders
        },
        body: JSON.stringify({ cmsStatus: newStatus })
      });
      if (res.ok) {
        await loadCoreData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to change status");
      }
    } catch {
      alert("Network error while changing status");
    }
  };

  const handleRollbackRevision = async (revisionNumber: number) => {
    if (!formState.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(formState.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...csrfHeaders
        },
        body: JSON.stringify({ rollbackRevisionNumber: revisionNumber })
      });
      const data = await res.json();
      if (res.ok && data.project) {
        await openEditEditor(data.project);
        setSaveMessage({
          type: "ok",
          text: `Rolled back to revision #${revisionNumber}.`
        });
        await loadCoreData();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUploadMediaFile = async (
    file: File,
    kind: CmsMediaRecord["kind"],
    applyToField?: "cover" | "thumbnail" | "desktopIcon" | "ogImage" | "gallery"
  ) => {
    setUploadingMedia(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      fd.append("projectSlug", formState.slug || "general");
      if (formState.id) fd.append("projectId", formState.id);
      fd.append("altTR", formState.titleTR || file.name);
      fd.append("altEN", formState.titleEN || file.name);

      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: {
          ...csrfHeaders
        },
        body: fd
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSaveMessage({ type: "err", text: data.error || "Media upload failed." });
        return;
      }

      const uploaded: CmsMediaRecord = data.media;
      if (applyToField === "cover") {
        setFormState((prev) => ({
          ...prev,
          cover: uploaded.publicUrl,
          thumbnail: prev.thumbnail || uploaded.publicUrl,
          desktopIcon: prev.desktopIcon || uploaded.publicUrl,
          desktopThumbnail: prev.desktopThumbnail || {
            src: uploaded.publicUrl,
            width: 120,
            height: 90,
            scale: 1.0
          }
        }));
      } else if (applyToField === "thumbnail") {
        setFormState((prev) => ({
          ...prev,
          thumbnail: uploaded.publicUrl,
          desktopThumbnail: {
            src: uploaded.publicUrl,
            width: prev.desktopThumbnail?.width || 120,
            height: prev.desktopThumbnail?.height || 90,
            scale: prev.desktopThumbnail?.scale || 1.0
          }
        }));
      } else if (applyToField === "desktopIcon") {
        setFormState((prev) => ({ ...prev, desktopIcon: uploaded.publicUrl }));
      } else if (applyToField === "ogImage") {
        setFormState((prev) => ({
          ...prev,
          ogImage: uploaded.publicUrl,
          seo: { ...prev.seo, ogImage: uploaded.publicUrl }
        }));
      } else if (applyToField === "gallery") {
        setFormState((prev) => ({
          ...prev,
          media: [
            ...(prev.media || []),
            {
              type: uploaded.mediaType,
              src: uploaded.publicUrl,
              altTR: uploaded.altTR,
              altEN: uploaded.altEN
            }
          ]
        }));
      }

      await loadCoreData();
      setSaveMessage({
        type: "ok",
        text: `Uploaded ${uploaded.filename} to R2 (${uploaded.publicUrl})`
      });
    } catch {
      setSaveMessage({ type: "err", text: "Error uploading file to R2." });
    } finally {
      setUploadingMedia(false);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.cmsStatus !== statusFilter) return false;
      if (workspaceFilter !== "all" && p.workspace !== workspaceFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.titleTR.toLowerCase().includes(q) ||
          p.titleEN.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          p.client.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projects, statusFilter, workspaceFilter, searchQuery]);

  const editorCompleteness = useMemo(
    () => calculateProjectCompleteness(formState),
    [formState]
  );

  // ==========================================================
  // UNAUTHENTICATED LOGIN GATE
  // ==========================================================
  if (!session) {
    return (
      <div className="h-full w-full overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-[#0B0C0E]">
        <div className="w-full max-w-md my-auto rounded-2xl border border-[#252A33] bg-[#121418] p-6 sm:p-8 shadow-2xl shadow-black/80">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#1C2027]">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-[11px] font-mono uppercase tracking-widest text-indigo-400 font-semibold">
                  Studio OS • Private CMS
                </span>
              </div>
              <h1 className="text-xl font-bold text-[#F5F7FA] mt-1 tracking-tight">
                Portfolio Control Suite
              </h1>
            </div>
            <span className="px-2.5 py-1 rounded text-[10px] font-mono bg-[#181B22] border border-[#252A33] text-[#A0A8B5]">
              noindex
            </span>
          </div>

          {!authConfig.productionReady && !authConfig.devFixtureEnabled ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 space-y-2">
              <p className="font-semibold">Fail-Closed Protection Active</p>
              <p>
                Admin authentication secrets (<code>ADMIN_SESSION_SECRET</code> and{" "}
                <code>ADMIN_PASSWORD_HASH</code>) are not configured in this
                production environment. Access is denied by default.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {loginError && (
                <div
                  data-testid="admin-login-error"
                  className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-300"
                >
                  {loginError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">
                    Admin Email (Allowlisted)
                  </label>
                  <input
                    type="email"
                    data-testid="admin-email-input"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-sm text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                    placeholder="kerem@keremmihci.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">
                    Admin Master Passphrase
                  </label>
                  <input
                    type="password"
                    data-testid="admin-password-input"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-sm text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                    placeholder="••••••••••••"
                  />
                </div>
                <button
                  type="button"
                  data-testid="admin-password-login-btn"
                  disabled={loginBusy}
                  onClick={() => handleLogin("master-password")}
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-semibold text-white transition-all shadow-sm shadow-indigo-600/30 cursor-pointer"
                >
                  {loginBusy ? "Verifying Credentials..." : "Sign In with Studio Passphrase"}
                </button>
              </div>

              {authConfig.devFixtureEnabled && (
                <div className="pt-4 border-t border-[#1C2027] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-amber-400">
                      Local Development Auth Fixture
                    </span>
                    <span className="text-[10px] font-mono text-[#64748B]">
                      HMAC-SHA256 Cookie + CSRF
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="dev-admin-login-btn"
                    disabled={loginBusy}
                    onClick={() => handleLogin("dev-fixture")}
                    className="w-full py-2.5 px-4 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-xs font-mono font-semibold text-emerald-300 transition-colors cursor-pointer"
                  >
                    Sign In (Local Dev Admin Session)
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-[#1C2027] flex items-center justify-between text-xs text-[#64748B]">
            <Link href="/tr" className="hover:text-[#A0A8B5] transition-colors">
              ← Public Portfolio (/tr)
            </Link>
            <Link href="/en" className="hover:text-[#A0A8B5] transition-colors">
              Public Portfolio (/en) →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================
  // AUTHENTICATED ADMIN DASHBOARD SHELL
  // ==========================================================
  const navGroups: {
    group: string;
    items: { id: AdminTab; label: string; badge?: string | number; icon: React.ReactNode }[];
  }[] = [
    {
      group: "CONTENT",
      items: [
        {
          id: "overview",
          label: "Overview",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          )
        },
        {
          id: "projects",
          label: "Projects",
          badge: projects.length,
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          )
        },
        {
          id: "editor",
          label: editorMode === "edit" ? "Edit Project" : "+ Create Project",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          )
        },
        {
          id: "media",
          label: "Media Library (R2)",
          badge: mediaList.length,
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )
        }
      ]
    },
    {
      group: "CURATION",
      items: [
        {
          id: "featured",
          label: "Featured Manager",
          badge: projects.filter((p) => p.cmsStatus === "published" && p.featured).length,
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          )
        }
      ]
    },
    {
      group: "SYSTEM",
      items: [
        {
          id: "system",
          label: "System & Cloudflare",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          )
        },
        {
          id: "settings",
          label: "Settings",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )
        }
      ]
    }
  ];

  const allNavItems = navGroups.flatMap((g) => g.items);

  return (
    <div className="h-full w-full flex flex-col lg:flex-row bg-[#0B0C0E] text-[#F5F7FA] overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 bg-[#101216] border-b lg:border-b-0 lg:border-r border-[#1C2027] flex flex-col justify-between p-4 flex-shrink-0 lg:h-full lg:overflow-y-auto">
        <div>
          <div className="px-2 py-2 mb-4 border-b border-[#1C2027]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${healthStatus.dotClass}`} />
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#F5F7FA] font-bold">
                  PORTFOLIO OS
                </span>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${healthStatus.colorClass}`}>
                {healthStatus.badgeText}
              </span>
            </div>
            <div className="flex items-center gap-2.5 mt-3 pt-2.5 border-t border-[#1C2027]/60">
              <div className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-[10px] font-mono font-bold text-indigo-300 shrink-0">
                KM
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#F5F7FA] truncate" title={session.email}>
                  {session.email}
                </p>
                <p className="text-[10px] text-[#A0A8B5] font-mono">Creative Director</p>
              </div>
            </div>
          </div>

          <nav className="flex lg:flex-col gap-4 overflow-x-auto pb-2 lg:pb-0">
            {navGroups.map((group) => (
              <div key={group.group} className="space-y-1">
                <div className="hidden lg:block px-2 text-[10px] font-mono uppercase tracking-wider text-[#64748B] font-semibold mb-1">
                  {group.group}
                </div>
                <div className="flex lg:flex-col gap-1">
                  {group.items.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={`admin-tab-${item.id}`}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                          isActive
                            ? "bg-[#181B22] text-[#F5F7FA] border border-[#252A33] shadow-sm font-semibold"
                            : "text-[#A0A8B5] hover:text-[#F5F7FA] hover:bg-[#181B22]/60 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={isActive ? "text-indigo-400" : "text-[#64748B]"}>
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge !== undefined && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              isActive
                                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                                : "bg-white/5 text-[#A0A8B5] border border-white/5"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="hidden lg:flex flex-col gap-2 pt-4 border-t border-[#1C2027] text-xs">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/tr"
              target="_blank"
              className="flex-1 text-center py-1.5 px-2 rounded-lg bg-[#181B22] hover:bg-[#1E222A] border border-[#252A33] text-[#A0A8B5] hover:text-[#F5F7FA] font-mono text-[11px] transition-colors"
            >
              /tr ↗
            </Link>
            <Link
              href="/en"
              target="_blank"
              className="flex-1 text-center py-1.5 px-2 rounded-lg bg-[#181B22] hover:bg-[#1E222A] border border-[#252A33] text-[#A0A8B5] hover:text-[#F5F7FA] font-mono text-[11px] transition-colors"
            >
              /en ↗
            </Link>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-mono transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Stage */}
      <main
        id="admin-main-stage"
        tabIndex={-1}
        className="flex-1 min-w-0 min-h-0 p-4 sm:p-6 md:p-8 overflow-y-auto overflow-x-hidden w-full focus:outline-none"
      >
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
          {/* Top Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#1C2027]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono uppercase tracking-widest text-indigo-400 font-semibold">
                  Studio Control
                </span>
                <span className="text-neutral-600 font-mono text-xs">•</span>
                <span className="text-[11px] font-mono text-[#A0A8B5]">
                  Cloudflare D1 & R2
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#F5F7FA]">
                {allNavItems.find((n) => n.id === activeTab)?.label}
              </h1>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                data-testid="new-project-quick-btn"
                onClick={openCreateEditor}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
              >
                + New Project
              </button>
              <button
                type="button"
                onClick={() => {
                  void loadCoreData();
                }}
                className="px-3.5 py-2 rounded-lg bg-[#181B22] hover:bg-[#1E222A] border border-[#252A33] text-xs font-mono text-[#A0A8B5] hover:text-white transition-all cursor-pointer"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

        {/* ======================================================
            1. OVERVIEW TAB
           ====================================================== */}
        {activeTab === "overview" && (
          <div className="space-y-6" data-testid="admin-overview-section">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              <div className="p-4 rounded-xl bg-[#121418] border border-[#252A33] shadow-sm">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#A0A8B5] block">Total Projects</span>
                <p className="text-2xl font-bold text-[#F5F7FA] mt-1.5 tracking-tight" data-testid="stat-total-projects">
                  {health?.counts.total ?? projects.length}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#121418] border border-emerald-500/30 shadow-sm">
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 block">Published</span>
                <p className="text-2xl font-bold text-emerald-300 mt-1.5 tracking-tight" data-testid="stat-published-projects">
                  {health?.counts.published ?? 0}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#121418] border border-amber-500/30 shadow-sm">
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 block">Drafts</span>
                <p className="text-2xl font-bold text-amber-300 mt-1.5 tracking-tight" data-testid="stat-draft-projects">
                  {health?.counts.draft ?? 0}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#121418] border border-[#252A33] shadow-sm">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#A0A8B5] block">Archived</span>
                <p className="text-2xl font-bold text-neutral-300 mt-1.5 tracking-tight" data-testid="stat-archived-projects">
                  {health?.counts.archived ?? 0}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#121418] border border-indigo-500/30 shadow-sm">
                <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 block">Featured (Live)</span>
                <p className="text-2xl font-bold text-indigo-300 mt-1.5 tracking-tight" data-testid="stat-featured-live">
                  {projects.filter((p) => p.cmsStatus === "published" && p.featured).length}
                </p>
                <span className="text-[10px] font-mono text-[#A0A8B5] mt-1 block">
                  {projects.filter((p) => p.cmsStatus === "published" && p.featured).length} published desktop icons
                </span>
              </div>
              <div className="p-4 rounded-xl bg-[#121418] border border-violet-500/30 shadow-sm">
                <span className="text-[11px] font-mono uppercase tracking-wider text-violet-400 block">D1 Media Records</span>
                <p className="text-2xl font-bold text-violet-300 mt-1.5 tracking-tight" data-testid="stat-media-records">
                  {health?.counts.mediaItems ?? mediaList.length}
                </p>
                <span className="text-[10px] font-mono text-[#A0A8B5] mt-1 block">
                  {health?.counts.mediaItems ?? mediaList.length} indexed metadata records
                </span>
              </div>
            </div>

            {/* Infrastructure & CMS Workspace Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-[#121418] border border-[#252A33] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${healthStatus.dotClass}`} />
                    <h3 className="text-sm font-semibold text-[#F5F7FA]">Cloudflare D1 & R2</h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${healthStatus.colorClass}`}>
                    {healthStatus.label}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-[#A0A8B5]">
                  <p className="flex justify-between">
                    <span>Engine Mode:</span>
                    <code className="text-[#F5F7FA] font-mono bg-[#181B22] px-1.5 py-0.5 rounded border border-[#252A33]">
                      {health?.mode || (loadingCore ? "checking..." : "local-d1-sqlite")}
                    </code>
                  </p>
                  <div className="pt-1 border-t border-[#1C2027] space-y-1">
                    <div className="flex justify-between items-center">
                      <span>Canonical Baseline:</span>
                      <span className={`font-mono text-[11px] ${reconciliationStatus.color}`}>
                        {reconciliationStatus.code === "BASELINE_VERIFIED"
                          ? "BASELINE VERIFIED"
                          : reconciliationStatus.code === "CONTENT_MODIFIED"
                          ? "MODIFIED FROM BASELINE"
                          : reconciliationStatus.badgeLabel}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-[#A0A8B5] text-right truncate" title={reconciliationStatus.detail || reconciliationStatus.summary}>
                      {reconciliationStatus.summary}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#121418] border border-[#252A33] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#F5F7FA]">Projects by Workspace</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                    {projects.length} Total
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="p-2.5 rounded-lg bg-[#181B22] border border-[#252A33]">
                    <span className="text-[10px] text-[#A0A8B5] uppercase block tracking-wider">Design</span>
                    <span className="text-base font-bold text-[#F5F7FA] mt-0.5 block">{workspaceCounts.design}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#181B22] border border-[#252A33]">
                    <span className="text-[10px] text-[#A0A8B5] uppercase block tracking-wider">Web</span>
                    <span className="text-base font-bold text-[#F5F7FA] mt-0.5 block">{workspaceCounts.web}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#181B22] border border-[#252A33]">
                    <span className="text-[10px] text-[#A0A8B5] uppercase block tracking-wider">Motion/AI</span>
                    <span className="text-base font-bold text-[#F5F7FA] mt-0.5 block">{workspaceCounts["motion-ai"]}</span>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#121418] border border-[#252A33] space-y-3">
                <h3 className="text-sm font-semibold text-[#F5F7FA]">Quick CMS Actions</h3>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={openCreateEditor}
                      className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm shadow-indigo-600/30 transition-all cursor-pointer text-center"
                    >
                      + Create Project
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("media")}
                      className="flex-1 px-3 py-2 rounded-lg bg-[#181B22] hover:bg-[#1E222A] border border-[#252A33] text-xs font-medium text-[#F5F7FA] transition-all cursor-pointer text-center"
                    >
                      Upload Media
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("featured")}
                    className="w-full px-3 py-2 rounded-lg bg-[#181B22] hover:bg-[#1E222A] border border-[#252A33] text-xs font-medium text-[#A0A8B5] hover:text-[#F5F7FA] transition-all cursor-pointer text-center"
                  >
                    Manage Featured ({projects.filter((p) => p.cmsStatus === "published" && p.featured).length}) →
                  </button>
                </div>
              </div>
            </div>

            {/* Recently Modified Projects */}
            <div className="p-5 rounded-xl bg-[#121418] border border-[#252A33]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#F5F7FA]">Recently Modified Projects</h3>
                  <p className="text-xs text-[#A0A8B5] mt-0.5">Projects updated in Cloudflare D1 storage</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("projects")}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-mono transition-colors cursor-pointer"
                >
                  View All ({projects.length}) →
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[#252A33]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#181B22] border-b border-[#252A33] text-[#A0A8B5] font-mono">
                      <th className="py-2.5 px-3">Project</th>
                      <th className="py-2.5 px-3">Workspace</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Last Updated</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1C2027]">
                    {recentlyModifiedProjects.map((p) => (
                      <tr key={p.id} className="hover:bg-[#15181F] transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-[#F5F7FA]">{p.titleTR}</div>
                          <div className="text-[11px] font-mono text-[#A0A8B5]">/{p.slug}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#181B22] text-[#A0A8B5] border border-[#252A33]">
                            {p.workspace}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                              p.cmsStatus === "published"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : p.cmsStatus === "draft"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-neutral-500/10 text-neutral-400 border border-neutral-500/20"
                            }`}
                          >
                            {p.cmsStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#A0A8B5]">
                          {new Date(p.updatedAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => void openEditEditor(p)}
                            className="px-2.5 py-1 rounded bg-[#181B22] hover:bg-[#1E222A] border border-[#252A33] text-xs font-mono text-[#A0A8B5] hover:text-[#F5F7FA] transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Publishing Events */}
            <div className="p-5 rounded-xl bg-[#121418] border border-[#252A33]">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[#F5F7FA]">Recent Publishing Events</h3>
                <p className="text-xs text-[#A0A8B5] mt-0.5">Immutable publication lifecycle trail recorded in D1</p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[#252A33]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#181B22] border-b border-[#252A33] text-[#A0A8B5] font-mono">
                      <th className="py-2.5 px-3">Project ID</th>
                      <th className="py-2.5 px-3">Event</th>
                      <th className="py-2.5 px-3">Transition</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1C2027]">
                    {(systemInfo?.publishingEvents || []).slice(0, 8).map((ev) => (
                      <tr key={ev.id} className="hover:bg-[#15181F] transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[#F5F7FA]">{ev.projectId}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {ev.eventType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#A0A8B5]">
                          {ev.previousStatus || "none"} → <span className="text-[#F5F7FA]">{ev.newStatus}</span>
                        </td>
                        <td className="py-2.5 px-3 text-[#A0A8B5]">{ev.actorEmail}</td>
                        <td className="py-2.5 px-3 font-mono text-neutral-500">
                          {new Date(ev.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================
            2. PROJECTS TABLE TAB
           ====================================================== */}
        {activeTab === "projects" && (
          <div className="space-y-4" data-testid="admin-projects-section">
            <div className="flex flex-wrap items-center gap-3 bg-[#121418] p-4 rounded-xl border border-[#252A33] shadow-sm">
              <input
                type="text"
                data-testid="projects-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, slug, or client..."
                className="flex-1 min-w-[220px] px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] focus:outline-none focus:border-indigo-500 transition-all"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published Only</option>
                <option value="draft">Drafts Only</option>
                <option value="archived">Archived Only</option>
              </select>
              <select
                value={workspaceFilter}
                onChange={(e) => setWorkspaceFilter(e.target.value)}
                className="px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] focus:outline-none focus:border-indigo-500 transition-all"
              >
                <option value="all">All Workspaces</option>
                <option value="design">Design</option>
                <option value="web">Web</option>
                <option value="motion-ai">Production (Motion/AI)</option>
              </select>
            </div>

            <div className="rounded-xl bg-[#121418] border border-[#252A33] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#252A33] bg-[#181B22] text-[#A0A8B5] font-mono">
                      <th className="py-3 px-4">Project (TR / EN)</th>
                      <th className="py-3 px-3">Workspace</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Featured</th>
                      <th className="py-3 px-3">TR/EN Completeness</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1C2027]">
                    {filteredProjects.map((project) => (
                      <tr
                        key={project.id}
                        data-testid={`project-row-${project.slug}`}
                        className="hover:bg-[#15181F] transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#F5F7FA]">{project.titleTR}</div>
                          <div className="text-[#A0A8B5] text-[11px]">{project.titleEN}</div>
                          <div className="text-[11px] font-mono text-neutral-500 mt-0.5">
                            /{project.slug} • {project.client} ({project.year})
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono uppercase text-[#A0A8B5]">
                          <span className="px-2 py-0.5 rounded bg-[#181B22] border border-[#252A33] text-[10px]">
                            {project.workspace}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            data-testid={`status-badge-${project.slug}`}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${
                              project.cmsStatus === "published"
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                                : project.cmsStatus === "draft"
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                : "bg-neutral-500/10 text-neutral-400 border-neutral-500/20"
                            }`}
                          >
                            {project.cmsStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {project.featured ? (
                            <span className="text-indigo-400 font-semibold flex items-center gap-1">
                              <span>★</span> Yes
                            </span>
                          ) : (
                            <span className="text-neutral-500">No</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-[#181B22] border border-[#252A33] overflow-hidden">
                              <div
                                className="h-full bg-emerald-400"
                                style={{ width: `${project.completeness.score}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] text-[#A0A8B5]">
                              {project.completeness.score}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            data-testid={`edit-btn-${project.slug}`}
                            onClick={() => openEditEditor(project)}
                            className="px-2.5 py-1 rounded bg-[#181B22] hover:bg-[#1E222A] text-indigo-300 border border-indigo-500/30 font-mono text-[11px] transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          <Link
                            href={`/admin/preview/${project.slug}?locale=tr`}
                            className="inline-block px-2.5 py-1 rounded bg-[#181B22] hover:bg-[#1E222A] text-[#A0A8B5] hover:text-[#F5F7FA] border border-[#252A33] font-mono text-[11px] transition-colors"
                          >
                            Preview
                          </Link>
                          {project.cmsStatus !== "published" ? (
                            <button
                              type="button"
                              data-testid={`publish-btn-${project.slug}`}
                              onClick={() => handleQuickStatusChange(project.id, "published")}
                              className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 font-mono text-[11px] transition-colors cursor-pointer"
                            >
                              Publish
                            </button>
                          ) : (
                            <button
                              type="button"
                              data-testid={`unpublish-btn-${project.slug}`}
                              onClick={() => handleQuickStatusChange(project.id, "draft")}
                              className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 font-mono text-[11px] transition-colors cursor-pointer"
                            >
                              Unpublish
                            </button>
                          )}
                          {project.cmsStatus !== "archived" && (
                            <button
                              type="button"
                              data-testid={`archive-btn-${project.slug}`}
                              onClick={() => handleQuickStatusChange(project.id, "archived")}
                              className="px-2.5 py-1 rounded bg-[#181B22] hover:bg-[#1E222A] text-neutral-400 hover:text-neutral-300 border border-[#252A33] font-mono text-[11px] transition-colors cursor-pointer"
                            >
                              Archive
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================
            3. CREATE / EDIT PROJECT TAB
           ====================================================== */}
        {activeTab === "editor" && (
          <div className="space-y-6" data-testid="admin-editor-section">
            {saveMessage && (
              <div
                data-testid="editor-save-message"
                className={`p-4 rounded-xl border text-xs font-mono ${
                  saveMessage.type === "ok"
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                    : "bg-red-500/10 border-red-500/25 text-red-300"
                }`}
              >
                {saveMessage.text}
              </div>
            )}

            {/* Completeness Bar & Publishing Actions */}
            <div className="p-4 rounded-xl bg-[#121418] border border-[#252A33] flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-[#F5F7FA]">
                    Completeness: {editorCompleteness.score}%
                  </span>
                  <span className="text-[11px] font-mono text-[#A0A8B5]">
                    TR: {editorCompleteness.trScore}% • EN: {editorCompleteness.enScore}% • Media:{" "}
                    {editorCompleteness.mediaScore}%
                  </span>
                </div>
                {editorCompleteness.missingFields.length > 0 && (
                  <p className="text-[11px] text-amber-400 font-mono">
                    Missing: {editorCompleteness.missingFields.join(", ")}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {formState.slug && (
                  <Link
                    href={`/admin/preview/${normalizeSlug(formState.slug)}?locale=tr`}
                    className="px-3.5 py-2 rounded-lg bg-[#181B22] hover:bg-[#1E222A] border border-[#252A33] text-xs font-mono text-[#F5F7FA] transition-colors"
                  >
                    Preview Draft
                  </Link>
                )}
                <button
                  type="button"
                  data-testid="save-draft-btn"
                  disabled={saving}
                  onClick={() => handleSaveProject("draft")}
                  className="px-4 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-semibold text-amber-300 transition-colors cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  data-testid="save-publish-btn"
                  disabled={saving}
                  onClick={() => handleSaveProject("published")}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-sm shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  {formState.cmsStatus === "published" ? "Save & Update Published" : "Publish Now"}
                </button>
                {formState.id && formState.cmsStatus === "published" && (
                  <button
                    type="button"
                    data-testid="editor-unpublish-btn"
                    disabled={saving}
                    onClick={() => handleSaveProject("draft")}
                    className="px-3.5 py-2 rounded-lg bg-[#181B22] hover:bg-[#1E222A] border border-[#252A33] text-xs font-mono text-[#A0A8B5] hover:text-[#F5F7FA] transition-colors cursor-pointer"
                  >
                    Unpublish
                  </button>
                )}
                {formState.id && (
                  <button
                    type="button"
                    data-testid="editor-archive-btn"
                    disabled={saving}
                    onClick={() => handleSaveProject("archived")}
                    className="px-3.5 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs font-mono text-red-300 transition-colors cursor-pointer"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>

            {/* Core Metadata Grid */}
            <div className="p-5 rounded-xl bg-[#121418] border border-[#252A33] grid grid-cols-1 md:grid-cols-3 gap-4 shadow-sm">
              <div>
                <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">
                  URL Slug (Unique) *
                </label>
                <input
                  type="text"
                  data-testid="input-project-slug"
                  value={formState.slug}
                  onChange={(e) => setFormState({ ...formState, slug: e.target.value })}
                  placeholder="cms-publish-test"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs font-mono text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">Workspace *</label>
                <select
                  data-testid="input-project-workspace"
                  value={formState.workspace}
                  onChange={(e) =>
                    setFormState({ ...formState, workspace: e.target.value as WorkspaceCategory })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] focus:outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="design">Design (Graphic & Brand)</option>
                  <option value="web">Web & Product</option>
                  <option value="motion-ai">Production (Motion & AI)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">
                  Client / Brand Name
                </label>
                <input
                  type="text"
                  data-testid="input-project-client"
                  value={formState.client}
                  onChange={(e) => setFormState({ ...formState, client: e.target.value })}
                  placeholder="Client or Studio"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">Year</label>
                <input
                  type="text"
                  data-testid="input-project-year"
                  value={formState.year}
                  onChange={(e) => setFormState({ ...formState, year: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">Live URL</label>
                <input
                  type="url"
                  data-testid="input-project-live-url"
                  value={formState.liveUrl || ""}
                  onChange={(e) => setFormState({ ...formState, liveUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input
                  id="featured-checkbox"
                  type="checkbox"
                  data-testid="input-project-featured"
                  checked={formState.featured}
                  onChange={(e) => setFormState({ ...formState, featured: e.target.checked })}
                  className="w-4 h-4 rounded border-[#252A33] bg-[#181B22] text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="featured-checkbox" className="text-xs font-medium text-[#F5F7FA]">
                  Featured on Desktop & Mobile Workspace
                </label>
              </div>
            </div>

            {/* Bilingual Content Editor (TR & EN Tabs) */}
            <div className="p-5 rounded-xl bg-[#121418] border border-[#252A33] space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#1C2027] pb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="locale-tab-tr"
                    onClick={() => setEditorLocaleTab("tr")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                      editorLocaleTab === "tr"
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                        : "bg-[#181B22] text-[#A0A8B5] hover:text-[#F5F7FA] border border-[#252A33]"
                    }`}
                  >
                    🇹🇷 Türkçe İçerik (TR)
                  </button>
                  <button
                    type="button"
                    data-testid="locale-tab-en"
                    onClick={() => setEditorLocaleTab("en")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                      editorLocaleTab === "en"
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                        : "bg-[#181B22] text-[#A0A8B5] hover:text-[#F5F7FA] border border-[#252A33]"
                    }`}
                  >
                    🇬🇧 English Content (EN)
                  </button>
                </div>
              </div>

              {editorLocaleTab === "tr" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">
                      Proje Başlığı (TR) *
                    </label>
                    <input
                      type="text"
                      data-testid="input-title-tr"
                      value={formState.titleTR}
                      onChange={(e) => setFormState({ ...formState, titleTR: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">
                      Kategori Etiketi (TR) *
                    </label>
                    <input
                      type="text"
                      data-testid="input-category-tr"
                      value={formState.categoryTR}
                      onChange={(e) => setFormState({ ...formState, categoryTR: e.target.value })}
                      placeholder="Web Tasarım & Geliştirme"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">
                      Kısa Özet / Summary (TR)
                    </label>
                    <input
                      type="text"
                      data-testid="input-summary-tr"
                      value={formState.summaryTR || ""}
                      onChange={(e) => setFormState({ ...formState, summaryTR: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">
                      Detaylı Proje Açıklaması (TR) *
                    </label>
                    <textarea
                      rows={5}
                      data-testid="input-description-tr"
                      value={formState.descriptionTR}
                      onChange={(e) =>
                        setFormState({ ...formState, descriptionTR: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all leading-relaxed"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">
                      Project Title (EN) *
                    </label>
                    <input
                      type="text"
                      data-testid="input-title-en"
                      value={formState.titleEN}
                      onChange={(e) => setFormState({ ...formState, titleEN: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">
                      Category Label (EN) *
                    </label>
                    <input
                      type="text"
                      data-testid="input-category-en"
                      value={formState.categoryEN}
                      onChange={(e) => setFormState({ ...formState, categoryEN: e.target.value })}
                      placeholder="Web Design & Engineering"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">
                      Short Summary (EN)
                    </label>
                    <input
                      type="text"
                      data-testid="input-summary-en"
                      value={formState.summaryEN || ""}
                      onChange={(e) => setFormState({ ...formState, summaryEN: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">
                      Full Project Description (EN) *
                    </label>
                    <textarea
                      rows={5}
                      data-testid="input-description-en"
                      value={formState.descriptionEN}
                      onChange={(e) =>
                        setFormState({ ...formState, descriptionEN: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Cover, Thumbnail & R2 Media Manager */}
            <div className="p-5 rounded-xl bg-[#121418] border border-[#252A33] space-y-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[#F5F7FA]">
                Project Cover, Thumbnail & Gallery Media (Cloudflare R2)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">
                    Cover / Hero Image URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      data-testid="input-cover-url"
                      value={formState.cover || ""}
                      onChange={(e) => setFormState({ ...formState, cover: e.target.value })}
                      placeholder="/projects/... or /api/media/..."
                      className="flex-1 min-w-0 px-3.5 py-2 rounded-lg bg-[#181B22] border border-[#252A33] text-xs font-mono text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                    />
                    <label className="px-3 py-2 rounded-lg bg-[#181B22] hover:bg-[#1E222A] border border-[#252A33] text-xs font-mono text-indigo-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap">
                      {uploadingMedia ? "..." : "Upload R2"}
                      <input
                        type="file"
                        data-testid="upload-cover-input"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadMediaFile(f, "cover", "cover");
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#A0A8B5] mb-1.5">
                    Desktop / Grid Thumbnail URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      data-testid="input-thumbnail-url"
                      value={formState.thumbnail || ""}
                      onChange={(e) => setFormState({ ...formState, thumbnail: e.target.value })}
                      placeholder="/projects/... or /api/media/..."
                      className="flex-1 min-w-0 px-3.5 py-2 rounded-lg bg-[#181B22] border border-[#252A33] text-xs font-mono text-[#F5F7FA] placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                    />
                    <label className="px-3 py-2 rounded-lg bg-[#181B22] hover:bg-[#1E222A] border border-[#252A33] text-xs font-mono text-indigo-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap">
                      Upload R2
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadMediaFile(f, "thumbnail", "thumbnail");
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Gallery Media List & Reordering */}
              <div className="pt-3 border-t border-[#1C2027] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-[#A0A8B5]">
                    Gallery Media Items ({(formState.media || []).length})
                  </span>
                  <label className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-xs font-mono text-indigo-300 transition-colors cursor-pointer">
                    + Upload Gallery Image/Video to R2
                    <input
                      type="file"
                      data-testid="upload-gallery-input"
                      accept="image/*,video/mp4,video/webm"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadMediaFile(f, "gallery", "gallery");
                      }}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  {(formState.media || []).map((m, idx) => (
                    <div
                      key={`${m.src}-${idx}`}
                      className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs"
                    >
                      <span className="font-mono text-neutral-500 w-6">#{idx + 1}</span>
                      <input
                        type="text"
                        value={m.src}
                        onChange={(e) => {
                          const next = [...(formState.media || [])];
                          next[idx] = { ...next[idx], src: e.target.value };
                          setFormState({ ...formState, media: next });
                        }}
                        className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded bg-[#121418] border border-[#252A33] font-mono text-[11px] text-[#F5F7FA] focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        value={m.altTR || ""}
                        placeholder="Alt TR"
                        onChange={(e) => {
                          const next = [...(formState.media || [])];
                          next[idx] = { ...next[idx], altTR: e.target.value };
                          setFormState({ ...formState, media: next });
                        }}
                        className="w-36 px-2.5 py-1.5 rounded bg-[#121418] border border-[#252A33] text-[11px] text-[#F5F7FA] focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        value={m.altEN || ""}
                        placeholder="Alt EN"
                        onChange={(e) => {
                          const next = [...(formState.media || [])];
                          next[idx] = { ...next[idx], altEN: e.target.value };
                          setFormState({ ...formState, media: next });
                        }}
                        className="w-36 px-2.5 py-1.5 rounded bg-[#121418] border border-[#252A33] text-[11px] text-[#F5F7FA] focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => {
                          const next = [...(formState.media || [])];
                          const temp = next[idx - 1];
                          next[idx - 1] = next[idx];
                          next[idx] = temp;
                          setFormState({ ...formState, media: next });
                        }}
                        className="px-2.5 py-1 rounded bg-[#121418] hover:bg-[#1E222A] border border-[#252A33] disabled:opacity-30 font-mono text-[#A0A8B5]"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === (formState.media || []).length - 1}
                        onClick={() => {
                          const next = [...(formState.media || [])];
                          const temp = next[idx + 1];
                          next[idx + 1] = next[idx];
                          next[idx] = temp;
                          setFormState({ ...formState, media: next });
                        }}
                        className="px-2.5 py-1 rounded bg-[#121418] hover:bg-[#1E222A] border border-[#252A33] disabled:opacity-30 font-mono text-[#A0A8B5]"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = (formState.media || []).filter((_, i) => i !== idx);
                          setFormState({ ...formState, media: next });
                        }}
                        className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-mono"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Revision History & Rollback */}
            {revisions.length > 0 && (
              <div className="p-5 rounded-xl bg-[#121418] border border-[#252A33] shadow-sm">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-[#F5F7FA]">
                    Revision Snapshots & Rollback ({revisions.length})
                  </h3>
                  <p className="text-xs text-[#A0A8B5] mt-0.5">Historical snapshots preserved in Cloudflare D1</p>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {revisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-indigo-400">
                          Rev #{rev.revisionNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#121418] border border-[#252A33] font-mono text-[10px] text-[#A0A8B5]">
                          {rev.action}
                        </span>
                        <span className="text-[#A0A8B5]">{rev.actorEmail}</span>
                        <span className="text-neutral-500 font-mono">
                          {new Date(rev.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRollbackRevision(rev.revisionNumber)}
                        className="px-2.5 py-1 rounded bg-[#121418] hover:bg-[#1E222A] border border-[#252A33] font-mono text-[11px] text-[#F5F7FA] transition-colors cursor-pointer"
                      >
                        Restore Snapshot
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================
            4. MEDIA LIBRARY (R2) TAB
           ====================================================== */}
        {activeTab === "media" && (
          <div className="space-y-4" data-testid="admin-media-section">
            <div className="p-5 rounded-xl bg-[#121418] border border-[#252A33] flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-400" />
                  <h3 className="text-sm font-semibold text-[#F5F7FA]">Cloudflare R2 Media Catalog</h3>
                </div>
                <p className="text-xs text-[#A0A8B5] mt-1">
                  {mediaList.length} media metadata records indexed in D1 (associated with R2 bucket <code className="text-violet-300 font-mono bg-[#181B22] px-1.5 py-0.5 rounded border border-[#252A33]">kerem-portfolio-media-staging</code>).
                </p>
              </div>
              <label className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm shadow-indigo-600/30 transition-all cursor-pointer">
                {uploadingMedia ? "Uploading..." : "+ Upload Asset to R2"}
                <input
                  type="file"
                  accept="image/*,video/mp4,video/webm"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadMediaFile(f, "gallery");
                  }}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {mediaList.slice(0, mediaDisplayLimit).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-[#121418] border border-[#252A33] overflow-hidden flex flex-col justify-between shadow-sm hover:border-[#353C48] transition-all"
                >
                  <div className="h-32 bg-[#0B0C0E] border-b border-[#252A33] flex items-center justify-center overflow-hidden relative">
                    {item.mediaType === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.publicUrl}
                        alt={item.altEN || item.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="font-mono text-xs text-violet-300">VIDEO ({item.mimeType})</span>
                    )}
                  </div>
                  <div className="p-3 space-y-1 text-[11px] bg-[#121418]">
                    <div className="font-mono text-[#F5F7FA] truncate font-medium" title={item.filename}>
                      {item.filename}
                    </div>
                    <div className="text-[#A0A8B5] font-mono text-[10px] truncate" title={item.publicUrl}>
                      {item.publicUrl}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {mediaList.length > 60 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#121418] border border-[#252A33] text-xs">
                <span className="text-[#A0A8B5] font-mono">
                  Showing {Math.min(mediaDisplayLimit, mediaList.length)} of {mediaList.length} media records
                </span>
                <div className="flex items-center gap-2">
                  {mediaDisplayLimit < mediaList.length && (
                    <>
                      <button
                        type="button"
                        onClick={() => setMediaDisplayLimit((prev) => prev + 30)}
                        className="px-3 py-1.5 rounded-lg bg-[#181B22] border border-[#252A33] text-[#F5F7FA] hover:border-[#3B4352] transition-colors font-mono cursor-pointer"
                      >
                        Show More (+{Math.min(30, mediaList.length - mediaDisplayLimit)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaDisplayLimit(mediaList.length)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors font-mono cursor-pointer"
                      >
                        Show All ({mediaList.length})
                      </button>
                    </>
                  )}
                  {mediaDisplayLimit >= mediaList.length && (
                    <button
                      type="button"
                      onClick={() => setMediaDisplayLimit(60)}
                      className="px-3 py-1.5 rounded-lg bg-[#181B22] border border-[#252A33] text-[#A0A8B5] hover:text-[#F5F7FA] transition-colors font-mono cursor-pointer"
                    >
                      Collapse to 60
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================
            5. FEATURED PROJECTS MANAGER TAB
           ====================================================== */}
        {activeTab === "featured" && (
          <div className="space-y-4" data-testid="admin-featured-section">
            <div className="flex items-center gap-2">
              {(["web", "design", "motion-ai"] as WorkspaceCategory[]).map((ws) => (
                <button
                  key={ws}
                  type="button"
                  onClick={() => setFeaturedWorkspace(ws)}
                  className={`px-4 py-2 rounded-lg text-xs font-mono uppercase transition-all cursor-pointer ${
                    featuredWorkspace === ws
                      ? "bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30"
                      : "bg-[#181B22] text-[#A0A8B5] hover:text-[#F5F7FA] border border-[#252A33]"
                  }`}
                >
                  {ws} Workspace
                </button>
              ))}
            </div>

            <div className="p-5 rounded-xl bg-[#121418] border border-[#252A33] space-y-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1C2027] pb-3">
                <p className="text-xs text-[#A0A8B5]">
                  Manage featured desktop icons for the <strong className="text-[#F5F7FA]">{featuredWorkspace}</strong> workspace.
                  Only <strong className="text-emerald-400">published</strong> projects with the featured flag appear on the live Portfolio OS desktop.
                </p>
                <div className="text-[11px] font-mono text-[#A0A8B5]">
                  Live Featured: <span className="text-indigo-400 font-bold">{projects.filter((p) => p.workspace === featuredWorkspace && p.cmsStatus === "published" && p.featured).length}</span> published
                </div>
              </div>
              <div className="divide-y divide-[#1C2027]">
                {projects
                  .filter((p) => p.workspace === featuredWorkspace)
                  .map((p) => {
                    const isPublished = p.cmsStatus === "published";
                    const isLiveFeatured = isPublished && p.featured;
                    return (
                      <div key={p.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[#F5F7FA]">{p.titleTR}</span>{" "}
                          <span className="text-[#A0A8B5]">({p.titleEN})</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                              isPublished
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                            }`}
                          >
                            {isPublished ? "PUBLISHED" : "DRAFT / NOT PUBLIC"}
                          </span>
                          {p.featured && !isPublished && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                              Staged for Feature
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/projects/${encodeURIComponent(p.id)}`, {
                              method: "PUT",
                              headers: {
                                "Content-Type": "application/json",
                                ...csrfHeaders
                              },
                              body: JSON.stringify({ ...p, featured: !p.featured })
                            });
                            await loadCoreData();
                          }}
                          className={`px-3 py-1.5 rounded-lg font-mono text-xs cursor-pointer border transition-all ${
                            isLiveFeatured
                              ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30 font-semibold"
                              : p.featured
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                : "bg-[#181B22] text-[#A0A8B5] hover:text-[#F5F7FA] border border-[#252A33]"
                          }`}
                        >
                          {isLiveFeatured
                            ? "★ Live on Desktop"
                            : p.featured
                              ? "★ Staged (Draft)"
                              : "Set Featured"}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================
            6. SYSTEM STATUS & AUDIT LOGS TAB
           ====================================================== */}
        {activeTab === "system" && systemInfo && (
          <div className="space-y-6" data-testid="admin-system-section">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-[#121418] border border-[#252A33] space-y-2.5 text-xs shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${reconciliationStatus.dotClass}`} />
                  <h3 className="text-sm font-semibold text-[#F5F7FA]">Database & Migration Health</h3>
                </div>
                <p className="text-[#A0A8B5]">
                  Engine Mode: <code className="text-[#F5F7FA] font-mono bg-[#181B22] px-1.5 py-0.5 rounded border border-[#252A33]">{systemInfo.d1Health.mode}</code>
                </p>
                <div>
                  <div className="flex items-center justify-between text-[#A0A8B5] mb-1">
                    <span>Canonical 30-Project Reconciliation:</span>
                    <strong className={`font-mono ${reconciliationStatus.color}`}>
                      {reconciliationStatus.badgeLabel}
                    </strong>
                  </div>
                  <div className="text-[11px] font-mono p-2.5 rounded bg-[#181B22] border border-[#252A33] space-y-1">
                    <div className="text-[#F5F7FA]">{reconciliationStatus.summary}</div>
                    {systemInfo.reconciliation.fieldMismatches && systemInfo.reconciliation.fieldMismatches.length > 0 && (
                      <div className="text-amber-300/90 pt-1.5 border-t border-[#252A33] mt-1 space-y-0.5">
                        <span className="text-[10px] uppercase text-[#A0A8B5] block font-semibold">Staging CMS Field Modifications:</span>
                        {systemInfo.reconciliation.fieldMismatches.map((m) => (
                          <div key={`${m.slug}-${m.field}`}>
                            • <span className="text-white">{m.slug}</span>: {m.field} = <code className="text-amber-300 bg-[#121418] px-1 rounded">{String(m.actual)}</code> (canonical: {String(m.expected)})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[#A0A8B5] flex justify-between pt-1 border-t border-[#1C2027]">
                  <span>Total Translations:</span>
                  <code className="text-[#F5F7FA] font-mono bg-[#181B22] px-1.5 py-0.5 rounded border border-[#252A33]">{systemInfo.d1Health.counts.translations} rows</code>
                </p>
              </div>

              <div className="p-5 rounded-xl bg-[#121418] border border-[#252A33] space-y-2 text-xs shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <h3 className="text-sm font-semibold text-[#F5F7FA]">Environment Readiness</h3>
                </div>
                <p className="text-[#A0A8B5]">
                  Cloudflare Remote Worker URL:{" "}
                  <code className="text-[#F5F7FA] font-mono bg-[#181B22] px-1.5 py-0.5 rounded border border-[#252A33]">
                    {systemInfo.environment.cloudflareRemoteWorkerConfigured
                      ? "Configured"
                      : "Local D1 Active"}
                  </code>
                </p>
                <p className="text-[#A0A8B5]">
                  D1 Storage Engine:{" "}
                  <code className="text-[#F5F7FA] font-mono bg-[#181B22] px-1.5 py-0.5 rounded border border-[#252A33]">{systemInfo.d1Health.mode}</code>
                </p>
                <p className="text-[#A0A8B5]">
                  Node Environment:{" "}
                  <code className="text-[#F5F7FA] font-mono bg-[#181B22] px-1.5 py-0.5 rounded border border-[#252A33]">{systemInfo.environment.nodeEnv || "production"}</code>
                </p>
                <p className="text-[#A0A8B5]">
                  Cloudflare R2 Storage:{" "}
                  <span className={`font-mono text-[11px] ${systemInfo.d1Health.r2Connected !== false ? "text-emerald-300" : "text-amber-400"}`}>
                    {systemInfo.d1Health.r2Connected !== false
                      ? "Bucket Configured & Bound (R2 API Connected)"
                      : "Unverified / Disconnected"}
                  </span>
                </p>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#121418] border border-[#252A33] shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[#F5F7FA]">
                  Admin Security & Mutation Audit Logs
                </h3>
                <p className="text-xs text-[#A0A8B5] mt-0.5">Administrative mutation trail recorded in D1</p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[#252A33]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#181B22] border-b border-[#252A33] text-[#A0A8B5] font-mono">
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Entity</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-3">Details</th>
                      <th className="py-2.5 px-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1C2027]">
                    {systemInfo.auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#15181F] transition-colors">
                        <td className="py-2.5 px-3 font-mono text-indigo-300">{log.action}</td>
                        <td className="py-2.5 px-3 font-mono text-[#F5F7FA]">
                          {log.entityType}:{log.entityId || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-[#A0A8B5]">{log.actorEmail}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-400 max-w-xs truncate">
                          {log.detailsJson}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-neutral-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================
            7. SETTINGS TAB
           ====================================================== */}
        {activeTab === "settings" && (
          <div
            className="p-6 rounded-xl bg-[#121418] border border-[#252A33] space-y-4 text-xs shadow-sm"
            data-testid="admin-settings-section"
          >
            <div>
              <h3 className="text-sm font-semibold text-[#F5F7FA]">
                Portfolio OS CMS & Security Configuration
              </h3>
              <p className="text-xs text-[#A0A8B5] mt-0.5">Session authentication & access controls</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[#A0A8B5]">
              <div className="p-4 rounded-lg bg-[#181B22] border border-[#252A33] space-y-1.5">
                <div className="font-mono text-indigo-400 font-semibold text-[11px] uppercase tracking-wider">Active Admin Session</div>
                <div className="text-xs"><span className="text-neutral-500">Email:</span> <span className="text-[#F5F7FA]">{session.email}</span></div>
                <div className="text-xs"><span className="text-neutral-500">Auth Mode:</span> <span className="text-[#F5F7FA]">{session.mode}</span></div>
                <div className="text-xs"><span className="text-neutral-500">Expires:</span> <span className="text-[#F5F7FA] font-mono">{new Date(session.exp).toLocaleString()}</span></div>
              </div>
              <div className="p-4 rounded-lg bg-[#181B22] border border-[#252A33] space-y-1.5">
                <div className="font-mono text-indigo-400 font-semibold text-[11px] uppercase tracking-wider">Security Controls</div>
                <div className="text-xs text-[#F5F7FA]">• HTTP-Only HMAC-SHA256 Signed Session Cookie</div>
                <div className="text-xs text-[#F5F7FA]">• Same-Origin + X-CSRF-Token Mutation Verification</div>
                <div className="text-xs text-[#F5F7FA]">• Robots.txt & X-Robots-Tag noindex Isolation</div>
                <div className="text-xs text-[#F5F7FA]">• Public Consent & Tracking Scripts Suppressed on /admin</div>
              </div>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
