"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { Project } from "@/data/projects";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore } from "@/store/windowStore";
import { useSessionStore } from "@/store/sessionStore";
import { ResolvedDesktopPosition, resolveSafeDropPosition } from "@/lib/desktopPlacement";
import { toLocaleUpper } from "@/lib/casing";

interface DesktopIconProps {
  project: Project;
  resolvedPosition?: ResolvedDesktopPosition;
}

export const DesktopIcon: React.FC<DesktopIconProps> = ({ project, resolvedPosition }) => {
  const { locale, activeWorkspace, theme } = useDesktopStore();
  const { openWindow, windows, closeWindow } = useWindowStore();
  const { updateDesktopPosition, setIsDraggingProject } = useSessionStore();

  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  const pointerDownRef = useRef<{
    startX: number;
    startY: number;
    initialPosX: number;
    initialPosY: number;
    hasExceededThreshold: boolean;
  } | null>(null);

  const isLight = theme === "light";

  const desktopLabel = useMemo(() => {
    const raw = locale === "tr"
      ? (project.desktopLabelTR || project.titleTR)
      : (project.desktopLabelEN || project.titleEN);
    return toLocaleUpper(raw, locale);
  }, [project, locale]);

  const fullTitle = useMemo(() => {
    return locale === "tr" ? project.titleTR : project.titleEN;
  }, [project, locale]);

  const category = useMemo(() => {
    return locale === "tr" ? project.categoryTR : project.categoryEN;
  }, [project, locale]);

  const ariaLabelText = useMemo(() => {
    return locale === "tr"
      ? `${fullTitle} projesini aç`
      : `Open ${fullTitle} project`;
  }, [fullTitle, locale]);

  const windowId = `project-${project.slug}`;
  const isOpen = useMemo(() => {
    return windows[activeWorkspace]?.some((w) => w.id === windowId) ?? false;
  }, [windows, activeWorkspace, windowId]);

  const handleOpenProject = useCallback(() => {
    if (isOpen) {
      closeWindow(windowId, activeWorkspace);
    } else {
      openWindow({
        id: windowId,
        type: "project",
        contentId: project.slug,
        titleTR: project.titleTR,
        titleEN: project.titleEN,
        extraData: { project },
        width: project.initialWindow?.width || 720,
        height: project.initialWindow?.height || 560
      });
    }
  }, [isOpen, closeWindow, openWindow, windowId, activeWorkspace, project]);

  // Pointer event handlers for desktop dragging
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary mouse button or touch
    if (e.button !== 0) return;

    const basePosX = resolvedPosition?.x ?? 20;
    const basePosY = resolvedPosition?.y ?? 20;

    pointerDownRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: basePosX,
      initialPosY: basePosY,
      hasExceededThreshold: false
    };

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ptr = pointerDownRef.current;
    if (!ptr) return;

    const deltaPxX = e.clientX - ptr.startX;
    const deltaPxY = e.clientY - ptr.startY;
    const dist = Math.hypot(deltaPxX, deltaPxY);

    if (!ptr.hasExceededThreshold) {
      if (dist >= 5) {
        ptr.hasExceededThreshold = true;
        setIsDragging(true);
        setIsDraggingProject(true);
      } else {
        return;
      }
    }

    // Convert pixel delta to viewport percentage
    const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
    const vh = typeof window !== "undefined" ? window.innerHeight : 900;

    const deltaPercentX = (deltaPxX / vw) * 100;
    const deltaPercentY = (deltaPxY / vh) * 100;

    // Clamp live position into safe desktop bounds
    const liveX = Math.max(8.0, Math.min(87.5, ptr.initialPosX + deltaPercentX));
    const liveY = Math.max(12.0, Math.min(67.5, ptr.initialPosY + deltaPercentY));

    setDragOffset({
      x: liveX - ptr.initialPosX,
      y: liveY - ptr.initialPosY
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const ptr = pointerDownRef.current;
    if (!ptr) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture was already released
    }

    if (ptr.hasExceededThreshold) {
      // Drag finished: resolve safe desktop bounds and update store (ignoring other projects for intentional overlap)
      const currentLiveX = ptr.initialPosX + (dragOffset?.x ?? 0);
      const currentLiveY = ptr.initialPosY + (dragOffset?.y ?? 0);

      const safeDropPos = resolveSafeDropPosition(currentLiveX, currentLiveY);
      updateDesktopPosition(activeWorkspace, project.id, safeDropPos);
    } else {
      // Pure click without dragging -> open project
      handleOpenProject();
    }

    pointerDownRef.current = null;
    setIsDragging(false);
    setDragOffset(null);
    setIsDraggingProject(false);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    pointerDownRef.current = null;
    setIsDragging(false);
    setDragOffset(null);
    setIsDraggingProject(false);
  };

  // Keyboard accessibility (Enter / Space)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleOpenProject();
    }
  };

  // 1. Primary Portfolio Media Thumbnail
  const spatialThumbnail = project.desktopThumbnail && !imageError ? project.desktopThumbnail : null;
  const thumbnailSrc =
    !imageError && (spatialThumbnail?.src || project.thumbnail || project.desktopIcon || project.media?.[0]?.src);

  const hasImage = Boolean(thumbnailSrc) && typeof thumbnailSrc === "string" && thumbnailSrc.startsWith("/");

  // Deterministic organic position & weight
  const basePosX = resolvedPosition?.x ?? 20;
  const basePosY = resolvedPosition?.y ?? 20;
  const currentPosX = basePosX + (dragOffset?.x ?? 0);
  const currentPosY = basePosY + (dragOffset?.y ?? 0);
  const weightScale = resolvedPosition?.weightScale ?? 1.0;
  const baseZIndex = resolvedPosition?.zIndexOffset ?? 10;

  const idleTextShadow = isLight
    ? "0 1px 2px rgba(44,32,22,0.65), 0 2px 8px rgba(44,32,22,0.35)"
    : "0 1px 3px rgba(0,0,0,0.85), 0 2px 10px rgba(0,0,0,0.45)";

  return (
    <div
      tabIndex={0}
      role="button"
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={ariaLabelText}
      data-prevent-workspace-wheel="true"
      data-workspace-scroll-lock="true"
      style={{
        position: "absolute",
        left: `${currentPosX}%`,
        top: `${currentPosY}%`,
        transform: `translate(-50%, -50%) scale(${isDragging ? weightScale * 1.03 : weightScale})`,
        zIndex: isDragging ? 60 : isHovered ? 40 : baseZIndex,
        transition: isDragging
          ? "none"
          : "left 220ms cubic-bezier(0.22, 1, 0.36, 1), top 220ms cubic-bezier(0.22, 1, 0.36, 1), transform 180ms ease, z-index 0ms",
        touchAction: "none"
      }}
      className={`group flex flex-col items-center justify-start max-w-[140px] min-w-[76px] p-1 select-none pointer-events-auto focus:outline-none ${
        isDragging ? "cursor-grabbing opacity-95" : "cursor-grab"
      }`}
    >
      {/* Thumbnail Selection Frame (Adapts to actual media aspect ratio & scales on hover/drag) */}
      <div
        className={`relative flex items-center justify-center transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] origin-center ${
          isDragging
            ? "scale-[1.06]"
            : isHovered
            ? "scale-[var(--desktop-thumb-hover-scale,1.06)]"
            : "scale-100"
        }`}
      >
        {hasImage && thumbnailSrc ? (
          /* Real Portfolio Media Thumbnail (Preserves Native Aspect Ratio with zero crop) */
          <div
            className={`relative flex items-center justify-center rounded-[5px] overflow-hidden transition-all duration-200 ${
              isDragging
                ? "ring-2 ring-white/90 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                : isHovered
                ? "ring-2 ring-white/70 shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
                : "ring-1 ring-black/15 dark:ring-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.30)]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailSrc}
              alt=""
              width={spatialThumbnail?.width}
              height={spatialThumbnail?.height}
              draggable={false}
              onError={() => setImageError(true)}
              style={{
                maxWidth: "var(--desktop-thumb-max-w, 130px)",
                maxHeight: "var(--desktop-thumb-max-h, 92px)",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                display: "block"
              }}
              className="select-none pointer-events-none transition-all duration-200"
            />
          </div>
        ) : (
          /* Authentic OS Document Thumbnail Fallback */
          <div className="w-11 h-13 md:w-12 md:h-14 bg-[#F5F2EB] rounded-[5px] border border-neutral-400 shadow-xs flex flex-col justify-between p-1 relative flex-shrink-0">
            <div className="w-full h-1 bg-amber-500 rounded-xs" />
            <div className="space-y-1 my-auto">
              <div className="w-3/4 h-1 bg-neutral-300 rounded-xs" />
              <div className="w-1/2 h-1 bg-neutral-300 rounded-xs" />
            </div>
            <div lang={locale} className="text-[8px] font-mono text-neutral-500 truncate text-center uppercase">
              {toLocaleUpper(category.split(">")[0] || (locale === "tr" ? "PROJE" : "PROJECT"), locale)}
            </div>
          </div>
        )}
      </div>

      {/* Filename Label */}
      <div
        className={`mt-[var(--desktop-thumb-label-gap,6px)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] text-center max-w-[130px] min-w-[70px] origin-top ${
          isDragging || isHovered ? "translate-y-0.5 scale-[1.04]" : "translate-y-0 scale-100"
        }`}
      >
        <span
          lang={locale}
          className={`transition-colors duration-150 text-[11px] md:text-xs font-sans font-semibold uppercase tracking-wider leading-tight max-w-[130px] line-clamp-2 ${
            isDragging || isHovered
              ? "bg-[#0868D9] text-white px-1.5 py-0.5 rounded-[4px] shadow-xs inline-block drop-shadow-none"
              : "text-white px-1 inline-block"
          }`}
          style={!isHovered && !isDragging ? { textShadow: idleTextShadow } : undefined}
        >
          {desktopLabel}
        </span>
      </div>
    </div>
  );
};
