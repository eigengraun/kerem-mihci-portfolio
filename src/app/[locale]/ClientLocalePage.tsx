"use client";

import React, { useEffect } from "react";
import { useParams } from "next/navigation";
import { ResponsiveShell } from "@/components/shell/ResponsiveShell";
import { useDesktopStore } from "@/store/desktopStore";
import { useSessionStore } from "@/store/sessionStore";
import { Locale } from "@/data/translations";
import type { Project } from "@/data/projects";
import type { PortfolioVideo } from "@/data/videos";
import type { GalleryItem } from "@/data/gallery";
import type {
  CmsProfileRecord,
  CmsWorkspaceNote,
  CmsExperienceItem,
  CmsEducationItem,
  CmsSkillItem,
  CmsCvDocument
} from "@/lib/portfolio/types";

export interface Phase5InitialData {
  profile?: CmsProfileRecord | null;
  notes?: Record<string, CmsWorkspaceNote[]>;
  experience?: CmsExperienceItem[];
  education?: CmsEducationItem[];
  skills?: CmsSkillItem[];
  cv?: { tr: CmsCvDocument | null; en: CmsCvDocument | null };
}

interface ClientLocalePageProps {
  initialProjects?: Project[];
  initialVideos?: PortfolioVideo[];
  initialGallery?: GalleryItem[];
  initialPhase5?: Phase5InitialData;
  isCmsMode?: boolean;
}

export function ClientLocalePage({ initialProjects, initialVideos, initialGallery, initialPhase5, isCmsMode = false }: ClientLocalePageProps) {
  const params = useParams();
  const locale = (params?.locale as Locale) || "tr";
  const { setLocale } = useDesktopStore();
  const hydrateProjects = useSessionStore((s) => s.hydrateProjects);
  const hydrateVideos = useSessionStore((s) => s.hydrateVideos);
  const hydrateGallery = useSessionStore((s) => s.hydrateGallery);
  const hydratePhase5Content = useSessionStore((s) => s.hydratePhase5Content);

  // Synchronous first-render hydration to prevent any flash of static fallback data
  const isHydratedRef = React.useRef<boolean | null>(null);
  if (isHydratedRef.current == null) {
    if (Array.isArray(initialVideos)) {
      useSessionStore.getState().hydrateVideos(initialVideos, isCmsMode);
    }
    if (Array.isArray(initialGallery)) {
      useSessionStore.getState().hydrateGallery(initialGallery, isCmsMode);
    }
    if (Array.isArray(initialProjects) && initialProjects.length > 0) {
      useSessionStore.getState().hydrateProjects(initialProjects);
    }
    if (initialPhase5) {
      useSessionStore.getState().hydratePhase5Content(initialPhase5);
    }
    isHydratedRef.current = true;
  }

  useEffect(() => {
    if (Array.isArray(initialProjects) && initialProjects.length > 0) {
      hydrateProjects(initialProjects);
    }
  }, [initialProjects, hydrateProjects]);

  useEffect(() => {
    if (Array.isArray(initialVideos)) {
      hydrateVideos(initialVideos, isCmsMode);
    }
  }, [initialVideos, hydrateVideos, isCmsMode]);

  useEffect(() => {
    if (Array.isArray(initialGallery)) {
      hydrateGallery(initialGallery, isCmsMode);
    }
  }, [initialGallery, hydrateGallery, isCmsMode]);

  useEffect(() => {
    if (initialPhase5) {
      hydratePhase5Content(initialPhase5);
    }
  }, [initialPhase5, hydratePhase5Content]);

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
