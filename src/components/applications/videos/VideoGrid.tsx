"use client";

import React from "react";
import { PortfolioVideo } from "@/data/videos";
import { VideoCard } from "./VideoCard";
import { getTranslation } from "@/lib/i18n";

interface VideoGridProps {
  videos: PortfolioVideo[];
  locale: "tr" | "en";
  onSelectVideo: (video: PortfolioVideo) => void;
  onImageError: (id: string) => void;
  failedPosterIds: Record<string, boolean>;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  videos,
  locale,
  onSelectVideo,
  onImageError,
  failedPosterIds
}) => {
  if (videos.length === 0) {
    return (
      <div className="my-12 p-8 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-raised)] text-center flex flex-col items-center justify-center gap-2 select-none">
        <div className="w-10 h-10 rounded-full bg-[var(--app-surface-subtle)] border border-[var(--app-border)] flex items-center justify-center text-[var(--app-text-muted)] text-base font-mono">
          🎬
        </div>
        <h2 className="text-xs font-semibold text-[var(--app-text-primary)] mt-1">
          {getTranslation(locale, "videos_empty")}
        </h2>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4"
      data-prevent-workspace-wheel="true"
    >
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          locale={locale}
          onSelect={onSelectVideo}
          onImageError={onImageError}
          hasImageFailed={failedPosterIds[video.id]}
        />
      ))}
    </div>
  );
};
