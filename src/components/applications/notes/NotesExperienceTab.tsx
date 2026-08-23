"use client";

import React from "react";
import { profileData } from "@/data/profile";
import { Locale } from "@/data/translations";

interface NotesExperienceTabProps {
  locale: Locale;
  isLight: boolean;
}

export const NotesExperienceTab: React.FC<NotesExperienceTabProps> = ({ locale, isLight }) => {
  const isEn = locale === "en";
  const { experience } = profileData;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div
        className={`border-b pb-2 flex items-center justify-between font-mono text-xs font-bold ${
          isLight ? "border-amber-300/80 text-amber-900" : "border-amber-500/30 text-amber-400"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span>💼 {isEn ? "EXPERIENCE" : "DENEYİM"}</span>
        </span>
        <span className="text-[10px] font-mono opacity-60">experience.log</span>
      </div>

      {/* Experience Feed */}
      <div className="space-y-3">
        {experience.map((item) => {
          const role = isEn ? item.roleEN : item.roleTR;
          const endDate = isEn ? item.endDateEN : item.endDateTR;
          const description = isEn ? item.descriptionEN : item.descriptionTR;
          const dateRange = `${item.startDate} — ${endDate}`;

          return (
            <div
              key={item.id}
              className={`p-3.5 sm:p-4 rounded-xl border transition-colors ${
                isLight
                  ? "bg-amber-50/50 border-amber-200/80"
                  : "bg-neutral-800/50 border-amber-500/20"
              }`}
            >
              {/* Role & Date Header */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1">
                <h3
                  className={`font-sans text-sm font-bold tracking-tight ${
                    isLight ? "text-neutral-900" : "text-white"
                  }`}
                >
                  {role}
                </h3>
                <span className="font-mono text-[11px] font-semibold text-amber-500 flex-shrink-0">
                  {dateRange}
                </span>
              </div>

              {/* Organization */}
              <div
                className={`font-mono text-xs font-medium mb-2.5 opacity-90 ${
                  isLight ? "text-neutral-700" : "text-neutral-300"
                }`}
              >
                🏢 {item.organization}
              </div>

              {/* Description */}
              <p
                className={`font-sans text-xs leading-relaxed mb-3 ${
                  isLight ? "text-neutral-700" : "text-neutral-300"
                }`}
              >
                {description}
              </p>

              {/* Skill Chips */}
              {item.skills && item.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {item.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
                        isLight
                          ? "bg-white border-amber-200 text-amber-900"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      }`}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
