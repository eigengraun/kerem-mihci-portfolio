import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projectsData } from "@/data/projects";
import { siteConfig } from "@/lib/siteConfig";
import {
  getLocalizedProjectTitle,
  getLocalizedProjectDescription,
  getProjectOgImage
} from "@/lib/seo";
import { Locale } from "@/data/translations";
import { ClientDeepLinkProjectPage } from "./ClientDeepLinkProjectPage";

export async function generateStaticParams() {
  const locales = ["tr", "en"];
  return locales.flatMap((locale) =>
    projectsData.map((project) => ({
      locale,
      slug: project.slug
    }))
  );
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const project = projectsData.find((p) => p.slug === slug);

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
  const project = projectsData.find((p) => p.slug === slug);

  if (!project) {
    notFound();
  }

  const cleanLocale = (locale === "tr" || locale === "en" ? locale : "tr") as Locale;

  return <ClientDeepLinkProjectPage project={project} locale={cleanLocale} />;
}
