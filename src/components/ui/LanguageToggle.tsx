"use client";

import React, { useState } from "react";
import { useDesktopStore } from "@/store/desktopStore";
import { Locale } from "@/data/translations";
import { AnalyticsSettingsModal } from "@/components/analytics/AnalyticsSettingsModal";

export const LanguageToggle: React.FC = () => {
  const { locale, setLocale, theme, toggleTheme } = useDesktopStore();
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  const setLang = (target: Locale) => {
    if (locale !== target) {
      setLocale(target);
    }
  };

  const isLight = theme === "light";

  return (
    <>
      <div
        data-prevent-workspace-wheel="true"
        data-workspace-scroll-lock="true"
        className="fixed top-4 right-5 z-40 flex items-center gap-2.5 select-none text-[11px] font-mono tracking-wider pointer-events-auto"
      >
        {/* TR / EN Language Switcher */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLang("tr")}
            className={`px-1 py-0.5 transition-all focus:outline-none cursor-pointer ${
              locale === "tr"
                ? isLight
                  ? "font-semibold text-neutral-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
                  : "font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
                : isLight
                ? "text-neutral-800 opacity-60 hover:opacity-100"
                : "text-neutral-200 opacity-55 hover:opacity-100"
            }`}
            aria-label="Türkçe Diline Geç"
          >
            TR
          </button>

          <span className={isLight ? "text-neutral-700 opacity-40" : "text-neutral-300 opacity-40"}>/</span>

          <button
            type="button"
            onClick={() => setLang("en")}
            className={`px-1 py-0.5 transition-all focus:outline-none cursor-pointer ${
              locale === "en"
                ? isLight
                  ? "font-semibold text-neutral-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
                  : "font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
                : isLight
                ? "text-neutral-800 opacity-60 hover:opacity-100"
                : "text-neutral-200 opacity-55 hover:opacity-100"
            }`}
            aria-label="Switch to English"
          >
            EN
          </button>
        </div>

        <span className={isLight ? "text-neutral-700 opacity-30" : "text-neutral-400 opacity-30"}>│</span>

        {/* Light / Dark Mode OS Utility Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-0.5 min-w-[64px] rounded-full transition-all duration-200 focus:outline-none cursor-pointer border ${
            isLight
              ? "bg-white/16 hover:bg-white/25 border-black/18 text-neutral-900 shadow-xs"
              : "bg-white/[0.05] hover:bg-white/12 border-white/18 text-white shadow-xs"
          }`}
          aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
          aria-pressed={!isLight}
        >
          <span className="text-[11px]">{isLight ? "☀" : "☾"}</span>
          <span className="text-[10px] font-mono tracking-wider uppercase opacity-90">
            {isLight ? "LIGHT" : "DARK"}
          </span>
        </button>

        <span className={isLight ? "text-neutral-700 opacity-30" : "text-neutral-400 opacity-30"}>│</span>

        {/* Privacy / Analytics Preferences Button */}
        <button
          type="button"
          onClick={() => setPrivacyModalOpen(true)}
          className={`flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full transition-all duration-200 focus:outline-none cursor-pointer border ${
            isLight
              ? "bg-white/16 hover:bg-white/25 border-black/18 text-neutral-900 shadow-xs"
              : "bg-white/[0.05] hover:bg-white/12 border-white/18 text-white shadow-xs"
          }`}
          aria-label={locale === "tr" ? "Gizlilik ve Analitik Ayarları" : "Privacy and Analytics Settings"}
          title={locale === "tr" ? "Gizlilik / Analitik Ayarları" : "Privacy / Analytics Settings"}
        >
          <span className="text-[10px]">⚙</span>
          <span className="text-[10px] font-mono tracking-wider uppercase opacity-90">
            {locale === "tr" ? "GİZLİLİK" : "PRIVACY"}
          </span>
        </button>
      </div>

      <AnalyticsSettingsModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
      />
    </>
  );
};
