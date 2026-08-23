"use client";

import React from "react";
import { Locale } from "@/data/translations";

export type NotesTabId = "notes" | "about" | "experience" | "education" | "skills" | "cv";

interface NotesTabNavProps {
  activeTab: NotesTabId;
  onSelectTab: (tab: NotesTabId) => void;
  locale: Locale;
  isLight: boolean;
}

interface TabItem {
  id: NotesTabId;
  labelTR: string;
  labelEN: string;
}

const TABS: TabItem[] = [
  { id: "notes", labelTR: "NOTLAR", labelEN: "NOTES" },
  { id: "about", labelTR: "HAKKIMDA", labelEN: "ABOUT" },
  { id: "experience", labelTR: "DENEYİM", labelEN: "EXPERIENCE" },
  { id: "education", labelTR: "EĞİTİM", labelEN: "EDUCATION" },
  { id: "skills", labelTR: "YETENEKLER", labelEN: "SKILLS" },
  { id: "cv", labelTR: "CV", labelEN: "CV" }
];

export const NotesTabNav: React.FC<NotesTabNavProps> = ({
  activeTab,
  onSelectTab,
  locale,
  isLight
}) => {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={`sticky top-0 z-10 flex items-center gap-1 px-3 py-1.5 overflow-x-auto overflow-y-hidden select-none border-b transition-colors duration-200 no-scrollbar ${
        isLight
          ? "bg-[#FFFDF5]/95 backdrop-blur-md border-amber-200/80 text-neutral-600"
          : "bg-[#2A2725]/95 backdrop-blur-md border-amber-500/20 text-neutral-400"
      }`}
      style={{
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        touchAction: "pan-x"
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const label = locale === "en" ? tab.labelEN : tab.labelTR;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`px-3 py-1 rounded text-[11px] md:text-xs font-mono font-semibold tracking-wider whitespace-nowrap transition-all duration-150 cursor-pointer flex-shrink-0 relative ${
              isActive
                ? isLight
                  ? "bg-amber-100/90 text-amber-950 border-b-2 border-amber-600 font-bold"
                  : "bg-amber-500/20 text-amber-300 border-b-2 border-amber-400 font-bold"
                : isLight
                  ? "hover:text-neutral-900 hover:bg-amber-50/60 text-neutral-600"
                  : "hover:text-neutral-200 hover:bg-white/5 text-neutral-400"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
