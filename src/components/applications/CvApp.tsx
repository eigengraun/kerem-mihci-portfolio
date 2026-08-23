"use client";

import React from "react";
import { useDesktopStore } from "@/store/desktopStore";
import { siteConfig } from "@/data/site";
import { skillsList } from "@/data/about";
import { getTranslation } from "@/lib/i18n";
import { toLocaleUpper } from "@/lib/casing";

export const CvApp: React.FC = () => {
  const { locale } = useDesktopStore();

  return (
    <div className="p-6 bg-white/90 rounded-lg border border-black/10 shadow-sm space-y-6 text-neutral-800">
      {/* Header Document Section */}
      <div className="border-b border-black/15 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">{siteConfig.owner}</h1>
          <p className="text-xs font-mono text-neutral-600 mt-1">
            {(locale === "tr" ? siteConfig.rolesTR : siteConfig.rolesEN).join(" • ")}
          </p>
          <p className="text-xs font-mono text-neutral-500 mt-0.5">
            📍 {locale === "tr" ? siteConfig.locationTR : siteConfig.locationEN} | ✉ {siteConfig.email}
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.open(`mailto:${siteConfig.email}`, "_blank")}
          className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-mono font-medium hover:bg-neutral-800 transition-colors"
        >
          {getTranslation(locale, "cv_download_button")}
        </button>
      </div>

      {/* Profile Section */}
      <div className="space-y-2">
        <h2 lang={locale} className="text-sm font-bold text-neutral-900 uppercase tracking-wider font-mono border-b border-black/10 pb-1">
          {toLocaleUpper(getTranslation(locale, "cv_profile_heading"), locale)}
        </h2>
        <p className="text-xs leading-relaxed text-neutral-700">
          {locale === "tr"
            ? "Dijital dünyada tasarım, web, marka kimliği ve yaratıcı üretimi bir araya getirerek amaca hizmet eden çözümler geliştiren multi-disipliner kreatif profesyonel."
            : "Multidisciplinary creative professional combining design, web engineering, brand identity, and creative production to build purposeful solutions."}
        </p>
      </div>

      {/* Skills Checklist */}
      <div className="space-y-2">
        <h2 lang={locale} className="text-sm font-bold text-neutral-900 uppercase tracking-wider font-mono border-b border-black/10 pb-1">
          {toLocaleUpper(getTranslation(locale, "cv_skills_heading"), locale)}
        </h2>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {skillsList.map((skill, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded bg-neutral-100 border border-black/10 text-neutral-800 font-medium"
            >
              {locale === "tr" ? skill.nameTR : skill.nameEN}
            </span>
          ))}
        </div>
      </div>

      {/* Verified Experience Note */}
      <div className="space-y-2">
        <h2 lang={locale} className="text-sm font-bold text-neutral-900 uppercase tracking-wider font-mono border-b border-black/10 pb-1">
          {toLocaleUpper(getTranslation(locale, "about_tab_exp"), locale)}
        </h2>
        <p className="text-xs font-mono text-neutral-500 italic bg-neutral-50 p-3 rounded border border-black/5">
          {getTranslation(locale, "exp_updating")}
        </p>
      </div>
    </div>
  );
};
