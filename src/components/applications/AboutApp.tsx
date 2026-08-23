"use client";

import React, { useState } from "react";
import { useDesktopStore } from "@/store/desktopStore";
import { siteConfig } from "@/data/site";
import { skillsList } from "@/data/about";
import { getTranslation } from "@/lib/i18n";
import { socialsConfig } from "@/data/socials";
import { toLocaleUpper } from "@/lib/casing";

type AboutTab = "me" | "cv" | "skills" | "contact";

export const AboutApp: React.FC = () => {
  const { locale } = useDesktopStore();
  const [activeTab, setActiveTab] = useState<AboutTab>("me");

  return (
    <div className="flex flex-col md:flex-row h-full min-h-[380px] bg-[var(--app-surface)] text-[var(--app-text-primary)] font-sans text-xs select-none transition-colors duration-200">
      {/* Left Sidebar List */}
      <div className="w-full md:w-36 bg-[var(--app-surface-subtle)] border-b md:border-b-0 md:border-r border-[var(--app-divider)] p-2 flex flex-row md:flex-col gap-0.5 flex-shrink-0 transition-colors duration-200">
        <button
          type="button"
          onClick={() => setActiveTab("me")}
          className={`px-3 py-1.5 rounded text-xs text-left transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "me"
              ? "bg-[var(--app-surface-raised)] text-[var(--app-text-primary)] font-semibold shadow-xs"
              : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
          }`}
        >
          {getTranslation(locale, "about_tab_me")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("cv")}
          className={`px-3 py-1.5 rounded text-xs text-left transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "cv"
              ? "bg-[var(--app-surface-raised)] text-[var(--app-text-primary)] font-semibold shadow-xs"
              : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
          }`}
        >
          CV
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("skills")}
          className={`px-3 py-1.5 rounded text-xs text-left transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "skills"
              ? "bg-[var(--app-surface-raised)] text-[var(--app-text-primary)] font-semibold shadow-xs"
              : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
          }`}
        >
          {getTranslation(locale, "about_tab_skills")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("contact")}
          className={`px-3 py-1.5 rounded text-xs text-left transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "contact"
              ? "bg-[var(--app-surface-raised)] text-[var(--app-text-primary)] font-semibold shadow-xs"
              : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
          }`}
        >
          {getTranslation(locale, "about_tab_contact")}
        </button>
      </div>

      {/* Main Information Panel */}
      <div className="flex-1 p-4 md:p-5 overflow-y-auto app-scrollbar select-text">
        {activeTab === "me" && (
          <div className="space-y-3 text-xs md:text-[13px] text-[var(--app-text-secondary)] leading-relaxed font-sans">
            <p className="font-medium text-[var(--app-text-primary)]">
              {locale === "tr"
                ? "Designer, Web Designer ve Digital Creator olarak tasarım, web ve yaratıcı üretim alanlarında çalışıyorum. Farklı disiplinleri tek bir görsel sistem içinde bir araya getiriyor; markaların dijital dünyada daha güçlü, tutarlı ve görünür olmasına yardımcı olan işler üretiyorum."
                : "Working as a Designer, Web Designer and Digital Creator across design, web engineering and creative production. I combine different disciplines into a single visual system to help brands build a stronger, consistent and more visible digital presence."}
            </p>

            <p>
              {locale === "tr"
                ? "İşim yalnızca güzel görünen işler üretmek değil; markanın kimliğine, hedeflerine ve kullanıcı deneyimine uygun sürdürülebilir çözümler geliştirmek."
                : "My work is not only about creating visually appealing graphics; I focus on building sustainable solutions aligned with a brand's identity, goals and user experience."}
            </p>

            <p>
              {locale === "tr"
                ? "Çalışmalarımda tasarım ve teknolojiyi birlikte kullanıyor, yapay zekâ araçlarını yaratıcı süreci destekleyen bir üretim aracı olarak değerlendiriyorum."
                : "I combine design and technology throughout my work and use AI tools as part of a broader creative production process."}
            </p>
          </div>
        )}

        {activeTab === "cv" && (
          <div className="space-y-3 text-xs md:text-[13px]">
            <div className="border-b border-[var(--app-divider)] pb-2">
              <h2 className="font-bold text-[var(--app-text-primary)] text-sm">{siteConfig.owner}</h2>
              <p className="text-xs font-mono text-[var(--app-text-secondary)] mt-0.5">
                {(locale === "tr" ? siteConfig.rolesTR : siteConfig.rolesEN).join(" • ")}
              </p>
              <p className="text-xs font-mono text-[var(--app-text-muted)] mt-0.5">
                📍 {locale === "tr" ? siteConfig.locationTR : siteConfig.locationEN} | ✉ {siteConfig.email}
              </p>
            </div>

            <div className="space-y-1">
              <span lang={locale} className="font-bold text-[var(--app-text-primary)] uppercase tracking-wider font-mono text-[11px]">
                {toLocaleUpper(locale === "tr" ? "Deneyim & Kariyer" : "Experience", locale)}
              </span>
              <p className="text-xs font-mono text-[var(--app-text-muted)] italic pt-1">
                {getTranslation(locale, "exp_updating")}
              </p>
            </div>
          </div>
        )}

        {activeTab === "skills" && (
          <div className="space-y-3">
            <h2 lang={locale} className="text-xs font-bold text-[var(--app-text-primary)] uppercase tracking-wider font-mono border-b border-[var(--app-divider)] pb-1.5">
              {toLocaleUpper(getTranslation(locale, "skills_heading"), locale)}
            </h2>
            {/* Plain vertical list with orange circular checkmarks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-4 text-xs font-sans">
              {skillsList.map((skill, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[var(--app-text-primary)]">
                  <div className="w-4 h-4 rounded-full bg-[#F5A623] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 shadow-2xs">
                    ✓
                  </div>
                  <span className="font-medium">
                    {locale === "tr" ? skill.nameTR : skill.nameEN}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "contact" && (
          <div className="space-y-3">
            <h2 lang={locale} className="text-xs font-bold text-[var(--app-text-primary)] uppercase tracking-wider font-mono border-b border-[var(--app-divider)] pb-1.5">
              {toLocaleUpper(getTranslation(locale, "about_tab_contact"), locale)}
            </h2>
            <div className="space-y-2 text-xs font-sans">
              <div>
                <span className="text-[var(--app-text-muted)] font-mono">Ad Soyad / Name:</span>
                <p className="font-bold text-[var(--app-text-primary)]">{siteConfig.owner}</p>
              </div>
              <div>
                <span className="text-[var(--app-text-muted)] font-mono">Konum / Location:</span>
                <p className="font-medium text-[var(--app-text-secondary)]">
                  {locale === "tr" ? siteConfig.locationTR : siteConfig.locationEN}
                </p>
              </div>
              <div>
                <span className="text-[var(--app-text-muted)] font-mono">E-posta / Email:</span>
                <p>
                  <a
                    href={`mailto:${siteConfig.email}`}
                    className="text-blue-500 underline font-mono hover:text-blue-400"
                  >
                    {siteConfig.email}
                  </a>
                </p>
              </div>
              <div>
                <span className="text-[var(--app-text-muted)] font-mono">Instagram:</span>
                <p>
                  <a
                    href={socialsConfig.instagram.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline font-mono hover:text-blue-400"
                  >
                    {socialsConfig.instagram.label}
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
