"use client";

import React from "react";

interface DesktopIconLabelProps {
  label: string;
  selected?: boolean;
}

export const DesktopIconLabel: React.FC<DesktopIconLabelProps> = ({ label, selected }) => {
  return (
    <div
      className={`mt-1.5 px-1.5 py-0.5 max-w-[110px] text-center text-xs md:text-[13px] font-sans leading-tight select-none rounded transition-all ${
        selected
          ? "bg-blue-600/90 text-white font-medium shadow"
          : "text-neutral-900 font-medium drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
      }`}
      style={{
        textShadow: selected ? "none" : "0 1px 3px rgba(255, 255, 255, 0.9)"
      }}
    >
      <span className="line-clamp-2 break-words">{label}</span>
    </div>
  );
};
