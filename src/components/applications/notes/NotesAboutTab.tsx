"use client";

import React, { useState } from "react";
import Image from "next/image";
import { profileData } from "@/data/profile";
import { Locale } from "@/data/translations";
import { useSessionStore } from "@/store/sessionStore";

interface NotesAboutTabProps {
  locale: Locale;
  isLight: boolean;
}

export const NotesAboutTab: React.FC<NotesAboutTabProps> = ({ locale, isLight }) => {
  const [imgError, setImgError] = useState(false);
  const { sessionProfile, isCmsMode, phase5Degraded } = useSessionStore();
  const isEn = locale === "en";

  if (isCmsMode && phase5Degraded) {
    return (
      <div className="p-8 text-center space-y-2 font-mono">
        <div className="text-amber-400 text-xs font-bold">
          {isEn ? "PROFILE TEMPORARILY DEGRADED" : "PROFİL GEÇİCİ OLARAK KULLANILAMIYOR"}
        </div>
        <p className="text-xs text-[#A0A8B5]">
          {isEn
            ? "Upstream CMS service is experiencing technical difficulties. Please try again later."
            : "Üst düzey CMS servisinde teknik aksaklık yaşanıyor. Lütfen daha sonra tekrar deneyiniz."}
        </p>
      </div>
    );
  }

  if (isCmsMode && !sessionProfile) {
    return (
      <div className="p-8 text-center space-y-2 font-mono">
        <p className="text-xs text-[#A0A8B5]">
          {isEn ? "No published profile is currently available." : "Şu anda yayınlanmış bir profil bulunmuyor."}
        </p>
      </div>
    );
  }

  const name = isCmsMode ? sessionProfile!.name : profileData.name;
  const headline = isCmsMode
    ? (isEn ? sessionProfile!.headline?.en : sessionProfile!.headline?.tr) || ""
    : (isEn ? profileData.headlineEN : profileData.headlineTR);
  const location = isCmsMode
    ? (isEn ? sessionProfile!.location?.en : sessionProfile!.location?.tr) || ""
    : (isEn ? profileData.locationEN : profileData.locationTR);
  const alt = isCmsMode
    ? (isEn ? sessionProfile!.alt?.en : sessionProfile!.alt?.tr) || ""
    : (isEn ? profileData.altEN : profileData.altTR);

  const summaries = isCmsMode
    ? ((isEn ? sessionProfile!.summary?.en : sessionProfile!.summary?.tr) || [])
    : (isEn ? profileData.summaryEN : profileData.summaryTR);

  const focusAreas = isCmsMode
    ? ((isEn ? sessionProfile!.focusAreas?.en : sessionProfile!.focusAreas?.tr) || [])
    : (isEn ? profileData.focusAreasEN : profileData.focusAreasTR);

  const stats = isCmsMode
    ? (sessionProfile!.stats || [])
    : profileData.stats;

  const imageSrc = isCmsMode
    ? (sessionProfile!.image || sessionProfile!.avatar || "")
    : (profileData.image || profileData.avatar);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div
        className={`border-b pb-2 flex items-center justify-between font-mono text-xs font-bold ${
          isLight ? "border-amber-300/80 text-amber-900" : "border-amber-500/30 text-amber-400"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span>👤 {isEn ? "ABOUT" : "HAKKIMDA"}</span>
        </span>
        <span className="text-[10px] font-mono opacity-60">profile.md</span>
      </div>

      {/* Hero Bio Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
        {/* Profile Avatar / Monogram */}
        <div
          className={`relative w-24 h-28 sm:w-28 sm:h-32 rounded-xl overflow-hidden flex-shrink-0 border shadow-md flex items-center justify-center ${
            isLight
              ? "bg-amber-100 border-amber-300 text-amber-950"
              : "bg-neutral-800 border-amber-500/30 text-amber-400"
          }`}
        >
          {!imgError && imageSrc ? (
            <Image
              src={imageSrc}
              alt={alt}
              fill
              sizes="(max-width: 640px) 96px, 112px"
              className="object-cover object-top"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center font-mono">
              <span className="text-2xl font-bold tracking-tighter">KM</span>
              <span className="text-[9px] opacity-70">PORTFOLIO OS</span>
            </div>
          )}
        </div>

        {/* Identity & Headline */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <h2
            className={`text-lg sm:text-xl font-bold tracking-tight font-sans ${
              isLight ? "text-neutral-900" : "text-white"
            }`}
          >
            {name}
          </h2>
          <p className="font-mono text-xs text-amber-500 font-medium">{headline}</p>
          <div
            className={`flex items-center gap-2 text-xs font-mono opacity-80 ${
              isLight ? "text-neutral-600" : "text-neutral-300"
            }`}
          >
            <span>📍 {location}</span>
          </div>
        </div>
      </div>

      {/* Profile Summary Paragraphs */}
      <div className="space-y-3 font-sans text-xs md:text-[13px] leading-relaxed">
        {summaries.map((paragraph, idx) => (
          <p key={idx} className={isLight ? "text-neutral-700" : "text-neutral-300"}>
            {paragraph}
          </p>
        ))}
      </div>

      {/* Quick Stats Grid */}
      <div className="pt-2">
        <h3
          className={`font-mono text-[11px] font-bold uppercase tracking-wider mb-2.5 ${
            isLight ? "text-amber-900" : "text-amber-400"
          }`}
        >
          {isEn ? "QUICK FACTS" : "HIZLI BİLGİLER"}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-lg border flex flex-col justify-between transition-colors ${
                isLight
                  ? "bg-amber-50/70 border-amber-200/80"
                  : "bg-neutral-800/60 border-amber-500/20"
              }`}
            >
              <span className="font-mono text-base sm:text-lg font-bold text-amber-500">
                {stat.value}
              </span>
              <span
                className={`font-mono text-[10px] font-medium leading-tight mt-1 ${
                  isLight ? "text-neutral-700" : "text-neutral-400"
                }`}
              >
                {isEn ? stat.labelEN : stat.labelTR}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Focus Areas */}
      <div className="pt-2">
        <h3
          className={`font-mono text-[11px] font-bold uppercase tracking-wider mb-2.5 ${
            isLight ? "text-amber-900" : "text-amber-400"
          }`}
        >
          {isEn ? "PRIMARY FOCUS AREAS" : "ODAK ALANLARI"}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {focusAreas.map((area, idx) => (
            <span
              key={idx}
              className={`px-2.5 py-1 rounded text-xs font-sans font-medium border ${
                isLight
                  ? "bg-white border-amber-200 text-neutral-800 shadow-2xs"
                  : "bg-neutral-800/80 border-amber-500/20 text-neutral-200"
              }`}
            >
              {area}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
