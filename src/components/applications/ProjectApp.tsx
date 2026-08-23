"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Project } from "@/data/projects";
import { useDesktopStore } from "@/store/desktopStore";
import { getTranslation } from "@/lib/i18n";
import { VideoPlayer } from "@/components/ui/VideoPlayer";
import { toLocaleUpper } from "@/lib/casing";

interface ProjectAppProps {
  project: Project;
}

export const ProjectApp: React.FC<ProjectAppProps> = ({ project }) => {
  const { locale } = useDesktopStore();
  const [imageErrorMap, setImageErrorMap] = useState<Record<number, boolean>>({});
  const [imageLoadingMap, setImageLoadingMap] = useState<Record<number, boolean>>({});

  const title = locale === "tr" ? project.titleTR : project.titleEN;
  const category = locale === "tr" ? project.categoryTR : project.categoryEN;
  const projectType = locale === "tr" ? (project.projectTypeTR || category) : (project.projectTypeEN || category);
  const intro = (locale === "tr" ? project.summaryTR : project.summaryEN) ||
                (locale === "tr" ? project.descriptionTR : project.descriptionEN);
  const role = locale === "tr" ? project.roleTR : project.roleEN;
  const services = locale === "tr" ? (project.servicesTR || project.services) : (project.servicesEN || project.services);
  const challenge = locale === "tr" ? project.challengeTR : project.challengeEN;
  const solution = locale === "tr" ? project.solutionTR : project.solutionEN;
  const result = locale === "tr" ? project.resultTR : project.resultEN;
  const liveLink = project.externalLinks?.find((l) => l.type === "live" || l.id === "live-site");

  const handleImageError = (idx: number) => {
    setImageErrorMap((prev) => ({ ...prev, [idx]: true }));
  };

  const handleImageLoad = (idx: number) => {
    setImageLoadingMap((prev) => ({ ...prev, [idx]: false }));
  };

  const iconSrc = project.thumbnail || project.desktopIcon;

  return (
    <div className="space-y-4 text-[var(--app-text-primary)] text-xs font-sans select-text">
      {/* Header Document Area */}
      <div className="flex items-start gap-3 border-b border-[var(--app-divider)] pb-3">
        {iconSrc ? (
          <div className="relative w-14 h-14 rounded-md overflow-hidden border border-[var(--app-border)] bg-[#F5F2EB] flex-shrink-0 shadow-xs">
            <Image
              src={iconSrc}
              alt={title}
              fill
              className="object-cover"
              sizes="70px"
            />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-md bg-[var(--app-surface-subtle)] text-[var(--app-text-primary)] font-bold flex items-center justify-center text-sm flex-shrink-0 border border-[var(--app-border)] shadow-xs">
            {project.initials || "PROJ"}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[var(--app-text-primary)] tracking-tight leading-snug">
                {title}
              </h1>
              <p className="text-xs font-mono text-[var(--app-text-secondary)] mt-0.5">
                {project.client} • {projectType}
              </p>
              {project.year && (
                <span className="inline-block mt-1 text-[11px] font-mono text-[var(--app-text-muted)]">
                  {project.year}
                </span>
              )}
            </div>

            {/* Prominent Live Site Action Button */}
            {liveLink && (
              <a
                href={liveLink.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1967E8] hover:bg-[#1557C0] text-white font-medium text-xs shadow-xs transition-colors cursor-pointer flex-shrink-0"
              >
                <span>↗</span>
                <span>{locale === "tr" ? (liveLink.labelTR || "Siteyi Canlı Gör") : (liveLink.labelEN || "View Live Site")}</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Single Introduction / Summary Card */}
      {intro && (
        <div className="text-xs font-medium leading-relaxed text-[var(--app-text-primary)] font-sans bg-[var(--app-surface-subtle)] p-2.5 rounded-md border border-[var(--app-border)]">
          {intro}
        </div>
      )}

      {/* Details Meta Divider */}
      <div className="border-t border-[var(--app-divider)] pt-3 space-y-2 text-xs">
        <h2 lang={locale} className="font-bold text-[var(--app-text-muted)] text-xs uppercase tracking-wider font-mono">
          {toLocaleUpper(getTranslation(locale, "project_details"), locale)}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans">
          <div>
            <span className="text-[var(--app-text-muted)] font-mono">{getTranslation(locale, "project_type")}</span>{" "}
            <span className="font-medium text-[var(--app-text-primary)]">{projectType}</span>
          </div>
          <div>
            <span className="text-[var(--app-text-muted)] font-mono">{getTranslation(locale, "project_client")}</span>{" "}
            <span className="font-medium text-[var(--app-text-primary)]">{project.client}</span>
          </div>

          {/* Role (if present) */}
          {role && (
            <div className="col-span-full">
              <span className="text-[var(--app-text-muted)] font-mono">{locale === "tr" ? "Sorumluluk / Rol:" : "Role / Scope:"}</span>{" "}
              <span className="font-medium text-[var(--app-text-primary)]">{role}</span>
            </div>
          )}

          {/* Services Chips */}
          {services && services.length > 0 && (
            <div className="col-span-full pt-1">
              <span className="text-[var(--app-text-muted)] font-mono">{getTranslation(locale, "project_services")}</span>{" "}
              <div className="flex flex-wrap gap-1 mt-1 font-mono text-[11px]">
                {services.map((s, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-[var(--app-chip-bg)] text-[var(--app-chip-text)] border border-[var(--app-border)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tools Chips (if present) */}
          {project.tools && project.tools.length > 0 && (
            <div className="col-span-full pt-1">
              <span className="text-[var(--app-text-muted)] font-mono">{locale === "tr" ? "Kullanılan Araçlar:" : "Tools Used:"}</span>{" "}
              <div className="flex flex-wrap gap-1 mt-1 font-mono text-[11px]">
                {project.tools.map((t, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-[var(--app-chip-bg)] text-[var(--app-chip-text)] border border-[var(--app-border)] opacity-90"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* External Links Section (Only rendered when externalLinks exist) */}
      {project.externalLinks && project.externalLinks.length > 0 && (
        <div className="border-t border-[var(--app-divider)] pt-3 space-y-2 text-xs">
          <h2 lang={locale} className="font-bold text-[var(--app-text-muted)] text-xs uppercase tracking-wider font-mono">
            {toLocaleUpper(locale === "tr" ? "Harici Bağlantılar" : "External Links", locale)}
          </h2>
          <div className="flex flex-wrap gap-2">
            {project.externalLinks.map((link) => {
              const label = locale === "tr" ? link.labelTR : link.labelEN;
              return (
                <a
                  key={link.id}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1967E8]/10 hover:bg-[#1967E8]/20 text-[#1967E8] font-medium text-xs border border-[#1967E8]/30 transition-colors cursor-pointer"
                >
                  <span>↗</span>
                  <span>{label}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Structured Challenge / Solution / Result Section (if present) */}
      {(challenge || solution || result) && (
        <div className="border-t border-[var(--app-divider)] pt-3 space-y-3">
          <h2 lang={locale} className="font-bold text-[var(--app-text-muted)] text-xs uppercase tracking-wider font-mono">
            {toLocaleUpper(locale === "tr" ? "Proje Süreci & Kazanımlar" : "Project Process & Impact", locale)}
          </h2>
          <div className="space-y-2.5 font-sans text-xs">
            {challenge && (
              <div className="p-3 rounded-md bg-[var(--app-surface-subtle)] border border-[var(--app-border)] space-y-1.5">
                <span lang={locale} className="font-mono text-[11px] font-bold text-[#B33E2B] uppercase tracking-wider block">
                  {toLocaleUpper(locale === "tr" ? "Zorluk / İhtiyaç" : "Challenge / Problem", locale)}
                </span>
                <p className="leading-relaxed text-[var(--app-text-primary)]">{challenge}</p>
              </div>
            )}
            {solution && (
              <div className="p-3 rounded-md bg-[var(--app-surface-subtle)] border border-[var(--app-border)] space-y-1.5">
                <span lang={locale} className="font-mono text-[11px] font-bold text-[#1967E8] uppercase tracking-wider block">
                  {toLocaleUpper(locale === "tr" ? "Çözüm & Kurgulanan Sistem" : "Solution & Implementation", locale)}
                </span>
                <p className="leading-relaxed text-[var(--app-text-primary)]">{solution}</p>
              </div>
            )}
            {result && (
              <div className="p-3 rounded-md bg-[var(--app-surface-subtle)] border border-[var(--app-border)] space-y-1.5">
                <span lang={locale} className="font-mono text-[11px] font-bold text-[#2E7D32] uppercase tracking-wider block">
                  {toLocaleUpper(locale === "tr" ? "Sonuç & Kazanım" : "Outcome & Impact", locale)}
                </span>
                <p className="leading-relaxed text-[var(--app-text-primary)]">{result}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Media Stack Preview */}
      {project.media && project.media.length > 0 && (
        <div className="border-t border-[var(--app-divider)] pt-3 space-y-3">
          <h2 lang={locale} className="font-bold text-[var(--app-text-muted)] text-xs uppercase tracking-wider font-mono">
            {toLocaleUpper(getTranslation(locale, "project_preview"), locale)}
          </h2>
          <div className="space-y-4">
            {project.media.map((item, idx) => {
              const hasError = imageErrorMap[idx];
              const isLoading = imageLoadingMap[idx] !== false && !hasError;
              const caption = locale === "tr" ? item.captionTR : item.captionEN;
              const alt = locale === "tr" ? (item.altTR || title) : (item.altEN || title);

              let layoutWidthClass = "w-full";
              if (item.layout === "contained") layoutWidthClass = "max-w-[85%] mx-auto";
              if (item.layout === "portrait") layoutWidthClass = "max-w-[65%] mx-auto";

              return (
                <div key={idx} className={`space-y-1.5 ${layoutWidthClass}`}>
                  <div className="relative rounded-lg overflow-hidden border border-[var(--app-border)] bg-[var(--app-media-bg)] shadow-xs transition-colors duration-200">
                    {item.type === "video" ? (
                      <VideoPlayer src={item.src} poster={item.poster} />
                    ) : hasError ? (
                      /* Controlled Theme-Aware Image Error Fallback */
                      <div className="w-full min-h-[160px] p-6 flex flex-col items-center justify-center text-center bg-[var(--app-media-bg)] text-[var(--app-text-muted)] font-mono text-xs space-y-1 select-none">
                        <span className="text-xl opacity-60">📷</span>
                        <span>{locale === "tr" ? "Medya yüklenemedi" : "Media unavailable"}</span>
                        {item.src && (
                          <span className="text-[10px] opacity-40 truncate max-w-[240px]">
                            {item.src.split("/").pop()}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="relative w-full min-h-[200px] md:min-h-[280px] flex items-center justify-center bg-[var(--app-media-bg)]">
                        {/* Loading Skeleton */}
                        {isLoading && (
                          <div className="absolute inset-0 bg-[var(--app-surface-subtle)] animate-pulse flex items-center justify-center text-[var(--app-text-muted)] font-mono text-[11px]">
                            {locale === "tr" ? "Yükleniyor..." : "Loading..."}
                          </div>
                        )}
                        <Image
                          src={item.src}
                          alt={alt}
                          width={item.width || 1200}
                          height={item.height || 800}
                          loading={item.priority ? "eager" : "lazy"}
                          className="w-full h-auto object-contain rounded-sm"
                          onError={() => handleImageError(idx)}
                          onLoad={() => handleImageLoad(idx)}
                        />
                      </div>
                    )}
                  </div>
                  {/* Subtle Caption (if present) */}
                  {caption && (
                    <p className="text-[11px] font-mono text-[var(--app-text-muted)] text-center px-2">
                      {caption}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
