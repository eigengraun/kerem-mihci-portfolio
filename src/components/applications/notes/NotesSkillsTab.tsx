"use client";

import React from "react";
import { profileData } from "@/data/profile";
import { Locale } from "@/data/translations";
import { toLocaleUpper } from "@/lib/casing";

interface NotesSkillsTabProps {
  locale: Locale;
  isLight: boolean;
}

export const NotesSkillsTab: React.FC<NotesSkillsTabProps> = ({ locale, isLight }) => {
  const isEn = locale === "en";
  const { skills } = profileData;

  const categories = [
    {
      titleTR: "TASARIM",
      titleEN: "DESIGN",
      icon: "🎨",
      items: skills.design.map((s) => (isEn ? s.en : s.tr))
    },
    {
      titleTR: "WEB",
      titleEN: "WEB",
      icon: "🌐",
      items: skills.web.map((s) => (isEn ? s.en : s.tr))
    },
    {
      titleTR: "PRODÜKSİYON",
      titleEN: "PRODUCTION",
      icon: "🎬",
      items: skills.production.map((s) => (isEn ? s.en : s.tr))
    },
    {
      titleTR: "AI & YARATICI ÜRETİM",
      titleEN: "AI & CREATIVE PRODUCTION",
      icon: "✨",
      items: skills.ai.map((s) => (isEn ? s.en : s.tr))
    },
    {
      titleTR: "DİJİTAL & STRATEJİ",
      titleEN: "DIGITAL & STRATEGY",
      icon: "📈",
      items: skills.strategy.map((s) => (isEn ? s.en : s.tr))
    },
    {
      titleTR: "ARAÇLAR & YAZILIMLAR",
      titleEN: "TOOLS & SOFTWARE",
      icon: "🛠️",
      items: skills.tools
    }
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div
        className={`border-b pb-2 flex items-center justify-between font-mono text-xs font-bold ${
          isLight ? "border-amber-300/80 text-amber-900" : "border-amber-500/30 text-amber-400"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span>⚙ {isEn ? "SKILLS" : "YETENEKLER"}</span>
        </span>
        <span className="text-[10px] font-mono opacity-60">skills.cfg</span>
      </div>

      {/* Category Groups Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {categories.map((cat, idx) => {
          const title = isEn ? cat.titleEN : cat.titleTR;

          return (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border flex flex-col justify-between transition-colors ${
                isLight
                  ? "bg-amber-50/50 border-amber-200/80"
                  : "bg-neutral-800/50 border-amber-500/20"
              }`}
            >
              <div>
                <h3
                  lang={locale}
                  className={`font-mono text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${
                    isLight ? "text-amber-900" : "text-amber-400"
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{toLocaleUpper(title, locale)}</span>
                </h3>

                <div className="flex flex-wrap gap-1.5">
                  {cat.items.map((item, itemIdx) => (
                    <span
                      key={itemIdx}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-sans font-medium border ${
                        isLight
                          ? "bg-white border-amber-200 text-neutral-800 shadow-2xs"
                          : "bg-neutral-800/90 border-amber-500/30 text-neutral-200"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      <span>{item}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
