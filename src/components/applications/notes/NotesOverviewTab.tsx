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
  const { sessionWorkspaceNotes } = useSessionStore();

  const cmsNotes = sessionWorkspaceNotes[activeWorkspace] || [];
  const hasCmsNotes = cmsNotes.length > 0;

  const fallbackNotes = workspaceNotes[activeWorkspace as keyof typeof workspaceNotes] || profileData.notes;
  const fallbackTitle = locale === "en" ? fallbackNotes.titleEN : fallbackNotes.titleTR;
  const fallbackItems = locale === "en" ? fallbackNotes.itemsEN : fallbackNotes.itemsTR;

  const workspaceLabel = activeWorkspace.toUpperCase();

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Bar */}
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

      {/* Notes List */}
      {hasCmsNotes ? (
        <div className="space-y-3 font-mono text-xs leading-relaxed">
          {cmsNotes.map((note) => {
            const noteTitle = locale === "en" ? (note.title.en || note.title.tr) : (note.title.tr || note.title.en);
            const noteContent = locale === "en" ? (note.content.en || note.content.tr) : (note.content.tr || note.content.en);

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
                  <span
                    className={`flex-shrink-0 font-bold ${
                      isLight ? "text-amber-700 opacity-80" : "text-amber-500 opacity-90"
                    }`}
                  >
                    —
                  </span>
                  <span className={isLight ? "text-neutral-800" : "text-neutral-200"}>
                    {noteContent}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-2.5 font-mono text-xs leading-relaxed">
          {fallbackItems.map((item, idx) => (
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
      )}
    </div>
  );
};
