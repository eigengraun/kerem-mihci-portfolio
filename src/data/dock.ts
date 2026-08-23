export interface DockItemConfig {
  id: string;
  workspaceId?: "design" | "web" | "motion-ai" | "all";
  titleTR: string;
  titleEN: string;
  iconType:
    | "photoshop"
    | "illustrator"
    | "figma"
    | "canva"
    | "wordpress"
    | "vscode"
    | "antigravity"
    | "premiere"
    | "aftereffects"
    | "capcut"
    | "higgsfield"
    | "browser"
    | "chatgpt"
    | "gemini"
    | "projects"
    | "photos"
    | "notes"
    | "videos"
    | "socials"
    | "mail"
    | "trash";
  actionType: "openToolInfo" | "openApp" | "toggleSocials" | "external";
  appId?: string; // "about" | "projects" | "gallery" | "video" | "contact" | "notes" | "trash" | "cv"
  toolId?: string;
  filterWorkspace?: "design" | "web" | "motion-ai";
  externalUrl?: string;
  isSeparatorAfter?: boolean;
  artworkMode?: "full" | "inset";
}

const createCommonUtilities = (ws: string): DockItemConfig[] => [
  {
    id: `dock-notes-${ws}`,
    titleTR: "Notlar",
    titleEN: "Notes",
    iconType: "notes",
    actionType: "openApp",
    appId: "notes",
    artworkMode: "full"
  },
  {
    id: `dock-gallery-${ws}`,
    titleTR: "Galeri",
    titleEN: "Gallery",
    iconType: "photos",
    actionType: "openApp",
    appId: "gallery",
    artworkMode: "full"
  },
  {
    id: `dock-videos-${ws}`,
    titleTR: "Videolar",
    titleEN: "Videos",
    iconType: "videos",
    actionType: "openApp",
    appId: "video",
    artworkMode: "full"
  },
  {
    id: `dock-projects-${ws}`,
    titleTR: "Projeler",
    titleEN: "Projects",
    iconType: "projects",
    actionType: "openApp",
    appId: "projects",
    artworkMode: "full"
  },
  {
    id: `dock-socials-${ws}`,
    titleTR: "Sosyal Medya",
    titleEN: "Social Media",
    iconType: "socials",
    actionType: "toggleSocials",
    artworkMode: "full"
  },
  {
    id: `dock-mail-${ws}`,
    titleTR: "İletişim / Mail",
    titleEN: "Contact / Mail",
    iconType: "mail",
    actionType: "openApp",
    appId: "contact",
    isSeparatorAfter: true,
    artworkMode: "full"
  },
  {
    id: `dock-trash-${ws}`,
    titleTR: "Çöp Kutusu",
    titleEN: "Trash",
    iconType: "trash",
    actionType: "openApp",
    appId: "trash"
  }
];

export const dockConfig: Record<string, DockItemConfig[]> = {
  design: [
    {
      id: "dock-photoshop",
      titleTR: "Adobe Photoshop",
      titleEN: "Adobe Photoshop",
      iconType: "photoshop",
      actionType: "openToolInfo",
      toolId: "photoshop",
      artworkMode: "full"
    },
    {
      id: "dock-illustrator",
      titleTR: "Adobe Illustrator",
      titleEN: "Adobe Illustrator",
      iconType: "illustrator",
      actionType: "openToolInfo",
      toolId: "illustrator",
      artworkMode: "full"
    },
    {
      id: "dock-figma-design",
      titleTR: "Figma",
      titleEN: "Figma",
      iconType: "figma",
      actionType: "openToolInfo",
      toolId: "figma",
      artworkMode: "full"
    },
    {
      id: "dock-canva-design",
      titleTR: "Canva",
      titleEN: "Canva",
      iconType: "canva",
      actionType: "openToolInfo",
      toolId: "canva",
      isSeparatorAfter: true,
      artworkMode: "full"
    },
    ...createCommonUtilities("design")
  ],
  web: [
    {
      id: "dock-figma-web",
      titleTR: "Figma",
      titleEN: "Figma",
      iconType: "figma",
      actionType: "openToolInfo",
      toolId: "figma",
      artworkMode: "full"
    },
    {
      id: "dock-wordpress-web",
      titleTR: "WordPress",
      titleEN: "WordPress",
      iconType: "wordpress",
      actionType: "openToolInfo",
      toolId: "wordpress",
      artworkMode: "full"
    },
    {
      id: "dock-vscode-web",
      titleTR: "Visual Studio Code",
      titleEN: "Visual Studio Code",
      iconType: "vscode",
      actionType: "openToolInfo",
      toolId: "vscode",
      artworkMode: "full"
    },
    {
      id: "dock-antigravity-web",
      titleTR: "Antigravity",
      titleEN: "Antigravity",
      iconType: "antigravity",
      actionType: "openToolInfo",
      toolId: "antigravity",
      isSeparatorAfter: true,
      artworkMode: "full"
    },
    ...createCommonUtilities("web")
  ],
  "motion-ai": [
    {
      id: "dock-premiere-motion",
      titleTR: "Adobe Premiere Pro",
      titleEN: "Adobe Premiere Pro",
      iconType: "premiere",
      actionType: "openToolInfo",
      toolId: "premiere",
      artworkMode: "full"
    },
    {
      id: "dock-ae-motion",
      titleTR: "Adobe After Effects",
      titleEN: "Adobe After Effects",
      iconType: "aftereffects",
      actionType: "openToolInfo",
      toolId: "aftereffects",
      artworkMode: "full"
    },
    {
      id: "dock-capcut-motion",
      titleTR: "CapCut",
      titleEN: "CapCut",
      iconType: "capcut",
      actionType: "openToolInfo",
      toolId: "capcut",
      artworkMode: "full"
    },
    {
      id: "dock-higgsfield-motion",
      titleTR: "Higgsfield",
      titleEN: "Higgsfield",
      iconType: "higgsfield",
      actionType: "openToolInfo",
      toolId: "higgsfield",
      isSeparatorAfter: true,
      artworkMode: "full"
    },
    ...createCommonUtilities("motion-ai")
  ]
};

export const dockItemsByWorkspace = dockConfig;
