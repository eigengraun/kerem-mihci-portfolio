"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useDesktopStore } from "@/store/desktopStore";
import { siteConfig } from "@/data/site";
import { socialsConfig, socialPlatformList } from "@/data/socials";
import { getTranslation } from "@/lib/i18n";
import { toLocaleUpper } from "@/lib/casing";

export const ContactApp: React.FC = () => {
  const { locale } = useDesktopStore();
  const isEn = locale === "en";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpeningMail, setIsOpeningMail] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName) {
      setErrorMessage(isEn ? "Please enter your name." : "Lütfen adınızı girin.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setErrorMessage(isEn ? "Please enter a valid email address." : "Lütfen geçerli bir e-posta adresi girin.");
      return;
    }

    if (!trimmedMessage) {
      setErrorMessage(isEn ? "Please enter your message." : "Lütfen mesajınızı yazın.");
      return;
    }

    const subject = encodeURIComponent(`Portfolio Contact from ${trimmedName}`);
    const body = encodeURIComponent(
      `Name / İsim: ${trimmedName}\nEmail / E-posta: ${trimmedEmail}\n\nMessage / Mesaj:\n${trimmedMessage}`
    );

    const mailtoUrl = `mailto:${siteConfig.email}?subject=${subject}&body=${body}`;
    window.location.href = mailtoUrl;

    setIsOpeningMail(true);
  };

  return (
    <div
      className="p-4 sm:p-5 h-full overflow-y-auto app-scrollbar select-none text-[var(--app-text-primary)]"
      data-prevent-workspace-wheel="true"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 max-w-4xl mx-auto">
        {/* Left Column: Profile Intro & Direct Channels */}
        <div className="md:col-span-5 flex flex-col justify-between gap-4 p-4 sm:p-5 rounded-xl bg-[var(--app-surface-raised)] border border-[var(--app-border)] shadow-xs">
          <div className="space-y-3">
            {/* Header / Intro */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <span lang={locale} className="text-[10px] font-mono uppercase tracking-wider text-[var(--app-text-muted)] font-medium">
                  {toLocaleUpper(isEn ? "Direct Inquiries" : "Doğrudan İletişim", locale)}
                </span>
              </div>
              <h1 className="text-lg font-bold tracking-tight text-[var(--app-text-primary)]">
                {getTranslation(locale, "contact_title")}
              </h1>
              <p className="text-xs leading-relaxed text-[var(--app-text-secondary)] font-sans pt-0.5">
                {getTranslation(locale, "contact_subtitle")}
              </p>
            </div>

            {/* Direct Contact Channels */}
            <div className="pt-2 space-y-2">
              {/* Email Channel */}
              <a
                href={`mailto:${siteConfig.email}`}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--app-surface-subtle)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] transition-all group cursor-pointer active:scale-[0.985]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-[#1967E8]/15 text-[#1967E8] flex items-center justify-center text-xs flex-shrink-0">
                    ✉
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-mono uppercase text-[var(--app-text-muted)] font-semibold">
                      Email
                    </span>
                    <span className="text-xs font-mono font-medium text-[var(--app-text-primary)] truncate group-hover:text-[#1967E8] transition-colors">
                      {siteConfig.email}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-[var(--app-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0">
                  ↗
                </span>
              </a>

              {/* Instagram Channel */}
              <a
                href={socialsConfig.instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--app-surface-subtle)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] transition-all group cursor-pointer active:scale-[0.985]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-gradient-to-tr from-amber-500/20 to-fuchsia-500/20 flex items-center justify-center text-xs flex-shrink-0">
                    <Image
                      src="/assets/icons/social/instagram.svg"
                      alt=""
                      width={14}
                      height={14}
                      className="w-3.5 h-3.5 object-contain"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-mono uppercase text-[var(--app-text-muted)] font-semibold">
                      Instagram
                    </span>
                    <span className="text-xs font-mono font-medium text-[var(--app-text-primary)] truncate group-hover:text-fuchsia-500 transition-colors">
                      @kerem.mhc
                    </span>
                  </div>
                </div>
                <span className="text-xs text-[var(--app-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0">
                  ↗
                </span>
              </a>
            </div>
          </div>

          {/* Social Platform Badges Strip */}
          <div className="pt-2 border-t border-[var(--app-divider)] flex items-center gap-2 flex-wrap">
            {socialPlatformList
              .filter((p) => p.id !== "instagram")
              .map((platform) => (
                <a
                  key={platform.id}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-md text-[11px] font-mono font-medium bg-[var(--app-surface-subtle)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Image
                    src={platform.icon}
                    alt=""
                    width={12}
                    height={12}
                    className="w-3 h-3 object-contain opacity-70"
                  />
                  <span>{platform.label}</span>
                </a>
              ))}
          </div>
        </div>

        {/* Right Column: Refined Contact Form */}
        <div className="md:col-span-7 p-4 sm:p-5 rounded-xl bg-[var(--app-surface-raised)] border border-[var(--app-border)] shadow-xs flex flex-col justify-between">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Name Field */}
            <div>
              <label className="block text-[11px] font-mono font-medium text-[var(--app-text-secondary)] mb-1">
                {getTranslation(locale, "contact_form_name")}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder={isEn ? "Kerem Mıhçı" : "Adınız Soyadınız"}
                className="w-full h-10 px-3 text-xs rounded-lg border border-[var(--app-input-border)] bg-[var(--app-input-bg)] text-[var(--app-text-primary)] placeholder-[var(--app-text-muted)] focus:outline-none focus:ring-1 focus:ring-[#1967E8] focus:border-[#1967E8] transition-colors"
              />
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-[11px] font-mono font-medium text-[var(--app-text-secondary)] mb-1">
                {getTranslation(locale, "contact_form_email")}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="name@example.com"
                className="w-full h-10 px-3 text-xs rounded-lg border border-[var(--app-input-border)] bg-[var(--app-input-bg)] text-[var(--app-text-primary)] placeholder-[var(--app-text-muted)] focus:outline-none focus:ring-1 focus:ring-[#1967E8] focus:border-[#1967E8] transition-colors"
              />
            </div>

            {/* Message Textarea */}
            <div>
              <label className="block text-[11px] font-mono font-medium text-[var(--app-text-secondary)] mb-1">
                {getTranslation(locale, "contact_form_message")}
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder={isEn ? "Describe your project or inquiry..." : "Projeniz veya çalışmanız hakkında bilgi verin..."}
                className="w-full h-28 p-3 text-xs rounded-lg border border-[var(--app-input-border)] bg-[var(--app-input-bg)] text-[var(--app-text-primary)] placeholder-[var(--app-text-muted)] focus:outline-none focus:ring-1 focus:ring-[#1967E8] focus:border-[#1967E8] resize-none transition-colors leading-relaxed"
              />
            </div>

            {/* Error Message if validation fails */}
            {errorMessage && (
              <div className="text-[11px] font-mono text-red-500 font-medium bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-md">
                ⚠ {errorMessage}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-[var(--app-divider)]">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#1967E8] hover:bg-[#1557C0] text-white font-medium text-xs shadow-sm transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span>{getTranslation(locale, "contact_form_send")}</span>
                <span className="text-[11px]">→</span>
              </button>

              <span className="text-[10px] font-mono text-[var(--app-text-muted)]">
                {isOpeningMail ? (
                  <span className="text-emerald-500 font-semibold">
                    ✓ {getTranslation(locale, "contact_mailto_notice")}
                  </span>
                ) : (
                  getTranslation(locale, "contact_mailto_notice")
                )}
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
