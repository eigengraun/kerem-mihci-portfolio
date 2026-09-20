"use client";

import React, { useEffect, useState, useRef } from "react";
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

  // Priority 3: Non-blocking idle prefetch for inactive workspace wallpapers
  const preloadedUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check for constrained network (save-data or 2G)
    const nav = navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } };
    const conn = nav.connection;
    if (conn && (conn.saveData || conn.effectiveType === "slow-2g" || conn.effectiveType === "2g")) {
      return;
    }

    // Mark current workspace wallpapers as already loaded/rendered by the active scene
    const currentWs = workspacesData.find((w) => w.id === activeWorkspace);
    if (currentWs) {
      if (currentWs.wallpaperLight) preloadedUrlsRef.current.add(currentWs.wallpaperLight);
      if (currentWs.wallpaperDark) preloadedUrlsRef.current.add(currentWs.wallpaperDark);
    }

    const preloadInactiveWorkspaces = () => {
      workspacesData.forEach((ws) => {
        if (ws.id === activeWorkspace) return;

        if (ws.wallpaperDark && !preloadedUrlsRef.current.has(ws.wallpaperDark)) {
          preloadedUrlsRef.current.add(ws.wallpaperDark);
          const imgDark = new Image();
          imgDark.src = ws.wallpaperDark;
        }
        if (ws.wallpaperLight && !preloadedUrlsRef.current.has(ws.wallpaperLight)) {
          preloadedUrlsRef.current.add(ws.wallpaperLight);
          const imgLight = new Image();
          imgLight.src = ws.wallpaperLight;
        }
      });
    };

    // Schedule prefetch during browser idle AFTER critical initial load has settled (4500ms)
    let idleHandle: number | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    fallbackTimer = setTimeout(() => {
      if ("requestIdleCallback" in window) {
        const winWithIdle = window as unknown as {
          requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
          cancelIdleCallback: (id: number) => void;
        };
        idleHandle = winWithIdle.requestIdleCallback(preloadInactiveWorkspaces, { timeout: 8000 });
      } else {
        preloadInactiveWorkspaces();
      }
    }, 4500);

    return () => {
      if (fallbackTimer !== null) {
        clearTimeout(fallbackTimer);
      }
      if (idleHandle !== null && "cancelIdleCallback" in window) {
        const winWithCancel = window as unknown as { cancelIdleCallback: (id: number) => void };
        winWithCancel.cancelIdleCallback(idleHandle);
      }
    };
  }, [activeWorkspace]);

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
