"use client";

import React, { useState, useMemo, useCallback } from "react";
import { PortfolioVideo, VideoType } from "@/data/videos";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore } from "@/store/windowStore";
import { useSessionStore } from "@/store/sessionStore";
import { VideoFeedView } from "./videos/VideoFeedView";
import { VideoLibraryView } from "./videos/VideoLibraryView";

export type VideoViewMode = "feed" | "library";
export type VideoFilterType = "all" | VideoType;

export const VIDEO_WINDOW_PRESETS = {
  reels: {
    width: 510,
    height: 660
  },
  library: {
    width: 900,
    height: 660
  },
  details: {
    width: 880,
    height: 660
  },
  landscapeDetails: {
    width: 1040,
    height: 720
  }
} as const;

export const VideoApp: React.FC = () => {
  const { locale, activeWorkspace } = useDesktopStore();
  const { windows, updateWindowBounds } = useWindowStore();
  const { sessionVideos } = useSessionStore();

  // Default strictly to minimal Reels Feed View
  const [viewMode, setViewMode] = useState<VideoViewMode>("feed");
  const [activeFilter, setActiveFilter] = useState<VideoFilterType>("all");
  const [currentFeedIndex, setCurrentFeedIndex] = useState<number>(0);
  const [selectedLibraryVideo, setSelectedLibraryVideo] = useState<PortfolioVideo | null>(null);
  const [detailOrigin, setDetailOrigin] = useState<"feed" | "library">("feed");
  const [isMuted, setIsMuted] = useState<boolean>(true);

  // Helper to dynamically resize the Videos application window based on active mode
  const resizeVideoWindow = useCallback((presetName: "reels" | "library" | "details" | "landscapeDetails") => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) return; // Mobile uses full-screen modal

    const preset = VIDEO_WINDOW_PRESETS[presetName];
    const windowId = `app-video-${activeWorkspace}`;
    const currentWin = (windows[activeWorkspace] || []).find((w) => w.id === windowId);

    if (!currentWin) return;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const targetW = Math.min(preset.width, viewportW - 24);
    const targetH = Math.min(preset.height, viewportH - 96);

    // Skip if already at target dimensions
    if (currentWin.width === targetW && currentWin.height === targetH) return;

    // Calculate new position preserving current window center
    const currentCenterX = currentWin.x + currentWin.width / 2;
    const currentCenterY = currentWin.y + currentWin.height / 2;

    const newX = currentCenterX - targetW / 2;
    const newY = currentCenterY - targetH / 2;

    const minX = 12;
    const maxX = Math.max(minX, viewportW - targetW - 12);
    const minY = 32;
    const maxY = Math.max(minY, viewportH - targetH - 84); // Safe clearance above desktop Dock

    const clampedX = Math.max(minX, Math.min(newX, maxX));
    const clampedY = Math.max(minY, Math.min(newY, maxY));

    updateWindowBounds(windowId, activeWorkspace, {
      x: Math.round(clampedX),
      y: Math.round(clampedY),
      width: Math.round(targetW),
      height: Math.round(targetH)
    });
  }, [activeWorkspace, windows, updateWindowBounds]);

  // Session-randomized video order
  const sortedVideos = sessionVideos;

  // Filtered list for Library View (both portrait and landscape)
  const libraryVideos = useMemo(() => {
    return sortedVideos.filter((v) => activeFilter === "all" || v.type === activeFilter);
  }, [sortedVideos, activeFilter]);

  // List for Reels Feed (includes all videos; landscape videos display in Instagram-style reel format)
  const feedVideos = sortedVideos;

  // Count calculations for filter badges in Library
  const totalCount = sortedVideos.length;
  const aiCount = useMemo(() => sortedVideos.filter((v) => v.type === "ai-reel").length, [sortedVideos]);
  const reelCount = useMemo(() => sortedVideos.filter((v) => v.type === "reel").length, [sortedVideos]);

  // Switch to Library
  const handleOpenLibrary = () => {
    setViewMode("library");
    setSelectedLibraryVideo(null);
    resizeVideoWindow("library");
  };

  // Return to Reels Feed
  const handleReturnToFeed = () => {
    setViewMode("feed");
    setSelectedLibraryVideo(null);
    resizeVideoWindow("reels");
  };

  // Open Detail from Reels Feed
  const handleOpenDetailFromFeed = (video: PortfolioVideo) => {
    setSelectedLibraryVideo(video);
    setDetailOrigin("feed");
    setViewMode("library");
    resizeVideoWindow(video.orientation === "landscape" ? "landscapeDetails" : "details");
  };

  // Open Detail from Library Grid
  const handleSelectVideoFromLibrary = (video: PortfolioVideo | null) => {
    setSelectedLibraryVideo(video);
    if (video) {
      setDetailOrigin("library");
      resizeVideoWindow(video.orientation === "landscape" ? "landscapeDetails" : "details");
    } else {
      if (detailOrigin === "feed") {
        setViewMode("feed");
        resizeVideoWindow("reels");
      } else {
        resizeVideoWindow("library");
      }
    }
  };

  // Transition from Detail directly into Reels Feed with selected video
  const handleOpenFeedWithVideo = (video: PortfolioVideo) => {
    const foundIndex = feedVideos.findIndex((v) => v.id === video.id);
    if (foundIndex >= 0) {
      setCurrentFeedIndex(foundIndex);
    } else {
      setCurrentFeedIndex(0);
    }
    setViewMode("feed");
    setSelectedLibraryVideo(null);
    resizeVideoWindow("reels");
  };

  return (
    <div
      className="flex flex-col h-full min-h-0 sm:min-h-[480px] bg-[var(--app-surface)] text-[var(--app-text-primary)] select-none transition-colors duration-200"
      data-prevent-workspace-wheel="true"
    >
      {/* Main Content: Immersive Feed or Adaptive Library */}
      <div
        className="flex-1 min-h-0 overflow-hidden relative"
        data-prevent-workspace-wheel="true"
      >
        {viewMode === "feed" ? (
          <VideoFeedView
            videos={feedVideos}
            currentIndex={Math.min(currentFeedIndex, Math.max(0, feedVideos.length - 1))}
            onIndexChange={setCurrentFeedIndex}
            onOpenDetail={handleOpenDetailFromFeed}
            onOpenLibrary={handleOpenLibrary}
            isMuted={isMuted}
            onToggleMute={(newMuted) => setIsMuted(newMuted)}
            locale={locale}
          />
        ) : (
          <div className="h-full p-3 sm:p-4 md:p-5 flex flex-col min-h-0 overflow-hidden">
            <VideoLibraryView
              videos={libraryVideos}
              locale={locale}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              counts={{
                total: totalCount,
                ai: aiCount,
                reel: reelCount
              }}
              onReturnToFeed={handleReturnToFeed}
              onOpenFeedWithVideo={handleOpenFeedWithVideo}
              selectedVideo={selectedLibraryVideo}
              onSelectVideo={handleSelectVideoFromLibrary}
            />
          </div>
        )}
      </div>
    </div>
  );
};
