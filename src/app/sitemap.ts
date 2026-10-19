import { MetadataRoute } from "next";
import { siteConfig } from "@/lib/siteConfig";
import { getPublishedProjects } from "@/lib/portfolio/repository";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url.replace(/\/$/, "");
  const publishedProjects = await getPublishedProjects();

  // Homepage routes (Turkish & English)
  const homeRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/tr`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0
    },
    {
      url: `${baseUrl}/en`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0
    }
  ];

  // Dynamic project routes for ALL published portfolio projects
  const projectRoutes: MetadataRoute.Sitemap = publishedProjects.flatMap((project) => {
    const modDate = project.updatedAt ? new Date(project.updatedAt) : new Date();
    return [
      {
        url: `${baseUrl}/tr/project/${project.slug}`,
        lastModified: modDate,
        changeFrequency: "monthly" as const,
        priority: project.featured ? 0.8 : 0.6
      },
      {
        url: `${baseUrl}/en/project/${project.slug}`,
        lastModified: modDate,
        changeFrequency: "monthly" as const,
        priority: project.featured ? 0.8 : 0.6
      }
    ];
  });

  return [...homeRoutes, ...projectRoutes];
}
