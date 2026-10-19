"use client";

import React, { useEffect } from "react";
import { ResponsiveShell } from "@/components/shell/ResponsiveShell";
import { useDesktopStore } from "@/store/desktopStore";
import { useWindowStore } from "@/store/windowStore";
import { useSessionStore } from "@/store/sessionStore";
import { Project } from "@/data/projects";
import { Locale } from "@/data/translations";

interface ClientDeepLinkProjectPageProps {
  project: Project;
  initialProjects?: Project[];
  locale: Locale;
}

export function ClientDeepLinkProjectPage({
  project,
  initialProjects,
  locale
}: ClientDeepLinkProjectPageProps) {
  const { setLocale, setActiveWorkspace } = useDesktopStore();
  const { openWindow } = useWindowStore();
  const hydrateProjects = useSessionStore((s) => s.hydrateProjects);

  useEffect(() => {
    if (Array.isArray(initialProjects) && initialProjects.length > 0) {
      hydrateProjects(initialProjects);
    }
  }, [initialProjects, hydrateProjects]);

  useEffect(() => {
    if (locale === "tr" || locale === "en") {
      setLocale(locale);
      if (typeof document !== "undefined") {
        document.documentElement.lang = locale;
      }
    }

    if (project) {
      // 1. Switch to project's workspace
      setActiveWorkspace(project.workspace);

      // 2. Open project window automatically with consistent slug-based ID
      openWindow({
        id: `project-${project.slug}`,
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
