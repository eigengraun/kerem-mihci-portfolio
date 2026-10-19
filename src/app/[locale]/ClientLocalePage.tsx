"use client";

import React, { useEffect } from "react";
import { useParams } from "next/navigation";
import { ResponsiveShell } from "@/components/shell/ResponsiveShell";
import { useDesktopStore } from "@/store/desktopStore";
import { useSessionStore } from "@/store/sessionStore";
import { Locale } from "@/data/translations";
import type { Project } from "@/data/projects";

interface ClientLocalePageProps {
  initialProjects?: Project[];
}

export function ClientLocalePage({ initialProjects }: ClientLocalePageProps) {
  const params = useParams();
  const locale = (params?.locale as Locale) || "tr";
  const { setLocale } = useDesktopStore();
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
  }, [locale, setLocale]);

  return <ResponsiveShell />;
}
