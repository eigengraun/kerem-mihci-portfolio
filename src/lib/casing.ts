import { Locale } from "@/data/translations";

/**
 * Returns the text in locale-aware uppercase.
 * For Turkish ("tr"):
 *   - "i" -> "İ" (e.g. "iletişim" -> "İLETİŞİM", "eğitim" -> "EĞİTİM", "deneyim" -> "DENEYİM")
 *   - "ı" -> "I" (e.g. "tasarım" -> "TASARIM", "ışık" -> "IŞIK")
 * For English ("en"): standard "en-US" uppercase.
 */
export function toLocaleUpper(text: string | null | undefined, locale: Locale | string = "tr"): string {
  if (!text) return "";
  const langTag = locale === "tr" ? "tr-TR" : "en-US";
  return text.toLocaleUpperCase(langTag);
}

/**
 * Returns the text in locale-aware lowercase.
 * For Turkish ("tr"):
 *   - "İ" -> "i" (e.g. "İLETİŞİM" -> "iletişim", "KİMLİK" -> "kimlik")
 *   - "I" -> "ı" (e.g. "IŞIK" -> "ışık", "TASARIM" -> "tasarım")
 * For English ("en"): standard "en-US" lowercase.
 */
export function toLocaleLower(text: string | null | undefined, locale: Locale | string = "tr"): string {
  if (!text) return "";
  const langTag = locale === "tr" ? "tr-TR" : "en-US";
  return text.toLocaleLowerCase(langTag);
}

/**
 * Search-friendly normalization that treats dotted and dotless I forgivingly
 * to match brand names (e.g. KAGESTUDIO, EMIX, IUCKMK) and Turkish text seamlessly.
 */
function normalizeForSearch(str: string): string {
  return str.toLocaleLowerCase("tr-TR").replace(/ı/g, "i");
}

/**
 * Locale-aware, case-insensitive, and search-friendly string inclusion check.
 */
export function localeIncludes(
  haystack: string | null | undefined,
  needle: string | null | undefined,
  locale: Locale | string = "tr"
): boolean {
  if (!haystack || !needle) return false;
  const hLower = toLocaleLower(haystack, locale);
  const nLower = toLocaleLower(needle, locale);
  if (hLower.includes(nLower)) return true;

  // Search-forgiving fallback for ASCII brand names and mixed I/İ typings
  const hNorm = normalizeForSearch(haystack);
  const nNorm = normalizeForSearch(needle);
  return hNorm.includes(nNorm);
}
