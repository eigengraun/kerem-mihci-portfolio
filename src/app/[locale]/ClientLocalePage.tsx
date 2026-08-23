"use client";

import React, { useEffect } from "react";
import { useParams } from "next/navigation";
import { ResponsiveShell } from "@/components/shell/ResponsiveShell";
import { useDesktopStore } from "@/store/desktopStore";
import { Locale } from "@/data/translations";

export function ClientLocalePage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || "tr";
  const { setLocale } = useDesktopStore();

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
