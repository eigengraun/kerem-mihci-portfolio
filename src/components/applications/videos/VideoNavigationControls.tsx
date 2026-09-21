"use client";

import React from "react";
import { getTranslation } from "@/lib/i18n";

interface VideoNavigationControlsProps {
  currentIndex: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
  locale: "tr" | "en";
}

export const VideoNavigationControls: React.FC<VideoNavigationControlsProps> = ({
  currentIndex,
  totalCount,
  onPrev,
  onNext,
  locale
}) => {
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < totalCount - 1;

  return (
    <div
      data-reels-nav="true"
      data-prevent-workspace-wheel="true"
      className="flex flex-col items-center gap-1.5 sm:gap-2 select-none opacity-85 sm:opacity-70 hover:opacity-100 transition-opacity duration-200 w-11 sm:w-16 min-w-[44px] sm:min-w-[64px] flex-shrink-0 overflow-visible"
    >
      {/* Up / Previous Reel Button */}
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label={getTranslation(locale, "videos_feed_prev")}
        title={getTranslation(locale, "videos_feed_prev")}
        className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-200 cursor-pointer flex-shrink-0 ${
          canPrev
            ? "bg-black/45 hover:bg-black/70 active:scale-90 text-white border-white/20 shadow-md hover:border-white/35"
            : "bg-black/20 text-white/25 border-white/10 cursor-not-allowed opacity-35"
        }`}
      >
        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
          <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
        </svg>
      </button>

      {/* Subtle Counter Pill: auto-expanding width, tabular numerals, perfectly centered */}
      <div className="w-max min-w-[46px] sm:min-w-[50px] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-[10px] font-mono font-medium tabular-nums text-white/90 shadow-xs inline-flex items-center justify-center text-center whitespace-nowrap overflow-visible leading-none flex-shrink-0">
        <span>{currentIndex + 1}</span>
        <span className="opacity-40 mx-0.5 sm:mx-1">/</span>
        <span className="opacity-60">{totalCount}</span>
      </div>

      {/* Down / Next Reel Button */}
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        aria-label={getTranslation(locale, "videos_feed_next")}
        title={getTranslation(locale, "videos_feed_next")}
        className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-200 cursor-pointer flex-shrink-0 ${
          canNext
            ? "bg-black/45 hover:bg-black/70 active:scale-90 text-white border-white/20 shadow-md hover:border-white/35"
            : "bg-black/20 text-white/25 border-white/10 cursor-not-allowed opacity-35"
        }`}
      >
        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
        </svg>
      </button>
    </div>
  );
};
