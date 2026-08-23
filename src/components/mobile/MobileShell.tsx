"use client";

import React, { useEffect } from "react";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore } from "@/store/windowStore";

import { MobileWorkspace } from "./MobileWorkspace";
import { MobileTopBar } from "./MobileTopBar";
import { MobileWindowManager } from "./MobileWindowManager";
import { MobileDock } from "./MobileDock";

export const MobileShell: React.FC = () => {
  const { theme, initFromStorage: initDesktopStore } = useDesktopStore();
  const { initFromStorage: initWindowStore } = useWindowStore();

  useEffect(() => {
    initDesktopStore();
    initWindowStore();
  }, [initDesktopStore, initWindowStore]);

  return (
    <main
      data-shell="mobile"
      data-theme={theme}
      className="relative w-screen h-[100dvh] overflow-hidden select-none bg-neutral-950 font-sans transition-colors duration-300"
    >
      {/* Mobile Top Bar */}
      <MobileTopBar />

      {/* Mobile Sliding Workspace Canvas */}
      <MobileWorkspace />

      {/* Mobile Full-Screen OS Windows Manager */}
      <MobileWindowManager />

      {/* Mobile Application Dock */}
      <MobileDock />
    </main>
  );
};
