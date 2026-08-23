"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { profileData } from "@/data/profile";
import { Locale } from "@/data/translations";
import { isDesktopEntryEligible } from "@/lib/deviceEligibility";
import { getEntryBypassStatus, markPortfolioEntered } from "@/lib/entryStorage";

export type DesktopEntryStage = "checking" | "boot" | "login" | "entering" | "desktop";

interface DesktopPortfolioEntryProps {
  locale: Locale;
  onStageChange?: (stage: DesktopEntryStage) => void;
  onComplete?: () => void;
}

export const DesktopPortfolioEntry: React.FC<DesktopPortfolioEntryProps> = ({
  locale,
  onStageChange,
  onComplete
}) => {
  const [stage, setStage] = useState<DesktopEntryStage>("checking");
  const [videoFading, setVideoFading] = useState(false);
  const [loginVisible, setLoginVisible] = useState(false);
  const [imgError, setImgError] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const stageRef = useRef<DesktopEntryStage>("checking");

  const isEn = locale === "en";

  // Keep stageRef updated
  const updateStage = useCallback(
    (newStage: DesktopEntryStage) => {
      stageRef.current = newStage;
      setStage(newStage);
      onStageChange?.(newStage);
      if (newStage === "desktop") {
        onComplete?.();
      }
    },
    [onStageChange, onComplete]
  );

  // Initial Device Eligibility, 24-Hour Bypass & Reduced Motion Check on Mount
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      // 1. Strict desktop-only check
      const eligible = isDesktopEntryEligible();
      if (!eligible) {
        updateStage("desktop");
        return;
      }

      // 2. 24-Hour Desktop Login Bypass Check
      const canBypass = getEntryBypassStatus();
      if (canBypass) {
        updateStage("desktop");
        return;
      }

      // 3. Check prefers-reduced-motion
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) {
        updateStage("login");
        setLoginVisible(true);
        return;
      }

      // 4. Eligible desktop with no valid bypass and motion enabled -> start boot
      updateStage("boot");
    });

    return () => cancelAnimationFrame(frameId);
  }, [updateStage]);

  // Set 1.75x playback rate on video element
  const applyPlaybackRate = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.defaultPlaybackRate = 1.75;
      videoRef.current.playbackRate = 1.75;
    }
  }, []);

  // Handle Video Completion / Fallback
  const handleVideoEnded = useCallback(() => {
    if (stageRef.current !== "boot") return;
    setVideoFading(true);
    // Smooth 150ms crossfade from video to matching static final frame
    setTimeout(() => {
      updateStage("login");
      // Trigger staggered UI entrance
      setTimeout(() => {
        setLoginVisible(true);
      }, 50);
    }, 150);
  }, [updateStage]);

  const handleVideoError = useCallback(() => {
    console.warn("Boot video playback failed, falling back directly to login.");
    updateStage("login");
    setLoginVisible(true);
  }, [updateStage]);

  // Safety timer for 1.75x video (4.04s / 1.75 = ~2.31s, safety timeout at 3200ms)
  useEffect(() => {
    if (stage === "boot") {
      const timer = setTimeout(() => {
        if (stageRef.current === "boot") {
          handleVideoEnded();
        }
      }, 3200);
      return () => clearTimeout(timer);
    }
  }, [stage, handleVideoEnded]);

  // Auto-focus button when login appears
  useEffect(() => {
    if (stage === "login" && loginVisible) {
      const timer = setTimeout(() => {
        buttonRef.current?.focus();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [stage, loginVisible]);

  // Handle Enter Action
  const handleEnter = useCallback(() => {
    if (stageRef.current !== "login") return;
    updateStage("entering");

    // Smooth 550ms fadeout transition into Desktop OS
    setTimeout(() => {
      // Mark successful desktop entry in localStorage (persists for 24 hours)
      markPortfolioEntered();
      updateStage("desktop");
    }, 550);
  }, [updateStage]);

  // Global Keyboard Listener for Enter Key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (stageRef.current === "login" && e.key === "Enter") {
        e.preventDefault();
        handleEnter();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleEnter]);

  // If not eligible (mobile/tablet) or already entered desktop, unmount completely
  if (stage === "desktop") {
    return null;
  }

  // Initial checking state: render a clean neutral backdrop for a fraction of a millisecond
  if (stage === "checking") {
    return (
      <div
        className="fixed inset-0 z-[99999] bg-[#07090E] pointer-events-none"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      data-workspace-scroll-lock="true"
      data-prevent-workspace-wheel="true"
      className={`fixed inset-0 z-[99999] overflow-hidden select-none bg-[#07090E] transition-all duration-550 ${
        stage === "entering"
          ? "opacity-0 pointer-events-none"
          : "opacity-100"
      }`}
      aria-label="Portfolio OS Entry"
    >
      {/* 1. Static Final-Frame Background Layer (preloaded, sitting underneath the video) */}
      <div
        className={`absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat pointer-events-none transition-all duration-500 ${
          stage === "entering" ? "scale-105 blur-[2px]" : "scale-100 blur-none"
        }`}
        style={{
          backgroundImage: "url(/intro/portfolio-login-background.webp)"
        }}
      />

      {/* 2. Boot Video Layer (plays once at 1.75x speed ~2.31s, then fades out seamlessly into static background) */}
      {stage === "boot" && (
        <video
          ref={videoRef}
          src="/intro/portfolio-boot-desktop.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={applyPlaybackRate}
          onPlay={applyPlaybackRate}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          className={`absolute inset-0 w-full h-full object-cover object-center pointer-events-none transition-opacity duration-150 ${
            videoFading ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden="true"
        />
      )}

      {/* 3. Modern Centered Login Interface Layer */}
      {(stage === "login" || stage === "entering") && (
        <div
          className={`absolute inset-0 flex items-center justify-center p-4 transition-all duration-400 ease-out ${
            stage === "entering"
              ? "opacity-0 scale-[0.985] -translate-y-2 pointer-events-none"
              : "opacity-100 scale-100 translate-y-0"
          }`}
        >
          {/* Centered Modern Identity Module (within the celestial arc) */}
          <div className="relative w-full max-w-[310px] sm:max-w-[330px] flex flex-col items-center text-center p-6 sm:p-7 rounded-[26px] bg-[#080d18]/35 border border-white/10 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.4)] transition-all duration-500">
            
            {/* Real Canonical Profile Avatar (Stagger Step 1: ~80ms) */}
            <div
              className={`relative w-23 h-23 sm:w-24 sm:h-24 rounded-full overflow-hidden border border-white/25 shadow-[0_10px_35px_rgba(0,0,0,0.35)] bg-neutral-900/80 flex items-center justify-center p-0.5 transition-all duration-450 ease-out ${
                loginVisible
                  ? "opacity-100 scale-100 translate-y-0"
                  : "opacity-0 scale-95 translate-y-2"
              }`}
            >
              {!imgError && (profileData.avatar || profileData.image) ? (
                <Image
                  src={profileData.avatar || profileData.image}
                  alt={isEn ? profileData.altEN : profileData.altTR}
                  fill
                  sizes="96px"
                  className="object-cover object-top rounded-full"
                  priority
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center font-mono text-amber-300">
                  <span className="text-xl font-bold tracking-tighter">KM</span>
                </div>
              )}
            </div>

            {/* User Name (Stagger Step 2: ~150ms) */}
            <div
              className={`mt-3.5 space-y-1 transition-all duration-450 delay-75 ease-out ${
                loginVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2"
              }`}
            >
              <h1 className="text-[21px] sm:text-[22px] font-semibold tracking-[-0.01em] text-[#f8f8f6] drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] font-sans">
                {profileData.name}
              </h1>
            </div>

            {/* Portfolio OS Badge Capsule (Stagger Step 3: ~210ms) */}
            <div
              className={`mt-1.5 inline-flex items-center gap-1.5 h-[24px] px-3 rounded-full border border-white/10 bg-white/5 transition-all duration-450 delay-150 ease-out ${
                loginVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300/80 shadow-[0_0_6px_rgba(252,211,77,0.6)]" />
              <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-[#e1dcd3]/85 font-medium">
                Portfolio OS
              </span>
            </div>

            {/* Modern Action Button (Stagger Step 4: ~280ms) */}
            <div
              className={`mt-5 w-full transition-all duration-450 delay-200 ease-out ${
                loginVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2"
              }`}
            >
              <button
                ref={buttonRef}
                type="button"
                onClick={handleEnter}
                className="group relative w-full h-[45px] px-5 rounded-[15px] bg-[#f5eee1]/95 hover:bg-[#ffffff] text-[#16191f] font-sans text-[13px] font-semibold tracking-wide flex items-center justify-between shadow-[0_6px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_25px_rgba(245,238,225,0.25)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-amber-300/50"
              >
                <span>{isEn ? "Enter Portfolio" : "Oturum Aç"}</span>
                <div className="w-6 h-6 rounded-full bg-[#16191f]/10 flex items-center justify-center transition-transform duration-200 group-hover:translate-x-1">
                  <svg
                    className="w-3.5 h-3.5 text-[#16191f]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
