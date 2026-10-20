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

interface ClientLocalePageProps {
  initialProjects?: Project[];
  initialVideos?: PortfolioVideo[];
  initialGallery?: GalleryItem[];
  isCmsMode?: boolean;
}

export function ClientLocalePage({ initialProjects, initialVideos, initialGallery, isCmsMode = false }: ClientLocalePageProps) {
  const params = useParams();
  const locale = (params?.locale as Locale) || "tr";
  const { setLocale } = useDesktopStore();
  const hydrateProjects = useSessionStore((s) => s.hydrateProjects);
  const hydrateVideos = useSessionStore((s) => s.hydrateVideos);
  const hydrateGallery = useSessionStore((s) => s.hydrateGallery);

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
    if (locale === "tr" || locale === "en") {
      setLocale(locale);
      if (typeof document !== "undefined") {
        document.documentElement.lang = locale;
      }
    }
  }, [locale, setLocale]);

  return <ResponsiveShell />;
}
