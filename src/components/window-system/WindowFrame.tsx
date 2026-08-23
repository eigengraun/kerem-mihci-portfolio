"use client";

import React, { useState, useEffect } from "react";
import { Rnd } from "react-rnd";
import { WindowInstance, useWindowStore } from "@/store/windowStore";
import { WindowTitleBar } from "./WindowTitleBar";
import { WindowContent } from "./WindowContent";
import { useDesktopStore } from "@/store/desktopStore";

interface WindowFrameProps {
  window: WindowInstance;
  children: React.ReactNode;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({ window: win, children }) => {
  const { locale, theme } = useDesktopStore();
  const { closeWindow, bringToFront, updateWindowBounds, updateWindowScroll } = useWindowStore();

  const [isMobile, setIsMobile] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const title = locale === "tr" ? win.titleTR : win.titleEN;
  const isDarkTool = win.type === "tool-info";
  const isLight = theme === "light";

  const handleClose = () => closeWindow(win.id, win.workspaceId);

  // Compute frame surface class based on window type and active desktop theme
  const frameSurfaceClass = isDarkTool
    ? "bg-[#2C2B2B] border-black/40 text-[#ECECEC] shadow-[0_14px_38px_rgba(0,0,0,0.32)]"
    : isLight
    ? "bg-[#ECE9E5] border-black/15 text-[#24211F] shadow-[0_15px_40px_rgba(0,0,0,0.16)]"
    : "bg-[#242221] border-white/12 text-[#F1EEEA] shadow-[0_15px_42px_rgba(0,0,0,0.42)]";

  // Mobile layout: Fixed near-full-screen modal
  if (isMobile) {
    return (
      <div
        className={`fixed inset-3 z-[100] flex flex-col border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${frameSurfaceClass}`}
        onClick={() => bringToFront(win.id, win.workspaceId)}
      >
        <WindowTitleBar title={title} onClose={handleClose} isDarkTool={isDarkTool} isDarkTheme={!isLight} />
        <WindowContent
          scrollTop={win.scrollTop}
          onScroll={(scrollTop) => updateWindowScroll(win.id, win.workspaceId, scrollTop)}
          isDarkTool={isDarkTool}
          isDarkTheme={!isLight}
        >
          {children}
        </WindowContent>
      </div>
    );
  }

  // Desktop layout: Rnd floating window with smooth mode-switch bounds transition
  return (
    <Rnd
      size={{ width: win.width, height: win.height }}
      position={{ x: win.x, y: win.y }}
      onDragStart={() => {
        setIsInteracting(true);
        bringToFront(win.id, win.workspaceId);
      }}
      onDragStop={(_e, d) => {
        setIsInteracting(false);
        updateWindowBounds(win.id, win.workspaceId, {
          x: d.x,
          y: d.y,
          width: win.width,
          height: win.height
        });
      }}
      onResizeStart={() => {
        setIsInteracting(true);
        bringToFront(win.id, win.workspaceId);
      }}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        setIsInteracting(false);
        updateWindowBounds(win.id, win.workspaceId, {
          x: position.x,
          y: position.y,
          width: parseInt(ref.style.width, 10),
          height: parseInt(ref.style.height, 10)
        });
      }}
      minWidth={320}
      minHeight={150}
      dragHandleClassName="window-drag-handle"
      cancel=".window-control-hitarea"
      bounds=".workspace-window-layer"
      className={`!flex flex-col border rounded-xl overflow-hidden focus:outline-none ${
        !isInteracting ? "transition-[width,height,transform] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]" : "transition-none"
      } ${frameSurfaceClass}`}
      style={{ zIndex: win.zIndex }}
      onMouseDown={() => bringToFront(win.id, win.workspaceId)}
    >
      <WindowTitleBar title={title} onClose={handleClose} isDarkTool={isDarkTool} isDarkTheme={!isLight} />
      <WindowContent
        scrollTop={win.scrollTop}
        onScroll={(scrollTop) => updateWindowScroll(win.id, win.workspaceId, scrollTop)}
        isDarkTool={isDarkTool}
        isDarkTheme={!isLight}
      >
        {children}
      </WindowContent>
    </Rnd>
  );
};
