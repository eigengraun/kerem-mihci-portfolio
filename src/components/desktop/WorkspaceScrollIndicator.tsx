"use client";

import React from "react";
import { useWorkspaceNavigation } from "@/context/WorkspaceNavigationContext";
import { useDesktopStore } from "@/store/desktopStore";
import { toLocaleUpper } from "@/lib/casing";

export const WorkspaceScrollIndicator: React.FC = () => {
  const { scrollProgress, scrollDirection, isActiveScroll, isTransitioning } = useWorkspaceNavigation();
  const { theme, locale, portfolioHintSeen } = useDesktopStore();

  const isLight = theme === "light";

  // Onboarding text hint visibility (resets on full page refresh)
  const showHintText = !portfolioHintSeen;

  // Rail active state (during active scroll, transition, or when progress > 0)
  const isRailActive = isActiveScroll || isTransitioning || scrollProgress > 0;

  // Container visibility
  const isVisible = showHintText || isRailActive;

  const hintText = toLocaleUpper(locale === "tr" ? "KAYDIR" : "SCROLL", locale);

  // Track and fill colors
  const trackBg = isLight ? "bg-black/20" : "bg-white/20";
  const fillBg = isLight
    ? "bg-neutral-900 shadow-[0_0_8px_rgba(0,0,0,0.4)]"
    : "bg-white shadow-[0_0_10px_rgba(255,255,255,0.85)]";

  const showDownArrow = scrollDirection === "down" && (isActiveScroll || scrollProgress > 0);
  const showUpArrow = scrollDirection === "up" && (isActiveScroll || scrollProgress > 0);

  // DOWN: progress grows from top to bottom (top-0 bottom-auto)
  // UP: progress grows from bottom to top (bottom-0 top-auto)
  const fillPosClass = scrollDirection === "up" ? "bottom-0 top-auto" : "top-0 bottom-auto";

  return (
    <aside
      aria-hidden="true"
      className={`hidden md:flex fixed right-6 top-1/2 -translate-y-1/2 z-20 w-8 flex-col items-center select-none pointer-events-none transition-opacity duration-300 ease-in-out ${
        isRailActive ? "opacity-100" : isVisible ? "opacity-75" : "opacity-35"
      }`}
    >
      {/* DOWN Arrow: Positioned near TOP of rail */}
      <div className="h-4 flex items-center justify-center">
        <span
          className={`text-[10px] font-mono leading-none transition-all duration-150 ${
            isLight ? "text-neutral-900" : "text-white"
          } ${showDownArrow ? "opacity-90 scale-100" : "opacity-0 scale-75"}`}
        >
          ↓
        </span>
      </div>

      {/* Minimal Right Scroll Rail (Fixed width & height anchor) */}
      <div className={`relative w-[3.5px] h-[100px] rounded-full overflow-hidden ${trackBg}`}>
        {/* Direction-dependent Scroll Progress Fill */}
        <div
          className={`absolute left-0 right-0 w-full rounded-full transition-[height] duration-75 ease-out ${fillBg} ${fillPosClass}`}
          style={{
            height: `${Math.min(Math.max(scrollProgress, 0), 1) * 100}%`
          }}
        />
      </div>

      {/* UP Arrow: Positioned near BOTTOM of rail */}
      <div className="h-4 flex items-center justify-center">
        <span
          className={`text-[10px] font-mono leading-none transition-all duration-150 ${
            isLight ? "text-neutral-900" : "text-white"
          } ${showUpArrow ? "opacity-90 scale-100" : "opacity-0 scale-75"}`}
        >
          ↑
        </span>
      </div>

      {/* Initial Onboarding Hint Text (Absolutely positioned so unmounting NEVER shifts rail position) */}
      {showHintText && (
        <span
          lang={locale}
          className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-mono tracking-[0.2em] uppercase transition-opacity duration-300 ${
            isLight ? "text-neutral-800 opacity-60" : "text-neutral-200 opacity-60"
          }`}
        >
          {hintText}
        </span>
      )}
    </aside>
  );
};
