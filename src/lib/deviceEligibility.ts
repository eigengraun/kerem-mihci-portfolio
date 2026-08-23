/**
 * Device Eligibility Helper for Desktop-Only Boot + Login Experience
 *
 * Strict desktop-only criteria:
 * - Minimum viewport width >= 1024px
 * - Fine pointer ((pointer: fine))
 * - Hover capability ((hover: hover))
 * - Non-touch primary device (navigator.maxTouchPoints === 0)
 * - Excludes all mobile devices, iPhones, Androids, and tablets (including iPad Pro landscape)
 */

export function isDesktopEntryEligible(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  // 1. Basic viewport width requirement (must be wide desktop)
  if (window.innerWidth < 1024) {
    return false;
  }

  // 2. Strict touch capability check:
  // All iPads, iPhones, Android phones and tablets have maxTouchPoints >= 1 (typically 5 or 10).
  // Pure desktop setups (macOS MacBook/iMac, Windows PC, Linux) have maxTouchPoints === 0.
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  if (maxTouchPoints > 0) {
    return false;
  }

  // 3. Media query checks for fine pointer and true hover capability
  const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
  const hasHover = window.matchMedia("(hover: hover)").matches;
  const isCoarse = window.matchMedia("(pointer: coarse)").matches;

  if (!hasFinePointer || !hasHover || isCoarse) {
    return false;
  }

  // 4. Secondary user-agent safeguard against simulated desktop agents on tablets
  const ua = navigator.userAgent || "";
  const isTabletOrMobileUA =
    /iPad|iPhone|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini|Tablet/i.test(ua) ||
    // iPadOS 13+ desktop-class Safari user agent spoof (Macintosh + touch points)
    (ua.includes("Macintosh") && maxTouchPoints > 1);

  if (isTabletOrMobileUA) {
    return false;
  }

  return true;
}
