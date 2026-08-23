/**
 * Portfolio OS Entry Storage & 24-Hour Bypass Manager
 *
 * Persists the Unix timestamp (ms) of the last successful desktop login.
 * Bypasses the cinematic boot + login experience on eligible desktop for 24 hours.
 */

export const ENTRY_STORAGE_KEY = "portfolioOS:entry:v1:lastEnteredAt";
export const ENTRY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds (86,400,000 ms)

/**
 * Checks whether the user has a valid, unexpired 24-hour desktop login timestamp.
 * Returns true if the entry experience should be bypassed.
 */
export function getEntryBypassStatus(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const rawValue = localStorage.getItem(ENTRY_STORAGE_KEY);
    if (!rawValue) {
      return false;
    }

    const lastEnteredAt = Number(rawValue);
    if (!Number.isFinite(lastEnteredAt)) {
      return false;
    }

    const now = Date.now();
    const age = now - lastEnteredAt;

    // Must be in the past (age >= 0) and strictly within 24 hours
    const isValid = age >= 0 && age < ENTRY_TTL_MS;

    return isValid;
  } catch (err) {
    console.warn("Could not read portfolio entry storage:", err);
    return false;
  }
}

/**
 * Records a successful desktop entry by writing the current Unix timestamp.
 * Only called when the user explicitly enters via the "Oturum Aç" / "Enter Portfolio" action.
 */
export function markPortfolioEntered(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(ENTRY_STORAGE_KEY, String(Date.now()));
  } catch (err) {
    console.warn("Could not write portfolio entry storage:", err);
  }
}

/**
 * Clears the stored desktop entry timestamp (useful for development reset).
 */
export function clearEntryBypass(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(ENTRY_STORAGE_KEY);
  } catch (err) {
    console.warn("Could not clear portfolio entry storage:", err);
  }
}
