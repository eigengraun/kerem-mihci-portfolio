"use client";

import React from "react";
import Image from "next/image";
import { useDesktopStore } from "@/store/desktopStore";
import { getTranslation } from "@/lib/i18n";

const discardedFiles = [
  { name: "final_final_v7.psd", size: "42.8 MB", date: "24 Oct 2024" },
  { name: "final_FINAL_really_final.psd", size: "128.4 MB", date: "12 Nov 2024" },
  { name: "unused-gradient-blob.ai", size: "14.2 MB", date: "05 Dec 2024" },
  { name: "revision_27_notes.txt", size: "4.1 KB", date: "18 Jan 2025" },
  { name: "definitely-not-final-render.mov", size: "210.5 MB", date: "02 Feb 2025" },
  { name: "old-concepts-archive/", size: "--", date: "10 Feb 2025" },
  { name: "logo_concept_v12_alt.ai", size: "18.6 MB", date: "20 Feb 2025" }
];

export const TrashApp: React.FC = () => {
  const { locale } = useDesktopStore();

  return (
    <div className="space-y-4 text-xs text-[var(--app-text-primary)]">
      {/* Header Info Box */}
      <div className="flex items-center gap-3 p-3 bg-[var(--app-surface-raised)] rounded-lg border border-[var(--app-border)] shadow-xs transition-colors duration-200">
        <div className="relative w-10 h-10 flex-shrink-0">
          <Image
            src="/assets/apps/system/trash-full.png"
            alt="Trash"
            width={40}
            height={40}
            className="w-full h-full object-contain"
          />
        </div>

        <div>
          <h1 className="font-bold text-[var(--app-text-primary)] text-sm">
            {getTranslation(locale, "trash_alert_title")}
          </h1>
          <p className="text-[11px] font-mono text-[var(--app-text-secondary)] italic mt-0.5">
            &quot;{locale === "tr" ? "Bazı fikirlerin burada kalması daha iyi oldu." : "Some ideas were better left here."}&quot;
          </p>
        </div>
      </div>


      {/* Discarded Files Finder Rows */}
      <div className="bg-[var(--app-surface-raised)] rounded-lg border border-[var(--app-border)] overflow-hidden font-mono text-[11px] select-none transition-colors duration-200">
        <div className="grid grid-cols-12 px-3 py-1.5 bg-[var(--app-surface-subtle)] font-semibold text-[var(--app-text-muted)] border-b border-[var(--app-divider)]">
          <span className="col-span-6">Dosya Adı / Name</span>
          <span className="col-span-3 text-right">Boyut / Size</span>
          <span className="col-span-3 text-right">Tarih / Date</span>
        </div>

        <div className="divide-y divide-[var(--app-divider)]">
          {discardedFiles.map((file, idx) => (
            <div
              key={idx}
              className="grid grid-cols-12 px-3 py-2 hover:bg-red-500/10 text-[var(--app-text-primary)] transition-colors items-center"
            >
              <span className="col-span-6 font-medium truncate flex items-center gap-1.5">
                <span className="opacity-60">🗑️</span> {file.name}
              </span>
              <span className="col-span-3 text-right text-[var(--app-text-secondary)]">{file.size}</span>
              <span className="col-span-3 text-right text-[var(--app-text-secondary)]">{file.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
