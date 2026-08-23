import { Project } from "@/data/projects";
import { siteConfig } from "./siteConfig";

/**
 * Constructs absolute canonical or asset URL.
 */
export function buildAbsoluteUrl(path: string): string {
  const baseUrl = siteConfig.url.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Returns localized project SEO title (e.g. "Fling Arena — Kerem Mıhçı").
 */
export function getLocalizedProjectTitle(project: Project, locale: string): string {
  if (project.seo) {
    const override = locale === "en" ? project.seo.titleEN : project.seo.titleTR;
    if (override) {
      if (override.includes(siteConfig.name)) return override;
      return `${override} — ${siteConfig.name}`;
    }
  }

  const baseTitle = locale === "en" ? project.titleEN : project.titleTR;
  return `${baseTitle} — ${siteConfig.name}`;
}

/**
 * Returns clean localized project SEO description (stripped of formatting, ~140-165 chars).
 */
export function getLocalizedProjectDescription(project: Project, locale: string): string {
  if (project.seo) {
    const override = locale === "en" ? project.seo.descriptionEN : project.seo.descriptionTR;
    if (override) return override;
  }

  const summary = locale === "en" ? project.summaryEN : project.summaryTR;
  if (summary) return summary.trim();

  const description = locale === "en" ? project.descriptionEN : project.descriptionTR;
  if (description) {
    const cleanStr = description.replace(/<[^>]*>?/gm, "").trim();
    if (cleanStr.length > 165) {
      return `${cleanStr.slice(0, 162)}...`;
    }
    return cleanStr;
  }

  const category = locale === "en" ? project.categoryEN : project.categoryTR;
  return `${project.client} — ${category} (${project.year || "2025"}). ${siteConfig.name} portfolio.`;
}

/**
 * Resolves preferred OG Image for a project with fallback hierarchy:
 * 1. project.seo?.ogImage or project.ogImage
 * 2. project.cover
 * 3. project.thumbnail
 * 4. global default OG image
 */
export function getProjectOgImage(project: Project): string {
  const rawImage =
    project.seo?.ogImage ||
    project.ogImage ||
    project.cover ||
    project.thumbnail ||
    siteConfig.defaultOgImage;

  return buildAbsoluteUrl(rawImage);
}

/**
 * Generates JSON-LD Structured Data for Person / Portfolio Owner.
 */
export function generatePersonJsonLd(locale: string) {
  const isEn = locale === "en";
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: siteConfig.person.name,
    url: siteConfig.url,
    jobTitle: isEn ? siteConfig.person.jobTitleEN : siteConfig.person.jobTitleTR,
    sameAs: siteConfig.person.sameAs
  };
}

/**
 * Generates JSON-LD Structured Data for WebSite.
 */
export function generateWebSiteJsonLd(locale: string) {
  const isEn = locale === "en";
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: `${siteConfig.url}/${isEn ? "en" : "tr"}`,
    description: isEn ? siteConfig.defaultDescriptionEN : siteConfig.defaultDescriptionTR,
    inLanguage: isEn ? "en-US" : "tr-TR"
  };
}
