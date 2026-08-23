"use client";

import React, { useEffect } from "react";
import { ResponsiveShell } from "@/components/shell/ResponsiveShell";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore } from "@/store/windowStore";
import { Project } from "@/data/projects";
import { Locale } from "@/data/translations";

interface ClientDeepLinkProjectPageProps {
  project: Project;
  locale: Locale;
}

export function ClientDeepLinkProjectPage({ project, locale }: ClientDeepLinkProjectPageProps) {
  const { setLocale, setActiveWorkspace } = useDesktopStore();
  const { openWindow } = useWindowStore();

  useEffect(() => {
    if (locale === "tr" || locale === "en") {
      setLocale(locale);
    }

    if (project) {
      // 1. Switch to project's workspace
      setActiveWorkspace(project.workspace);

      // 2. Open project window automatically
      openWindow({
        id: `project-${project.id}`,
        workspaceId: project.workspace,
        contentId: project.slug,
        type: "project",
        titleTR: `${project.titleTR} — Proje Bilgisi`,
        titleEN: `Information about: ${project.titleEN}`,
        preferredWidth: project.initialWindow.width,
        preferredHeight: project.initialWindow.height,
        extraData: { project }
      });
    }
  }, [locale, project, setLocale, setActiveWorkspace, openWindow]);

  return <ResponsiveShell />;
}
