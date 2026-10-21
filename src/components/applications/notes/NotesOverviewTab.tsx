"use client";

import React from "react";
import { profileData } from "@/data/profile";
import { workspaceNotes } from "@/data/notes";
import { Locale } from "@/data/translations";
import { useDesktopStore } from "@/store/desktopStore";
import { useSessionStore } from "@/store/sessionStore";

interface NotesOverviewTabProps {
  locale: Locale;
  isLight: boolean;
}

export const NotesOverviewTab: React.FC<NotesOverviewTabProps> = ({ locale, isLight }) => {
  const { activeWorkspace } = useDesktopStore();
  const { sessionWorkspaceNotes, isCmsMode, phase5Degraded } = useSessionStore();
  const isEn = locale === "en";

  const workspaceLabel = activeWorkspace.toUpperCase();

  if (isCmsMode && phase5Degraded) {
    return (
      <div className="p-8 text-center space-y-2 font-mono">
        <div className="text-amber-400 text-xs font-bold">
          {isEn ? "NOTES TEMPORARILY DEGRADED" : "NOTLAR GEÇİCİ OLARAK KULLANILAMIYOR"}
        </div>
        <p className="text-xs text-[#A0A8B5]">
          {isEn
            ? "Upstream CMS service is experiencing technical difficulties. Please try again later."
            : "Üst düzey CMS servisinde teknik aksaklık yaşanıyor. Lütfen daha sonra tekrar deneyiniz."}
        </p>
      </div>
    );
  }

  const cmsNotes = sessionWorkspaceNotes[activeWorkspace] || [];

  if (isCmsMode) {
    if (cmsNotes.length === 0) {
      return (
        <div className="p-8 text-center space-y-2 font-mono">
          <p className="text-xs text-[#A0A8B5]">
            {isEn
              ? `No published notes for "${activeWorkspace}" workspace.`
              : `"${activeWorkspace}" çalışma alanı için yayınlanmış not bulunmuyor.`}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* Header Bar */}
        <div
          className={`border-b pb-2 flex items-center justify-between font-mono text-xs font-bold ${
            isLight ? "border-amber-300/80 text-amber-900" : "border-amber-500/30 text-amber-400"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span>{isEn ? "NOTES — GENERAL" : "NOTLAR — GENEL"}</span>
            <span className="text-[10px] font-mono opacity-60">[{workspaceLabel}]</span>
          </span>
          <span className="text-[10px] font-mono opacity-60">system.txt</span>
        </div>

        {/* Notes List */}
        <div className="space-y-3 font-mono text-xs leading-relaxed">
          {cmsNotes.map((note) => {
            const noteTitle = isEn ? (note.title.en || note.title.tr) : (note.title.tr || note.title.en);
            const noteContent = isEn ? (note.content.en || note.content.tr) : (note.content.tr || note.content.en);

            return (
              <div key={note.id} className="space-y-1">
                <div
                  className={`flex items-center justify-between text-[11px] font-semibold opacity-90 ${
                    isLight ? "text-amber-800" : "text-amber-300"
                  }`}
                >
                  <span>{noteTitle}</span>
                  <span className="text-[10px] opacity-60">{note.filename}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-amber-500 select-none opacity-60">&gt;</span>
                  <span className={isLight ? "text-neutral-800" : "text-neutral-200"}>{noteContent}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Legacy mode:
  const fallbackNotes = workspaceNotes[activeWorkspace as keyof typeof workspaceNotes] || profileData.notes;
  const fallbackTitle = isEn ? fallbackNotes.titleEN : fallbackNotes.titleTR;
  const fallbackItems = isEn ? fallbackNotes.itemsEN : fallbackNotes.itemsTR;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div
        className={`border-b pb-2 flex items-center justify-between font-mono text-xs font-bold ${
          isLight ? "border-amber-300/80 text-amber-900" : "border-amber-500/30 text-amber-400"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span>{fallbackTitle}</span>
          <span className="text-[10px] font-mono opacity-60">[{workspaceLabel}]</span>
        </span>
        <span className="text-[10px] font-mono opacity-60">system.txt</span>
      </div>

      <div className="space-y-3 font-mono text-xs leading-relaxed">
        {fallbackItems.map((item, index) => (
          <div key={index} className="flex items-start gap-2.5">
            <span className="text-amber-500 select-none opacity-60">&gt;</span>
            <span className={isLight ? "text-neutral-800" : "text-neutral-200"}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
