/**
 * Google Analytics 4 (GA4) Integration Helper
 *
 * Centralized utility for initializing and sending GA4 events.
 * Safe for production, SSR, and client-side App Router navigation.
 */

import { getStoredConsent } from "./analyticsConsent";

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Returns true only in production runtime when:
 * 1. A valid GA Measurement ID is configured
 * 2. The visitor has explicitly granted analytics consent ("accepted")
 *
 * Guarantees Basic Consent Mode: zero analytics hits without explicit acceptance.
 */
export function isAnalyticsActive(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    Boolean(GA_MEASUREMENT_ID) &&
    getStoredConsent() === "accepted"
  );
}

// Lightweight window augmentation for gtag & dataLayer without external package bloat
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (command: string, ...args: unknown[]) => void;
  }
}

/**
 * Dispatches a sanitized page_view event to Google Analytics.
 * Only executes on the client in production mode when analytics is active.
 *
 * @param url Clean relative path or path with query params (e.g., "/tr", "/en/project/xyz")
 * @param title Optional page title; defaults to document.title
 */
export function pageview(url: string, title?: string): void {
  if (typeof window === "undefined" || !isAnalyticsActive() || !GA_MEASUREMENT_ID) {
    return;
  }

  // Ensure dataLayer & gtag function queue exist even if script is still downloading
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };
  }

  window.gtag("event", "page_view", {
    page_path: url,
    page_location: window.location.href,
    page_title: title || (typeof document !== "undefined" ? document.title : ""),
    send_to: GA_MEASUREMENT_ID
  });
}
