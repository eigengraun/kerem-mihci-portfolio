"use client";

import React from "react";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore, WindowInstance } from "@/store/windowStore";
import { WindowFrame } from "./WindowFrame";
import {
  DynamicProjectApp,
  DynamicAboutApp,
  DynamicProjectsApp,
  DynamicGalleryApp,
  DynamicVideoApp,
  DynamicContactApp,
  DynamicCvApp,
  DynamicSystemAlert,
  DynamicMediaViewer,
  DynamicToolInfoApp,
  DynamicNotesApp,
  DynamicTrashApp
} from "./dynamicApps";
import { projectsData } from "@/data/projects";
import { toolInfoData } from "@/data/toolInfo";

export const WindowManager: React.FC = () => {
  const { activeWorkspace } = useDesktopStore();
  const { windows } = useWindowStore();

  const currentWindows = windows[activeWorkspace] || [];

  const renderWindowContent = (win: WindowInstance) => {
    switch (win.type) {
      case "project": {
        const found = projectsData.find((p) => p.slug === win.contentId) || (win.extraData?.project as typeof projectsData[0]);
        if (!found) {
          return <div className="p-4 text-xs font-mono text-neutral-500">Project data not found.</div>;
        }
        return <DynamicProjectApp project={found} />;
      }
      case "about":
        return <DynamicAboutApp />;
      case "projects":
        return <DynamicProjectsApp />;
      case "gallery":
        return <DynamicGalleryApp />;
      case "video":
        return <DynamicVideoApp />;
      case "contact":
        return <DynamicContactApp />;
      case "cv":
        return <DynamicCvApp />;
      case "alert":
        return <DynamicSystemAlert windowId={win.id} />;
      case "image-viewer":
        return <DynamicMediaViewer src={win.extraData?.src as string} title={win.extraData?.title as string} />;
      case "tool-info": {
        const toolId = (win.contentId as string) || (win.extraData?.toolId as string);
        const tool =
          (toolId ? toolInfoData[toolId] : null) ||
          (win.extraData?.tool as typeof toolInfoData[string]) ||
          toolInfoData.photoshop;

        return <DynamicToolInfoApp tool={tool} windowId={win.id} />;
      }

      case "notes":
        return <DynamicNotesApp />;
      case "trash":
        return <DynamicTrashApp />;
      default:
        return <div className="p-4 text-xs font-mono text-neutral-500">Unknown application content.</div>;
    }
  };

  return (
    <div className="workspace-window-layer fixed inset-0 pointer-events-none z-30">
      {currentWindows.map((win) => (
        <div key={win.id} className="pointer-events-auto" data-prevent-workspace-wheel="true">
          <WindowFrame window={win}>
            {renderWindowContent(win)}
          </WindowFrame>
        </div>
      ))}
    </div>
  );
};
