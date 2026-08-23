"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import Image from "next/image";
import { PortfolioVideo } from "@/data/videos";
import { VideoFeedItem } from "./VideoFeedItem";
import { VideoNavigationControls } from "./VideoNavigationControls";
import { getTranslation } from "@/lib/i18n";

interface VideoFeedViewProps {
  videos: PortfolioVideo[];
  currentIndex: number;
  onIndexChange: (newIndex: number) => void;
  onOpenDetail: (video: PortfolioVideo) => void;
  onOpenLibrary: () => void;
  isMuted: boolean;
  onToggleMute: (newMuted: boolean) => void;
  locale: "tr" | "en";
}

export const VideoFeedView: React.FC<VideoFeedViewProps> = ({
  videos,
  currentIndex,
  onIndexChange,
  onOpenDetail,
  onOpenLibrary,
  isMuted,
  onToggleMute,
  locale
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const isWheelingRef = useRef<boolean>(false);
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [slideDirection, setSlideDirection] = useState<"up" | "down" | null>(null);
  const prevIndexRef = useRef<number>(currentIndex);

  const total = videos.length;
  const safeIndex = Math.max(0, Math.min(currentIndex, total - 1));
  const currentVideo = videos[safeIndex];

  // Track slide transition direction
  useEffect(() => {
    if (currentIndex > prevIndexRef.current) {
      setSlideDirection("up"); // Next Reel enters from bottom
    } else if (currentIndex < prevIndexRef.current) {
      setSlideDirection("down"); // Previous Reel enters from top
    }
    prevIndexRef.current = currentIndex;

    const timer = setTimeout(() => {
      setSlideDirection(null);
    }, 430);
    return () => clearTimeout(timer);
  }, [currentIndex]);

  const handlePrev = useCallback(() => {
    if (safeIndex > 0) {
      onIndexChange(safeIndex - 1);
    }
  }, [safeIndex, onIndexChange]);

  const handleNext = useCallback(() => {
    if (safeIndex < total - 1) {
      onIndexChange(safeIndex + 1);
    }
  }, [safeIndex, total, onIndexChange]);

  // Throttled mouse wheel / trackpad navigation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (isWheelingRef.current) return;

      const deltaThreshold = 25;
      if (Math.abs(e.deltaY) > deltaThreshold) {
        isWheelingRef.current = true;

        if (e.deltaY > 0) {
          handleNext();
        } else {
          handlePrev();
        }

        if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
        wheelTimeoutRef.current = setTimeout(() => {
          isWheelingRef.current = false;
        }, 320);
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    };
  }, [handleNext, handlePrev]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        onToggleMute(!isMuted);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, onToggleMute, isMuted]);

  // Touch Swipe handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY.current;
    const swipeThreshold = 40;

    if (deltaY < -swipeThreshold) {
      handleNext();
    } else if (deltaY > swipeThreshold) {
      handlePrev();
    }

    touchStartY.current = null;
  };

  if (!videos || videos.length === 0 || !currentVideo) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-[var(--app-text-muted)] select-none">
        <svg className="w-12 h-12 stroke-current mb-3 opacity-40" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p className="text-sm font-medium">{getTranslation(locale, "videos_feed_empty")}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-prevent-workspace-wheel="true"
      className="relative w-full h-full flex items-center justify-center select-none p-1 sm:p-2 bg-[var(--app-surface)] overflow-hidden"
    >
      {/* Extremely Subtle Ambient Background from Current Reel */}
      {currentVideo.poster && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-15 dark:opacity-10 transition-all duration-700">
          <Image
            src={currentVideo.poster}
            alt=""
            fill
            className="object-cover scale-125 blur-3xl"
            priority
          />
          <div className="absolute inset-0 bg-[var(--app-surface)]/80 backdrop-blur-md" />
        </div>
      )}

      {/* Top-Right Minimal Library Icon Button (No Text Clutter) */}
      <button
        type="button"
        onClick={onOpenLibrary}
        aria-label={getTranslation(locale, "videos_view_library")}
        title={getTranslation(locale, "videos_view_library")}
        className="absolute top-3.5 right-4 z-40 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 active:scale-90 backdrop-blur-md border border-white/20 text-white shadow-md flex items-center justify-center transition-all cursor-pointer"
      >
        {/* 4-Squares Grid Icon */}
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zm-9 9h7v7H4v-7zm9 0h7v7h-7v-7z" />
        </svg>
      </button>

      {/* Centered Single Reel Viewer Stage */}
      <div className="relative flex items-center justify-center gap-3 sm:gap-4 z-10 max-w-full max-h-full overflow-visible">
        {/* Strictly SINGLE active 9:16 Video Frame with Smooth Glide Animation */}
        <div
          key={currentVideo.id}
          className={`flex items-center justify-center ${
            slideDirection === "up"
              ? "animate-reel-enter-up"
              : slideDirection === "down"
              ? "animate-reel-enter-down"
              : "opacity-100 scale-100"
          }`}
        >
          <VideoFeedItem
            video={currentVideo}
            isActive={true}
            isMuted={isMuted}
            onToggleMute={onToggleMute}
            onOpenDetail={onOpenDetail}
            locale={locale}
          />
        </div>

        {/* Floating Right Navigation Controls on Desktop & Tablet */}
        <div className="hidden sm:flex flex-shrink-0 w-16 min-w-[64px] justify-center items-center overflow-visible">
          <VideoNavigationControls
            currentIndex={safeIndex}
            totalCount={total}
            onPrev={handlePrev}
            onNext={handleNext}
            locale={locale}
          />
        </div>
      </div>
    </div>
  );
};
