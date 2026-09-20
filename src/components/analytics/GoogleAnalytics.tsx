import React, { Suspense } from "react";
import Script from "next/script";
import { GA_MEASUREMENT_ID, isAnalyticsActive } from "@/lib/analytics";
import { AnalyticsTracker } from "./AnalyticsTracker";

/**
 * Global Google Analytics 4 Component.
 * Injected once into the root layout.
 *
 * Automatically stays dormant if:
 * 1. NODE_ENV !== "production"
 * 2. NEXT_PUBLIC_GA_MEASUREMENT_ID is missing or undefined
 */
export const GoogleAnalytics: React.FC = () => {
  if (!isAnalyticsActive() || !GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      {/* Google Analytics 4 tag library */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />

      {/* Initialize dataLayer and configure measurement ID with manual page_view dispatch */}
      <Script
        id="google-analytics-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              send_page_view: false
            });
          `
        }}
      />

      {/* Track initial page load and App Router client-side navigation within a Suspense boundary */}
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
    </>
  );
};
