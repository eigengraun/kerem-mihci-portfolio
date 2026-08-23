"use client";

import React, { useState } from "react";
import { useDesktopStore, WorkspaceId } from "@/store/desktopStore";
import { useWorkspaceNavigation } from "@/context/WorkspaceNavigationContext";
import { workspacesData } from "@/data/workspaces";
import { toLocaleUpper } from "@/lib/casing";

export const WorkspaceSwitcher: React.FC = () => {
  const { activeWorkspace, locale, theme } = useDesktopStore();
  const { navigateToWorkspace, isTransitioning } = useWorkspaceNavigation();
  const [hoveredWorkspace, setHoveredWorkspace] = useState<WorkspaceId | null>(null);

  const isLight = theme === "light";

  return (
    <aside
      data-prevent-workspace-wheel="true"
      data-workspace-scroll-lock="true"
      className="fixed left-4 md:left-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2.5 select-none pointer-events-auto"
    >
      {workspacesData.map((ws) => {
        const isActive = activeWorkspace === ws.id;
        const isHovered = hoveredWorkspace === ws.id;
        const isAnyHovered = hoveredWorkspace !== null;

        const title = locale === "tr" ? ws.titleTR : ws.titleEN;

        // Compute opacity & text shadow class
        let opacityClass = isLight ? "opacity-[0.50] font-normal" : "opacity-[0.48] font-normal";
        if (isActive) {
          opacityClass = isLight
            ? "opacity-100 font-semibold drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
            : "opacity-100 font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]";
        } else if (isHovered) {
          opacityClass = "opacity-100 font-medium";
        } else if (isAnyHovered) {
          opacityClass = "opacity-[0.25] font-normal";
        }

        // Compute indicator line width
        let lineWidth = "w-[12px]";
        if (isHovered) {
          lineWidth = "w-[24px]";
        } else if (isActive) {
          lineWidth = "w-[20px]";
        }

        return (
          <div
            key={ws.id}
            onMouseEnter={() => setHoveredWorkspace(ws.id)}
            onMouseLeave={() => setHoveredWorkspace(null)}
          >
            <button
              type="button"
              disabled={isTransitioning}
              onClick={() => navigateToWorkspace(ws.id)}
              aria-label={`${title} (${ws.code})`}
              className={`flex items-center gap-1.5 h-8 px-1 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus:outline-none cursor-pointer disabled:cursor-default ${
                isLight ? "text-neutral-900" : "text-white"
              } ${opacityClass} ${
                isHovered && !isActive ? "translate-x-1.5" : "translate-x-0"
              }`}
            >
              {/* Micro Status Dot Indicator */}
              <span
                className={`w-1 h-1 rounded-full bg-current transition-opacity duration-150 mr-0.5 ${
                  isActive || isHovered ? "opacity-100" : "opacity-0"
                }`}
              />

              {/* Workspace Number Code */}
              <span className="w-[20px] text-[11px] md:text-xs font-mono tracking-wider text-left">
                {ws.code}
              </span>

              {/* Dynamic Indicator Line */}
              <span
                className={`h-[1px] bg-current transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${lineWidth}`}
              />

              {/* Workspace Title Label */}
              <span lang={locale} className="text-xs font-sans tracking-wider uppercase">
                {toLocaleUpper(title, locale)}
              </span>
            </button>
          </div>
        );
      })}
    </aside>
  );
};
