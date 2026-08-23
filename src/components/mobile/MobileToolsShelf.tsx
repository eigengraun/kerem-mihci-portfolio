"use client";

import React from "react";
import Image from "next/image";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore } from "@/store/windowStore";
import { dockConfig } from "@/data/dock";
import { toolInfoData } from "@/data/toolInfo";
import { toLocaleUpper } from "@/lib/casing";

interface MobileToolsShelfProps {
  onClose: () => void;
}

const iconPaths: Record<string, string> = {
  photoshop: "/assets/apps/photoshop.svg",
  illustrator: "/assets/apps/illustrator.svg",
  figma: "/assets/icons/apps/figma.svg",
  canva: "/assets/icons/apps/canva.svg",
  wordpress: "/assets/icons/apps/wordpress.svg",
  vscode: "/assets/icons/apps/vscode.svg",
  antigravity: "/assets/icons/apps/antigravity.svg",
  premiere: "/assets/apps/premiere.svg",
  aftereffects: "/assets/apps/after-effects.svg",
  capcut: "/assets/icons/apps/capcut.svg",
  higgsfield: "/assets/icons/apps/higgsfield.svg"
};

export const MobileToolsShelf: React.FC<MobileToolsShelfProps> = ({ onClose }) => {
  const { activeWorkspace, locale } = useDesktopStore();
  const { openWindow, bringToFront, windows } = useWindowStore();

  const workspaceTools = (dockConfig[activeWorkspace] || []).filter(
    (item) => item.actionType === "openToolInfo"
  );

  const handleOpenTool = (toolId: string) => {
    onClose();
    const info = toolInfoData[toolId];
    if (!info) return;

    const windowId = `tool-info-${toolId}`;
    const isAlreadyOpen = windows[activeWorkspace]?.some((w) => w.id === windowId);

    if (isAlreadyOpen) {
      bringToFront(windowId, activeWorkspace);
    } else {
      openWindow({
        id: windowId,
        type: "tool-info",
        contentId: toolId,
        titleTR: locale === "tr" ? info.titleTR : info.titleEN,
        titleEN: locale === "tr" ? info.titleTR : info.titleEN,
        extraData: { toolId },
        width: 320,
        height: 280
      });
    }
  };

  return (
    <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-[360px] p-3 rounded-2xl backdrop-blur-xl bg-neutral-900/90 border border-white/20 shadow-2xl flex items-center justify-around gap-2 select-none animate-in fade-in slide-in-from-bottom-2 duration-200">
      {workspaceTools.map((item) => {
        const iconSrc = iconPaths[item.iconType];
        const label = locale === "tr" ? item.titleTR : item.titleEN;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => item.toolId && handleOpenTool(item.toolId)}
            className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-90 transition-transform group p-1"
          >
            <div className="w-10 h-10 rounded-[10px] overflow-hidden flex items-center justify-center bg-transparent border border-white/10 shadow-xs">
              {iconSrc ? (
                <Image
                  src={iconSrc}
                  alt=""
                  width={40}
                  height={40}
                  className="w-full h-full object-cover select-none pointer-events-none"
                  unoptimized={iconSrc.endsWith(".svg")}
                />
              ) : (
                <span lang={locale} className="font-bold text-xs text-white font-mono">
                  {toLocaleUpper(item.iconType.slice(0, 2), locale)}
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono text-white/90 text-center truncate max-w-[64px]">
              {label.split(" ")[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
};
