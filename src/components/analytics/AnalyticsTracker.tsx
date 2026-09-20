"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pageview } from "@/lib/analytics";

/**
 * Route-change observer for Next.js App Router.
 * Must be wrapped in a <Suspense> boundary because it utilizes `useSearchParams()`.
 */
export const AnalyticsTracker: React.FC = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    const queryString = searchParams?.toString();
    const currentUrl = queryString ? `${pathname}?${queryString}` : pathname;

    // Deduplicate: do not fire if the full URL has not changed
    if (lastTrackedUrlRef.current === currentUrl) {
      return;
    }

    lastTrackedUrlRef.current = currentUrl;
    pageview(currentUrl);
  }, [pathname, searchParams]);

  return null;
};
