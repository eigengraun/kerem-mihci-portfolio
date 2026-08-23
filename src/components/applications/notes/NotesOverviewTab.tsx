"use client";

import React from "react";
import { profileData } from "@/data/profile";
import { Locale } from "@/data/translations";

interface NotesOverviewTabProps {
  locale: Locale;
  isLight: boolean;
}

export const NotesOverviewTab: React.FC<NotesOverviewTabProps> = ({ locale, isLight }) => {
  const { notes } = profileData;
  const title = locale === "en" ? notes.titleEN : notes.titleTR;
  const items = locale === "en" ? notes.itemsEN : notes.itemsTR;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div
        className={`border-b pb-2 flex items-center justify-between font-mono text-xs font-bold ${
          isLight ? "border-amber-300/80 text-amber-900" : "border-amber-500/30 text-amber-400"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span>{title}</span>
        </span>
        <span className="text-[10px] font-mono opacity-60">{notes.filename}</span>
      </div>

      {/* Items List */}
      <ul className="space-y-2.5 font-mono text-xs leading-relaxed">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2.5">
            <span
              className={`flex-shrink-0 font-bold ${
                isLight ? "text-amber-700 opacity-80" : "text-amber-500 opacity-90"
              }`}
            >
              —
            </span>
            <span className={isLight ? "text-neutral-800" : "text-neutral-200"}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
