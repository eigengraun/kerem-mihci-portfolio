export interface SiteConfig {
  name: string;
  owner: string;
  locationTR: string;
  locationEN: string;
  email: string;
  instagramUrl: string;
  instagramDisplay: string;
  githubUrl: string;
  rolesTR: string[];
  rolesEN: string[];
  areas: string[];
}

export const siteConfig: SiteConfig = {
  name: "Kerem Portfolio OS",
  owner: "Kerem Mıhçı",
  locationTR: "İstanbul, Türkiye",
  locationEN: "Istanbul, Turkey",
  email: "info@keremmihci.com",
  instagramUrl: "https://www.instagram.com/kerem.mhc/",
  instagramDisplay: "@kerem.mhc",
  githubUrl: "", // Render only if non-empty
  rolesTR: [
    "Tasarımcı",
    "Web Tasarımcısı",
    "Dijital İçerik Üreticisi"
  ],
  rolesEN: [
    "Designer",
    "Web Designer",
    "Digital Creator"
  ],
  areas: [
    "Web Design",
    "Web Development",
    "Graphic Design",
    "Brand Identity",
    "Logo Design",
    "Editorial Design",
    "Social Media Design",
    "Digital Marketing",
    "SEO",
    "UI/UX",
    "AI-Assisted Creative Production",
    "Video Production",
    "Reels",
    "Motion",
    "Product Visualization"
  ]
};
