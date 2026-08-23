"use client";

import React from "react";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore, WindowInstance } from "@/store/windowStore";
import { WindowFrame } from "./WindowFrame";
import { ProjectApp } from "@/components/applications/ProjectApp";
import { AboutApp } from "@/components/applications/AboutApp";
import { ProjectsApp } from "@/components/applications/ProjectsApp";
import { GalleryApp } from "@/components/applications/GalleryApp";
import { VideoApp } from "@/components/applications/VideoApp";
import { ContactApp } from "@/components/applications/ContactApp";
import { CvApp } from "@/components/applications/CvApp";
import { SystemAlert } from "@/components/applications/SystemAlert";
import { MediaViewer } from "@/components/ui/MediaViewer";
import { ToolInfoApp } from "@/components/applications/ToolInfoApp";
import { NotesApp } from "@/components/applications/NotesApp";
import { TrashApp } from "@/components/applications/TrashApp";
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
        return <ProjectApp project={found} />;
      }
      case "about":
        return <AboutApp />;
      case "projects":
        return <ProjectsApp />;
      case "gallery":
        return <GalleryApp />;
      case "video":
        return <VideoApp />;
      case "contact":
        return <ContactApp />;
      case "cv":
        return <CvApp />;
      case "alert":
        return <SystemAlert windowId={win.id} />;
      case "image-viewer":
        return <MediaViewer src={win.extraData?.src as string} title={win.extraData?.title as string} />;
      case "tool-info": {
        const toolId = (win.contentId as string) || (win.extraData?.toolId as string);
        const tool =
          (toolId ? toolInfoData[toolId] : null) ||
          (win.extraData?.tool as typeof toolInfoData[string]) ||
          toolInfoData.photoshop;

        return <ToolInfoApp tool={tool} windowId={win.id} />;
      }

      case "notes":
        return <NotesApp />;
      case "trash":
        return <TrashApp />;
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
