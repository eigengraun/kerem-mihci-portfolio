"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import Image from "next/image";
import { DockItemConfig } from "@/data/dock";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore, WindowType } from "@/store/windowStore";
import { DockTooltip } from "./DockTooltip";
import { toolInfoData } from "@/data/toolInfo";
import { SocialStack } from "./SocialStack";
import { toLocaleUpper } from "@/lib/casing";

interface DockIconProps {
  item: DockItemConfig;
  index: number;
  registerItem: (
    id: string,
    wrapper: HTMLElement | null,
    tile: HTMLElement | null,
    tooltip: HTMLElement | null
  ) => void;
  isLight: boolean;
  socialsOpen?: boolean;
  onToggleSocials?: () => void;
  onCloseSocials?: () => void;
  prefersReducedMotion?: boolean;
}

const iconPaths: Record<string, string> = {
  photoshop: "/assets/apps/photoshop.svg",
  illustrator: "/assets/apps/illustrator.svg",
  figma: "/assets/icons/apps/figma.svg",
  canva: "/assets/icons/apps/canva.svg",
  wordpress: "/assets/icons/apps/wordpress.svg",
  vscode: "/assets/icons/apps/vscode.svg",
  antigravity: "/assets/icons/apps/antigravity.svg",
  premiere: "/assets/apps/premiere.svg",
  aftereffects: "/assets/apps/after-effects.svg",
  capcut: "/assets/icons/apps/capcut.svg",
  higgsfield: "/assets/icons/apps/higgsfield.svg",
  browser: "/assets/icons/apps/vscode.svg",
  chatgpt: "/assets/apps/chatgpt.svg",
  gemini: "/assets/apps/gemini.svg",
  projects: "/assets/apps/projects.svg",
  photos: "/assets/apps/system/photos.png",
  notes: "/assets/apps/system/notes.png",
  videos: "/assets/apps/videos.svg",
  socials: "/assets/icons/dock/social-media.svg",
  mail: "/assets/apps/system/mail.png",
  trash: "/assets/apps/system/trash-full.png"
};

export const DockIcon: React.FC<DockIconProps> = ({
  item,
  registerItem,
  socialsOpen = false,
  onToggleSocials,
  onCloseSocials,
  prefersReducedMotion
}) => {
  const { locale, activeWorkspace } = useDesktopStore();
  const { windows, openWindow, closeWindow, bringToFront } = useWindowStore();
  const [imageError, setImageError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLButtonElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isSocials = item.actionType === "toggleSocials";
  const label = locale === "tr" ? item.titleTR : item.titleEN;
  const iconSrc = iconPaths[item.iconType] || "/assets/apps/projects.svg";

  // Register DOM elements with Dock spring controller
  useEffect(() => {
    registerItem(item.id, wrapperRef.current, tileRef.current, tooltipRef.current);
    return () => {
      registerItem(item.id, null, null, null);
    };
  }, [item.id, registerItem]);

  // Compute targetWindowId for this dock item
  const targetWindowId = useMemo(() => {
    if (item.actionType === "openToolInfo" && item.toolId) {
      return `tool-${item.toolId}-${activeWorkspace}`;
    }
    if (item.actionType === "openApp" && item.appId) {
      return `app-${item.appId}-${activeWorkspace}`;
    }
    return undefined;
  }, [item, activeWorkspace]);

  // Check if app has an active open window in Zustand state
  const activeWindow = useMemo(() => {
    if (!targetWindowId) return undefined;
    const wsWins = windows[activeWorkspace] || [];
    return wsWins.find((w) => w.id === targetWindowId);
  }, [windows, activeWorkspace, targetWindowId]);

  const isOpen = Boolean(activeWindow);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // 1. Socials toggle launcher
    if (isSocials) {
      if (onToggleSocials) {
        onToggleSocials();
      }
      return;
    }

    // 2. Open Tool Info Window
    if (item.actionType === "openToolInfo" && item.toolId) {
      const tool = toolInfoData[item.toolId];
      if (!tool) return;

      const windowId = `tool-${tool.id}-${activeWorkspace}`;
      const wsWins = windows[activeWorkspace] || [];
      const isAlreadyOpen = wsWins.some((w) => w.id === windowId);

      if (isAlreadyOpen) {
        bringToFront(windowId, activeWorkspace);
        return;
      }

      openWindow({
        id: windowId,
        contentId: tool.id,
        type: "tool-info",
        titleTR: `${tool.titleTR} — Bilgi`,
        titleEN: `${tool.titleEN} — Info`,
        preferredWidth: tool.preferredSize?.width || 400,
        preferredHeight: tool.preferredSize?.height || 175,
        width: tool.preferredSize?.width || 400,
        height: tool.preferredSize?.height || 175,
        extraData: { toolId: tool.id, tool }
      });
      return;
    }

    // 3. Open Standalone App Window (Toggle / Bring to front)
    if (item.actionType === "openApp" && item.appId) {
      const windowId = `app-${item.appId}-${activeWorkspace}`;
      const wsWins = windows[activeWorkspace] || [];
      const found = wsWins.find((w) => w.id === windowId);

      if (found) {
        if (found.minimized) {
          bringToFront(windowId, activeWorkspace);
        } else {
          closeWindow(windowId, activeWorkspace);
        }
        return;
      }

      const titleTR =
        item.appId === "gallery"
          ? "Galeri"
          : item.appId === "video" || item.appId === "videos"
          ? "Videolar"
          : item.appId === "projects"
          ? "Projeler"
          : item.appId === "contact"
          ? "İletişim"
          : item.appId === "about"
          ? "Hakkında"
          : item.appId === "notes"
          ? "Notlar"
          : item.appId === "trash"
          ? "Çöp Kutusu"
          : item.titleTR;

      const titleEN =
        item.appId === "gallery"
          ? "Gallery"
          : item.appId === "video" || item.appId === "videos"
          ? "Videos"
          : item.appId === "projects"
          ? "Projects"
          : item.appId === "contact"
          ? "Contact"
          : item.appId === "about"
          ? "About"
          : item.appId === "notes"
          ? "Notes"
          : item.appId === "trash"
          ? "Trash"
          : item.titleEN;

      const defaultW =
        item.appId === "gallery"
          ? 780
          : item.appId === "video" || item.appId === "videos"
          ? 510
          : item.appId === "projects"
          ? 840
          : item.appId === "contact"
          ? 580
          : item.appId === "about"
          ? 620
          : item.appId === "notes"
          ? 540
          : item.appId === "trash"
          ? 600
          : 640;

      const defaultH =
        item.appId === "gallery"
          ? 560
          : item.appId === "video" || item.appId === "videos"
          ? 660
          : item.appId === "projects"
          ? 660
          : item.appId === "contact"
          ? 460
          : item.appId === "about"
          ? 540
          : item.appId === "notes"
          ? 350
          : item.appId === "trash"
          ? 420
          : 560;

      openWindow({
        id: `app-${item.appId}-${activeWorkspace}`,
        type: item.appId as WindowType,
        contentId: item.appId,
        titleTR,
        titleEN,
        width: defaultW,
        height: defaultH
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center select-none pointer-events-auto flex-shrink-0"
    >
      {/* Tooltip anchored directly to the top of the animated icon */}
      <DockTooltip ref={tooltipRef} text={label} />

      {/* Animated Icon Wrapper Button with Layout-Displacing Dimensions & Upward Lift */}
      <button
        ref={wrapperRef}
        type="button"
        onClick={handleClick}
        aria-label={label}
        aria-haspopup={isSocials ? "menu" : undefined}
        aria-expanded={isSocials ? socialsOpen : undefined}
        style={{
          width: "46px",
          height: "46px"
        }}
        className={`relative flex items-center justify-center transition-transform duration-75 active:scale-95 active:translate-y-[1px] focus:outline-none cursor-pointer p-0 bg-transparent border-none will-change-[width,height,transform] ${
          prefersReducedMotion ? "motion-safe:hover:scale-105" : ""
        }`}
      >
        {!imageError ? (
          item.iconType === "trash" ? (
            /* Trash Exception (Vertically Centered Artwork) */
            <div
              ref={tileRef}
              className="w-full h-full flex items-center justify-center relative flex-shrink-0 p-[2px]"
            >
              <Image
                src={iconSrc}
                alt=""
                width={74}
                height={74}
                draggable={false}
                className="w-full h-full object-contain select-none pointer-events-none"
                onError={() => setImageError(true)}
                unoptimized
              />
            </div>
          ) : (
            /* Universal Normalized App Icon Tile */
            <div
              ref={tileRef}
              style={{
                borderRadius: "11px"
              }}
              className="w-full h-full overflow-hidden flex items-center justify-center relative flex-shrink-0 shadow-xs"
            >
              <Image
                src={iconSrc}
                alt=""
                width={74}
                height={74}
                draggable={false}
                className={`w-full h-full select-none pointer-events-none ${
                  item.artworkMode === "inset" ? "w-[84%] h-[84%] object-contain" : "object-cover"
                }`}
                onError={() => setImageError(true)}
                unoptimized={iconSrc.endsWith(".svg")}
              />
            </div>
          )
        ) : (
          /* Fallback Tile */
          <div
            ref={tileRef}
            lang={locale}
            style={{ borderRadius: "11px" }}
            className="w-full h-full bg-neutral-800 border border-white/10 flex items-center justify-center text-white/60 text-xs font-mono font-bold"
          >
            {toLocaleUpper(item.iconType.slice(0, 2), locale)}
          </div>
        )}

        {/* Active Dot Indicator (Anchored right at bottom of button) */}
        {isOpen && (
          <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 pointer-events-none flex items-center justify-center">
            <div className="w-[3px] h-[3px] rounded-full bg-white/90 shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
          </div>
        )}
      </button>

      {/* Social Stack Popover Anchored Directly Above Socials Icon */}
      {isSocials && socialsOpen && (
        <SocialStack
          isOpen={socialsOpen}
          onClose={() => {
            if (onCloseSocials) onCloseSocials();
          }}
        />
      )}
    </div>
  );
};
