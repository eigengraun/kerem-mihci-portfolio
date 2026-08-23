"use client";

import React from "react";
import Image from "next/image";
import { ToolInfo } from "@/data/toolInfo";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore } from "@/store/windowStore";

interface ToolInfoAppProps {
  tool: ToolInfo;
  windowId?: string;
}

export const ToolInfoApp: React.FC<ToolInfoAppProps> = ({ tool, windowId }) => {
  const { locale, activeWorkspace } = useDesktopStore();
  const { closeWindow } = useWindowStore();

  const description = locale === "tr" ? tool.descriptionTR : tool.descriptionEN;
  const buttonText = locale === "tr" ? tool.buttonTR : tool.buttonEN;

  const handleButtonClick = () => {
    if (windowId) {
      closeWindow(windowId, activeWorkspace);
    } else {
      closeWindow(`tool-${tool.id}-${activeWorkspace}`, activeWorkspace);
    }
  };

  return (
    <div className="flex flex-col text-[#ECECEC] font-sans select-none">
      {/* Icon + Playful Message */}
      <div className="flex items-start gap-3.5">
        <div className="relative w-10 h-10 md:w-11 md:h-11 flex-shrink-0 mt-0.5">
          <Image
            src={tool.icon}
            alt={tool.name}
            width={44}
            height={44}
            className="w-full h-full object-contain"
          />
        </div>

        <div className="flex-1 text-xs md:text-[13px] leading-[1.4] text-[#D1CECE] pt-0.5">
          {description}
        </div>
      </div>

      {/* Action Row — 14px below content naturally */}
      <div className="flex justify-end mt-3.5">
        <button
          type="button"
          onClick={handleButtonClick}
          className="px-3 py-1 h-[26px] rounded-md bg-[#3478F6] text-white text-xs font-medium hover:bg-[#2563EB] active:scale-97 transition-all focus:outline-none shadow-xs cursor-pointer flex items-center"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};
