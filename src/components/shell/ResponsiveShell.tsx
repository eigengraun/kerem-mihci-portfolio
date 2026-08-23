"use client";

import React, { useState, useEffect } from "react";
import { DesktopShell } from "@/components/desktop/DesktopShell";
import { MobileShell } from "@/components/mobile/MobileShell";

export const ResponsiveShell: React.FC = () => {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    
    const updateMatches = () => {
      setIsMobile(mediaQuery.matches);
    };

    updateMatches();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateMatches);
      return () => mediaQuery.removeEventListener("change", updateMatches);
    } else {
      mediaQuery.addListener(updateMatches);
      return () => mediaQuery.removeListener(updateMatches);
    }
  }, []);

  if (isMobile === null) {
    return null;
  }

  return isMobile ? <MobileShell /> : <DesktopShell />;
};
