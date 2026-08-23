"use client";

import React from "react";
import { profileData } from "@/data/profile";
import { Locale } from "@/data/translations";

interface NotesEducationTabProps {
  locale: Locale;
  isLight: boolean;
}

export const NotesEducationTab: React.FC<NotesEducationTabProps> = ({ locale, isLight }) => {
  const isEn = locale === "en";
  const { education } = profileData;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div
        className={`border-b pb-2 flex items-center justify-between font-mono text-xs font-bold ${
          isLight ? "border-amber-300/80 text-amber-900" : "border-amber-500/30 text-amber-400"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span>🎓 {isEn ? "EDUCATION" : "EĞİTİM"}</span>
        </span>
        <span className="text-[10px] font-mono opacity-60">education.txt</span>
      </div>

      {/* Education Feed */}
      <div className="space-y-3">
        {education.map((item) => {
          const institution = isEn ? item.institutionEN : item.institutionTR;
          const program = isEn ? item.programEN : item.programTR;
          const endYear = isEn ? item.endYearEN : item.endYearTR;
          const description = isEn ? item.descriptionEN : item.descriptionTR;
          const status = isEn ? item.statusEN : item.statusTR;
          const dateRange = item.startYear && endYear ? `${item.startYear} — ${endYear}` : endYear || item.startYear;

          return (
            <div
              key={item.id}
              className={`p-3.5 sm:p-4 rounded-xl border transition-colors ${
                isLight
                  ? "bg-amber-50/50 border-amber-200/80"
                  : "bg-neutral-800/50 border-amber-500/20"
              }`}
            >
              {/* Program & Date Header */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1">
                <h3
                  className={`font-sans text-sm font-bold tracking-tight ${
                    isLight ? "text-neutral-900" : "text-white"
                  }`}
                >
                  {program}
                </h3>
                {dateRange && (
                  <span className="font-mono text-[11px] font-semibold text-amber-500 flex-shrink-0">
                    {dateRange}
                  </span>
                )}
              </div>

              {/* Institution */}
              <div
                className={`font-mono text-xs font-medium mb-2.5 opacity-90 ${
                  isLight ? "text-neutral-700" : "text-neutral-300"
                }`}
              >
                🏫 {institution}
              </div>

              {/* Status Badge */}
              {status && (
                <div className="mb-2.5">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
                      isLight
                        ? "bg-amber-100/80 border-amber-300 text-amber-950"
                        : "bg-amber-500/20 border-amber-500/30 text-amber-300"
                    }`}
                  >
                    {status}
                  </span>
                </div>
              )}

              {/* Description */}
              {description && (
                <p
                  className={`font-sans text-xs leading-relaxed ${
                    isLight ? "text-neutral-700" : "text-neutral-300"
                  }`}
                >
                  {description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
