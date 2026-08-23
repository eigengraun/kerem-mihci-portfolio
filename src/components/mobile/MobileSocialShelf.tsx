"use client";

import React from "react";
import Image from "next/image";
import { socialPlatformList, SocialPlatformItem } from "@/data/socials";

interface MobileSocialShelfProps {
  onClose: () => void;
}

export const MobileSocialShelf: React.FC<MobileSocialShelfProps> = () => {
  return (
    <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-[360px] p-3 rounded-2xl backdrop-blur-xl bg-neutral-900/90 border border-white/20 shadow-2xl flex items-center justify-around gap-2 select-none animate-in fade-in slide-in-from-bottom-2 duration-200">
      {socialPlatformList.map((item: SocialPlatformItem) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-90 transition-transform group p-1"
        >
          <div className="w-10 h-10 rounded-[10px] overflow-hidden flex items-center justify-center bg-transparent border border-white/10 shadow-xs">
            <Image
              src={item.icon}
              alt=""
              width={40}
              height={40}
              className="w-full h-full object-cover select-none pointer-events-none"
              unoptimized
            />
          </div>
          <span className="text-[10px] font-mono text-white/90 text-center truncate max-w-[64px]">
            {item.label}
          </span>
        </a>
      ))}
    </div>
  );
};
