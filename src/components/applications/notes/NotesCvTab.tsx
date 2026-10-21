"use client";

import React from "react";
import { profileData } from "@/data/profile";
import { Locale } from "@/data/translations";
import { useSessionStore } from "@/store/sessionStore";

interface NotesCvTabProps {
  locale: Locale;
  isLight: boolean;
}

export const NotesCvTab: React.FC<NotesCvTabProps> = ({ locale, isLight }) => {
  const isEn = locale === "en";
  const { sessionCv, isCmsMode, phase5Degraded } = useSessionStore();

  if (isCmsMode && phase5Degraded) {
    return (
      <div className="p-8 text-center space-y-2 font-mono">
        <div className="text-amber-400 text-xs font-bold">
          {isEn ? "CV SERVICE TEMPORARILY DEGRADED" : "CV SERVİSİ GEÇİCİ OLARAK KULLANILAMIYOR"}
        </div>
        <p className="text-xs text-[#A0A8B5]">
          {isEn
            ? "Upstream CMS service is experiencing technical difficulties. Please try again later."
            : "Üst düzey CMS servisinde teknik aksaklık yaşanıyor. Lütfen daha sonra tekrar deneyiniz."}
        </p>
      </div>
    );
  }

  let trAvailable = false;
  let trPath = "";
  let enAvailable = false;
  let enPath = "";

  if (isCmsMode) {
    const trCms = sessionCv?.tr;
    trAvailable = Boolean(trCms && trCms.status === "published" && trCms.publicUrl && trCms.byteSize > 0);
    trPath = trAvailable ? trCms!.publicUrl : "";

    const enCms = sessionCv?.en;
    enAvailable = Boolean(enCms && enCms.status === "published" && enCms.publicUrl && enCms.byteSize > 0);
    enPath = enAvailable ? enCms!.publicUrl : "";
  } else {
    trAvailable = profileData.cv.trAvailable;
    trPath = profileData.cv.trPath;
    enAvailable = profileData.cv.enAvailable;
    enPath = profileData.cv.enPath;
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
          <span>📄 CV</span>
        </span>
        <span className="text-[10px] font-mono opacity-60">resume.pdf</span>
      </div>

      {/* Explanatory text */}
      <p
        className={`font-sans text-xs md:text-[13px] leading-relaxed ${
          isLight ? "text-neutral-700" : "text-neutral-300"
        }`}
      >
        {isEn
          ? "You can preview or download my curriculum vitae in PDF format below."
          : "Özgeçmiş dosyamı aşağıdaki bağlantılardan inceleyebilir veya PDF olarak indirebilirsiniz."}
      </p>

      {/* Action Cards for Turkish & English CVs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
        {/* Turkish CV Card */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-colors ${
            isLight
              ? "bg-amber-50/50 border-amber-200/80"
              : "bg-neutral-800/50 border-amber-500/20"
          }`}
        >
          <div>
            <div className="flex items-center justify-between font-mono text-xs font-bold mb-1">
              <span className={isLight ? "text-neutral-900" : "text-white"}>
                {isEn ? "Turkish CV" : "Türkçe CV"}
              </span>
              <span className="text-[10px] text-amber-500 font-mono">PDF</span>
            </div>
            <p
              className={`font-sans text-xs ${
                isLight ? "text-neutral-600" : "text-neutral-400"
              }`}
            >
              {isEn ? "Turkish version curriculum vitae" : "Türkçe detaylı özgeçmiş dosyası"}
            </p>
          </div>

          {trAvailable ? (
            <div className="flex items-center gap-2 font-mono text-xs pt-1">
              <a
                href={trPath}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex-1 text-center py-1.5 px-3 rounded font-medium border transition-colors cursor-pointer ${
                  isLight
                    ? "bg-amber-100/80 border-amber-300 text-amber-950 hover:bg-amber-200"
                    : "bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/30"
                }`}
              >
                {isEn ? "Preview" : "Önizle"}
              </a>
              <a
                href={trPath}
                download="kerem-mihci-cv-tr.pdf"
                className={`flex-1 text-center py-1.5 px-3 rounded font-medium border transition-colors cursor-pointer ${
                  isLight
                    ? "bg-white border-amber-200 text-neutral-800 hover:bg-amber-50"
                    : "bg-neutral-800 border-amber-500/20 text-neutral-200 hover:bg-neutral-700"
                }`}
              >
                {isEn ? "Download" : "İndir"}
              </a>
            </div>
          ) : (
            <div className="pt-1">
              <span
                className={`inline-block w-full text-center py-1.5 px-3 rounded text-xs font-mono border italic ${
                  isLight
                    ? "bg-amber-50 border-amber-200/60 text-amber-800/70"
                    : "bg-neutral-900/60 border-amber-500/10 text-neutral-400/70"
                }`}
              >
                {isEn ? "CV coming soon" : "CV yakında eklenecek"}
              </span>
            </div>
          )}
        </div>

        {/* English CV Card */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-colors ${
            isLight
              ? "bg-amber-50/50 border-amber-200/80"
              : "bg-neutral-800/50 border-amber-500/20"
          }`}
        >
          <div>
            <div className="flex items-center justify-between font-mono text-xs font-bold mb-1">
              <span className={isLight ? "text-neutral-900" : "text-white"}>
                {isEn ? "English CV" : "İngilizce CV"}
              </span>
              <span className="text-[10px] text-amber-500 font-mono">PDF</span>
            </div>
            <p
              className={`font-sans text-xs ${
                isLight ? "text-neutral-600" : "text-neutral-400"
              }`}
            >
              {isEn ? "English version curriculum vitae" : "İngilizce detaylı özgeçmiş dosyası"}
            </p>
          </div>

          {enAvailable ? (
            <div className="flex items-center gap-2 font-mono text-xs pt-1">
              <a
                href={enPath}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex-1 text-center py-1.5 px-3 rounded font-medium border transition-colors cursor-pointer ${
                  isLight
                    ? "bg-amber-100/80 border-amber-300 text-amber-950 hover:bg-amber-200"
                    : "bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/30"
                }`}
              >
                {isEn ? "Preview" : "Önizle"}
              </a>
              <a
                href={enPath}
                download="kerem-mihci-cv-en.pdf"
                className={`flex-1 text-center py-1.5 px-3 rounded font-medium border transition-colors cursor-pointer ${
                  isLight
                    ? "bg-white border-amber-200 text-neutral-800 hover:bg-amber-50"
                    : "bg-neutral-800 border-amber-500/20 text-neutral-200 hover:bg-neutral-700"
                }`}
              >
                {isEn ? "Download" : "İndir"}
              </a>
            </div>
          ) : (
            <div className="pt-1">
              <span
                className={`inline-block w-full text-center py-1.5 px-3 rounded text-xs font-mono border italic ${
                  isLight
                    ? "bg-amber-50 border-amber-200/60 text-amber-800/70"
                    : "bg-neutral-900/60 border-amber-500/10 text-neutral-400/70"
                }`}
              >
                {isEn ? "CV coming soon" : "CV yakında eklenecek"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
