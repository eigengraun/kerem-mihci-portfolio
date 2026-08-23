"use client";

import React from "react";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore } from "@/store/windowStore";
import { MobileWindow } from "./MobileWindow";

export const MobileWindowManager: React.FC = () => {
  const { activeWorkspace } = useDesktopStore();
  const { windows } = useWindowStore();

  const activeWindows = windows[activeWorkspace] || [];

  if (activeWindows.length === 0) return null;

  // Foreground window on top of stack
  const foregroundWin = activeWindows[activeWindows.length - 1];

  return <MobileWindow key={foregroundWin.id} win={foregroundWin} />;
};
