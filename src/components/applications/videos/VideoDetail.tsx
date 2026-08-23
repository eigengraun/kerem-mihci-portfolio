"use client";

import React, { useRef, useEffect } from "react";
import Image from "next/image";
import { PortfolioVideo } from "@/data/videos";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore } from "@/store/windowStore";
import { projectsData } from "@/data/projects";
import { getTranslation } from "@/lib/i18n";
import { toLocaleUpper } from "@/lib/casing";

interface VideoDetailProps {
  video: PortfolioVideo;
  onBack: () => void;
  onOpenFeed?: (video: PortfolioVideo) => void;
}

export const VideoDetail: React.FC<VideoDetailProps> = ({ video, onBack, onOpenFeed }) => {
  const { locale, activeWorkspace } = useDesktopStore();
  const { openWindow, bringToFront, windows } = useWindowStore();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Playback lifecycle cleanup: pause playback on unmount or video change
  useEffect(() => {
    const videoEl = videoRef.current;
    return () => {
      if (videoEl) {
        videoEl.pause();
      }
    };
  }, [video.id]);

  const title = locale === "tr" ? video.titleTR : video.titleEN;
  const description = locale === "tr" ? (video.fullDescriptionTR || video.descriptionTR) : (video.fullDescriptionEN || video.descriptionEN);
  const isAi = video.type === "ai-reel";
  const badgeLabel = isAi ? "AI REEL" : "REEL";
  const services = locale === "tr" ? (video.servicesTR || video.services) : (video.servicesEN || video.services);
  const isLandscape = video.orientation === "landscape";

  // Handle optional "View Project" link to Portfolio OS Projects App
  const handleOpenProject = () => {
    if (!video.projectSlug) return;
    const found = projectsData.find((p) => p.slug === video.projectSlug);
    if (!found) return;

    const windowId = `project-${found.slug}`;
    const activeWins = windows[activeWorkspace] || [];
    const isAlreadyOpen = activeWins.some((w) => w.id === windowId);

    if (isAlreadyOpen) {
      bringToFront(windowId, activeWorkspace);
    } else {
      openWindow({
        id: windowId,
        workspaceId: activeWorkspace,
        contentId: found.slug,
        type: "project",
        titleTR: `${found.titleTR} — Proje Bilgisi`,
        titleEN: `Information about: ${found.titleEN}`,
        preferredWidth: found.initialWindow.width,
        preferredHeight: found.initialWindow.height,
        extraData: { project: found }
      });
    }
  };

  const handleBackClick = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    onBack();
  };

  if (isLandscape) {
    return (
      <LandscapeVideoDetail
        video={video}
        locale={locale}
        title={title}
        description={description}
        isAi={isAi}
        badgeLabel={badgeLabel}
        services={services}
        videoRef={videoRef}
        onBack={handleBackClick}
        handleOpenProject={handleOpenProject}
      />
    );
  }

  return (
    <PortraitVideoDetail
      video={video}
      locale={locale}
      title={title}
      description={description}
      isAi={isAi}
      badgeLabel={badgeLabel}
      services={services}
      videoRef={videoRef}
      onBack={handleBackClick}
      onOpenFeed={onOpenFeed}
      handleOpenProject={handleOpenProject}
    />
  );
};

/* =========================================================================
   LANDSCAPE VIDEO DETAIL (16:9 Hero Layout)
   ========================================================================= */
interface LandscapeVideoDetailProps {
  video: PortfolioVideo;
  locale: "tr" | "en";
  title: string;
  description?: string;
  isAi: boolean;
  badgeLabel: string;
  services?: string[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onBack: () => void;
  handleOpenProject: () => void;
}

const LandscapeVideoDetail: React.FC<LandscapeVideoDetailProps> = ({
  video,
  locale,
  title,
  description,
  isAi,
  badgeLabel,
  services,
  videoRef,
  onBack,
  handleOpenProject
}) => {
  return (
    <div
      className="h-full overflow-y-auto app-scrollbar pr-1 flex flex-col select-none"
      data-prevent-workspace-wheel="true"
    >
      {/* Top Header Control Row */}
      <div className="pb-3 border-b border-[var(--app-divider)] flex items-center justify-between gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--app-surface-subtle)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text-primary)] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95 shadow-xs"
        >
          <span>←</span>
          <span>{getTranslation(locale, "videos_back")}</span>
        </button>

        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-md ${
              isAi
                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25"
                : "bg-black/5 dark:bg-white/10 text-[var(--app-text-secondary)] border border-[var(--app-border)]"
            }`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>

      {/* Main Single-Scroll Content Flow */}
      <div className="pt-4 pb-8 space-y-5 max-w-[880px] w-full mx-auto flex-1">
        {/* Title Block */}
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[var(--app-text-primary)] leading-snug">
            {title}
          </h1>
        </div>

        {/* Compact Structured Metadata Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-[var(--app-surface-subtle)] border border-[var(--app-border)] text-xs shadow-2xs">
          {video.client && (
            <div className="flex flex-col">
              <span lang={locale} className="text-[10px] font-mono uppercase tracking-wider text-[var(--app-text-muted)] font-semibold">
                {toLocaleUpper(getTranslation(locale, "videos_client"), locale)}
              </span>
              <span className="font-medium text-[var(--app-text-primary)] mt-0.5 text-xs sm:text-sm">
                {video.client}
              </span>
            </div>
          )}
          {video.year && (
            <div className="flex flex-col">
              <span lang={locale} className="text-[10px] font-mono uppercase tracking-wider text-[var(--app-text-muted)] font-semibold">
                {toLocaleUpper(getTranslation(locale, "videos_year"), locale)}
              </span>
              <span className="font-medium font-mono text-[var(--app-text-primary)] mt-0.5 text-xs sm:text-sm">
                {video.year}
              </span>
            </div>
          )}
          {video.aiAssisted && (
            <div className="flex flex-col">
              <span lang={locale} className="text-[10px] font-mono uppercase tracking-wider text-[var(--app-text-muted)] font-semibold">
                {toLocaleUpper(locale === "tr" ? "ÜRETİM" : "PRODUCTION", locale)}
              </span>
              <span className="font-medium text-[var(--app-text-primary)] mt-0.5 text-xs sm:text-sm">
                {locale === "tr" ? "AI Destekli" : "AI-Assisted"}
              </span>
            </div>
          )}
          {video.duration && (
            <div className="flex flex-col">
              <span lang={locale} className="text-[10px] font-mono uppercase tracking-wider text-[var(--app-text-muted)] font-semibold">
                {toLocaleUpper(locale === "tr" ? "SÜRE" : "DURATION", locale)}
              </span>
              <span className="font-medium font-mono text-[var(--app-text-primary)] mt-0.5 text-xs sm:text-sm">
                {video.duration}
              </span>
            </div>
          )}
        </div>

        {/* 16:9 Hero Video Player */}
        <div
          className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-black border border-[var(--app-border)] shadow-2xl flex items-center justify-center"
          data-prevent-workspace-wheel="true"
        >
          {video.src ? (
            <video
              ref={videoRef}
              key={video.src}
              src={video.src}
              poster={video.poster}
              controls
              playsInline
              preload="metadata"
              className="w-full h-full object-contain bg-black pointer-events-auto"
            >
              {getTranslation(locale, "videos_media_unavailable")}
            </video>
          ) : (
            <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
              {video.poster && (
                <Image
                  src={video.poster}
                  alt={title}
                  fill
                  sizes="880px"
                  className="object-contain w-full h-full opacity-90 pointer-events-none"
                />
              )}
            </div>
          )}
        </div>

        {/* Content Below Video: Project Information & Services */}
        <div className="space-y-5 pt-2">
          {/* Description */}
          {description && (
            <div className="space-y-2.5">
              <h2 lang={locale} className="text-xs font-mono uppercase tracking-wider font-semibold text-[var(--app-text-muted)]">
                {toLocaleUpper(locale === "tr" ? "PROJE HAKKINDA" : "ABOUT THE PROJECT", locale)}
              </h2>
              <div className="space-y-2.5 text-xs sm:text-sm md:text-[14.5px] text-[var(--app-text-secondary)] leading-relaxed font-sans">
                {description.split("\n\n").map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </div>
          )}

          {/* Services Chips */}
          {services && services.length > 0 && (
            <div className="space-y-2 pt-1">
              <h2 lang={locale} className="text-xs font-mono uppercase tracking-wider font-semibold text-[var(--app-text-muted)]">
                {toLocaleUpper(getTranslation(locale, "videos_services"), locale)}
              </h2>
              <div className="flex flex-wrap gap-2">
                {services.map((srv) => (
                  <span
                    key={srv}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--app-surface-subtle)] border border-[var(--app-border)] text-[var(--app-text-primary)] shadow-2xs"
                  >
                    {srv}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tools Chips (if any) */}
          {video.tools && video.tools.length > 0 && (
            <div className="space-y-2 pt-1">
              <h2 lang={locale} className="text-xs font-mono uppercase tracking-wider font-semibold text-[var(--app-text-muted)]">
                {toLocaleUpper(getTranslation(locale, "videos_tools"), locale)}
              </h2>
              <div className="flex flex-wrap gap-2">
                {video.tools.map((tool) => (
                  <span
                    key={tool}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono bg-[var(--app-surface-subtle)] border border-[var(--app-border)] text-[var(--app-text-primary)] shadow-2xs"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Links */}
          {(video.projectSlug || video.externalUrl) && (
            <div className="pt-3 border-t border-[var(--app-divider)] flex flex-wrap items-center gap-2">
              {video.projectSlug && (
                <button
                  type="button"
                  onClick={handleOpenProject}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--app-surface-subtle)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text-primary)] shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
                >
                  <span>{getTranslation(locale, "videos_view_project")}</span>
                  <span>↗</span>
                </button>
              )}

              {video.externalUrl && (
                <a
                  href={video.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--app-surface-subtle)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text-primary)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
                >
                  <span>{getTranslation(locale, "videos_external_link")}</span>
                  <span>↗</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   PORTRAIT VIDEO DETAIL (Vertical 9:16 Split Layout)
   ========================================================================= */
interface PortraitVideoDetailProps {
  video: PortfolioVideo;
  locale: "tr" | "en";
  title: string;
  description?: string;
  isAi: boolean;
  badgeLabel: string;
  services?: string[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onBack: () => void;
  onOpenFeed?: (video: PortfolioVideo) => void;
  handleOpenProject: () => void;
}

const PortraitVideoDetail: React.FC<PortraitVideoDetailProps> = ({
  video,
  locale,
  title,
  description,
  isAi,
  badgeLabel,
  services,
  videoRef,
  onBack,
  onOpenFeed,
  handleOpenProject
}) => {
  return (
    <div
      className="h-full overflow-y-auto app-scrollbar pr-1 flex flex-col select-none"
      data-prevent-workspace-wheel="true"
    >
      {/* Top Navigation Bar with Back Button */}
      <div className="pb-3 border-b border-[var(--app-divider)] flex items-center justify-between gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--app-surface-subtle)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text-primary)] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95 shadow-xs"
        >
          <span>←</span>
          <span>{getTranslation(locale, "videos_back")}</span>
        </button>

        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
              isAi
                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25"
                : "bg-black/5 dark:bg-white/10 text-[var(--app-text-secondary)] border border-[var(--app-border)]"
            }`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>

      {/* Main Detail Body: Desktop Split / Mobile Stacked */}
      <div className="pt-3 pb-6 flex flex-col md:flex-row gap-6 flex-1">
        {/* Left Column: True Video Player Stage (Aspect-Aware 9:16) */}
        <div className="w-full md:w-auto flex-shrink-0 flex items-start justify-center">
          <div
            className="relative w-auto h-[420px] sm:h-[450px] md:h-[480px] max-h-[calc(100vh-280px)] aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-[var(--app-border)] shadow-2xl flex items-center justify-center flex-shrink-0"
            data-prevent-workspace-wheel="true"
          >
            {video.src ? (
              <video
                ref={videoRef}
                key={video.src}
                src={video.src}
                poster={video.poster}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain bg-black pointer-events-auto"
              >
                {getTranslation(locale, "videos_media_unavailable")}
              </video>
            ) : (
              <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
                {video.poster && (
                  <Image
                    src={video.poster}
                    alt={title}
                    fill
                    sizes="270px"
                    className="object-contain w-full h-full opacity-90 pointer-events-none"
                  />
                )}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-11 h-11 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-white text-sm shadow-lg mb-2">
                    ▶
                  </div>
                  <span className="text-xs font-mono font-medium text-white/90">
                    {locale === "tr" ? "Önizleme Modu" : "Preview Mode"}
                  </span>
                  <span className="text-[10px] font-mono text-white/60 mt-0.5">
                    {video.duration || "9:16 HD"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Project Information & Actions */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-4 pb-2">
          <div className="space-y-3.5">
            {/* Title */}
            <div>
              <h1 className="text-base sm:text-lg font-bold text-[var(--app-text-primary)] leading-tight">
                {title}
              </h1>
            </div>

            {/* Clean Structured Metadata Grid */}
            {(video.client || video.year || video.aiAssisted) && (
              <div className={`grid gap-2 p-2.5 rounded-lg bg-[var(--app-surface-subtle)] border border-[var(--app-border)] text-xs ${
                video.aiAssisted ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"
              }`}>
                {video.client && (
                  <div className="flex flex-col">
                    <span lang={locale} className="text-[10px] font-mono uppercase tracking-wider text-[var(--app-text-muted)] font-semibold">
                      {toLocaleUpper(getTranslation(locale, "videos_client"), locale)}
                    </span>
                    <span className="font-medium text-[var(--app-text-primary)] mt-0.5">
                      {video.client}
                    </span>
                  </div>
                )}
                {video.year && (
                  <div className="flex flex-col">
                    <span lang={locale} className="text-[10px] font-mono uppercase tracking-wider text-[var(--app-text-muted)] font-semibold">
                      {toLocaleUpper(getTranslation(locale, "videos_year"), locale)}
                    </span>
                    <span className="font-medium font-mono text-[var(--app-text-primary)] mt-0.5">
                      {video.year}
                    </span>
                  </div>
                )}
                {video.aiAssisted && (
                  <div className="flex flex-col col-span-2 sm:col-span-1">
                    <span lang={locale} className="text-[10px] font-mono uppercase tracking-wider text-[var(--app-text-muted)] font-semibold">
                      {toLocaleUpper(locale === "tr" ? "ÜRETİM" : "PRODUCTION", locale)}
                    </span>
                    <span className="font-medium text-[var(--app-text-primary)] mt-0.5">
                      {locale === "tr" ? "AI Destekli" : "AI-Assisted"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Multi-paragraph Description */}
            {description && (
              <div className="space-y-2 text-xs sm:text-sm text-[var(--app-text-secondary)] leading-relaxed font-sans">
                {description.split("\n\n").map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            )}

            {/* Services Chips */}
            {services && services.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span lang={locale} className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[var(--app-text-muted)]">
                  {toLocaleUpper(getTranslation(locale, "videos_services"), locale)}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {services.map((srv) => (
                    <span
                      key={srv}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--app-surface-subtle)] border border-[var(--app-border)] text-[var(--app-text-primary)]"
                    >
                      {srv}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tools Chips (if any) */}
            {video.tools && video.tools.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span lang={locale} className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[var(--app-text-muted)]">
                  {toLocaleUpper(getTranslation(locale, "videos_tools"), locale)}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {video.tools.map((tool) => (
                    <span
                      key={tool}
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-[var(--app-surface-subtle)] border border-[var(--app-border)] text-[var(--app-text-primary)]"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Links */}
          <div className="pt-3 border-t border-[var(--app-divider)] flex flex-wrap items-center gap-2">
            {onOpenFeed && (video.orientation ?? "portrait") === "portrait" && (
              <button
                type="button"
                onClick={() => onOpenFeed(video)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1967E8] text-white hover:bg-blue-600 shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
              >
                <span>{getTranslation(locale, "videos_feed_open_in_reels")}</span>
                <span>▶</span>
              </button>
            )}

            {video.projectSlug && (
              <button
                type="button"
                onClick={handleOpenProject}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--app-surface-subtle)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text-primary)] shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
              >
                <span>{getTranslation(locale, "videos_view_project")}</span>
                <span>↗</span>
              </button>
            )}

            {video.externalUrl && (
              <a
                href={video.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--app-surface-subtle)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text-primary)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
              >
                <span>{getTranslation(locale, "videos_external_link")}</span>
                <span>↗</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
