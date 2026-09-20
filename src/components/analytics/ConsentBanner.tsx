"use client";

import React, { useState } from "react";
import { useDesktopStore } from "@/store/desktopStore";
import { setStoredConsent, applyConsentMode, AnalyticsConsentValue } from "@/lib/analyticsConsent";

interface ConsentBannerProps {
  onConsentChange?: (choice: AnalyticsConsentValue) => void;
}

export const ConsentBanner: React.FC<ConsentBannerProps> = ({ onConsentChange }) => {
  const { locale, theme } = useDesktopStore();
  const [showDetails, setShowDetails] = useState(false);
  const isEn = locale === "en";
  const isLight = theme === "light";

  const handleChoice = (choice: AnalyticsConsentValue) => {
    // 1. Store preference
    setStoredConsent(choice);

    // 2. Dispatch Consent Mode v2 signal
    applyConsentMode(choice);

    // 3. Callback parent
    onConsentChange?.(choice);
  };

  return (
    <aside
      aria-label={isEn ? "Analytics Consent Notice" : "Analitik İzni Bildirimi"}
      role="region"
      data-prevent-workspace-wheel="true"
      data-workspace-scroll-lock="true"
      className={`fixed z-50 pointer-events-auto rounded-2xl border p-4.5 sm:p-5 shadow-2xl backdrop-blur-2xl transition-all duration-300 motion-reduce:transition-none
        /* Mobile: positioned safely above the two-row mobile dock */
        bottom-[calc(var(--mobile-dock-height,80px)+env(safe-area-inset-bottom,0px)+14px)] left-3 right-3 max-w-[calc(100vw-24px)] mx-auto
        /* Desktop: positioned lower-left, well clear of the centered Dock and project icons */
        md:bottom-6 md:left-6 md:right-auto md:max-w-[390px] md:mx-0
        ${
          isLight
            ? "bg-white/92 border-black/15 text-neutral-900 shadow-[0_16px_40px_rgba(0,0,0,0.14)]"
            : "bg-neutral-950/90 border-white/18 text-neutral-100 shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
        }`}
    >
      <div className="flex flex-col gap-2.5">
        {/* Header row with badge & title */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            <h2 className="text-xs sm:text-[13px] font-semibold tracking-wide font-sans">
              {isEn ? "Analytics Consent" : "Analitik İzni"}
            </h2>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">
            Portfolio OS
          </span>
        </div>

        {/* Informative Body Copy */}
        <p className="text-[11.5px] sm:text-xs leading-relaxed opacity-85 font-sans">
          {isEn
            ? "I use Google Analytics to understand site usage and improve the portfolio experience. Analytics cookies are enabled only if you choose to allow them."
            : "Site kullanımını anlamak ve portfolyo deneyimini geliştirmek için Google Analytics kullanmak istiyorum. Analitik çerezleri yalnızca izin verirsen etkinleştirilir."}
        </p>

        {/* Collapsible Learn More Details */}
        {showDetails && (
          <div
            className={`text-[10.5px] sm:text-[11px] leading-relaxed p-2.5 rounded-lg border font-sans ${
              isLight
                ? "bg-black/[0.04] border-black/10 text-neutral-700"
                : "bg-white/[0.06] border-white/10 text-neutral-300"
            }`}
          >
            {isEn
              ? "Google Analytics provides measurement data about which pages are visited and how the site is generally used. Analytics tracking is enabled only when you allow it. You can change your preference at any time from Settings."
              : "Google Analytics, hangi sayfaların ziyaret edildiği ve site kullanımının genel olarak nasıl gerçekleştiği hakkında ölçüm verileri sağlar. Analitik izleme yalnızca izin verdiğinizde etkinleştirilir. Tercihinizi Ayarlar bölümünden istediğiniz zaman değiştirebilirsiniz."}
          </div>
        )}

        {/* Actions Row */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="text-[10.5px] sm:text-[11px] font-medium opacity-75 hover:opacity-100 underline underline-offset-2 transition-opacity cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-sm"
          >
            {showDetails
              ? isEn
                ? "Less info"
                : "Daha az bilgi"
              : isEn
              ? "Learn more"
              : "Daha fazla bilgi"}
          </button>

          <div className="flex items-center gap-2">
            {/* Reject Button */}
            <button
              type="button"
              onClick={() => handleChoice("rejected")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-400 border ${
                isLight
                  ? "bg-neutral-100 hover:bg-neutral-200/90 border-black/10 text-neutral-800"
                  : "bg-white/10 hover:bg-white/18 border-white/15 text-neutral-200"
              }`}
            >
              {isEn ? "Reject" : "Reddet"}
            </button>

            {/* Accept Button */}
            <button
              type="button"
              onClick={() => handleChoice("accepted")}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide bg-[#1967E8] hover:bg-[#1656c2] text-white shadow-md hover:shadow-lg transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {isEn ? "Allow Analytics" : "Analitiklere İzin Ver"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
