"use client";

import React, { Suspense } from "react";
import Script from "next/script";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";
import { useAnalyticsConsent } from "@/lib/analyticsConsent";
import { AnalyticsTracker } from "./AnalyticsTracker";
import { ConsentBanner } from "./ConsentBanner";

/**
 * Global Google Analytics 4 & Consent Mode v2 Component.
 *
 * Implements Basic Consent Mode:
 * - Before consent (or if rejected): No GA scripts, cookies, or measurement hits are created.
 * - When accepted in production: Initializes gtag with `analytics_storage: granted` and loads GA4.
 */
export const GoogleAnalytics: React.FC = () => {
  const consent = useAnalyticsConsent();

  // If GA Measurement ID is not configured, remain completely dormant
  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  const isAccepted = consent === "accepted";
  const shouldLoadScripts = process.env.NODE_ENV === "production" && isAccepted;

  return (
    <>
      {/* Show minimal consent notice if visitor has not yet made a decision */}
      {consent === null && <ConsentBanner />}

      {/* Basic Consent Mode: Load gtag.js strictly after explicit consent in production */}
      {shouldLoadScripts && (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          />

          <Script
            id="google-analytics-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('consent', 'default', {
                  analytics_storage: 'granted',
                  ad_storage: 'denied',
                  ad_user_data: 'denied',
                  ad_personalization: 'denied'
                });
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}', {
                  send_page_view: false
                });
              `
            }}
          />

          <Suspense fallback={null}>
            <AnalyticsTracker />
          </Suspense>
        </>
      )}
    </>
  );
};
