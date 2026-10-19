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
import type {
  AnalyticsDateRange,
  Ga4ReportData,
  GscReportData,
  ProjectTrafficInsight
} from "@/lib/admin/googleAnalyticsAndGsc";

type AdminTab =
  | "overview"
  | "projects"
  | "editor"
  | "media"
  | "featured"
  | "ga4"
  | "gsc"
  | "project-traffic"
  | "system"
  | "settings";

interface ProjectWithCompleteness extends CmsProjectRecord {
  completeness: CompletenessCheck;
}

interface D1HealthSummary {
  ok: boolean;
  mode: string;
  dbPath: string;
  r2Path: string;
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

interface SystemPayload {
  d1Health: D1HealthSummary;
  reconciliation: {
    canonicalCount: number;
    d1TotalCount: number;
    missingSlugs: string[];
    fieldMismatches: { slug: string; field: string; expected: unknown; actual: unknown }[];
    reconciled: boolean;
  };
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
  const [loginEmail, setLoginEmail] = useState("kerem@keremmihci.com");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  // Data state
  const [projects, setProjects] = useState<ProjectWithCompleteness[]>([]);
  const [health, setHealth] = useState<D1HealthSummary | null>(null);
  const [mediaList, setMediaList] = useState<CmsMediaRecord[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemPayload | null>(null);

  // Analytics state
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsDateRange>("28d");
  const [ga4Data, setGa4Data] = useState<Ga4ReportData | null>(null);
  const [gscData, setGscData] = useState<GscReportData | null>(null);
  const [projectInsights, setProjectInsights] = useState<ProjectTrafficInsight[]>([]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("all");

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
    }
  }, [session]);

  const loadAnalyticsData = useCallback(
    async (range: AnalyticsDateRange) => {
      if (!session) return;
      try {
        const res = await fetch(`/api/admin/analytics?range=${range}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setGa4Data(data.ga4 || null);
          setGscData(data.gsc || null);
          setProjectInsights(data.projectInsights || []);
        }
      } catch (err) {
        console.error("Failed to load analytics:", err);
      }
    },
    [session]
  );

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => {
      void loadCoreData();
      void loadAnalyticsData(analyticsRange);
    }, 0);
    return () => clearTimeout(timer);
  }, [session, loadCoreData, loadAnalyticsData, analyticsRange]);

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
    await fetch("/api/admin/auth", { method: "DELETE" });
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
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#0B0C10]">
        <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#12141C] p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400">
                Portfolio OS • Private Admin
              </span>
              <h1 className="text-xl font-bold text-white mt-1">
                Cloudflare CMS & Analytics
              </h1>
            </div>
            <span className="px-2.5 py-1 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-neutral-400">
              noindex
            </span>
          </div>

          {!authConfig.productionReady && !authConfig.devFixtureEnabled ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 space-y-2">
              <p className="font-semibold">Fail-Closed Protection Active</p>
              <p>
                Admin authentication secrets (<code>ADMIN_SESSION_SECRET</code> and{" "}
                <code>ADMIN_MASTER_PASSWORD</code> / Google OAuth) are not configured in this
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

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono text-neutral-400 mb-1">
                    Admin Email (Allowlisted)
                  </label>
                  <input
                    type="email"
                    data-testid="admin-email-input"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg bg-black/50 border border-white/15 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="kerem@keremmihci.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-neutral-400 mb-1">
                    Admin Master Passphrase
                  </label>
                  <input
                    type="password"
                    data-testid="admin-password-input"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg bg-black/50 border border-white/15 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="••••••••••••"
                  />
                </div>
                <button
                  type="button"
                  data-testid="admin-password-login-btn"
                  disabled={loginBusy}
                  onClick={() => handleLogin("master-password")}
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors cursor-pointer"
                >
                  {loginBusy ? "Verifying..." : "Sign In with Admin Passphrase"}
                </button>
              </div>

              {authConfig.devFixtureEnabled && (
                <div className="pt-4 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-amber-400">
                      Local Development Auth Fixture
                    </span>
                    <span className="text-[10px] font-mono text-neutral-500">
                      HMAC-SHA256 Cookie + CSRF
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="dev-admin-login-btn"
                    disabled={loginBusy}
                    onClick={() => handleLogin("dev-fixture")}
                    className="w-full py-2.5 px-4 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs font-mono font-semibold text-emerald-300 transition-colors cursor-pointer"
                  >
                    Sign In (Local Dev Admin Session)
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-neutral-500">
            <Link href="/tr" className="hover:text-neutral-300">
              ← Public Portfolio (/tr)
            </Link>
            <Link href="/en" className="hover:text-neutral-300">
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
  const navItems: { id: AdminTab; label: string; badge?: string | number }[] = [
    { id: "overview", label: "Overview" },
    { id: "projects", label: "Projects", badge: projects.length },
    { id: "editor", label: editorMode === "edit" ? "Edit Project" : "+ Create Project" },
    { id: "media", label: "Media Library (R2)", badge: mediaList.length },
    {
      id: "featured",
      label: "Featured Manager",
      badge: health?.counts.featuredPublished ?? 0
    },
    {
      id: "ga4",
      label: "Analytics (GA4)",
      badge: ga4Data?.status === "LIVE" ? "LIVE" : "CFG"
    },
    {
      id: "gsc",
      label: "Search Console",
      badge: gscData?.status === "LIVE" ? "LIVE" : "CFG"
    },
    { id: "project-traffic", label: "Project Traffic" },
    { id: "system", label: "System & Audit Logs" },
    { id: "settings", label: "Settings" }
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0B0C10] text-neutral-100 overflow-x-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 bg-[#10121A] border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col justify-between p-4 flex-shrink-0">
        <div>
          <div className="px-2 py-2 mb-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-blue-400 font-semibold">
                Portfolio OS CMS
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                D1 Active
              </span>
            </div>
            <p className="text-xs text-neutral-400 truncate mt-1" title={session.email}>
              {session.email}
            </p>
          </div>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`admin-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white font-semibold"
                      : "text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        isActive ? "bg-black/30 text-white" : "bg-white/10 text-neutral-300"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:flex flex-col gap-2 pt-4 border-t border-white/10 text-xs">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/tr"
              target="_blank"
              className="flex-1 text-center py-1.5 px-2 rounded bg-white/5 hover:bg-white/10 text-neutral-300 font-mono text-[11px]"
            >
              /tr ↗
            </Link>
            <Link
              href="/en"
              target="_blank"
              className="flex-1 text-center py-1.5 px-2 rounded bg-white/5 hover:bg-white/10 text-neutral-300 font-mono text-[11px]"
            >
              /en ↗
            </Link>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-mono cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Stage */}
      <main className="flex-1 min-w-0 p-4 sm:p-5 md:p-8 overflow-y-auto overflow-x-hidden max-w-7xl mx-auto w-full space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h1 className="text-xl font-bold text-white">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h1>
            <p className="text-xs text-neutral-400">
              Cloudflare D1 Normalized Database & R2 Object Storage • Bilingual TR/EN Publishing
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="new-project-quick-btn"
              onClick={openCreateEditor}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer"
            >
              + New Project
            </button>
            <button
              type="button"
              onClick={() => {
                loadCoreData();
                loadAnalyticsData(analyticsRange);
              }}
              className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-neutral-300 cursor-pointer"
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="p-4 rounded-xl bg-[#131620] border border-white/10">
                <span className="text-[11px] font-mono text-neutral-400">Total Projects</span>
                <p className="text-2xl font-bold text-white mt-1" data-testid="stat-total-projects">
                  {health?.counts.total ?? projects.length}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#131620] border border-emerald-500/30">
                <span className="text-[11px] font-mono text-emerald-400">Published</span>
                <p className="text-2xl font-bold text-emerald-300 mt-1" data-testid="stat-published-projects">
                  {health?.counts.published ?? 0}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#131620] border border-amber-500/30">
                <span className="text-[11px] font-mono text-amber-400">Drafts</span>
                <p className="text-2xl font-bold text-amber-300 mt-1" data-testid="stat-draft-projects">
                  {health?.counts.draft ?? 0}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#131620] border border-neutral-500/30">
                <span className="text-[11px] font-mono text-neutral-400">Archived</span>
                <p className="text-2xl font-bold text-neutral-300 mt-1" data-testid="stat-archived-projects">
                  {health?.counts.archived ?? 0}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#131620] border border-blue-500/30">
                <span className="text-[11px] font-mono text-blue-400">Featured Desktop</span>
                <p className="text-2xl font-bold text-blue-300 mt-1">
                  {health?.counts.featuredPublished ?? 0}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#131620] border border-purple-500/30">
                <span className="text-[11px] font-mono text-purple-400">R2 Media Items</span>
                <p className="text-2xl font-bold text-purple-300 mt-1">
                  {health?.counts.mediaItems ?? mediaList.length}
                </p>
              </div>
            </div>

            {/* Infrastructure & Analytics Connection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-[#131620] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Cloudflare D1 & R2</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    OPERATIONAL
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Mode: <code className="text-neutral-200">{health?.mode || "local-d1-sqlite"}</code>
                </p>
                <p className="text-xs text-neutral-400">
                  Canonical Reconciliation:{" "}
                  <span className="text-emerald-300 font-mono">
                    {systemInfo?.reconciliation.reconciled
                      ? `${systemInfo.reconciliation.canonicalCount}/${systemInfo.reconciliation.canonicalCount} Verified`
                      : "Pending"}
                  </span>
                </p>
              </div>

              <div className="p-5 rounded-xl bg-[#131620] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Google Analytics 4</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                      ga4Data?.status === "LIVE"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {ga4Data?.status || "CHECKING"}
                  </span>
                </div>
                {ga4Data?.status === "LIVE" && ga4Data.overview ? (
                  <p className="text-xs text-neutral-300">
                    28d Active Users: <strong>{ga4Data.overview.activeUsers}</strong> • Views:{" "}
                    <strong>{ga4Data.overview.screenPageViews}</strong>
                  </p>
                ) : (
                  <p className="text-xs text-neutral-400">
                    Requires <code>GA4_PROPERTY_ID</code> & Google Service Account credentials. No
                    fabricated metrics are shown.
                  </p>
                )}
              </div>

              <div className="p-5 rounded-xl bg-[#131620] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Google Search Console</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                      gscData?.status === "LIVE"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {gscData?.status || "CHECKING"}
                  </span>
                </div>
                {gscData?.status === "LIVE" && gscData.totals ? (
                  <p className="text-xs text-neutral-300">
                    28d Clicks: <strong>{gscData.totals.clicks}</strong> • Impressions:{" "}
                    <strong>{gscData.totals.impressions}</strong>
                  </p>
                ) : (
                  <p className="text-xs text-neutral-400">
                    Property: <code>{gscData?.siteUrl || "sc-domain:keremmihci.com"}</code>. Awaiting
                    Service Account credentials.
                  </p>
                )}
              </div>
            </div>

            {/* Recent Publishing Events */}
            <div className="p-5 rounded-xl bg-[#131620] border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-3">Recent Publishing Events</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-neutral-400 font-mono">
                      <th className="py-2 pr-4">Project ID</th>
                      <th className="py-2 pr-4">Event</th>
                      <th className="py-2 pr-4">Transition</th>
                      <th className="py-2 pr-4">Actor</th>
                      <th className="py-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(systemInfo?.publishingEvents || []).slice(0, 8).map((ev) => (
                      <tr key={ev.id}>
                        <td className="py-2 pr-4 font-mono text-white">{ev.projectId}</td>
                        <td className="py-2 pr-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-neutral-200">
                            {ev.eventType}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono text-neutral-400">
                          {ev.previousStatus || "none"} → {ev.newStatus}
                        </td>
                        <td className="py-2 pr-4 text-neutral-400">{ev.actorEmail}</td>
                        <td className="py-2 font-mono text-neutral-500">
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
            <div className="flex flex-wrap items-center gap-3 bg-[#131620] p-4 rounded-xl border border-white/10">
              <input
                type="text"
                data-testid="projects-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, slug, or client..."
                className="flex-1 min-w-[220px] px-3.5 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published Only</option>
                <option value="draft">Drafts Only</option>
                <option value="archived">Archived Only</option>
              </select>
              <select
                value={workspaceFilter}
                onChange={(e) => setWorkspaceFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
              >
                <option value="all">All Workspaces</option>
                <option value="design">Design</option>
                <option value="web">Web</option>
                <option value="motion-ai">Production (Motion/AI)</option>
              </select>
            </div>

            <div className="rounded-xl bg-[#131620] border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/30 text-neutral-400 font-mono">
                      <th className="py-3 px-4">Project (TR / EN)</th>
                      <th className="py-3 px-3">Workspace</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Featured</th>
                      <th className="py-3 px-3">TR/EN Completeness</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredProjects.map((project) => (
                      <tr
                        key={project.id}
                        data-testid={`project-row-${project.slug}`}
                        className="hover:bg-white/[0.02]"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{project.titleTR}</div>
                          <div className="text-neutral-400">{project.titleEN}</div>
                          <div className="text-[11px] font-mono text-neutral-500 mt-0.5">
                            /{project.slug} • {project.client} ({project.year})
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono uppercase text-neutral-300">
                          {project.workspace}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            data-testid={`status-badge-${project.slug}`}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${
                              project.cmsStatus === "published"
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                : project.cmsStatus === "draft"
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                : "bg-neutral-500/15 text-neutral-400 border-neutral-500/30"
                            }`}
                          >
                            {project.cmsStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {project.featured ? (
                            <span className="text-blue-400 font-semibold">★ Yes</span>
                          ) : (
                            <span className="text-neutral-500">No</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-emerald-400"
                                style={{ width: `${project.completeness.score}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] text-neutral-300">
                              {project.completeness.score}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            data-testid={`edit-btn-${project.slug}`}
                            onClick={() => openEditEditor(project)}
                            className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-mono text-[11px] cursor-pointer"
                          >
                            Edit
                          </button>
                          <Link
                            href={`/admin/preview/${project.slug}?locale=tr`}
                            className="inline-block px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 font-mono text-[11px]"
                          >
                            Preview
                          </Link>
                          {project.cmsStatus !== "published" ? (
                            <button
                              type="button"
                              data-testid={`publish-btn-${project.slug}`}
                              onClick={() => handleQuickStatusChange(project.id, "published")}
                              className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-mono text-[11px] cursor-pointer"
                            >
                              Publish
                            </button>
                          ) : (
                            <button
                              type="button"
                              data-testid={`unpublish-btn-${project.slug}`}
                              onClick={() => handleQuickStatusChange(project.id, "draft")}
                              className="px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-mono text-[11px] cursor-pointer"
                            >
                              Unpublish
                            </button>
                          )}
                          {project.cmsStatus !== "archived" && (
                            <button
                              type="button"
                              data-testid={`archive-btn-${project.slug}`}
                              onClick={() => handleQuickStatusChange(project.id, "archived")}
                              className="px-2.5 py-1 rounded bg-neutral-700/40 hover:bg-neutral-700/60 text-neutral-300 border border-white/10 font-mono text-[11px] cursor-pointer"
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
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/15 border-red-500/30 text-red-300"
                }`}
              >
                {saveMessage.text}
              </div>
            )}

            {/* Completeness Bar & Publishing Actions */}
            <div className="p-4 rounded-xl bg-[#131620] border border-white/10 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-white">
                    Completeness: {editorCompleteness.score}%
                  </span>
                  <span className="text-[11px] font-mono text-neutral-400">
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
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono text-neutral-200"
                  >
                    Preview Draft
                  </Link>
                )}
                <button
                  type="button"
                  data-testid="save-draft-btn"
                  disabled={saving}
                  onClick={() => handleSaveProject("draft")}
                  className="px-4 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-xs font-semibold text-amber-300 cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  data-testid="save-publish-btn"
                  disabled={saving}
                  onClick={() => handleSaveProject("published")}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer"
                >
                  {formState.cmsStatus === "published" ? "Save & Update Published" : "Publish Now"}
                </button>
                {formState.id && formState.cmsStatus === "published" && (
                  <button
                    type="button"
                    data-testid="editor-unpublish-btn"
                    disabled={saving}
                    onClick={() => handleSaveProject("draft")}
                    className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-white/15 text-xs font-mono text-neutral-300 cursor-pointer"
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
                    className="px-3 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-mono text-red-300 cursor-pointer"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>

            {/* Core Metadata Grid */}
            <div className="p-5 rounded-xl bg-[#131620] border border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono text-neutral-400 mb-1">
                  URL Slug (Unique) *
                </label>
                <input
                  type="text"
                  data-testid="input-project-slug"
                  value={formState.slug}
                  onChange={(e) => setFormState({ ...formState, slug: e.target.value })}
                  placeholder="cms-publish-test"
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-neutral-400 mb-1">Workspace *</label>
                <select
                  data-testid="input-project-workspace"
                  value={formState.workspace}
                  onChange={(e) =>
                    setFormState({ ...formState, workspace: e.target.value as WorkspaceCategory })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
                >
                  <option value="design">Design (Graphic & Brand)</option>
                  <option value="web">Web & Product</option>
                  <option value="motion-ai">Production (Motion & AI)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-neutral-400 mb-1">
                  Client / Brand Name
                </label>
                <input
                  type="text"
                  data-testid="input-project-client"
                  value={formState.client}
                  onChange={(e) => setFormState({ ...formState, client: e.target.value })}
                  placeholder="Client or Studio"
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-neutral-400 mb-1">Year</label>
                <input
                  type="text"
                  data-testid="input-project-year"
                  value={formState.year}
                  onChange={(e) => setFormState({ ...formState, year: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-neutral-400 mb-1">Live URL</label>
                <input
                  type="url"
                  data-testid="input-project-live-url"
                  value={formState.liveUrl || ""}
                  onChange={(e) => setFormState({ ...formState, liveUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
                />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <input
                  id="featured-checkbox"
                  type="checkbox"
                  data-testid="input-project-featured"
                  checked={formState.featured}
                  onChange={(e) => setFormState({ ...formState, featured: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="featured-checkbox" className="text-xs font-medium text-white">
                  Featured on Desktop & Mobile Workspace
                </label>
              </div>
            </div>

            {/* Bilingual Content Editor (TR & EN Tabs) */}
            <div className="p-5 rounded-xl bg-[#131620] border border-white/10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="locale-tab-tr"
                    onClick={() => setEditorLocaleTab("tr")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                      editorLocaleTab === "tr"
                        ? "bg-blue-600 text-white"
                        : "bg-white/5 text-neutral-400 hover:text-white"
                    }`}
                  >
                    🇹🇷 Türkçe İçerik (TR)
                  </button>
                  <button
                    type="button"
                    data-testid="locale-tab-en"
                    onClick={() => setEditorLocaleTab("en")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                      editorLocaleTab === "en"
                        ? "bg-blue-600 text-white"
                        : "bg-white/5 text-neutral-400 hover:text-white"
                    }`}
                  >
                    🇬🇧 English Content (EN)
                  </button>
                </div>
              </div>

              {editorLocaleTab === "tr" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-neutral-400 mb-1">
                      Proje Başlığı (TR) *
                    </label>
                    <input
                      type="text"
                      data-testid="input-title-tr"
                      value={formState.titleTR}
                      onChange={(e) => setFormState({ ...formState, titleTR: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-neutral-400 mb-1">
                      Kategori Etiketi (TR) *
                    </label>
                    <input
                      type="text"
                      data-testid="input-category-tr"
                      value={formState.categoryTR}
                      onChange={(e) => setFormState({ ...formState, categoryTR: e.target.value })}
                      placeholder="Web Tasarım & Geliştirme"
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-mono text-neutral-400 mb-1">
                      Kısa Özet / Summary (TR)
                    </label>
                    <input
                      type="text"
                      data-testid="input-summary-tr"
                      value={formState.summaryTR || ""}
                      onChange={(e) => setFormState({ ...formState, summaryTR: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-mono text-neutral-400 mb-1">
                      Detaylı Proje Açıklaması (TR) *
                    </label>
                    <textarea
                      rows={5}
                      data-testid="input-description-tr"
                      value={formState.descriptionTR}
                      onChange={(e) =>
                        setFormState({ ...formState, descriptionTR: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-neutral-400 mb-1">
                      Project Title (EN) *
                    </label>
                    <input
                      type="text"
                      data-testid="input-title-en"
                      value={formState.titleEN}
                      onChange={(e) => setFormState({ ...formState, titleEN: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-neutral-400 mb-1">
                      Category Label (EN) *
                    </label>
                    <input
                      type="text"
                      data-testid="input-category-en"
                      value={formState.categoryEN}
                      onChange={(e) => setFormState({ ...formState, categoryEN: e.target.value })}
                      placeholder="Web Design & Engineering"
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-mono text-neutral-400 mb-1">
                      Short Summary (EN)
                    </label>
                    <input
                      type="text"
                      data-testid="input-summary-en"
                      value={formState.summaryEN || ""}
                      onChange={(e) => setFormState({ ...formState, summaryEN: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-mono text-neutral-400 mb-1">
                      Full Project Description (EN) *
                    </label>
                    <textarea
                      rows={5}
                      data-testid="input-description-en"
                      value={formState.descriptionEN}
                      onChange={(e) =>
                        setFormState({ ...formState, descriptionEN: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Cover, Thumbnail & R2 Media Manager */}
            <div className="p-5 rounded-xl bg-[#131620] border border-white/10 space-y-4">
              <h3 className="text-sm font-semibold text-white">
                Project Cover, Thumbnail & Gallery Media (Cloudflare R2)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-neutral-400 mb-1">
                    Cover / Hero Image URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      data-testid="input-cover-url"
                      value={formState.cover || ""}
                      onChange={(e) => setFormState({ ...formState, cover: e.target.value })}
                      placeholder="/projects/... or /api/media/..."
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs font-mono text-white"
                    />
                    <label className="px-3 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xs font-mono text-blue-300 cursor-pointer whitespace-nowrap">
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
                  <label className="block text-xs font-mono text-neutral-400 mb-1">
                    Desktop / Grid Thumbnail URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      data-testid="input-thumbnail-url"
                      value={formState.thumbnail || ""}
                      onChange={(e) => setFormState({ ...formState, thumbnail: e.target.value })}
                      placeholder="/projects/... or /api/media/..."
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs font-mono text-white"
                    />
                    <label className="px-3 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xs font-mono text-blue-300 cursor-pointer whitespace-nowrap">
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
              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-neutral-300">
                    Gallery Media Items ({(formState.media || []).length})
                  </span>
                  <label className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-xs font-mono text-purple-300 cursor-pointer">
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
                      className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-black/30 border border-white/10 text-xs"
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
                        className="flex-1 min-w-[180px] px-2.5 py-1 rounded bg-black/50 border border-white/10 font-mono text-[11px] text-white"
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
                        className="w-36 px-2.5 py-1 rounded bg-black/50 border border-white/10 text-[11px] text-white"
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
                        className="w-36 px-2.5 py-1 rounded bg-black/50 border border-white/10 text-[11px] text-white"
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
                        className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 font-mono"
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
                        className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 font-mono"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = (formState.media || []).filter((_, i) => i !== idx);
                          setFormState({ ...formState, media: next });
                        }}
                        className="px-2 py-1 rounded bg-red-500/20 text-red-300 font-mono"
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
              <div className="p-5 rounded-xl bg-[#131620] border border-white/10">
                <h3 className="text-sm font-semibold text-white mb-3">
                  Revision Snapshots & Rollback ({revisions.length})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {revisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-black/30 border border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-blue-400">
                          Rev #{rev.revisionNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/10 font-mono text-[10px]">
                          {rev.action}
                        </span>
                        <span className="text-neutral-400">{rev.actorEmail}</span>
                        <span className="text-neutral-500 font-mono">
                          {new Date(rev.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRollbackRevision(rev.revisionNumber)}
                        className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/15 border border-white/10 font-mono text-[11px] text-neutral-200 cursor-pointer"
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
            <div className="p-5 rounded-xl bg-[#131620] border border-white/10 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Cloudflare R2 Media Library</h3>
                <p className="text-xs text-neutral-400">
                  Validated image/video uploads with structured key prefixing and immutable caching.
                </p>
              </div>
              <label className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer">
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
              {mediaList.slice(0, 60).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-[#131620] border border-white/10 overflow-hidden flex flex-col justify-between"
                >
                  <div className="h-32 bg-black/50 flex items-center justify-center overflow-hidden relative">
                    {item.mediaType === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.publicUrl}
                        alt={item.altEN || item.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="font-mono text-xs text-purple-300">VIDEO ({item.mimeType})</span>
                    )}
                  </div>
                  <div className="p-3 space-y-1 text-[11px]">
                    <div className="font-mono text-white truncate" title={item.filename}>
                      {item.filename}
                    </div>
                    <div className="text-neutral-500 font-mono truncate" title={item.publicUrl}>
                      {item.publicUrl}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
                  className={`px-4 py-2 rounded-lg text-xs font-mono uppercase cursor-pointer ${
                    featuredWorkspace === ws
                      ? "bg-blue-600 text-white font-semibold"
                      : "bg-[#131620] text-neutral-400 border border-white/10"
                  }`}
                >
                  {ws} Workspace
                </button>
              ))}
            </div>

            <div className="p-5 rounded-xl bg-[#131620] border border-white/10 space-y-3">
              <p className="text-xs text-neutral-400">
                Toggle featured desktop icons for the <strong>{featuredWorkspace}</strong> workspace.
                Featured published projects spawn automatically on the Portfolio OS desktop without
                overlapping.
              </p>
              <div className="divide-y divide-white/5">
                {projects
                  .filter((p) => p.workspace === featuredWorkspace)
                  .map((p) => (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <span className="font-semibold text-white">{p.titleTR}</span>{" "}
                        <span className="text-neutral-400">({p.titleEN})</span>
                        <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-neutral-400">
                          {p.cmsStatus}
                        </span>
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
                        className={`px-3 py-1.5 rounded-lg font-mono text-xs cursor-pointer border ${
                          p.featured
                            ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
                            : "bg-white/5 text-neutral-400 border-white/10"
                        }`}
                      >
                        {p.featured ? "★ Featured on Desktop" : "Set Featured"}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================
            6. GOOGLE ANALYTICS 4 (GA4) TAB
           ====================================================== */}
        {activeTab === "ga4" && (
          <div className="space-y-6" data-testid="admin-ga4-section">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#131620] p-4 rounded-xl border border-white/10">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Google Analytics 4 Data API Report
                </h3>
                <p className="text-xs text-neutral-400 font-mono">
                  Property ID: {ga4Data?.propertyId || "Not Configured"} • Stream:{" "}
                  {ga4Data?.measurementId || "Not Configured"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(["7d", "28d", "90d"] as AnalyticsDateRange[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setAnalyticsRange(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer ${
                      analyticsRange === r
                        ? "bg-blue-600 text-white"
                        : "bg-white/5 text-neutral-400 hover:text-white"
                    }`}
                  >
                    Last {r}
                  </button>
                ))}
              </div>
            </div>

            {ga4Data?.status !== "LIVE" ? (
              <div
                data-testid="ga4-not-configured-banner"
                className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-amber-300">
                    GA4 Data API Integration: {ga4Data?.status || "NOT_CONFIGURED"}
                  </h4>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-200">
                    ZERO FABRICATED METRICS
                  </span>
                </div>
                <p className="text-xs text-neutral-300">
                  Real server-side GA4 Data API reporting is implemented and ready. To activate live
                  data fetching, provide the following environment variables on the server:
                </p>
                <ul className="list-disc list-inside text-xs font-mono text-amber-200 space-y-1">
                  {(ga4Data?.missingEnvVars || ["GA4_PROPERTY_ID", "GOOGLE_SERVICE_ACCOUNT_JSON"]).map(
                    (v) => (
                      <li key={v}>{v}</li>
                    )
                  )}
                </ul>
                {ga4Data?.errorMessage && (
                  <p className="text-xs font-mono text-red-300">API Error: {ga4Data.errorMessage}</p>
                )}
              </div>
            ) : (
              ga4Data.overview && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-[#131620] border border-white/10">
                      <span className="text-[11px] font-mono text-neutral-400">Active Users</span>
                      <p className="text-2xl font-bold text-white mt-1">
                        {ga4Data.overview.activeUsers}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#131620] border border-white/10">
                      <span className="text-[11px] font-mono text-neutral-400">Sessions</span>
                      <p className="text-2xl font-bold text-white mt-1">
                        {ga4Data.overview.sessions}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#131620] border border-white/10">
                      <span className="text-[11px] font-mono text-neutral-400">Page Views</span>
                      <p className="text-2xl font-bold text-white mt-1">
                        {ga4Data.overview.screenPageViews}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#131620] border border-white/10">
                      <span className="text-[11px] font-mono text-neutral-400">Realtime Users</span>
                      <p className="text-2xl font-bold text-emerald-400 mt-1">
                        {ga4Data.realtimeActiveUsers ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* ======================================================
            7. GOOGLE SEARCH CONSOLE (GSC) TAB
           ====================================================== */}
        {activeTab === "gsc" && (
          <div className="space-y-6" data-testid="admin-gsc-section">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#131620] p-4 rounded-xl border border-white/10">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Google Search Console Search Analytics API
                </h3>
                <p className="text-xs text-neutral-400 font-mono">
                  Property: {gscData?.siteUrl || "sc-domain:keremmihci.com"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(["7d", "28d", "90d"] as AnalyticsDateRange[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setAnalyticsRange(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer ${
                      analyticsRange === r
                        ? "bg-blue-600 text-white"
                        : "bg-white/5 text-neutral-400 hover:text-white"
                    }`}
                  >
                    Last {r}
                  </button>
                ))}
              </div>
            </div>

            {gscData?.status !== "LIVE" ? (
              <div
                data-testid="gsc-not-configured-banner"
                className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-amber-300">
                    Search Console API Integration: {gscData?.status || "NOT_CONFIGURED"}
                  </h4>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-200">
                    ZERO FABRICATED METRICS
                  </span>
                </div>
                <p className="text-xs text-neutral-300">
                  Real server-side Search Console API reporting for{" "}
                  <code>{gscData?.siteUrl || "sc-domain:keremmihci.com"}</code> is implemented. Grant
                  the Service Account access in Google Search Console and configure:
                </p>
                <ul className="list-disc list-inside text-xs font-mono text-amber-200 space-y-1">
                  {(
                    gscData?.missingEnvVars || [
                      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
                      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
                    ]
                  ).map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
            ) : (
              gscData.totals && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-[#131620] border border-white/10">
                    <span className="text-[11px] font-mono text-neutral-400">Total Clicks</span>
                    <p className="text-2xl font-bold text-white mt-1">{gscData.totals.clicks}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#131620] border border-white/10">
                    <span className="text-[11px] font-mono text-neutral-400">Impressions</span>
                    <p className="text-2xl font-bold text-white mt-1">
                      {gscData.totals.impressions}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#131620] border border-white/10">
                    <span className="text-[11px] font-mono text-neutral-400">Average CTR</span>
                    <p className="text-2xl font-bold text-white mt-1">
                      {(gscData.totals.ctr * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#131620] border border-white/10">
                    <span className="text-[11px] font-mono text-neutral-400">Average Position</span>
                    <p className="text-2xl font-bold text-white mt-1">
                      {gscData.totals.position.toFixed(1)}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* ======================================================
            8. PROJECT-LEVEL TRAFFIC INSIGHTS TAB
           ====================================================== */}
        {activeTab === "project-traffic" && (
          <div className="space-y-4" data-testid="admin-project-traffic-section">
            <div className="p-4 rounded-xl bg-[#131620] border border-white/10">
              <h3 className="text-sm font-semibold text-white">
                Project-Level Traffic & Search Performance (/tr/project/[slug] + /en/project/[slug])
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Maps GA4 page views and Search Console search queries/clicks directly to each
                portfolio project. Shows <code>— (Awaiting API)</code> when live Google credentials
                are not yet attached.
              </p>
            </div>

            <div className="rounded-xl bg-[#131620] border border-white/10 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-black/30 text-neutral-400 font-mono">
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">GA4 Total Views (TR / EN)</th>
                    <th className="py-3 px-3">GA4 Users</th>
                    <th className="py-3 px-3">GSC Clicks</th>
                    <th className="py-3 px-3">GSC Impressions</th>
                    <th className="py-3 px-3">GSC Avg Pos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {projectInsights.map((ins) => (
                    <tr key={ins.projectId}>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-white">{ins.titleTR}</div>
                        <div className="text-[11px] font-mono text-neutral-500">/{ins.slug}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono uppercase text-neutral-400">
                        {ins.status}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {ins.ga4.totalViews !== null ? (
                          <span className="text-white">
                            {ins.ga4.totalViews} ({ins.ga4.trViews} TR / {ins.ga4.enViews} EN)
                          </span>
                        ) : (
                          <span className="text-neutral-500">— (Not Configured)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-neutral-400">
                        {ins.ga4.users !== null ? ins.ga4.users : "—"}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-neutral-400">
                        {ins.gsc.clicks !== null ? ins.gsc.clicks : "—"}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-neutral-400">
                        {ins.gsc.impressions !== null ? ins.gsc.impressions : "—"}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-neutral-400">
                        {ins.gsc.position !== null ? ins.gsc.position.toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================
            9. SYSTEM STATUS & AUDIT LOGS TAB
           ====================================================== */}
        {activeTab === "system" && systemInfo && (
          <div className="space-y-6" data-testid="admin-system-section">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-[#131620] border border-white/10 space-y-2 text-xs">
                <h3 className="text-sm font-semibold text-white">Database & Migration Health</h3>
                <p className="text-neutral-400">
                  Engine Mode: <code className="text-white">{systemInfo.d1Health.mode}</code>
                </p>
                <p className="text-neutral-400">
                  Canonical 30-Project Reconciliation:{" "}
                  <strong className="text-emerald-400">
                    {systemInfo.reconciliation.reconciled ? "100% RECONCILED" : "MISMATCH"}
                  </strong>
                </p>
                <p className="text-neutral-400">
                  Total Translations: <code>{systemInfo.d1Health.counts.translations}</code> rows
                </p>
              </div>

              <div className="p-5 rounded-xl bg-[#131620] border border-white/10 space-y-2 text-xs">
                <h3 className="text-sm font-semibold text-white">Environment Readiness</h3>
                <p className="text-neutral-400">
                  GA4 Browser Stream ID:{" "}
                  <code>
                    {systemInfo.environment.gaMeasurementIdConfigured ? "Configured" : "Not Set"}
                  </code>
                </p>
                <p className="text-neutral-400">
                  GA4 Numeric Property ID:{" "}
                  <code>
                    {systemInfo.environment.ga4PropertyIdConfigured ? "Configured" : "Not Set"}
                  </code>
                </p>
                <p className="text-neutral-400">
                  Google Service Account:{" "}
                  <code>
                    {systemInfo.environment.googleServiceAccountConfigured
                      ? "Configured"
                      : "Not Set"}
                  </code>
                </p>
                <p className="text-neutral-400">
                  Cloudflare Remote Worker URL:{" "}
                  <code>
                    {systemInfo.environment.cloudflareRemoteWorkerConfigured
                      ? "Configured"
                      : "Local D1 Active"}
                  </code>
                </p>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#131620] border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-3">
                Admin Security & Mutation Audit Logs
              </h3>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-neutral-400 font-mono">
                      <th className="py-2 pr-4">Action</th>
                      <th className="py-2 pr-4">Entity</th>
                      <th className="py-2 pr-4">Actor</th>
                      <th className="py-2 pr-4">Details</th>
                      <th className="py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {systemInfo.auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2 pr-4 font-mono text-blue-300">{log.action}</td>
                        <td className="py-2 pr-4 font-mono text-neutral-300">
                          {log.entityType}:{log.entityId || "-"}
                        </td>
                        <td className="py-2 pr-4 text-neutral-400">{log.actorEmail}</td>
                        <td className="py-2 pr-4 font-mono text-[11px] text-neutral-500 max-w-xs truncate">
                          {log.detailsJson}
                        </td>
                        <td className="py-2 font-mono text-neutral-500">
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
            10. SETTINGS TAB
           ====================================================== */}
        {activeTab === "settings" && (
          <div className="p-6 rounded-xl bg-[#131620] border border-white/10 space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-white">
              Portfolio OS CMS & Security Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-neutral-300">
              <div className="p-4 rounded-lg bg-black/30 border border-white/5 space-y-1">
                <div className="font-mono text-neutral-400">Active Admin Session</div>
                <div>Email: {session.email}</div>
                <div>Auth Mode: {session.mode}</div>
                <div>Expires: {new Date(session.exp).toLocaleString()}</div>
              </div>
              <div className="p-4 rounded-lg bg-black/30 border border-white/5 space-y-1">
                <div className="font-mono text-neutral-400">Security Controls</div>
                <div>• HTTP-Only HMAC-SHA256 Signed Session Cookie</div>
                <div>• Same-Origin + X-CSRF-Token Mutation Verification</div>
                <div>• Robots.txt & X-Robots-Tag noindex Isolation</div>
                <div>• Public ConsentBanner & GA4 Suppressed on /admin</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
