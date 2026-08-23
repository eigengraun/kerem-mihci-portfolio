"use client";

import React, { useEffect, useState } from "react";
import { useDesktopStore, WorkspaceId } from "@/store/desktopStore";
import { useWorkspaceNavigation } from "@/context/WorkspaceNavigationContext";
import { workspacesData, WorkspaceConfig } from "@/data/workspaces";
import { projectsData } from "@/data/projects";
import { getFeaturedProjectsForDesktop } from "@/lib/projectSelectors";
import { DesktopIcon } from "./DesktopIcon";
import { useSessionStore } from "@/store/sessionStore";

export const DesktopWorkspace: React.FC = () => {
  const { activeWorkspace, setSelectedIconId, theme } = useDesktopStore();
  const {
    isTransitioning,
    transitionDirection,
    outgoingWorkspace,
    incomingWorkspace,
    scrollProgress,
    scrollDirection,
    isActiveScroll
  } = useWorkspaceNavigation();

  // Animation phase for two-layer vertical depth transition ("start" | "active")
  const [animPhase, setAnimPhase] = useState<"start" | "active">("start");

  // Reduced motion user preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  // Preload inactive wallpapers progressively to avoid network bottlenecks
  useEffect(() => {
    const timer = setTimeout(() => {
      workspacesData.forEach((ws) => {
        if (ws.wallpaperLight) {
          const imgLight = new Image();
          imgLight.src = ws.wallpaperLight;
        }
        if (ws.wallpaperDark) {
          const imgDark = new Image();
          imgDark.src = ws.wallpaperDark;
        }
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  const { desktopPlacements } = useSessionStore();
  const workspacePlacements = desktopPlacements;

  // Trigger frame-perfect animation step when transition starts
  useEffect(() => {
    if (!isTransitioning) return;

    let raf2: number;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setAnimPhase("active");
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      setAnimPhase("start");
    };
  }, [isTransitioning]);

  const isLightTarget = theme === "light";

  // Micro-preview tactile resistance while scrolling prior to threshold
  let microTransform = "translateY(0px) scale(1)";
  let microOpacity = 1;

  if (!isTransitioning && isActiveScroll && scrollProgress > 0) {
    const p = Math.min(scrollProgress, 0.8);
    const yShift = scrollDirection === "down" ? -p * 4 : p * 4;
    const scaleShift = 1 - p * 0.002;
    microTransform = `translateY(${yShift}px) scale(${scaleShift})`;
    microOpacity = 1 - p * 0.02;
  }

  // Render a complete workspace scene (wallpaper layers + vignette + featured desktop icons)
  const renderScene = (wsConfig: WorkspaceConfig, sceneStyle: React.CSSProperties) => {
    const workspaceProjects = getFeaturedProjectsForDesktop(projectsData, wsConfig.id);
    const placements = workspacePlacements[wsConfig.id] || {};

    const lightSrc = wsConfig.wallpaperLight || wsConfig.wallpaper;
    const darkSrc = wsConfig.wallpaperDark || wsConfig.wallpaper;

    return (
      <div
        key={wsConfig.id}
        style={sceneStyle}
        className="absolute inset-0 w-full h-full overflow-hidden pointer-events-auto transition-all duration-520 ease-[cubic-bezier(0.22,1,0.36,1)]"
      >
        {/* Dark Wallpaper Layer */}
        <div
          className="absolute inset-0 bg-cover bg-no-repeat transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            backgroundImage: `url("${darkSrc}")`,
            backgroundPosition: wsConfig.wallpaperPosition || "50% 50%",
            opacity: isLightTarget ? 0 : 1,
            filter: isLightTarget
              ? "brightness(1.0) contrast(1.0) saturate(1.0)"
              : "brightness(0.98) contrast(1.0) saturate(1.0)"
          }}
        />

        {/* Light Wallpaper Layer */}
        <div
          className="absolute inset-0 bg-cover bg-no-repeat transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            backgroundImage: `url("${lightSrc}")`,
            backgroundPosition: wsConfig.wallpaperPosition || "50% 50%",
            opacity: isLightTarget ? 1 : 0,
            filter: isLightTarget
              ? "brightness(1.0) contrast(1.0) saturate(1.0)"
              : "brightness(0.98) contrast(1.0) saturate(1.0)"
          }}
        />

        {/* Subtle Tonal & Vignette Readability Overlay */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-500 opacity-100"
          style={{
            background: isLightTarget
              ? "radial-gradient(circle at center, rgba(255, 250, 244, 0.03) 45%, rgba(44, 32, 22, 0.04) 100%)"
              : "radial-gradient(circle at center, rgba(8, 8, 10, 0.04) 45%, rgba(0, 0, 0, 0.08) 100%)"
          }}
        />

        {/* Spatial Desktop Files Layer - Full Absolute Canvas */}
        <div className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {workspaceProjects.map((project) => (
            <DesktopIcon
              key={project.id}
              project={project}
              resolvedPosition={placements[project.id]}
            />
          ))}
        </div>
      </div>
    );
  };

  // Helper to find WorkspaceConfig by ID
  const getWsConfig = (id: WorkspaceId) => workspacesData.find((w) => w.id === id) || workspacesData[0];

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none transition-colors duration-500 ${
        isLightTarget ? "bg-[#DEDAD5]" : "bg-neutral-950"
      }`}
      onClick={() => setSelectedIconId(null)} // Click empty desktop deselects icon
    >
      {isTransitioning && outgoingWorkspace && incomingWorkspace ? (
        /* 2-Layer Refined Vertical Depth Transition */
        <>
          {/* Outgoing Workspace Scene */}
          {(() => {
            const wsConfig = getWsConfig(outgoingWorkspace);

            let style: React.CSSProperties;
            if (prefersReducedMotion) {
              style = {
                opacity: animPhase === "active" ? 0 : 1
              };
            } else {
              const targetY = transitionDirection === "down" ? -32 : 32;
              style = {
                transform: animPhase === "active" ? `translateY(${targetY}px) scale(0.985)` : "translateY(0px) scale(1)",
                opacity: animPhase === "active" ? 0 : 1
              };
            }

            return renderScene(wsConfig, style);
          })()}

          {/* Incoming Workspace Scene */}
          {(() => {
            const wsConfig = getWsConfig(incomingWorkspace);

            let style: React.CSSProperties;
            if (prefersReducedMotion) {
              style = {
                opacity: animPhase === "active" ? 1 : 0
              };
            } else {
              const startY = transitionDirection === "down" ? 32 : -32;
              style = {
                transform: animPhase === "active" ? "translateY(0px) scale(1)" : `translateY(${startY}px) scale(1.01)`,
                opacity: animPhase === "active" ? 1 : 0
              };
            }

            return renderScene(wsConfig, style);
          })()}
        </>
      ) : (
        /* Static Active Workspace Scene with Micro-Preview Resistance */
        (() => {
          const wsConfig = getWsConfig(activeWorkspace);
          const style: React.CSSProperties = prefersReducedMotion
            ? { opacity: 1 }
            : {
                transform: microTransform,
                opacity: microOpacity
              };
          return renderScene(wsConfig, style);
        })()
      )}
    </div>
  );
};
