"use client";

import React, { useEffect, useState } from "react";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore } from "@/store/windowStore";
import { WorkspaceNavigationProvider } from "@/context/WorkspaceNavigationContext";

import { DesktopWorkspace } from "./DesktopWorkspace";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { WorkspaceScrollIndicator } from "./WorkspaceScrollIndicator";
import { WindowManager } from "../window-system/WindowManager";
import { Dock } from "../dock/Dock";
import { LanguageToggle } from "../ui/LanguageToggle";
import { DesktopPortfolioEntry, DesktopEntryStage } from "../entry/DesktopPortfolioEntry";

export const DesktopShell: React.FC = () => {
  const { theme, locale, initFromStorage: initDesktopStore } = useDesktopStore();
  const { initFromStorage: initWindowStore } = useWindowStore();
  const [entryStage, setEntryStage] = useState<DesktopEntryStage>("checking");

  useEffect(() => {
    initDesktopStore();
    initWindowStore();
  }, [initDesktopStore, initWindowStore]);

  const isEntryActive = entryStage !== "desktop";

  return (
    <WorkspaceNavigationProvider>
      {/* Desktop-Only Cinematic Boot + Login Entry Experience */}
      <DesktopPortfolioEntry
        locale={locale}
        onStageChange={setEntryStage}
      />

      <main
        data-shell="desktop"
        data-theme={theme}
        data-entry-active={isEntryActive ? "true" : "false"}
        className={`relative w-screen h-[100dvh] overflow-hidden select-none bg-neutral-900 font-sans transition-all duration-700 ${
          isEntryActive ? "pointer-events-none select-none opacity-0 scale-[1.01]" : "opacity-100 scale-100"
        }`}
        aria-hidden={isEntryActive}
      >
        {/* Vertical Depth Transition Workspace Scene */}
        <DesktopWorkspace />

        {/* Persistent Left Workspace Switcher */}
        <WorkspaceSwitcher />

        {/* Right-Side Minimal Scroll Progress Indicator */}
        <WorkspaceScrollIndicator />

        {/* Floating OS Windows Manager */}
        <WindowManager />

        {/* Application Bottom Dock */}
        <Dock />

        {/* Top Right Language & Theme Switcher Controls */}
        <LanguageToggle />
      </main>
    </WorkspaceNavigationProvider>
  );
};
