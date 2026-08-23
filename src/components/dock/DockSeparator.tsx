"use client";

import React from "react";
import { useDesktopStore } from "@/store/desktopStore";

export const DockSeparator: React.FC = () => {
  const { theme } = useDesktopStore();
  const isLight = theme === "light";

  return (
    <div
      className={`w-[1px] h-[32px] mx-[4px] self-center flex-shrink-0 transition-colors duration-200 ${
        isLight ? "bg-white/25" : "bg-white/14"
      }`}
    />
  );
};
