"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore } from "@/store/windowStore";
import { workspacesData } from "@/data/workspaces";
import { projectsData, Project } from "@/data/projects";
import { getFeaturedProjectsForMobile } from "@/lib/projectSelectors";
import { getResolvedMobilePlacements } from "@/lib/mobilePlacement";
import { toLocaleUpper } from "@/lib/casing";

export const MobileWorkspace: React.FC = () => {
  const { activeWorkspace, theme, locale, setSelectedIconId } = useDesktopStore();
  const { openWindow, windows, closeWindow } = useWindowStore();

  const [idleReady, setIdleReady] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const activeIndex = workspacesData.findIndex((w) => w.id === activeWorkspace);
  const isLightTarget = theme === "light";

  // Non-blocking idle preloading for secondary wallpapers after initial shell render
  useEffect(() => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const handle = (window as unknown as { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(() => {
        setIdleReady(true);
      });
      return () => {
        if ("cancelIdleCallback" in window) {
          (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(handle);
        }
      };
    } else {
      const timer = setTimeout(() => setIdleReady(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Compute mobile resolved spatial placements
  const mobilePlacements = useMemo(() => {
    const map: Record<string, ReturnType<typeof getResolvedMobilePlacements>> = {};
    const vWidth = typeof window !== "undefined" ? window.innerWidth : 390;
    workspacesData.forEach((ws) => {
      const workspaceProjects = getFeaturedProjectsForMobile(projectsData, ws.id, vWidth);
      map[ws.id] = getResolvedMobilePlacements(workspaceProjects, ws.id);
    });
    return map;
  }, []);

  const handleOpenProject = (p: Project) => {
    const windowId = `project-${p.slug}`;
    const isOpen = windows[activeWorkspace]?.some((w) => w.id === windowId);

    if (isOpen) {
      closeWindow(windowId, activeWorkspace);
    } else {
      openWindow({
        id: windowId,
        type: "project",
        contentId: p.slug,
        titleTR: p.titleTR,
        titleEN: p.titleEN,
        extraData: { project: p },
        width: 360,
        height: 520
      });
    }
  };

  return (
    <div
      className={`relative w-full h-[100dvh] overflow-hidden select-none transition-colors duration-500 ${
        isLightTarget ? "bg-[#DEDAD5]" : "bg-neutral-950"
      }`}
      onClick={() => setSelectedIconId(null)}
    >
      {/* Sliding Workspaces Container */}
      <div
        className="flex w-[300vw] h-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: `translateX(-${activeIndex * 100}vw)`
        }}
      >
        {workspacesData.map((ws, wsIdx) => {
          const vWidth = typeof window !== "undefined" ? window.innerWidth : 390;
          const workspaceProjects = getFeaturedProjectsForMobile(projectsData, ws.id, vWidth);
          const placements = mobilePlacements[ws.id] || {};

          const lightSrc = ws.wallpaperLight || ws.wallpaper;
          const darkSrc = ws.wallpaperDark || ws.wallpaper;

          // Priority loading: render wallpaper URL immediately if active workspace or idleReady is true
          const shouldLoadWallpaper = wsIdx === activeIndex || idleReady;

          return (
            <div
              key={ws.id}
              className="relative w-[100vw] h-[100dvh] flex-shrink-0 overflow-hidden pointer-events-auto"
            >
              {/* Dark Wallpaper Layer */}
              <div
                className="absolute inset-0 bg-cover bg-no-repeat transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  backgroundImage: shouldLoadWallpaper ? `url("${darkSrc}")` : undefined,
                  backgroundPosition: ws.wallpaperPosition || "50% 50%",
                  opacity: isLightTarget ? 0 : 1
                }}
              />

              {/* Light Wallpaper Layer */}
              <div
                className="absolute inset-0 bg-cover bg-no-repeat transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  backgroundImage: shouldLoadWallpaper ? `url("${lightSrc}")` : undefined,
                  backgroundPosition: ws.wallpaperPosition || "50% 50%",
                  opacity: isLightTarget ? 1 : 0
                }}
              />

              {/* Subtle Readability Vignette Overlay */}
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-500 opacity-100"
                style={{
                  background: isLightTarget
                    ? "radial-gradient(circle at center, rgba(255, 250, 244, 0.05) 40%, rgba(44, 32, 22, 0.08) 100%)"
                    : "radial-gradient(circle at center, rgba(8, 8, 10, 0.05) 40%, rgba(0, 0, 0, 0.15) 100%)"
                }}
              />

              {/* Curated Mobile Spatial Project Items Layer */}
              <div className="absolute inset-0 w-full h-full pointer-events-none z-10">
                {workspaceProjects.map((project) => {
                  const pos = placements[project.id] || { x: 30, y: 30 };
                  const rawTitle = locale === "tr" ? (project.desktopLabelTR || project.titleTR) : (project.desktopLabelEN || project.titleEN);
                  const title = toLocaleUpper(rawTitle, locale);
                  const iconSrc = project.thumbnail || project.desktopIcon;
                  const hasFailed = failedImages[project.id];

                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProject(project);
                      }}
                      style={{
                        position: "absolute",
                        left: `${pos.x}%`,
                        top: `${pos.y}%`,
                        transform: "translate(-50%, -50%)"
                      }}
                      className="group flex flex-col items-center justify-start min-w-[44px] min-h-[44px] max-w-[95px] p-1 select-none pointer-events-auto cursor-pointer focus:outline-none active:scale-[0.96] transition-transform duration-150"
                    >
                      {/* Icon Thumbnail Frame (Compact 38px visual footprint) */}
                      <div className="relative w-[38px] h-[38px] rounded-lg overflow-hidden border border-black/20 bg-neutral-900 shadow-md flex items-center justify-center flex-shrink-0">
                        {iconSrc && !hasFailed ? (
                          <Image
                            src={iconSrc}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="38px"
                            onError={() => setFailedImages((prev) => ({ ...prev, [project.id]: true }))}
                          />
                        ) : (
                          <span className="font-bold text-[10px] text-white font-mono">
                            {project.initials || "PROJ"}
                          </span>
                        )}
                      </div>

                      {/* Label (Max 2 lines, tight 3-5px gap) */}
                      <span
                        lang={locale}
                        className="mt-1 text-[10px] font-sans font-bold uppercase tracking-wider text-white text-center line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] max-w-[85px] leading-tight"
                      >
                        {title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
