"use client";

import React from "react";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore } from "@/store/windowStore";
import { getTranslation } from "@/lib/i18n";

interface SystemAlertProps {
  windowId: string;
}

export const SystemAlert: React.FC<SystemAlertProps> = ({ windowId }) => {
  const { locale, activeWorkspace } = useDesktopStore();
  const { closeWindow } = useWindowStore();

  const message = getTranslation(locale, "trash_alert_message");

  return (
    <div className="flex flex-col items-center justify-center p-4 text-center space-y-4 min-h-[140px]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 font-bold text-lg">
          ⚠️
        </div>
        <p className="text-xs md:text-sm font-sans font-medium text-neutral-800 whitespace-pre-line leading-relaxed">
          {message}
        </p>
      </div>

      <button
        type="button"
        onClick={() => closeWindow(windowId, activeWorkspace)}
        className="px-5 py-1.5 rounded-md bg-neutral-900 text-white font-medium text-xs shadow-sm hover:bg-neutral-800 transition-colors focus:outline-none"
      >
        {getTranslation(locale, "trash_alert_ok")}
      </button>
    </div>
  );
};
