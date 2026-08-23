import { MetadataRoute } from "next";
import { projectsData } from "@/data/projects";
import { siteConfig } from "@/lib/siteConfig";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.url.replace(/\/$/, "");

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

  // Dynamic project routes for ALL legitimate portfolio projects (featured + non-featured)
  const projectRoutes: MetadataRoute.Sitemap = projectsData.flatMap((project) => [
    {
      url: `${baseUrl}/tr/project/${project.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: project.featured ? 0.8 : 0.6
    },
    {
      url: `${baseUrl}/en/project/${project.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: project.featured ? 0.8 : 0.6
    }
  ]);

  return [...homeRoutes, ...projectRoutes];
}
