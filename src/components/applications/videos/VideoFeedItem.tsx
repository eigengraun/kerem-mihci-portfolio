"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { PortfolioVideo } from "@/data/videos";
import { getTranslation } from "@/lib/i18n";

interface VideoFeedItemProps {
  video: PortfolioVideo;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: (newMutedState: boolean) => void;
  onOpenDetail: (video: PortfolioVideo) => void;
  locale: "tr" | "en";
  currentIndex: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
}

export const VideoFeedItem: React.FC<VideoFeedItemProps> = ({
  video,
  isActive,
  isMuted,
  onToggleMute,
  onOpenDetail,
  locale,
  currentIndex,
  totalCount,
  onPrev,
  onNext
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [feedbackType, setFeedbackType] = useState<"play" | "pause" | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const title = locale === "tr" ? (video.shortTitleTR || video.titleTR) : (video.shortTitleEN || video.titleEN);
  const isAi = video.type === "ai-reel";
  const badgeLabel = isAi ? "AI REEL" : "REEL";
  const clientInfo = [video.client, video.year].filter(Boolean).join(" · ");

  // Authoritative playback & stream lifecycle management
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    setIsLoading(true);
    setHasError(false);

    if (isActive) {
      if (videoEl.readyState >= 3) {
        setIsLoading(false);
      }
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (videoEl) {
            videoEl.muted = true;
            videoEl.play().catch(() => {});
          }
        });
      }
    } else {
      videoEl.pause();
    }

    // Authoritative unmount stream cleanup: halts ongoing HTTP range downloads and frees connection
    return () => {
      if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute("src");
        videoEl.load();
      }
    };
  }, [video.id, video.src, isActive]);

  // Sync mute state changes in-place on the DOM element without reloading or seeking
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Manual retry handler for failed streams
  const handleRetry = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const videoEl = videoRef.current;
    if (!videoEl) return;
    setHasError(false);
    setIsLoading(true);
    videoEl.load();
    videoEl.play().catch(() => {});
  }, []);

  // Audio Toggle Handler — strictly toggles sound only, preserves currentTime
  const handleMuteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const videoEl = videoRef.current;
    if (!videoEl) return;

    const nextMuted = !videoEl.muted;
    videoEl.muted = nextMuted;
    onToggleMute(nextMuted);
  }, [onToggleMute]);

  // Toggle Play / Pause on video tap (strictly does NOT open detail)
  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const videoEl = videoRef.current;
    if (!videoEl || !video.src) return;

    if (videoEl.paused) {
      videoEl.play().then(() => {
        setFeedbackType("play");
      }).catch(() => {});
    } else {
      videoEl.pause();
      setFeedbackType("pause");
    }

    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackType(null);
    }, 450);
  };

  return (
    <div
      className="relative h-full w-auto max-h-full max-w-full aspect-[9/16] sm:h-[530px] md:h-[570px] sm:max-h-[calc(100vh-140px)] sm:w-auto rounded-2xl overflow-hidden bg-black border border-white/15 dark:border-white/10 shadow-2xl flex items-center justify-center flex-shrink-0 select-none group cursor-pointer"
      onClick={handleTogglePlay}
      data-prevent-workspace-wheel="true"
    >
      {/* Underlying Poster Layer — remains visible while buffering */}
      {video.poster && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Image
            src={video.poster}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, 400px"
            className="object-contain w-full h-full"
            priority
          />
        </div>
      )}

      {/* Background Media / Native Video Element */}
      {video.src ? (
        <video
          ref={videoRef}
          key={video.id}
          src={video.src}
          poster={video.poster}
          loop
          playsInline
          preload="auto"
          muted={isMuted}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => {
            setIsLoading(false);
            setHasError(false);
          }}
          onCanPlay={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          className="relative z-10 w-full h-full object-contain bg-transparent pointer-events-none"
        />
      ) : (
        /* Preview / Poster Fallback */
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center bg-neutral-950 pointer-events-none">
          {video.poster ? (
            <Image
              src={video.poster}
              alt={title}
              fill
              sizes="320px"
              className="object-contain w-full h-full opacity-80"
              priority
            />
          ) : (
            <div className="w-full h-full bg-neutral-900" />
          )}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
            <div className="w-11 h-11 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-white text-sm shadow-lg mb-2">
              ▶
            </div>
            <span className="text-xs font-mono font-medium text-white/90">
              {locale === "tr" ? "Önizleme Modu" : "Preview Mode"}
            </span>
            <span className="text-[10px] font-mono text-white/60 mt-0.5">
              {video.duration || "9:16 HD"}
            </span>
          </div>
        </div>
      )}

      {/* Centered Buffering / Loading Indicator */}
      {isLoading && !hasError && video.src && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="w-9 h-9 rounded-full border-2 border-white/20 border-t-white animate-spin backdrop-blur-xs shadow-lg" />
        </div>
      )}

      {/* Stream Failure / Retry UI */}
      {hasError && video.src && (
        <div className="absolute inset-0 z-25 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs p-4 text-center">
          <p className="text-xs font-mono text-white/90 mb-2">
            {locale === "tr" ? "Video yüklenemedi" : "Failed to load video"}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="px-3 py-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white text-xs font-medium border border-white/30 backdrop-blur-md transition-all active:scale-95 cursor-pointer pointer-events-auto"
          >
            {locale === "tr" ? "Tekrar Dene" : "Retry"}
          </button>
        </div>
      )}

      {/* Transient Play / Pause Feedback Pulse Animation */}
      {feedbackType && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="w-12 h-12 rounded-full bg-black/55 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl animate-playpause-fade">
            {feedbackType === "play" ? (
              /* Clean Triangular Play SVG */
              <svg className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              /* Clean Two Vertical Pause Bars SVG */
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Top Bar Overlay (Category Badge on Left & Audio Mute on Right) */}
      <div className="absolute top-3.5 inset-x-3.5 flex items-center justify-between pointer-events-none z-20">
        {/* Category Badge */}
        <span
          className={`text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full backdrop-blur-md shadow-xs pointer-events-auto ${
            isAi
              ? "bg-blue-600/80 text-white border border-blue-400/30"
              : "bg-black/55 text-white/90 border border-white/20"
          }`}
        >
          {badgeLabel}
        </span>

        {/* Audio Mute/Unmute Button (Translucent Circle) */}
        {video.src && (
          <button
            type="button"
            onClick={handleMuteClick}
            aria-label={isMuted ? getTranslation(locale, "videos_feed_unmute") : getTranslation(locale, "videos_feed_mute")}
            title={isMuted ? getTranslation(locale, "videos_feed_unmute") : getTranslation(locale, "videos_feed_mute")}
            className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 active:scale-90 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-md transition-all pointer-events-auto cursor-pointer mr-11 sm:mr-0"
          >
            {isMuted ? (
              /* Speaker with Slash Icon */
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : (
              /* Sound Active Waves Icon */
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Mobile Navigation Arrows & Counter (Strictly below sm breakpoint) */}
      <div
        className="sm:hidden absolute right-2.5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-auto select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Up / Previous Reel Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (currentIndex > 0) onPrev();
          }}
          disabled={currentIndex === 0}
          aria-label={getTranslation(locale, "videos_feed_prev")}
          title={getTranslation(locale, "videos_feed_prev")}
          className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-200 cursor-pointer flex-shrink-0 ${
            currentIndex > 0
              ? "bg-black/50 hover:bg-black/75 active:scale-90 text-white border-white/25 shadow-md"
              : "bg-black/20 text-white/20 border-white/10 opacity-30 cursor-not-allowed"
          }`}
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
          </svg>
        </button>

        {/* Subtle Counter Pill */}
        <div
          className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-[10px] font-mono font-medium tabular-nums text-white/90 shadow-xs select-none inline-flex items-center justify-center whitespace-nowrap leading-none"
        >
          <span>{currentIndex + 1}</span>
          <span className="opacity-40 mx-0.5">/</span>
          <span className="opacity-60">{totalCount}</span>
        </div>

        {/* Down / Next Reel Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (currentIndex < totalCount - 1) onNext();
          }}
          disabled={currentIndex >= totalCount - 1}
          aria-label={getTranslation(locale, "videos_feed_next")}
          title={getTranslation(locale, "videos_feed_next")}
          className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-200 cursor-pointer flex-shrink-0 ${
            currentIndex < totalCount - 1
              ? "bg-black/50 hover:bg-black/75 active:scale-90 text-white border-white/25 shadow-md"
              : "bg-black/20 text-white/20 border-white/10 opacity-30 cursor-not-allowed"
          }`}
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>
      </div>

      {/* Bottom Minimal Portfolio Overlay (Title, Client · Year, Details CTA) */}
      <div
        className="absolute bottom-0 inset-x-0 pt-10 sm:pt-14 pb-2.5 sm:pb-3.5 px-3 sm:px-3.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex flex-col gap-1 z-20 pointer-events-auto"
        onClick={handleTogglePlay}
      >
        {/* Title */}
        <h2 className="text-xs sm:text-sm font-bold text-white leading-tight drop-shadow-md line-clamp-2">
          {title}
        </h2>

        {/* Client · Year */}
        {clientInfo && (
          <div className="text-[10px] sm:text-[11px] font-mono text-white/80 font-medium drop-shadow-xs">
            {clientInfo}
          </div>
        )}

        {/* Bottom Action Strip (Understated Details CTA) */}
        <div className="pt-1.5 flex items-center justify-between">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onOpenDetail(video);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-medium bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/25 shadow-xs transition-all cursor-pointer active:scale-95 pointer-events-auto"
          >
            <span>{getTranslation(locale, "videos_feed_details")}</span>
            <span className="text-[10px]">↗</span>
          </button>

          {video.duration && (
            <span className="text-[9px] font-mono text-white/60 bg-black/40 px-1.5 py-0.5 rounded border border-white/10">
              {video.duration}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
