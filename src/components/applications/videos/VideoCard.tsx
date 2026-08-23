"use client";

import React from "react";
import Image from "next/image";
import { PortfolioVideo } from "@/data/videos";

interface VideoCardProps {
  video: PortfolioVideo;
  locale: "tr" | "en";
  onSelect: (video: PortfolioVideo) => void;
  onImageError: (id: string) => void;
  hasImageFailed?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  locale,
  onSelect,
  onImageError,
  hasImageFailed
}) => {
  const title = locale === "tr" ? (video.shortTitleTR || video.titleTR) : (video.shortTitleEN || video.titleEN);
  const isAi = video.type === "ai-reel";
  const badgeLabel = isAi ? "AI REEL" : "REEL";
  const metaInfo = [video.client, video.year].filter(Boolean).join(" · ");
  const ariaLabel = locale === "tr" ? `${title} videosunu izle` : `Watch ${title} video`;

  const isLandscape = video.orientation === "landscape";

  return (
    <button
      type="button"
      onClick={() => onSelect(video)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(video);
        }
      }}
      aria-label={ariaLabel}
      className="flex flex-col text-left w-full group cursor-pointer select-none rounded-xl p-2 bg-[var(--app-surface-raised)] border border-[var(--app-border)] hover:border-black/20 dark:hover:border-white/25 hover:shadow-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-[0.985]"
    >
      {/* 9:16 Vertical Poster Container */}
      <div className="relative w-full aspect-[9/16] rounded-lg overflow-hidden bg-black/5 dark:bg-black/30 border border-black/10 dark:border-white/10 flex items-center justify-center">
        {!hasImageFailed && video.poster ? (
          <div className="relative w-full h-full">
            <Image
              src={video.poster}
              alt={title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
              className={`${
                isLandscape ? "object-contain bg-black/90" : "object-cover"
              } w-full h-full motion-safe:group-hover:scale-[1.02] transition-transform duration-300 pointer-events-none`}
              onError={() => onImageError(video.id)}
            />
          </div>
        ) : (
          /* Neutral Fallback Frame */
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-[var(--app-surface-subtle)] text-[var(--app-text-muted)]">
            <span className="font-mono text-xs font-bold">{isLandscape ? "16:9" : "9:16"}</span>
            <span className="text-[10px] mt-1 font-mono">{badgeLabel}</span>
          </div>
        )}

        {/* Subtle Play Overlay Symbol */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/10 group-hover:bg-black/25 transition-colors">
          <div className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-xs border border-white/30 flex items-center justify-center text-white shadow-md group-hover:scale-110 group-hover:bg-black/65 transition-all">
            <svg
              className="w-3.5 h-3.5 fill-current translate-x-0.5"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Optional Duration Badge */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/65 backdrop-blur-xs text-[10px] font-mono font-medium text-white/90 border border-white/15 pointer-events-none">
            {video.duration}
          </div>
        )}

        {/* Subtle Top-Left Type Tag */}
        <div className="absolute top-2 left-2 pointer-events-none">
          <span
            className={`text-[9px] font-mono font-semibold tracking-wider px-1.5 py-0.5 rounded backdrop-blur-xs ${
              isAi
                ? "bg-blue-600/80 text-white border border-blue-400/30"
                : "bg-black/60 text-white/90 border border-white/20"
            }`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>

      {/* Card Metadata Strip */}
      <div className="mt-2.5 px-0.5 flex flex-col gap-0.5">
        <h2 className="text-xs font-semibold text-[var(--app-text-primary)] line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {title}
        </h2>
        {metaInfo && (
          <span className="text-[10px] font-mono text-[var(--app-text-muted)] truncate">
            {metaInfo}
          </span>
        )}
      </div>
    </button>
  );
};
