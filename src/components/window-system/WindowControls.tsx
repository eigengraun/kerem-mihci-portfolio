"use client";

import React from "react";
import { useDesktopStore } from "@/store/desktopStore";

interface WindowControlsProps {
  onClose: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
}

export const WindowControls: React.FC<WindowControlsProps> = ({ onClose }) => {
  const { locale } = useDesktopStore();

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  const ariaLabel = locale === "tr" ? "Pencereyi kapat" : "Close window";

  return (
    <button
      type="button"
      onClick={handleClose}
      onMouseDown={(e) => e.stopPropagation()}
      className="window-control-hitarea flex items-center gap-1.5 p-2 -ml-2 -my-1 select-none cursor-pointer bg-transparent border-0 appearance-none focus:outline-none focus-visible:outline-1 focus-visible:outline-white/30 focus-visible:outline-offset-1 focus-visible:rounded-md transition-opacity duration-150 flex-shrink-0"
      aria-label={ariaLabel}
    >
      {/* Red Circle */}
      <span
        aria-hidden="true"
        className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] flex-shrink-0 block"
      />

      {/* Yellow Circle */}
      <span
        aria-hidden="true"
        className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] flex-shrink-0 block"
      />

      {/* Green Circle */}
      <span
        aria-hidden="true"
        className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29] flex-shrink-0 block"
      />
    </button>
  );
};
