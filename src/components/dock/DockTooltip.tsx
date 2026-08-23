"use client";

import React, { forwardRef } from "react";

interface DockTooltipProps {
  text: string;
}

export const DockTooltip = forwardRef<HTMLDivElement, DockTooltipProps>(({ text }, ref) => {
  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: "translateX(-50%) translateY(4px)",
        pointerEvents: "none"
      }}
      className="absolute bottom-[calc(100%+8px)] left-1/2 bg-[#1C1B1A]/95 text-white text-[11px] font-sans font-medium px-[8px] py-[4px] rounded-[5px] border border-white/12 shadow-[0_4px_12px_rgba(0,0,0,0.35)] whitespace-nowrap transition-all duration-150 ease-out z-[10020] will-change-[opacity,transform]"
    >
      {text}
    </div>
  );
});

DockTooltip.displayName = "DockTooltip";
