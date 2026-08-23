"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore, WindowType } from "@/store/windowStore";
import { MobileToolsShelf } from "./MobileToolsShelf";
import { MobileSocialShelf } from "./MobileSocialShelf";

export const MobileDock: React.FC = () => {
  const { activeWorkspace } = useDesktopStore();
  const { openWindow, windows, closeWindow } = useWindowStore();

  const [toolsOpen, setToolsOpen] = useState(false);
  const [socialsOpen, setSocialsOpen] = useState(false);

  const dockBoxRef = useRef<HTMLDivElement>(null);
  const activeWindows = windows[activeWorkspace] || [];

  useEffect(() => {
    let lastHeight = 0;
    let lastTop = 0;

    const updateMetrics = () => {
      if (!dockBoxRef.current) return;
      const rect = dockBoxRef.current.getBoundingClientRect();
      const height = Math.round(rect.height);
      const top = Math.round(rect.top);

      if (height !== lastHeight || top !== lastTop) {
        lastHeight = height;
        lastTop = top;
        document.documentElement.style.setProperty("--mobile-dock-height", `${height}px`);
        document.documentElement.style.setProperty("--mobile-dock-top", `${top}px`);
      }
    };

    updateMetrics();
    const observer = new ResizeObserver(updateMetrics);
    if (dockBoxRef.current) observer.observe(dockBoxRef.current);

    window.addEventListener("resize", updateMetrics);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateMetrics);
    };
  }, []);

  // Outside click listener for upward shelves (active only when a shelf is open)
  useEffect(() => {
    if (!toolsOpen && !socialsOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (dockBoxRef.current && !dockBoxRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
        setSocialsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [toolsOpen, socialsOpen]);

  const handleToggleApp = (appId: WindowType, titleTR: string, titleEN: string) => {
    setToolsOpen(false);
    setSocialsOpen(false);

    const windowId = appId;
    const isAlreadyOpen = activeWindows.some((w) => w.id === windowId);

    if (isAlreadyOpen) {
      closeWindow(windowId, activeWorkspace);
    } else {
      openWindow({
        id: windowId,
        type: appId,
        contentId: appId,
        titleTR,
        titleEN,
        width: 360,
        height: 520
      });
    }
  };

  const isAppOpen = (appId: string) => {
    return activeWindows.some((w) => w.id === appId);
  };

  return (
    <nav className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+8px)] left-1/2 -translate-x-1/2 z-40 select-none pointer-events-auto flex flex-col items-center justify-center">
      {/* Upward Tools Launcher Shelf */}
      {toolsOpen && <MobileToolsShelf onClose={() => setToolsOpen(false)} />}

      {/* Upward Social Media Shelf */}
      {socialsOpen && <MobileSocialShelf onClose={() => setSocialsOpen(false)} />}

      {/* Single Translucent Glass Two-Row Mobile Dock Container */}
      <div
        ref={dockBoxRef}
        className="w-max max-w-[calc(100vw-24px)] px-3 py-2 rounded-[18px] backdrop-blur-xl bg-black/45 dark:bg-black/60 border border-white/20 shadow-2xl flex flex-col min-[700px]:flex-row items-center justify-center gap-1.5 transition-colors duration-300"
      >
        
        {/* ROW 1: Software / Tools, Notes, Gallery, Videos */}
        <div className="flex items-center justify-center gap-2">
          {/* Slot 1: TOOLS (Workspace Software Launcher) */}
          <button
            type="button"
            onClick={() => {
              setSocialsOpen(false);
              setToolsOpen((prev) => !prev);
            }}
            aria-label="Software Tools"
            className="flex flex-col items-center justify-center cursor-pointer active:scale-90 transition-transform p-0.5 min-w-[44px] min-h-[44px]"
          >
            <div
              className={`w-9 h-9 rounded-[9px] flex items-center justify-center border transition-all ${
                toolsOpen
                  ? "bg-[#1967E8] border-white/50 shadow-md text-white"
                  : "bg-neutral-800/80 border-white/15 text-white/90"
              }`}
            >
              <span className="font-mono font-bold text-xs">🛠️</span>
            </div>
          </button>

          {/* Slot 2: NOTES */}
          <button
            type="button"
            onClick={() => handleToggleApp("notes", "Notlar", "Notes")}
            aria-label="Notes"
            className="flex flex-col items-center justify-center cursor-pointer active:scale-90 transition-transform p-0.5 min-w-[44px] min-h-[44px]"
          >
            <div className="w-9 h-9 rounded-[9px] overflow-hidden flex items-center justify-center bg-black/10 border border-white/15 shadow-xs relative">
              <Image
                src="/assets/apps/system/notes.png"
                alt=""
                width={36}
                height={36}
                className="w-full h-full object-cover select-none pointer-events-none"
              />
            </div>
            {isAppOpen("notes") && (
              <div className="w-1 h-1 rounded-full bg-white shadow-xs mt-0.5" />
            )}
          </button>

          {/* Slot 3: GALLERY */}
          <button
            type="button"
            onClick={() => handleToggleApp("gallery", "Galeri", "Gallery")}
            aria-label="Gallery"
            className="flex flex-col items-center justify-center cursor-pointer active:scale-90 transition-transform p-0.5 min-w-[44px] min-h-[44px]"
          >
            <div className="w-9 h-9 rounded-[9px] overflow-hidden flex items-center justify-center bg-black/10 border border-white/15 shadow-xs relative">
              <Image
                src="/assets/apps/system/photos.png"
                alt=""
                width={36}
                height={36}
                className="w-full h-full object-cover select-none pointer-events-none"
              />
            </div>
            {isAppOpen("gallery") && (
              <div className="w-1 h-1 rounded-full bg-white shadow-xs mt-0.5" />
            )}
          </button>

          {/* Slot 4: VIDEOS */}
          <button
            type="button"
            onClick={() => handleToggleApp("video", "Videolar", "Videos")}
            aria-label="Videos"
            className="flex flex-col items-center justify-center cursor-pointer active:scale-90 transition-transform p-0.5 min-w-[44px] min-h-[44px]"
          >
            <div className="w-9 h-9 rounded-[9px] overflow-hidden flex items-center justify-center bg-black/10 border border-white/15 shadow-xs relative">
              <Image
                src="/assets/apps/videos.svg"
                alt=""
                width={36}
                height={36}
                className="w-full h-full object-cover select-none pointer-events-none"
                unoptimized
              />
            </div>
            {isAppOpen("video") && (
              <div className="w-1 h-1 rounded-full bg-white shadow-xs mt-0.5" />
            )}
          </button>
        </div>

        {/* ROW 2: Projects, Social, Mail, Divider, Trash */}
        <div className="flex items-center justify-center gap-2">
          {/* Slot 5: PROJECTS */}
          <button
            type="button"
            onClick={() => handleToggleApp("projects", "Projeler", "Projects")}
            aria-label="Projects"
            className="flex flex-col items-center justify-center cursor-pointer active:scale-90 transition-transform p-0.5 min-w-[44px] min-h-[44px]"
          >
            <div className="w-9 h-9 rounded-[9px] overflow-hidden flex items-center justify-center bg-black/10 border border-white/15 shadow-xs relative">
              <Image
                src="/assets/apps/projects.svg"
                alt=""
                width={36}
                height={36}
                className="w-full h-full object-cover select-none pointer-events-none"
                unoptimized
              />
            </div>
            {isAppOpen("projects") && (
              <div className="w-1 h-1 rounded-full bg-white shadow-xs mt-0.5" />
            )}
          </button>

          {/* Slot 6: SOCIAL */}
          <button
            type="button"
            onClick={() => {
              setToolsOpen(false);
              setSocialsOpen((prev) => !prev);
            }}
            aria-label="Social Media"
            className="flex flex-col items-center justify-center cursor-pointer active:scale-90 transition-transform p-0.5 min-w-[44px] min-h-[44px]"
          >
            <div className="w-9 h-9 rounded-[9px] overflow-hidden flex items-center justify-center bg-black/10 border border-white/15 shadow-xs relative">
              <Image
                src="/assets/icons/dock/social-media.svg"
                alt=""
                width={36}
                height={36}
                className="w-full h-full object-cover select-none pointer-events-none"
                unoptimized
              />
            </div>
          </button>

          {/* Slot 7: MAIL */}
          <button
            type="button"
            onClick={() => handleToggleApp("contact", "İletişim", "Contact")}
            aria-label="Contact / Mail"
            className="flex flex-col items-center justify-center cursor-pointer active:scale-90 transition-transform p-0.5 min-w-[44px] min-h-[44px]"
          >
            <div className="w-9 h-9 rounded-[9px] overflow-hidden flex items-center justify-center bg-black/10 border border-white/15 shadow-xs relative">
              <Image
                src="/assets/apps/system/mail.png"
                alt=""
                width={36}
                height={36}
                className="w-full h-full object-cover select-none pointer-events-none"
              />
            </div>
            {isAppOpen("contact") && (
              <div className="w-1 h-1 rounded-full bg-white shadow-xs mt-0.5" />
            )}
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-white/20 my-auto mx-0.5 flex-shrink-0" />

          {/* Slot 8: TRASH */}
          <button
            type="button"
            onClick={() => handleToggleApp("trash", "Çöp Kutusu", "Trash")}
            aria-label="Trash"
            className="flex flex-col items-center justify-center cursor-pointer active:scale-90 transition-transform p-0.5 min-w-[44px] min-h-[44px]"
          >
            <div className="w-9 h-9 flex items-center justify-center relative">
              <Image
                src="/assets/apps/system/trash-full.png"
                alt=""
                width={36}
                height={36}
                className="w-full h-full object-contain select-none pointer-events-none"
              />
            </div>
            {isAppOpen("trash") && (
              <div className="w-1 h-1 rounded-full bg-white shadow-xs mt-0.5" />
            )}
          </button>
        </div>
      </div>
    </nav>
  );
};
