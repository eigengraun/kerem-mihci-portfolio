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
      className="flex flex-col items-center gap-1.5 sm:gap-2 select-none w-10 sm:w-11 flex-shrink-0"
    >
      {/* Up / Previous Reel Button */}
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label={getTranslation(locale, "videos_feed_prev")}
        title={getTranslation(locale, "videos_feed_prev")}
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-200 cursor-pointer flex-shrink-0 ${
          canPrev
            ? "bg-black/50 hover:bg-black/75 active:scale-90 text-white border-white/20 shadow-md hover:border-white/35"
            : "bg-black/25 text-white/35 border-white/10 cursor-not-allowed opacity-40"
        }`}
      >
        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" viewBox="0 0 24 24">
          <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
        </svg>
      </button>

      {/* Subtle Counter Pill: cohesive glass styling, tabular numerals, perfectly centered */}
      <div className="w-8 sm:w-9 min-w-[36px] sm:min-w-[40px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-[10px] sm:text-[11px] font-mono font-medium tabular-nums text-white/90 shadow-xs inline-flex items-center justify-center text-center whitespace-nowrap leading-none flex-shrink-0">
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
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-200 cursor-pointer flex-shrink-0 ${
          canNext
            ? "bg-black/50 hover:bg-black/75 active:scale-90 text-white border-white/20 shadow-md hover:border-white/35"
            : "bg-black/25 text-white/35 border-white/10 cursor-not-allowed opacity-40"
        }`}
      >
        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" viewBox="0 0 24 24">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
        </svg>
      </button>
    </div>
  );
};
