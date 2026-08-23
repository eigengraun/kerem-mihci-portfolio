"use client";

import React, { useState } from "react";
import Image from "next/image";
import { socialPlatformList } from "@/data/socials";
import { useDesktopStore } from "@/store/desktopStore";

interface SocialStackProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const SocialStack: React.FC<SocialStackProps> = ({ isOpen = true }) => {
  const { theme, locale } = useDesktopStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const isLight = theme === "light";

  if (!isOpen) return null;


  return (
    <div
      role="menu"
      aria-label="Social Media Links"

      className={`absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 flex flex-row items-center gap-2.5 px-3 py-2 rounded-[18px] select-none pointer-events-auto z-[10010] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] animate-in fade-in slide-in-from-bottom-2 ${
        isLight
          ? "bg-[#423B34]/78 backdrop-blur-[22px] backdrop-saturate-[125%] border border-white/20 shadow-[0_12px_28px_rgba(45,30,20,0.20)]"
          : "bg-[#0C0C0E]/84 backdrop-blur-[24px] backdrop-saturate-[120%] border border-white/10 shadow-[0_16px_34px_rgba(0,0,0,0.38)]"
      }`}
    >
      {socialPlatformList.map((platform, idx) => {
        const hasUrl = Boolean(platform.url && platform.url.trim() !== "");
        const tooltipText = hasUrl
          ? platform.label
          : locale === "tr"
          ? `${platform.label} (Yakında)`
          : `${platform.label} (Coming Soon)`;

        return (
          <div
            key={platform.id}
            className="relative flex flex-col items-center group"
            onMouseEnter={() => setHoveredId(platform.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Dock-style Hover Tooltip */}
            <div
              className={`absolute bottom-full mb-2.5 px-2.5 py-1 text-[11px] font-sans font-medium rounded-md shadow-md whitespace-nowrap pointer-events-none transition-all duration-150 z-[10020] ${
                hoveredId === platform.id ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
              } ${
                isLight
                  ? "bg-[#2C2016]/90 text-white border border-white/15"
                  : "bg-[#18181B]/95 text-white border border-white/10"
              }`}
            >
              {tooltipText}
            </div>

            {hasUrl ? (
              <a
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                aria-label={platform.label}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="relative flex items-center justify-center w-11 h-11 md:w-12 md:h-12 rounded-xl transition-all duration-150 group-hover:scale-110 group-hover:-translate-y-0.5 active:scale-95 focus:outline-none cursor-pointer p-0.5"
                style={{ animationDelay: `${idx * 25}ms` }}
              >
                {/* 9px Rounded Mask for Social Platform Icons */}
                <div className="w-[36px] h-[36px] md:w-[38px] md:h-[38px] rounded-[9px] overflow-hidden flex items-center justify-center relative flex-shrink-0">
                  <Image
                    src={platform.icon}
                    alt=""
                    width={38}
                    height={38}
                    draggable={false}
                    className="w-full h-full object-contain select-none pointer-events-none"
                    unoptimized={platform.icon.endsWith(".svg")}
                  />
                </div>
              </a>
            ) : (
              <a
                href="#"
                role="menuitem"
                aria-label={`${platform.label} (Yakında / Coming Soon)`}
                aria-disabled="true"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="relative flex items-center justify-center w-11 h-11 md:w-12 md:h-12 rounded-xl transition-all duration-150 focus:outline-none cursor-default p-0.5 opacity-45"
                style={{ animationDelay: `${idx * 25}ms` }}
              >
                {/* 9px Rounded Mask for Social Platform Icons */}
                <div className="w-[36px] h-[36px] md:w-[38px] md:h-[38px] rounded-[9px] overflow-hidden flex items-center justify-center relative flex-shrink-0">
                  <Image
                    src={platform.icon}
                    alt=""
                    width={38}
                    height={38}
                    draggable={false}
                    className="w-full h-full object-contain select-none pointer-events-none"
                    unoptimized={platform.icon.endsWith(".svg")}
                  />
                </div>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
};
