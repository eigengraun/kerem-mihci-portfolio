"use client";

import React, { useState } from "react";
import { PortfolioVideo, VideoType } from "@/data/videos";
import { VideoGrid } from "./VideoGrid";
import { VideoDetail } from "./VideoDetail";
import { getTranslation } from "@/lib/i18n";

export type VideoFilterType = "all" | VideoType;

interface VideoLibraryViewProps {
  videos: PortfolioVideo[];
  locale: "tr" | "en";
  activeFilter: VideoFilterType;
  onFilterChange: (filter: VideoFilterType) => void;
  counts: {
    total: number;
    ai: number;
    reel: number;
  };
  onReturnToFeed: () => void;
  onOpenFeedWithVideo: (video: PortfolioVideo) => void;
  selectedVideo: PortfolioVideo | null;
  onSelectVideo: (video: PortfolioVideo | null) => void;
}

export const VideoLibraryView: React.FC<VideoLibraryViewProps> = ({
  videos,
  locale,
  activeFilter,
  onFilterChange,
  counts,
  onReturnToFeed,
  onOpenFeedWithVideo,
  selectedVideo,
  onSelectVideo
}) => {
  const [failedPosterIds, setFailedPosterIds] = useState<Record<string, boolean>>({});

  const handleImageError = (id: string) => {
    setFailedPosterIds((prev) => ({ ...prev, [id]: true }));
  };

  const filterTabs = [
    { id: "all" as const, label: getTranslation(locale, "videos_filter_all"), count: counts.total },
    { id: "ai-reel" as const, label: getTranslation(locale, "videos_filter_ai"), count: counts.ai },
    { id: "reel" as const, label: getTranslation(locale, "videos_filter_reels"), count: counts.reel }
  ];

  return (
    <div
      className="flex flex-col h-full w-full select-none"
      data-prevent-workspace-wheel="true"
    >
      {/* Library Top Bar: Return to Reels on Left & Filter Chips on Right */}
      {!selectedVideo && (
        <div className="pb-3 mb-3 border-b border-[var(--app-divider)] flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          {/* Return to Reels Feed Button */}
          <button
            type="button"
            onClick={onReturnToFeed}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--app-surface-subtle)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text-primary)] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95 shadow-xs"
          >
            {/* Reels Phone Icon */}
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H7V5h10v14zm-5-3.5l4-3.5-4-3.5v7z" />
            </svg>
            <span>{getTranslation(locale, "videos_view_feed")}</span>
          </button>

          {/* Library Category Filters */}
          <div className="flex items-center gap-1 bg-[var(--app-input-bg)] p-1 rounded-lg border border-[var(--app-input-border)] text-xs overflow-x-auto no-scrollbar">
            {filterTabs.map((tab) => {
              const isSelected = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onFilterChange(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-[#1967E8] text-white shadow-xs"
                      : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-mono ${
                      isSelected ? "opacity-90" : "opacity-60"
                    }`}
                  >
                    ({tab.count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content: Detail View or Grid */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {selectedVideo ? (
          <VideoDetail
            video={selectedVideo}
            onBack={() => onSelectVideo(null)}
            onOpenFeed={onOpenFeedWithVideo}
          />
        ) : (
          <div className="h-full overflow-y-auto app-scrollbar">
            <VideoGrid
              videos={videos}
              locale={locale}
              onSelectVideo={onSelectVideo}
              onImageError={handleImageError}
              failedPosterIds={failedPosterIds}
            />
          </div>
        )}
      </div>
    </div>
  );
};
