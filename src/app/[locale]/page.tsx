import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteConfig } from "@/lib/siteConfig";
import { generatePersonJsonLd, generateWebSiteJsonLd } from "@/lib/seo";
import { isValidLocale } from "@/lib/i18n";
import type {
  CmsProfileRecord,
  CmsWorkspaceNote,
  CmsExperienceItem,
  CmsEducationItem,
  CmsSkillItem,
  CmsCvDocument
} from "@/lib/portfolio/types";
import {
  getPublishedProjects,
  getPublishedVideos,
  getPublishedGallery,
  getCmsDataSource,
  getPublishedProfile,
  getPublishedWorkspaceNotes,
  getPublishedExperience,
  getPublishedEducation,
  getPublishedSkills,
  getPublishedCv
} from "@/lib/portfolio/repository";
import { ClientLocalePage } from "./ClientLocalePage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) {
    return {};
  }

  const isEn = locale === "en";
  const title = isEn ? siteConfig.defaultTitleEN : siteConfig.defaultTitleTR;
  const description = isEn ? siteConfig.defaultDescriptionEN : siteConfig.defaultDescriptionTR;
  const canonicalUrl = `${siteConfig.url}/${isEn ? "en" : "tr"}`;
  const ogImage = `${siteConfig.url}/branding/og-default.png`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        tr: `${siteConfig.url}/tr`,
        en: `${siteConfig.url}/en`
      }
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: siteConfig.name,
      locale: isEn ? "en_US" : "tr_TR",
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
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

export default async function LocaleDesktopPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) {
    notFound();
  }

  const isCmsMode = getCmsDataSource() !== "legacy";

  const [
    publishedProjects,
    publishedVideos,
    publishedGallery
  ] = await Promise.all([
    getPublishedProjects(),
    getPublishedVideos(),
    getPublishedGallery()
  ]);

  let publishedProfile: CmsProfileRecord | null = null;
  let designNotes: CmsWorkspaceNote[] = [];
  let webNotes: CmsWorkspaceNote[] = [];
  let motionAiNotes: CmsWorkspaceNote[] = [];
  let publishedExperience: CmsExperienceItem[] = [];
  let publishedEducation: CmsEducationItem[] = [];
  let publishedSkills: CmsSkillItem[] = [];
  let cvTr: CmsCvDocument | null = null;
  let cvEn: CmsCvDocument | null = null;
  let isDegraded = false;
  let errorMessage: string | undefined = undefined;

  if (isCmsMode) {
    try {
      [
        publishedProfile,
        designNotes,
        webNotes,
        motionAiNotes,
        publishedExperience,
        publishedEducation,
        publishedSkills,
        cvTr,
        cvEn
      ] = await Promise.all([
        getPublishedProfile(),
        getPublishedWorkspaceNotes("design"),
        getPublishedWorkspaceNotes("web"),
        getPublishedWorkspaceNotes("motion-ai"),
        getPublishedExperience(),
        getPublishedEducation(),
        getPublishedSkills(),
        getPublishedCv("tr"),
        getPublishedCv("en")
      ]);
    } catch (err) {
      isDegraded = true;
      errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[LocaleDesktopPage] Phase 5 CMS fetch failed (failing closed):", errorMessage);
    }
  }
  const personJsonLd = generatePersonJsonLd(locale);
  const websiteJsonLd = generateWebSiteJsonLd(locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <ClientLocalePage
        initialProjects={publishedProjects}
        initialVideos={publishedVideos}
        initialGallery={publishedGallery}
        initialPhase5={{
          profile: publishedProfile,
          notes: {
            design: designNotes,
            web: webNotes,
            "motion-ai": motionAiNotes
          },
          experience: publishedExperience,
          education: publishedEducation,
          skills: publishedSkills,
          cv: { tr: cvTr, en: cvEn },
          isDegraded,
          errorMessage
        }}
        isCmsMode={isCmsMode}
      />
    </>
  );
}
