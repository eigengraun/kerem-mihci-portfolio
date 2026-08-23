export interface WorkspaceConfig {
  id: "design" | "web" | "motion-ai";
  order: number;
  code: string;
  titleTR: string;
  titleEN: string;
  wallpaper: string;
  wallpaperLight: string;
  wallpaperDark: string;
  wallpaperPosition?: string;
  descriptionTR: string;
  descriptionEN: string;
}

export const workspacesData: WorkspaceConfig[] = [
  {
    id: "design",
    order: 1,
    code: "01",
    titleTR: "TASARIM",
    titleEN: "DESIGN",
    wallpaper: "/assets/wallpapers/workspace-design-dark.webp",
    wallpaperLight: "/assets/wallpapers/workspace-design-light.webp",
    wallpaperDark: "/assets/wallpapers/workspace-design-dark.webp",
    wallpaperPosition: "50% 50%",
    descriptionTR: "Grafik tasarım, marka kimliği, logo, editoryal ve dergi tasarımları.",
    descriptionEN: "Graphic design, brand identity, logo, editorial and magazine layouts."
  },
  {
    id: "web",
    order: 2,
    code: "02",
    titleTR: "WEB",
    titleEN: "WEB",
    wallpaper: "/assets/wallpapers/workspace-web-dark.webp",
    wallpaperLight: "/assets/wallpapers/workspace-web-light.webp",
    wallpaperDark: "/assets/wallpapers/workspace-web-dark.webp",
    wallpaperPosition: "50% 50%",
    descriptionTR: "Web tasarımı, web geliştirme, UI/UX, SEO ve dijital optimizasyon.",
    descriptionEN: "Web design, web development, UI/UX, SEO and digital optimization."
  },
  {
    id: "motion-ai",
    order: 3,
    code: "03",
    titleTR: "PRODÜKSİYON",
    titleEN: "PRODUCTION",
    wallpaper: "/assets/wallpapers/workspace-production-dark.webp",
    wallpaperLight: "/assets/wallpapers/workspace-production-light.webp",
    wallpaperDark: "/assets/wallpapers/workspace-production-dark.webp",
    wallpaperPosition: "50% 50%",
    descriptionTR: "Video kurgu, reels, motion graphics, video prodüksiyon ve AI destekli kreatif video süreçleri.",
    descriptionEN: "Video editing, reels, motion graphics, video production and AI-assisted creative video workflows."
  }
];
