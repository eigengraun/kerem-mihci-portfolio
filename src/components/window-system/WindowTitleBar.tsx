"use client";

import React from "react";
import { WindowControls } from "./WindowControls";

interface WindowTitleBarProps {
  title: string;
  onClose: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
  isDarkTool?: boolean;
  isDarkTheme?: boolean;
}

export const WindowTitleBar: React.FC<WindowTitleBarProps> = ({
  title,
  onClose,
  isDarkTool = false,
  isDarkTheme = false
}) => {
  const titlebarBg = isDarkTool
    ? "bg-[#333131] border-black/30 text-[#ECECEC]"
    : isDarkTheme
    ? "bg-[#1F1D1C] border-white/10 text-[#F1EEEA]"
    : "bg-[#E2DDD7] border-black/10 text-[#24211F]";

  return (
    <div
      className={`window-drag-handle h-7 md:h-8 px-3 border-b flex items-center justify-between select-none rounded-t-xl cursor-grab active:cursor-grabbing transition-colors duration-200 ${titlebarBg}`}
    >
      <WindowControls onClose={onClose} />

      <div className="flex-1 px-2 text-center text-xs font-sans font-medium truncate">
        {title}
      </div>

      {/* Spacer balancing controls */}
      <div className="w-10 flex-shrink-0" />
    </div>
  );
};
