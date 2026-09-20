/**
 * Centralized Google Analytics Consent Mode v2 & Local Storage Manager
 *
 * Implements Google Basic Consent Mode:
 * - Before consent: Zero GA tags are loaded, zero measurement requests sent, zero cookies set.
 * - When accepted: `analytics_storage` is granted. `ad_storage`, `ad_user_data`, and `ad_personalization` remain strictly denied.
 * - When rejected: All consent states remain denied and GA scripts are never loaded.
 */

import { useSyncExternalStore } from "react";

export const ANALYTICS_CONSENT_KEY = "portfolioOS:privacy:analyticsConsent:v1";
export const ANALYTICS_CONSENT_CHANGE_EVENT = "portfolioOS:analyticsConsentChange";

export type AnalyticsConsentValue = "accepted" | "rejected";
export type AnalyticsConsent = AnalyticsConsentValue | null;

export interface StoredConsentRecord {
  value: AnalyticsConsentValue;
  updatedAt: number;
}

/**
 * Safely reads the visitor's stored analytics consent preference on the client.
 * Returns null if no choice has been made yet (first visit) or during SSR.
 */
export function getStoredConsent(): AnalyticsConsent {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (!raw) return null;

    // Handle parsed JSON record or fallback string
    if (raw === "accepted" || raw === "rejected") {
      return raw;
    }

    const parsed = JSON.parse(raw) as StoredConsentRecord;
    if (parsed && (parsed.value === "accepted" || parsed.value === "rejected")) {
      return parsed.value;
    }
  } catch (err) {
    console.warn("Could not read analytics consent storage:", err);
  }

  return null;
}

/**
 * Persists the visitor's analytics consent choice and notifies any mounted components.
 */
export function setStoredConsent(value: AnalyticsConsentValue): void {
  if (typeof window === "undefined") return;

  try {
    const record: StoredConsentRecord = {
      value,
      updatedAt: Date.now()
    };
    localStorage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify(record));

    // Dispatch custom event for real-time reactive updates across components
    window.dispatchEvent(
      new CustomEvent<AnalyticsConsentValue>(ANALYTICS_CONSENT_CHANGE_EVENT, {
        detail: value
      })
    );
  } catch (err) {
    console.warn("Could not persist analytics consent:", err);
  }
}

/**
 * Applies Google Consent Mode v2 parameters via window.gtag.
 * Guarantees that advertising consent categories are ALWAYS denied.
 */
export function applyConsentMode(consent: AnalyticsConsentValue): void {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };
  }

  const isGranted = consent === "accepted";

  window.gtag("consent", "update", {
    analytics_storage: isGranted ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  });
}

/**
 * Safely removes Google Analytics cookies (_ga, _ga_*) scoped to the current site.
 */
export function clearAnalyticsCookies(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  try {
    const cookies = document.cookie.split(";");
    const hostname = window.location.hostname;
    const domainParts = hostname.split(".");

    for (const cookie of cookies) {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();

      if (name.startsWith("_ga")) {
        // Clear root path on current host
        document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;`;
        document.cookie = `${name}=; Path=/; Domain=${hostname}; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;`;

        // Clear parent domain if multi-part (e.g. .keremmihci.com)
        if (domainParts.length >= 2) {
          const rootDomain = domainParts.slice(-2).join(".");
          document.cookie = `${name}=; Path=/; Domain=.${rootDomain}; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;`;
        }
      }
    }
  } catch (err) {
    console.warn("Could not clear analytics cookies:", err);
  }
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): AnalyticsConsent {
  return getStoredConsent();
}

function getServerSnapshot(): AnalyticsConsent {
  return null;
}

/**
 * Idiomatic React 18/19 hook subscribing to analytics consent changes without cascading render warnings.
 */
export function useAnalyticsConsent(): AnalyticsConsent {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

