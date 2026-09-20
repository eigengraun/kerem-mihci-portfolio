"use client";

import React from "react";
import { useDesktopStore } from "@/store/desktopStore";
import {
  setStoredConsent,
  applyConsentMode,
  clearAnalyticsCookies,
  useAnalyticsConsent
} from "@/lib/analyticsConsent";

interface AnalyticsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnalyticsSettingsModal: React.FC<AnalyticsSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { locale, theme } = useDesktopStore();
  const consent = useAnalyticsConsent();
  const isEn = locale === "en";
  const isLight = theme === "light";

  if (!isOpen) return null;

  const isAccepted = consent === "accepted";

  const handleToggleConsent = () => {
    if (isAccepted) {
      // 1. Update Consent Mode to denied
      applyConsentMode("rejected");
      // 2. Persist rejected state
      setStoredConsent("rejected");
      // 3. Clear Google Analytics cookies
      clearAnalyticsCookies();
      // 4. Soft reload while preserving current URL to completely purge third-party script from memory
      window.location.reload();
    } else {
      // 1. Grant consent
      setStoredConsent("accepted");
      applyConsentMode("accepted");
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none pointer-events-auto"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-[360px] p-5 rounded-2xl border shadow-2xl backdrop-blur-2xl flex flex-col gap-4 ${
          isLight
            ? "bg-white/95 border-black/15 text-neutral-900 shadow-black/15"
            : "bg-neutral-950/95 border-white/20 text-white shadow-black/70"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            <h2 id="analytics-settings-title" className="text-xs sm:text-[13px] font-semibold tracking-wide font-sans">
              {isEn ? "Analytics Preferences" : "Analitik Tercihleri"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? "Close" : "Kapat"}
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Current State Status Row */}
        <div
          className={`flex items-center justify-between p-3 rounded-xl border ${
            isLight
              ? "bg-black/[0.03] border-black/10"
              : "bg-white/[0.05] border-white/10"
          }`}
        >
          <span className="text-xs font-medium font-sans">
            {isEn ? "Analytics Status:" : "Analitik Durumu:"}
          </span>
          <span
            className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
              isAccepted
                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                : "bg-neutral-500/15 text-neutral-400 border-neutral-500/30"
            }`}
          >
            {isAccepted
              ? isEn
                ? "Allowed"
                : "İzin Verildi"
              : isEn
              ? "Rejected"
              : "Reddedildi"}
          </span>
        </div>

        {/* Informative Description */}
        <p className="text-[11.5px] leading-relaxed opacity-80 font-sans">
          {isEn
            ? "Google Analytics helps measure anonymous traffic and general site usage to improve the portfolio experience. You can withdraw or grant your permission at any time."
            : "Google Analytics, portfolyo deneyimini geliştirmek için anonim trafik ve genel site kullanımını ölçmeye yardımcı olur. İzninizi dilediğiniz an geri çekebilir veya verebilirsiniz."}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer border ${
              isLight
                ? "bg-neutral-100 hover:bg-neutral-200 border-black/10 text-neutral-800"
                : "bg-white/10 hover:bg-white/18 border-white/15 text-neutral-200"
            }`}
          >
            {isEn ? "Close" : "Kapat"}
          </button>

          <button
            type="button"
            onClick={handleToggleConsent}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-md ${
              isAccepted
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-[#1967E8] hover:bg-[#1656c2] text-white"
            }`}
          >
            {isAccepted
              ? isEn
                ? "Withdraw Consent"
                : "İzni Geri Çek"
              : isEn
              ? "Allow Analytics"
              : "İzin Ver"}
          </button>
        </div>
      </div>
    </div>
  );
};
