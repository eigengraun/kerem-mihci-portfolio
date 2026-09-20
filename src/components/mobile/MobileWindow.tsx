"use client";

import React, { useState, useRef, useEffect } from "react";
import { WindowInstance, useWindowStore } from "@/store/windowStore";
import { useDesktopStore } from "@/store/desktopStore";
import {
  DynamicProjectApp,
  DynamicProjectsApp,
  DynamicGalleryApp,
  DynamicNotesApp,
  DynamicContactApp,
  DynamicToolInfoApp,
  DynamicTrashApp,
  DynamicAboutApp,
  DynamicVideoApp
} from "../window-system/dynamicApps";
import { projectsData } from "@/data/projects";
import { toolInfoData } from "@/data/toolInfo";

interface MobileWindowProps {
  win: WindowInstance;
}

export type MobileSizeMode = "compact" | "content" | "large";

export function getMobileWindowSizeMode(winType: WindowInstance["type"]): MobileSizeMode {
  switch (winType) {
    case "tool-info":
    case "alert":
      return "compact";
    case "trash":
      return "content";
    case "notes":
    case "projects":
    case "gallery":
    case "project":
    case "about":
    case "cv":
    case "contact":
    case "video":
    default:
      return "large";
  }
}

// Work Area & Boundary Constants
const GAP_ABOVE_DOCK = 12; // Mandatory gap above Mobile Dock
const VIEWPORT_MARGIN = 12; // Left/Right screen margin
const MIN_TOP_MARGIN = 8; // Top margin below notch / safe area

function calculateMobileWorkArea() {
  if (typeof window === "undefined") {
    return { top: 56, bottom: 680, height: 624, dockTop: 692 };
  }

  const vHeight = window.visualViewport?.height || window.innerHeight;
  const safeAreaTop = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue("--safe-area-top") || "0",
    10
  ) || 0;
  const safeAreaBottom = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue("--safe-area-bottom") || "0",
    10
  ) || 0;

  // Available Top: below safe area & top controls bar
  const availableTop = Math.max(52, safeAreaTop + 48);

  // Read real measured Mobile Dock top offset or calculate fallback
  const measuredDockTopStr = getComputedStyle(document.documentElement).getPropertyValue("--mobile-dock-top");
  const measuredDockTop = measuredDockTopStr ? parseFloat(measuredDockTopStr) : 0;

  const dockTop = measuredDockTop > 0
    ? measuredDockTop
    : vHeight - safeAreaBottom - 8 - 104;

  const availableBottom = Math.max(availableTop + 150, dockTop - GAP_ABOVE_DOCK);
  const availableHeight = Math.max(150, availableBottom - availableTop);

  return {
    top: availableTop,
    bottom: availableBottom,
    height: availableHeight,
    dockTop
  };
}

function computeDefaultPos() {
  if (typeof window === "undefined") return { x: VIEWPORT_MARGIN, y: 56 };

  const vWidth = window.innerWidth;
  const workArea = calculateMobileWorkArea();
  const winWidth = Math.min(vWidth - VIEWPORT_MARGIN * 2, 480);
  const defaultX = Math.max(VIEWPORT_MARGIN, (vWidth - winWidth) / 2);
  const defaultY = workArea.top;

  return { x: defaultX, y: defaultY };
}

export const MobileWindow: React.FC<MobileWindowProps> = ({ win }) => {
  const { activeWorkspace, locale } = useDesktopStore();
  const { closeWindow, bringToFront } = useWindowStore();

  const title = locale === "tr" ? win.titleTR : win.titleEN;
  const mode = getMobileWindowSizeMode(win.type);

  const windowRef = useRef<HTMLDivElement>(null);

  // Dragging state initialized lazily
  const [pos, setPos] = useState<{ x: number; y: number }>(() => computeDefaultPos());
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  // Re-clamp position on orientation / viewport resize
  useEffect(() => {
    const handleResize = () => {
      const vWidth = window.innerWidth;
      const workArea = calculateMobileWorkArea();
      const winWidth = windowRef.current?.getBoundingClientRect().width || Math.min(vWidth - 24, 480);
      const winHeight = windowRef.current?.getBoundingClientRect().height || 300;

      setPos((prev) => {
        const minX = VIEWPORT_MARGIN;
        const maxX = Math.max(minX, vWidth - winWidth - VIEWPORT_MARGIN);
        const minY = Math.max(MIN_TOP_MARGIN, workArea.top);
        const maxY = Math.max(minY, workArea.bottom - winHeight);

        return {
          x: Math.max(minX, Math.min(maxX, prev.x)),
          y: Math.max(minY, Math.min(maxY, prev.y))
        };
      });
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  const handleClose = () => {
    closeWindow(win.id, activeWorkspace);
  };

  // Titlebar Pointer Drag Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button !== 0) return;

    bringToFront(win.id, activeWorkspace);

    const targetEl = e.currentTarget;
    try {
      targetEl.setPointerCapture(e.pointerId);
    } catch {
      // fallback
    }

    const currentX = pos ? pos.x : (windowRef.current?.getBoundingClientRect().left || VIEWPORT_MARGIN);
    const currentY = pos ? pos.y : (windowRef.current?.getBoundingClientRect().top || 56);

    dragStartRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentX,
      initialY: currentY
    };

    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    if (e.pointerId !== dragStartRef.current.pointerId) return;

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    let newX = dragStartRef.current.initialX + deltaX;
    let newY = dragStartRef.current.initialY + deltaY;

    // Strict clamping within Mobile Work Area & Screen Bounds
    const vWidth = window.innerWidth;
    const workArea = calculateMobileWorkArea();
    const measuredW = windowRef.current?.getBoundingClientRect().width || (vWidth - VIEWPORT_MARGIN * 2);
    const measuredH = windowRef.current?.getBoundingClientRect().height || 300;

    const minX = VIEWPORT_MARGIN;
    const maxX = Math.max(minX, vWidth - measuredW - VIEWPORT_MARGIN);
    newX = Math.max(minX, Math.min(maxX, newX));

    const minY = Math.max(MIN_TOP_MARGIN, workArea.top);
    const maxY = Math.max(minY, workArea.bottom - measuredH);
    newY = Math.max(minY, Math.min(maxY, newY));

    setPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current && e.pointerId === dragStartRef.current.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      dragStartRef.current = null;
      setIsDragging(false);
    }
  };

  const renderContent = () => {
    switch (win.type) {
      case "project": {
        const found =
          projectsData.find((p) => p.slug === win.contentId) ||
          (win.extraData?.project as typeof projectsData[0]);
        if (!found) return <div className="p-4 text-xs font-mono text-neutral-400">Project Not Found</div>;
        return <DynamicProjectApp project={found} />;
      }
      case "projects":
        return <DynamicProjectsApp />;
      case "gallery":
        return <DynamicGalleryApp />;
      case "video":
        return <DynamicVideoApp />;
      case "notes":
        return <DynamicNotesApp />;
      case "contact":
        return <DynamicContactApp />;
      case "tool-info": {
        const toolObj = toolInfoData[win.contentId || "photoshop"] || toolInfoData.photoshop;
        return <DynamicToolInfoApp tool={toolObj} windowId={win.id} />;
      }
      case "trash":
        return <DynamicTrashApp />;
      case "about":
        return <DynamicAboutApp />;
      default:
        return <div className="p-4 text-xs font-mono text-neutral-400">Content loading...</div>;
    }
  };

  // Outer container dimensions / max-height according to size mode and work area
  const workArea = calculateMobileWorkArea();
  const maxAvailableH = workArea.height;

  const getMaxHeightStyle = () => {
    switch (mode) {
      case "compact":
        return `${Math.min(maxAvailableH, 500)}px`;
      case "content":
        return `${Math.min(maxAvailableH, 560)}px`;
      case "large":
      default:
        return `${maxAvailableH}px`;
    }
  };

  const currentX = pos ? pos.x : VIEWPORT_MARGIN;
  const currentY = pos ? pos.y : workArea.top;

  return (
    <div
      ref={windowRef}
      onPointerDown={() => bringToFront(win.id, activeWorkspace)}
      className="fixed left-0 top-0 z-30 flex flex-col rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-raised)] shadow-2xl overflow-hidden select-none animate-in fade-in zoom-in-95 duration-200"
      style={{
        width: "calc(100vw - 24px)",
        maxWidth: "480px",
        maxHeight: getMaxHeightStyle(),
        transform: `translate3d(${currentX}px, ${currentY}px, 0)`,
        transition: isDragging ? "none" : "transform 150ms ease-out",
        backgroundColor: "var(--app-surface-raised)"
      }}
    >
      {/* OS Window Titlebar — Draggable Handle */}
      <header
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="px-3 py-2.5 bg-[var(--app-surface-subtle)] border-b border-[var(--app-divider)] flex items-center justify-between gap-2 flex-shrink-0 select-none touch-none cursor-grab active:cursor-grabbing relative"
        style={{ touchAction: "none", userSelect: "none" }}
      >
        {/* Traffic Light Close Group — Excluded from Drag */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="flex items-center gap-1.5 cursor-pointer p-1.5 -ml-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-all z-10"
          aria-label="Close window"
        >
          <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/20 pointer-events-none" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/20 pointer-events-none" />
          <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/20 pointer-events-none" />
        </div>

        {/* Window Title */}
        <div className="font-sans font-bold text-xs text-[var(--app-text-primary)] truncate max-w-[200px] text-center pointer-events-none">
          {title}
        </div>

        <div className="w-8 pointer-events-none" />
      </header>

      {/* Internal Content Area — Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto app-scrollbar p-3 pb-6 text-[var(--app-text-primary)]">
        {renderContent()}
      </div>
    </div>
  );
};
