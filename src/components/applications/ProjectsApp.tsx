"use client";

import React, { useState } from "react";
import Image from "next/image";
import { projectCategories, Project, ProjectCategoryId } from "@/data/projects";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore } from "@/store/windowStore";
import { useSessionStore } from "@/store/sessionStore";
import { getTranslation } from "@/lib/i18n";
import { localeIncludes, toLocaleLower } from "@/lib/casing";

type ViewMode = "grid" | "list";

export const ProjectsApp: React.FC = () => {
  const { locale, activeWorkspace } = useDesktopStore();
  const { openWindow, bringToFront, windows } = useWindowStore();
  const { sessionProjects } = useSessionStore();

  const [filter, setFilter] = useState<ProjectCategoryId>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const filteredProjects = sessionProjects.filter((p) => {
    const matchesCategory = filter === "all" || (p.categoryIds && p.categoryIds.includes(filter));
    const title = locale === "tr" ? p.titleTR : p.titleEN;
    const client = p.client || "";
    const year = p.year || "";
    const categoryText = locale === "tr" ? p.categoryTR : p.categoryEN;
    const query = toLocaleLower(search.trim(), locale);

    const matchesSearch =
      query === "" ||
      localeIncludes(title, query, locale) ||
      localeIncludes(client, query, locale) ||
      localeIncludes(year, query, locale) ||
      localeIncludes(categoryText, query, locale);

    return matchesCategory && matchesSearch;
  });

  const handleOpenProject = (p: Project) => {
    const windowId = `project-${p.slug}`;
    const activeWindows = windows[activeWorkspace] || [];
    const isAlreadyOpen = activeWindows.some((w) => w.id === windowId);

    if (isAlreadyOpen) {
      bringToFront(windowId, activeWorkspace);
    } else {
      openWindow({
        id: windowId,
        workspaceId: activeWorkspace,
        contentId: p.slug,
        type: "project",
        titleTR: `${p.titleTR} — Proje Bilgisi`,
        titleEN: `Information about: ${p.titleEN}`,
        preferredWidth: p.initialWindow.width,
        preferredHeight: p.initialWindow.height,
        extraData: { project: p }
      });
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[440px] rounded-lg bg-[var(--app-surface-raised)] border border-[var(--app-border)] overflow-hidden shadow-xs transition-colors duration-200">
      {/* Top Finder Toolbar */}
      <div className="px-3 py-2 bg-[var(--app-surface-subtle)] border-b border-[var(--app-divider)] flex items-center justify-between gap-3 select-none flex-wrap transition-colors duration-200">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-[var(--app-input-bg)] p-1 rounded-md border border-[var(--app-input-border)] text-xs">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
              viewMode === "grid"
                ? "bg-[var(--app-surface)] font-bold shadow-xs text-[var(--app-text-primary)]"
                : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
            }`}
          >
            {getTranslation(locale, "projects_view_grid")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
              viewMode === "list"
                ? "bg-[var(--app-surface)] font-bold shadow-xs text-[var(--app-text-primary)]"
                : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
            }`}
          >
            {getTranslation(locale, "projects_view_list")}
          </button>
        </div>

        {/* Search Input */}
        <div className="flex-1 max-w-xs min-w-[160px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={getTranslation(locale, "projects_search_placeholder")}
            className="w-full px-2.5 py-1 text-base md:text-xs rounded-md border border-[var(--app-input-border)] bg-[var(--app-input-bg)] text-[var(--app-text-primary)] placeholder-[var(--app-text-muted)] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors duration-200"
          />
        </div>
      </div>

      {/* Main Content Area with Category Sidebar */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Finder Category Sidebar / Mobile Horizontal Category Bar */}
        <div className="w-full md:w-52 bg-[var(--app-surface-subtle)] border-b md:border-b-0 md:border-r border-[var(--app-divider)] p-2 px-3 flex flex-row md:flex-col gap-1.5 select-none flex-shrink-0 overflow-x-auto overflow-y-hidden md:overflow-x-hidden md:overflow-y-auto no-scrollbar touch-pan-x transition-colors duration-200">
          {projectCategories.map((cat) => {
            const count = sessionProjects.filter(
              (p) => cat.id === "all" || (p.categoryIds && p.categoryIds.includes(cat.id))
            ).length;

            const isSelected = filter === cat.id;
            const label = getTranslation(locale, cat.titleKey);

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilter(cat.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs text-left transition-colors cursor-pointer whitespace-nowrap flex flex-shrink-0 items-center justify-between gap-2 ${
                  isSelected
                    ? "bg-[#1967E8] text-white font-medium shadow-xs"
                    : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
                }`}
              >
                <span className="truncate">{label}</span>
                <span className={`text-[10px] font-mono ${isSelected ? "opacity-90" : "opacity-60"}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Projects View Canvas */}
        <div className="flex-1 p-4 overflow-y-auto app-scrollbar bg-[var(--app-surface)] transition-colors duration-200">
          {filteredProjects.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-[var(--app-text-muted)]">
              {getTranslation(locale, "projects_empty")}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 select-none">
              {filteredProjects.map((project) => {
                const title = locale === "tr" ? project.titleTR : project.titleEN;
                const ariaLabel = locale === "tr" ? `${title} projesini aç` : `Open ${title} project`;

                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleOpenProject(project)}
                    aria-label={ariaLabel}
                    className="flex flex-col items-center p-2 rounded-lg hover:bg-blue-500/15 cursor-pointer group transition-all active:scale-[0.985] focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 text-left w-full"
                  >
                    {/* Thumbnail Frame */}
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-black/15 bg-[#F5F2EB] shadow-xs group-hover:scale-105 transition-transform flex items-center justify-center">
                      {project.desktopIcon ? (
                        <Image
                          src={project.desktopIcon}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="60px"
                        />
                      ) : (
                        <span className="font-bold text-xs text-neutral-800 font-mono">
                          {project.initials || "FILE"}
                        </span>
                      )}
                    </div>
                    <span className="mt-2 text-xs font-medium text-center text-[var(--app-text-primary)] line-clamp-2">
                      {title}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--app-text-muted)] truncate max-w-full">
                      {project.client}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="space-y-1 text-xs select-none">
              <div className="grid grid-cols-12 px-3 py-1.5 font-mono text-[11px] font-semibold text-[var(--app-text-muted)] border-b border-[var(--app-divider)]">
                <span className="col-span-6">Proje Adı / Name</span>
                <span className="col-span-4">Müşteri / Client</span>
                <span className="col-span-2 text-right">Yıl / Year</span>
              </div>
              {filteredProjects.map((project) => {
                const title = locale === "tr" ? project.titleTR : project.titleEN;
                const ariaLabel = locale === "tr" ? `${title} projesini aç` : `Open ${title} project`;

                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleOpenProject(project)}
                    aria-label={ariaLabel}
                    className="grid grid-cols-12 w-full px-3 py-2 rounded text-[var(--app-text-primary)] hover:bg-[#1967E8] hover:text-white cursor-pointer transition-colors items-center active:scale-[0.99] focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 text-left"
                  >
                    <span className="col-span-6 font-medium truncate">{title}</span>
                    <span className="col-span-4 opacity-80 truncate">{project.client}</span>
                    <span className="col-span-2 text-right font-mono opacity-80">
                      {project.year || "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
