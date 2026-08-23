"use client";

import React, { useState } from "react";
import Image from "next/image";
import { GalleryItem } from "@/data/gallery";
import { useDesktopStore } from "@/store/desktopStore";
import { useSessionStore } from "@/store/sessionStore";
import { getTranslation } from "@/lib/i18n";

export const GalleryApp: React.FC = () => {
  const { locale } = useDesktopStore();
  const { sessionGallery } = useSessionStore();
  const [failedImageIds, setFailedImageIds] = useState<Record<string, boolean>>({});

  const handleImageError = (id: string) => {
    setFailedImageIds((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="flex flex-col h-full min-h-[460px] bg-[var(--app-surface)] text-[var(--app-text-primary)] select-none transition-colors duration-200">
      {/* Native macOS Information Header */}
      <div className="px-5 py-4 border-b border-[var(--app-divider)] bg-[var(--app-surface-subtle)] flex items-center gap-3.5 transition-colors duration-200">
        <div className="relative w-11 h-11 md:w-12 md:h-12 flex-shrink-0 rounded-[10px] overflow-hidden shadow-xs border border-black/10">
          <Image
            src="/assets/apps/system/photos.png"
            alt=""
            fill
            className="object-cover"
            sizes="48px"
            priority
          />
        </div>
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold tracking-tight text-[var(--app-text-primary)]">
            {getTranslation(locale, "gallery_header_title")}
          </h1>
          <p className="text-xs text-[var(--app-text-muted)] font-medium mt-0.5">
            {getTranslation(locale, "gallery_header_subtitle")}
          </p>
        </div>
      </div>

      {/* Preview Section Header */}
      <div className="px-5 pt-3 pb-1 flex items-center gap-1 text-xs font-medium text-[var(--app-text-muted)]">
        <span>⌄</span>
        <span>{getTranslation(locale, "gallery_preview_label")}</span>
      </div>

      {/* Gallery Feed Container with Internal Scroll */}
      <div className="flex-1 p-5 overflow-y-auto app-scrollbar">
        {sessionGallery.length === 0 ? (
          /* Native Empty State */
          <div className="my-8 p-8 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-raised)] text-center flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[var(--app-surface-subtle)] border border-[var(--app-border)] flex items-center justify-center text-[var(--app-text-muted)] text-base font-mono">
              📷
            </div>
            <h2 className="text-xs font-semibold text-[var(--app-text-primary)] mt-1">
              {getTranslation(locale, "gallery_empty_title")}
            </h2>
            <p className="text-[11px] text-[var(--app-text-muted)] max-w-xs leading-relaxed font-mono">
              {getTranslation(locale, "gallery_empty_description")}
            </p>
          </div>
        ) : (
          /* Single Vertical Image Stream */
          <div className="flex flex-col gap-4">
            {sessionGallery.map((item: GalleryItem) => {
              const altText = locale === "tr" ? item.alt.tr : item.alt.en;
              const captionText = item.caption ? (locale === "tr" ? item.caption.tr : item.caption.en) : undefined;
              const hasFailed = failedImageIds[item.id];

              const metaInfo = [item.location, item.year].filter(Boolean).join(" · ");

              return (
                <div
                  key={item.id}
                  className="flex flex-col rounded-[10px] overflow-hidden border border-[var(--app-border)] bg-[var(--app-surface-raised)] transition-all duration-200"
                >
                  {/* Photo Frame preserving natural aspect ratio */}
                  <div className="relative w-full bg-black/5 flex items-center justify-center">
                    {!hasFailed ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.src}
                        alt={altText}
                        loading="lazy"
                        onError={() => handleImageError(item.id)}
                        className="w-full h-auto object-contain rounded-t-[9px] block max-h-[700px]"
                      />
                    ) : (
                      <div className="p-8 text-center text-xs font-mono text-[var(--app-text-muted)] bg-[var(--app-surface-subtle)] w-full">
                        {getTranslation(locale, "gallery_media_unavailable")} ({altText})
                      </div>
                    )}
                  </div>

                  {/* Caption & Metadata Row */}
                  {(captionText || metaInfo) && (
                    <div className="p-3 bg-[var(--app-surface-subtle)] border-t border-[var(--app-divider)] flex flex-col gap-0.5 text-left">
                      {captionText && (
                        <p className="text-xs text-[var(--app-text-primary)] font-mono leading-relaxed">
                          {captionText}
                        </p>
                      )}
                      {metaInfo && (
                        <span className="text-[10px] text-[var(--app-text-muted)] font-mono">
                          {metaInfo}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
