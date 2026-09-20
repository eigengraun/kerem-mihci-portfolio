"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Settings, Sun, Moon } from "lucide-react";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore } from "@/store/windowStore";
import { workspacesData } from "@/data/workspaces";
import { getTranslation } from "@/lib/i18n";
import { toLocaleUpper } from "@/lib/casing";
import { AnalyticsSettingsModal } from "@/components/analytics/AnalyticsSettingsModal";
import { useAnalyticsConsent } from "@/lib/analyticsConsent";

export const MobileTopBar: React.FC = () => {
  const { activeWorkspace, setActiveWorkspace, theme, toggleTheme, locale, setLocale } = useDesktopStore();
  const { windows } = useWindowStore();

  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const consent = useAnalyticsConsent();

  const containerRef = useRef<HTMLDivElement>(null);

  const activeWindows = windows[activeWorkspace] || [];
  const hasOpenApp = activeWindows.length > 0;
  const isLight = theme === "light";

  // Find active workspace details
  const activeWsObj = workspacesData.find((w) => w.id === activeWorkspace) || workspacesData[0];
  const activeWsLabel = locale === "tr" ? activeWsObj.titleTR : activeWsObj.titleEN;
  const activeWsNum = activeWsObj.id === "design" ? "01" : activeWsObj.id === "web" ? "02" : "03";

  // Close menus on outside click or Escape key (active only when menus are open)
  useEffect(() => {
    if (!workspaceOpen && !settingsOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setWorkspaceOpen(false);
        setSettingsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setWorkspaceOpen(false);
        setSettingsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [workspaceOpen, settingsOpen]);

  const handleToggleWorkspace = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSettingsOpen(false);
    setWorkspaceOpen((prev) => !prev);
  };

  const handleToggleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    setWorkspaceOpen(false);
    setSettingsOpen((prev) => !prev);
  };

  const handleSelectWorkspace = (id: typeof workspacesData[number]["id"]) => {
    setActiveWorkspace(id);
    setWorkspaceOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`fixed top-0 left-0 right-0 z-40 px-3.5 pt-[calc(env(safe-area-inset-top,0px)+8px)] flex items-center justify-between pointer-events-none select-none transition-all duration-200 ease-out ${
        hasOpenApp ? "opacity-0 -translate-y-1 pointer-events-none" : "opacity-100 translate-y-0"
      }`}
    >
      {/* ========================================== */}
      {/* 1. TOP-LEFT WORKSPACE FLOATING WIDGET      */}
      {/* ========================================== */}
      <div className="relative pointer-events-auto">
        <button
          type="button"
          onClick={handleToggleWorkspace}
          aria-expanded={workspaceOpen}
          aria-haspopup="true"
          className={`h-[34px] min-w-[95px] max-w-[145px] px-2.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-between gap-1.5 active:scale-[0.97] backdrop-blur-xl shadow-lg ${
            isLight
              ? "bg-white/75 border-black/15 text-neutral-900 hover:bg-white/90"
              : "bg-black/50 border-white/20 text-white hover:bg-black/65"
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <span className="opacity-60 text-[11px] flex-shrink-0">{activeWsNum}</span>
            <span className="truncate">{activeWsLabel.split(" ")[0]}</span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
              workspaceOpen ? "rotate-180 opacity-100" : "opacity-60"
            }`}
          />
        </button>

        {/* WORKSPACE DROPDOWN MENU */}
        {workspaceOpen && (
          <div
            className={`absolute top-full mt-1.5 left-0 z-50 w-[155px] p-1.5 rounded-xl border backdrop-blur-2xl shadow-2xl flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150 ${
              isLight
                ? "bg-white/95 border-black/15 text-neutral-900 shadow-black/10"
                : "bg-neutral-900/95 border-white/20 text-white shadow-black/60"
            }`}
          >
            {workspacesData.map((ws) => {
              const isSelected = ws.id === activeWorkspace;
              const label = locale === "tr" ? ws.titleTR : ws.titleEN;
              const num = ws.id === "design" ? "01" : ws.id === "web" ? "02" : "03";

              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => handleSelectWorkspace(ws.id)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-left transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? isLight
                        ? "bg-neutral-200/80 font-bold text-neutral-900"
                        : "bg-white/20 font-bold text-white"
                      : "opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {isSelected ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1967E8] flex-shrink-0" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-transparent flex-shrink-0" />
                    )}
                    <span className="opacity-70 text-[10px]">{num}</span>
                    <span className="truncate">{label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* 2. TOP-RIGHT SETTINGS FLOATING WIDGET       */}
      {/* ========================================== */}
      <div className="relative pointer-events-auto">
        <div className="p-1 -m-1 flex items-center justify-center">
          <button
            type="button"
            onClick={handleToggleSettings}
            aria-expanded={settingsOpen}
            aria-haspopup="true"
            aria-label={getTranslation(locale, "settings_title")}
            className={`w-[34px] h-[34px] rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-95 backdrop-blur-xl shadow-lg ${
              isLight
                ? "bg-white/75 border-black/15 text-neutral-900 hover:bg-white/90"
                : "bg-black/50 border-white/20 text-white hover:bg-black/65"
            }`}
          >
            <Settings className="w-4 h-4 opacity-85" />
          </button>
        </div>

        {/* SETTINGS FLOATING PANEL */}
        {settingsOpen && (
          <div
            className={`absolute top-full mt-1.5 right-0 z-50 w-[190px] p-3 rounded-xl border backdrop-blur-2xl shadow-2xl flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150 ${
              isLight
                ? "bg-white/95 border-black/15 text-neutral-900 shadow-black/10"
                : "bg-neutral-900/95 border-white/20 text-white shadow-black/60"
            }`}
          >
            {/* Header */}
            <div lang={locale} className="text-[10px] font-mono font-bold tracking-widest text-neutral-400 uppercase">
              {toLocaleUpper(getTranslation(locale, "settings_title"), locale)}
            </div>

            {/* Language Switch Row — Single Forgiving Toggle Control */}
            <div className="flex items-center justify-between gap-2 min-h-[44px]">
              <span className="text-xs font-medium opacity-80">
                {getTranslation(locale, "settings_language")}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={locale === "en"}
                aria-label={locale === "tr" ? "Dili değiştir" : "Toggle language"}
                onClick={(e) => {
                  e.stopPropagation();
                  setLocale(locale === "tr" ? "en" : "tr");
                }}
                className={`flex items-center p-1 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition-all active:scale-95 touch-manipulation min-h-[36px] min-w-[76px] justify-between gap-1 ${
                  isLight ? "bg-neutral-100 border-black/10" : "bg-black/40 border-white/10"
                }`}
              >
                <div
                  className={`px-2.5 py-1 min-h-[28px] min-w-[32px] rounded-md transition-all flex items-center justify-center pointer-events-none ${
                    locale === "tr"
                      ? "bg-[#1967E8] text-white shadow-xs font-bold opacity-100"
                      : "opacity-60"
                  }`}
                >
                  TR
                </div>
                <div
                  className={`px-2.5 py-1 min-h-[28px] min-w-[32px] rounded-md transition-all flex items-center justify-center pointer-events-none ${
                    locale === "en"
                      ? "bg-[#1967E8] text-white shadow-xs font-bold opacity-100"
                      : "opacity-60"
                  }`}
                >
                  EN
                </div>
              </button>
            </div>

            {/* Appearance / Theme Switch Row — Single Forgiving Toggle Control */}
            <div className="flex items-center justify-between gap-2 min-h-[44px]">
              <span className="text-xs font-medium opacity-80">
                {getTranslation(locale, "settings_appearance")}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={theme === "dark"}
                aria-label={locale === "tr" ? "Temayı değiştir" : "Toggle theme"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTheme();
                }}
                className={`flex items-center p-1 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition-all active:scale-95 touch-manipulation min-h-[36px] min-w-[76px] justify-between gap-1 ${
                  isLight ? "bg-neutral-100 border-black/10" : "bg-black/40 border-white/10"
                }`}
              >
                <div
                  className={`px-2 py-1 rounded-md transition-all flex items-center justify-center pointer-events-none ${
                    isLight
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "opacity-60 text-white/70"
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                </div>
                <div
                  className={`px-2 py-1 rounded-md transition-all flex items-center justify-center pointer-events-none ${
                    !isLight
                      ? "bg-neutral-800 text-white shadow-xs"
                      : "opacity-60 text-neutral-700"
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                </div>
              </button>
            </div>

            {/* Privacy & Analytics Preferences Row */}
            <div className="flex flex-col gap-2 pt-2 border-t border-black/10 dark:border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium opacity-80">
                  {locale === "tr" ? "Gizlilik" : "Privacy"}
                </span>
                <span
                  className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                    consent === "accepted"
                      ? "bg-emerald-500/20 text-emerald-500"
                      : "bg-neutral-500/20 text-neutral-400"
                  }`}
                >
                  {consent === "accepted"
                    ? locale === "tr"
                      ? "İzin Verildi"
                      : "Allowed"
                    : locale === "tr"
                    ? "Reddedildi"
                    : "Rejected"}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSettingsOpen(false);
                  setAnalyticsModalOpen(true);
                }}
                className={`w-full py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all text-center border cursor-pointer active:scale-98 ${
                  isLight
                    ? "bg-neutral-100 hover:bg-neutral-200/80 border-black/10 text-neutral-800"
                    : "bg-white/10 hover:bg-white/15 border-white/10 text-white/90"
                }`}
              >
                {locale === "tr" ? "Analitik Tercihleri" : "Analytics Preferences"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Analytics Settings Modal */}
      <AnalyticsSettingsModal
        isOpen={analyticsModalOpen}
        onClose={() => setAnalyticsModalOpen(false)}
      />
    </div>
  );
};
