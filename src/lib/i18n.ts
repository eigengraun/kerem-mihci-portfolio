import { translations, Locale } from "@/data/translations";

export function getTranslation(locale: Locale, key: keyof typeof translations["tr"]): string {
  const dict = translations[locale] || translations.tr;
  return dict[key] || translations.tr[key] || String(key);
}

export function isValidLocale(locale: string): locale is Locale {
  return locale === "tr" || locale === "en";
}
