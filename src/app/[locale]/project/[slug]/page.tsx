import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteConfig } from "@/lib/siteConfig";
import {
  getLocalizedProjectTitle,
  getLocalizedProjectDescription,
  getProjectOgImage,
  generateProjectJsonLd
} from "@/lib/seo";
import { isValidLocale } from "@/lib/i18n";
import { getPublishedProjectBySlug, getPublishedProjects } from "@/lib/portfolio/repository";
import { ClientDeepLinkProjectPage } from "./ClientDeepLinkProjectPage";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) {
    return {};
  }

  const project = await getPublishedProjectBySlug(slug);
  if (!project) {
    return {};
  }

  const isEn = locale === "en";
  const title = getLocalizedProjectTitle(project, locale);
  const description = getLocalizedProjectDescription(project, locale);
  const canonicalUrl = `${siteConfig.url}/${isEn ? "en" : "tr"}/project/${project.slug}`;
  const ogImage = getProjectOgImage(project);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        tr: `${siteConfig.url}/tr/project/${project.slug}`,
        en: `${siteConfig.url}/en/project/${project.slug}`
      }
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: siteConfig.name,
      locale: isEn ? "en_US" : "tr_TR",
      type: "article",
      images: [
        {
          url: ogImage,
          alt: title
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage]
    }
  };
}

export default async function DeepLinkProjectPage({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) {
    notFound();
  }

  const [project, allPublished] = await Promise.all([
    getPublishedProjectBySlug(slug),
    getPublishedProjects()
  ]);

  if (!project) {
    notFound();
  }

  const projectJsonLd = generateProjectJsonLd(project, locale);
  const isEn = locale === "en";
  const localizedTitle = isEn ? project.titleEN : project.titleTR;
  const localizedCategory = isEn ? project.categoryEN : project.categoryTR;
  const localizedSummary = isEn
    ? project.summaryEN || project.descriptionEN
    : project.summaryTR || project.descriptionTR;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(projectJsonLd) }}
      />
      {/* Accessible SEO landmark for search crawlers and screen readers */}
      <article className="sr-only" aria-label={localizedTitle}>
        <h1>{localizedTitle}</h1>
        <p>{localizedCategory} — {project.client} ({project.year})</p>
        <p>{localizedSummary}</p>
      </article>
      <ClientDeepLinkProjectPage
        project={project}
        initialProjects={allPublished}
        locale={locale}
      />
    </>
  );
}
