export type WorkspaceId = "design" | "web" | "motion-ai";

export type ProjectCategoryId =
  | "all"
  | "website"
  | "graphic-design"
  | "brand-identity"
  | "social-media"
  | "seo"
  | "advertising-design"
  | "ecommerce"
  | "video-production"
  | "ai-creative"
  | "product-visualization";

export type ProjectStatus = "completed" | "ongoing" | "concept";

export type ExternalLinkType =
  | "live"
  | "github"
  | "instagram"
  | "behance"
  | "case-study"
  | "other";

export interface ProjectExternalLink {
  id: string;
  type: ExternalLinkType;
  labelTR: string;
  labelEN: string;
  href: string;
}

export type ProjectMediaType = "image" | "video";

export type ProjectMediaLayout = "full" | "contained" | "portrait" | "landscape";

export interface ProjectMediaItem {
  id?: string;
  type: ProjectMediaType;
  src: string;
  thumbnail?: string;
  poster?: string;
  altTR?: string;
  altEN?: string;
  captionTR?: string;
  captionEN?: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  layout?: ProjectMediaLayout;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: "none" | "metadata" | "auto";
  priority?: boolean;
}

export interface ProjectContentBlockText {
  type: "text";
  titleTR?: string;
  titleEN?: string;
  bodyTR: string;
  bodyEN: string;
}

export interface ProjectContentBlockMedia {
  type: "media";
  mediaId?: string;
  mediaItem?: ProjectMediaItem;
}

export type ProjectContentBlock = ProjectContentBlockText | ProjectContentBlockMedia;

export interface DesktopPosition {
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  width?: number; // px width override for desktop icon
}

export interface InitialWindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export interface DesktopThumbnailConfig {
  src: string;
  width: number;
  height: number;
  scale?: number;
  altTR?: string;
  altEN?: string;
}

import { translations } from "./translations";

export interface CategoryFilterConfig {
  id: ProjectCategoryId;
  titleKey: keyof typeof translations.tr;
}

export const projectCategories: CategoryFilterConfig[] = [
  { id: "all", titleKey: "cat_all" },
  { id: "website", titleKey: "cat_website" },
  { id: "graphic-design", titleKey: "cat_graphic_design" },
  { id: "brand-identity", titleKey: "cat_brand_identity" },
  { id: "social-media", titleKey: "cat_social_media" },
  { id: "seo", titleKey: "cat_seo" },
  { id: "advertising-design", titleKey: "cat_advertising_design" },
  { id: "ecommerce", titleKey: "cat_ecommerce" },
  { id: "video-production", titleKey: "cat_video_production" },
  { id: "ai-creative", titleKey: "cat_ai_creative" },
  { id: "product-visualization", titleKey: "cat_product_visualization" }
];

export interface ProjectSeoConfig {
  titleTR?: string;
  titleEN?: string;
  descriptionTR?: string;
  descriptionEN?: string;
  ogImage?: string;
}

export interface Project {
  id: string;
  slug: string;
  workspace: WorkspaceId;
  workspaceId?: WorkspaceId;
  categoryIds: ProjectCategoryId[];
  titleTR: string;
  titleEN: string;
  desktopLabelTR?: string;
  desktopLabelEN?: string;
  client: string;
  categoryTR: string;
  categoryEN: string;
  projectTypeTR?: string;
  projectTypeEN?: string;
  year?: string;
  status?: ProjectStatus;
  summaryTR?: string;
  summaryEN?: string;
  descriptionTR?: string;
  descriptionEN?: string;
  challengeTR?: string;
  challengeEN?: string;
  solutionTR?: string;
  solutionEN?: string;
  resultTR?: string;
  resultEN?: string;
  roleTR?: string;
  roleEN?: string;
  thumbnail?: string;
  cover?: string;
  desktopIcon?: string;
  desktopThumbnail?: DesktopThumbnailConfig;
  initials?: string;
  media: ProjectMediaItem[];
  servicesTR?: string[];
  servicesEN?: string[];
  services?: string[];
  tools?: string[];
  externalLinks?: ProjectExternalLink[];
  contentBlocks?: ProjectContentBlock[];
  seo?: ProjectSeoConfig;
  ogImage?: string;

  /**
   * Single source of truth for workspace home screen visibility.
   * - `true`: Curated showcase item visible directly on desktop/mobile wallpaper canvas.
   * - `false`: Portfolio archive item accessible inside Projects app / finder catalog.
   */
  featured: boolean;

  /**
   * Editorial priority order among featured projects on workspace home screens (1, 2, 3...).
   */
  featuredOrder?: number;

  /**
   * General catalog ordering inside Projects app archive (1, 2, 3...).
   */
  sortOrder?: number;

  desktop: DesktopPosition;
  desktopPlacement?: { x: number; y: number };
  desktopClusterId?: string;
  desktopWeight?: "small" | "normal" | "large";
  initialWindow: InitialWindowBounds;
}

export const projectsData: Project[] = [
  {
    id: "yanarsan-yangin-website-tasarimi",
    slug: "yanarsan-yangin-website-tasarimi",
    workspace: "web",
    workspaceId: "web",
    categoryIds: [
      "website",
      "brand-identity"
    ],
    titleTR: "Yanarsan Yangın Website Tasarımı",
    titleEN: "Yanarsan Fire & Safety Website Design",
    desktopLabelTR: "Yanarsan",
    desktopLabelEN: "Yanarsan",
    client: "Yanarsan Yangın",
    categoryTR: "Kurumsal Web Sitesi",
    categoryEN: "Corporate Website",
    projectTypeTR: "Web Sitesi > Yangın Söndürme & Güvenlik Sistemleri",
    projectTypeEN: "Website > Fire Safety & Extinguishing Systems",
    year: "2024",
    status: "completed",
    summaryTR: "Yanarsan Yangın için yangın söndürme ve güvenlik sistemleri sektörüne uygun, kurumsal ve güven veren bir website tasarımı hazırlandı. Güçlü kırmızı ve turuncu vurgu renkleri, hizmet ve ürün odaklı içerik yapısı, belirgin iletişim alanları ve sade navigasyon bir araya getirilerek markanın güvenlik odaklı profesyonel duruşunu destekleyen kullanıcı dostu bir web deneyimi oluşturuldu.",
    summaryEN: "A professional and trust-oriented website was designed for Yanarsan Yangın to reflect the needs of the fire extinguishing and safety systems sector. Strong red and orange accents, service- and product-focused content, visible contact information, and straightforward navigation were combined to create a user-friendly digital experience aligned with the brand’s professional safety positioning.",
    descriptionTR: "Yanarsan Yangın için yangın söndürme ve güvenlik sistemleri sektörüne uygun, kurumsal ve güven veren bir website tasarımı hazırlandı. Güçlü kırmızı ve turuncu vurgu renkleri, hizmet ve ürün odaklı içerik yapısı, belirgin iletişim alanları ve sade navigasyon bir araya getirilerek markanın güvenlik odaklı profesyonel duruşunu destekleyen kullanıcı dostu bir web deneyimi oluşturuldu.",
    descriptionEN: "A professional and trust-oriented website was designed for Yanarsan Yangın to reflect the needs of the fire extinguishing and safety systems sector. Strong red and orange accents, service- and product-focused content, visible contact information, and straightforward navigation were combined to create a user-friendly digital experience aligned with the brand’s professional safety positioning.",
    challengeTR: "Yanarsan Yangın’ın yangın söndürme, güvenlik sistemleri ve ekipman alanındaki hizmetlerini daha profesyonel, erişilebilir ve güven veren bir dijital yapı içinde sunabileceği modern bir web sitesine ihtiyacı vardı. Hizmet ve ürün kategorilerinin kolay keşfedilmesi, temel iletişim bilgilerinin görünür olması ve güvenlik odaklı marka algısının dijital ortamda güçlü biçimde aktarılması temel ihtiyaçları oluşturuyordu.",
    challengeEN: "Yanarsan Yangın needed a modern website capable of presenting its fire extinguishing, safety-system, and equipment services within a more professional, accessible, and trustworthy digital structure. Service and product categories needed to be easy to discover, key contact information had to remain visible, and the brand’s safety-focused positioning needed to translate clearly into the digital experience.",
    solutionTR: "Markanın sektörüne ve kurumsal kimliğine uygun olarak siyah, beyaz ve kırmızı/turuncu vurgu renklerinden oluşan güçlü bir görsel sistem kurgulandı. Ana sayfada yangın ve güvenlik temasını doğrudan aktaran etkileyici bir hero alanı kullanılırken; hizmetler, ürünler, galeri, blog ve iletişim gibi temel alanlar sade bir navigasyon yapısı altında toplandı. Telefon bilgileri, çalışma saatleri, hizmet yönlendirmeleri ve WhatsApp iletişimi gibi aksiyonlar kullanıcıların ihtiyaç duydukları bilgiye hızlı ulaşmasını destekleyecek şekilde görünür konumlandırıldı.",
    solutionEN: "A strong visual system combining black, white, and red/orange accents was created around the brand’s identity and sector. The homepage uses an impactful fire-and-safety hero to communicate the core service area immediately, while key sections such as services, products, gallery, blog, and contact are organized through straightforward navigation. Phone information, business hours, service actions, and WhatsApp contact were positioned prominently to help users access important information quickly.",
    resultTR: "Yanarsan Yangın için sektörel güven algısını destekleyen, profesyonel ve marka kimliğiyle uyumlu bir web deneyimi oluşturuldu. Hizmet ve ürün alanlarının daha düzenli sunulması, iletişim bilgilerinin görünür hale getirilmesi ve güçlü görsel dil sayesinde markanın dijital sunumu daha erişilebilir, kurumsal ve kullanıcı odaklı bir yapıya kavuştu.",
    resultEN: "The resulting website provides Yanarsan Yangın with a professional digital presence aligned with the trust requirements of the fire-safety sector. Clearer service and product presentation, visible contact information, and a stronger visual identity created a more accessible, corporate, and user-focused online experience.",
    roleTR: "Website Tasarımı & UI/UX",
    roleEN: "Website Design & UI/UX",
    desktopIcon: "/projects/yanarsan-yangin-website-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/yanarsan-yangin-website-tasarimi/thumbnail.webp",
      width: 130,
      height: 81,
      scale: 1,
      altTR: "Yanarsan Yangın Website Tasarımı Masaüstü İkonu",
      altEN: "Yanarsan Fire & Safety Website Design Desktop Icon"
    },
    thumbnail: "/projects/yanarsan-yangin-website-tasarimi/thumbnail.webp",
    cover: "/projects/yanarsan-yangin-website-tasarimi/cover.webp",
    initials: "YAN",
    servicesTR: [
      "Website Tasarımı",
      "UI/UX Tasarımı",
      "Kurumsal Web Tasarımı",
      "Responsive Tasarım",
      "İçerik Hiyerarşisi",
      "Hizmet & Ürün Sunumu"
    ],
    servicesEN: [
      "Website Design",
      "UI/UX Design",
      "Corporate Web Design",
      "Responsive Design",
      "Content Hierarchy",
      "Service & Product Presentation"
    ],
    services: [
      "Website Design",
      "UI/UX Design",
      "Corporate Web Design",
      "Responsive Design",
      "Content Hierarchy",
      "Service & Product Presentation"
    ],
    tools: [],
    externalLinks: [
      {
        id: "live-site",
        type: "live",
        labelTR: "Siteyi Canlı Gör",
        labelEN: "View Live Site",
        href: "https://yanarsan.com"
      }
    ],
    media: [
      {
        id: "media-2",
        type: "image",
        src: "/projects/yanarsan-yangin-website-tasarimi/media/02-homepage-browser.webp",
        altTR: "Yanarsan Yangın ana sayfası, yangın temalı hero alanı ve hizmet navigasyonu.",
        altEN: "Yanarsan Yangın homepage with a fire-themed hero section and service navigation.",
        captionTR: "Yanarsan Yangın web sitesi ana sayfa ve navigasyon görünümü",
        captionEN: "Yanarsan Yangın website homepage and navigation view",
        layout: "full",
        width: 1024,
        height: 640
      },
      {
        id: "media-1",
        type: "image",
        src: "/projects/yanarsan-yangin-website-tasarimi/media/01-laptop-presentation.webp",
        altTR: "Yanarsan Yangın web sitesinin açık olduğu dizüstü bilgisayar, aydınlık minimalist bir sunum ortamında.",
        altEN: "Laptop displaying the Yanarsan Yangın website in a bright minimalist presentation environment.",
        captionTR: "Yanarsan Yangın web sitesinin modern kurumsal laptop sunumu",
        captionEN: "Modern corporate laptop presentation of the Yanarsan Yangın website",
        layout: "full",
        width: 1024,
        height: 978
      },
      {
        id: "media-3",
        type: "image",
        src: "/projects/yanarsan-yangin-website-tasarimi/media/03-hero-detail.webp",
        altTR: "Yanarsan Yangın ana sayfası, kurumsal başlık, iletişim hatları, menü ve hero alanı detayı.",
        altEN: "Yanarsan Yangın homepage, corporate header, contact numbers, menu and hero section detail.",
        captionTR: "Yanarsan Yangın kurumsal kimlik, telefon hatları, menü ve güvenlik odaklı hero alanı",
        captionEN: "Yanarsan Yangın corporate identity, contact lines, menu and safety-oriented hero section",
        layout: "full",
        width: 1600,
        height: 906
      },
      {
        id: "media-4",
        type: "image",
        src: "/projects/yanarsan-yangin-website-tasarimi/media/04-fire-safety-presentation.webp",
        altTR: "Modern yangın güvenliği mühendislik showroom ortamında Yanarsan Yangın web sitesi masaüstü cihaz sunumu.",
        altEN: "Desktop device presentation of the Yanarsan Yangın website in a modern fire-safety engineering showroom setting.",
        captionTR: "Yanarsan Yangın modern kurumsal mühendislik çalışma ortamında masaüstü sunumu",
        captionEN: "Yanarsan Yangın desktop presentation in a modern corporate engineering workspace",
        layout: "full",
        width: 1600,
        height: 893
      },
      {
        id: "media-5",
        type: "image",
        src: "/projects/yanarsan-yangin-website-tasarimi/media/05-service-product-structure.webp",
        altTR: "Yanarsan Yangın web sitesinin hizmet, ürün ve iletişim odaklı UX bilgi mimarisi şeması.",
        altEN: "Yanarsan Yangın website UX information architecture diagram showing services, products and contact flow.",
        captionTR: "Sektörel güveni ve hızlı iletişimi destekleyen hizmet ve ürün mimarisi sistemi",
        captionEN: "Service and product architecture system supporting sectoral trust and direct communication",
        layout: "full",
        width: 1600,
        height: 900
      }
    ],
    desktop: {
      x: 8,
      y: 188
    },
    initialWindow: {
      width: 780,
      height: 640
    },
    featured: true,
    sortOrder: 1,
    featuredOrder: 1
  },

  {
    id: "eigestore-website-tasarimi",
    slug: "eigestore-website-tasarimi",
    workspace: "web",
    workspaceId: "web",
    categoryIds: [
      "website",
      "ecommerce",
      "brand-identity"
    ],
    titleTR: "EigeStore Website Tasarımı",
    titleEN: "EigeStore E-Commerce Website Design",
    desktopLabelTR: "EigeStore",
    desktopLabelEN: "EigeStore",
    client: "EigeStore",
    categoryTR: "E-Ticaret & Web Sitesi",
    categoryEN: "E-Commerce & Website",
    projectTypeTR: "Web Sitesi > E-Ticaret & Ürün Deneyimi",
    projectTypeEN: "Website > E-Commerce & Product Experience",
    year: "2024",
    status: "completed",
    summaryTR: "EigeStore için genç, renkli ve ürün odaklı marka kimliğini yansıtan modern bir e-ticaret website tasarımı hazırlandı. Telefon kılıfı ve aksesuar koleksiyonlarını öne çıkaran arayüz; sade navigasyon, güçlü ürün sunumu, güven unsurları ve alışveriş odaklı kullanıcı deneyimiyle kurgulandı.",
    summaryEN: "A modern e-commerce website was designed for EigeStore to reflect its youthful, colorful, and product-led brand identity. The interface highlights phone case and accessory collections through clear navigation, strong product presentation, trust elements, and a shopping-focused user experience.",
    descriptionTR: "EigeStore için genç, renkli ve ürün odaklı marka kimliğini yansıtan modern bir e-ticaret website tasarımı hazırlandı. Telefon kılıfı ve aksesuar koleksiyonlarını öne çıkaran arayüz; sade navigasyon, güçlü ürün sunumu, güven unsurları ve alışveriş odaklı kullanıcı deneyimiyle kurgulandı.",
    descriptionEN: "A modern e-commerce website was designed for EigeStore to reflect its youthful, colorful, and product-led brand identity. The interface highlights phone case and accessory collections through clear navigation, strong product presentation, trust elements, and a shopping-focused user experience.",
    challengeTR: "EigeStore’un genç, dinamik ve renkli marka karakterini dijital ortamda güçlü biçimde yansıtırken ürün koleksiyonlarını anlaşılır şekilde sunabilecek ve kullanıcıyı alışverişe yönlendirecek modern bir e-ticaret deneyimine ihtiyacı vardı. Ürün çeşitliliğinin sade bir yapı içinde sunulması ve güven veren alışveriş unsurlarının kullanıcı yolculuğuna doğru şekilde dahil edilmesi önemliydi.",
    challengeEN: "EigeStore needed a modern e-commerce experience capable of translating its youthful, dynamic, and colorful brand identity into the digital environment while presenting product collections clearly and guiding users toward purchase. Product variety needed to remain easy to navigate while trust-building shopping elements had to be integrated naturally into the customer journey.",
    solutionTR: "Markanın enerjik yapısına uygun olarak açık renkli, modern ve ürün merkezli bir e-ticaret arayüzü tasarlandı. Ana sayfa, koleksiyon navigasyonu, ürün sunumları ve alışveriş aksiyonları sade bir hiyerarşi içinde kurgulanırken; ücretsiz kargo, WhatsApp iletişimi, özel tasarım imkânı ve güvenli ödeme gibi güven unsurları kullanıcı deneyimini destekleyecek şekilde görünür hale getirildi.",
    solutionEN: "A bright, modern, and product-focused e-commerce interface was designed around the energetic character of the brand. Homepage content, collection navigation, product presentation, and shopping actions were structured through a clear visual hierarchy, while trust elements such as free shipping, WhatsApp support, custom design options, and secure payment were positioned prominently to support the purchase journey.",
    resultTR: "EigeStore için marka kimliğiyle uyumlu, modern ve alışveriş odaklı bir dijital vitrin oluşturuldu. Ürün koleksiyonlarının daha güçlü sunulması, alışveriş aksiyonlarının sadeleştirilmesi ve güven unsurlarının görünür hale getirilmesiyle kullanıcıların ürünleri keşfetmesini ve satın alma sürecine ilerlemesini destekleyen daha profesyonel bir e-ticaret deneyimi ortaya çıktı.",
    resultEN: "The resulting website provides EigeStore with a modern, shopping-focused digital storefront aligned with its brand identity. Stronger product presentation, simplified shopping actions, and visible trust elements create a more professional e-commerce experience designed to support product discovery and progression toward purchase.",
    roleTR: "E-Ticaret Website Tasarımı & UI/UX",
    roleEN: "E-Commerce Website Design & UI/UX",
    desktopIcon: "/projects/eigestore-website-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/eigestore-website-tasarimi/thumbnail.webp",
      width: 130,
      height: 81,
      scale: 1,
      altTR: "EigeStore Website Tasarımı Masaüstü İkonu",
      altEN: "EigeStore E-Commerce Website Design Desktop Icon"
    },
    thumbnail: "/projects/eigestore-website-tasarimi/thumbnail.webp",
    cover: "/projects/eigestore-website-tasarimi/cover.webp",
    initials: "ES",
    servicesTR: [
      "E-Ticaret Website Tasarımı",
      "Website Tasarımı",
      "UI/UX Tasarımı",
      "Ürün Sunumu",
      "Alışveriş Deneyimi",
      "Responsive Tasarım"
    ],
    servicesEN: [
      "E-Commerce Website Design",
      "Website Design",
      "UI/UX Design",
      "Product Presentation",
      "Shopping Experience",
      "Responsive Design"
    ],
    services: [
      "E-Commerce Website Design",
      "Website Design",
      "UI/UX Design",
      "Product Presentation",
      "Shopping Experience",
      "Responsive Design"
    ],
    tools: [],
    externalLinks: [
      {
        id: "live-site",
        type: "live",
        labelTR: "Siteyi Canlı Gör",
        labelEN: "View Live Site",
        href: "https://eigestore.com"
      }
    ],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/eigestore-website-tasarimi/media/01-homepage-storefront.webp",
        altTR: "EigeStore e-ticaret web sitesi ana sayfası ve ürün koleksiyonları doğrudan ekran görünümü.",
        altEN: "EigeStore e-commerce website homepage and product collections direct screen view.",
        captionTR: "EigeStore e-ticaret ana sayfa vitrini ve ürün koleksiyonları",
        captionEN: "EigeStore e-commerce storefront and product collections",
        layout: "full",
        width: 1024,
        height: 640
      },
      {
        id: "media-2",
        type: "image",
        src: "/projects/eigestore-website-tasarimi/media/01-laptop-presentation.webp",
        altTR: "EigeStore e-ticaret web sitesinin açık olduğu dizüstü bilgisayar, ahşap masa ve minimalist çalışma alanı.",
        altEN: "Laptop displaying the EigeStore e-commerce website on a wooden desk in a minimal workspace.",
        captionTR: "EigeStore e-ticaret web sitesinin masaüstü sunumu",
        captionEN: "Desktop presentation of the EigeStore e-commerce website",
        layout: "full",
        width: 1024,
        height: 696
      },
      {
        id: "media-3",
        type: "image",
        src: "/projects/eigestore-website-tasarimi/media/02-hero-detail.webp",
        altTR: "EigeStore ana sayfası, renkli telefon kılıfları ve alışverişe başla butonu detayı.",
        altEN: "EigeStore homepage, colorful phone cases and start shopping button detail.",
        captionTR: "EigeStore ana sayfa hero alanı ve ürün koleksiyonları sunumu",
        captionEN: "EigeStore homepage hero section and product collections showcase",
        layout: "full",
        width: 1600,
        height: 1015
      },
      {
        id: "media-3",
        type: "image",
        src: "/projects/eigestore-website-tasarimi/media/03-ecommerce-presentation.webp",
        altTR: "Aydınlık kreatif stüdyo ortamında EigeStore e-ticaret web sitesi cihaz sunumu.",
        altEN: "Device presentation of the EigeStore e-commerce website in a bright creative studio environment.",
        captionTR: "EigeStore modern kreatif çalışma alanı masaüstü sunumu",
        captionEN: "EigeStore desktop presentation in a modern creative workspace",
        layout: "full",
        width: 1600,
        height: 893
      },
      {
        id: "media-4",
        type: "image",
        src: "/projects/eigestore-website-tasarimi/media/04-shopping-experience.webp",
        altTR: "EigeStore e-ticaret arayüzünün ürün keşfi ve güvenli alışveriş UX yapısı.",
        altEN: "EigeStore e-commerce interface UX structure showing product discovery and secure checkout.",
        captionTR: "Koleksiyon keşfi ve güvenli alışveriş akışını destekleyen e-ticaret mimarisi",
        captionEN: "E-commerce architecture supporting collection discovery and secure shopping flow",
        layout: "full",
        width: 1600,
        height: 900
      }
    ],
    desktop: {
      x: 8,
      y: 100
    },
    initialWindow: {
      width: 780,
      height: 640
    },
    featured: true,
    sortOrder: 2,
    featuredOrder: 2
  },

  {
    id: "kagestudio-website-tasarimi",
    slug: "kagestudio-website-tasarimi",
    workspace: "web",
    workspaceId: "web",
    categoryIds: [
      "website",
      "ecommerce",
      "brand-identity"
    ],
    titleTR: "KAGESTUDIO Website Tasarımı",
    titleEN: "KAGESTUDIO Website Design",
    desktopLabelTR: "KAGESTUDIO",
    desktopLabelEN: "KAGESTUDIO",
    client: "KAGESTUDIO",
    categoryTR: "E-Ticaret & Web Sitesi Tasarımı",
    categoryEN: "E-Commerce & Website Design",
    projectTypeTR: "Web Sitesi > Dövüş Kültürü & E-Ticaret Tasarımı",
    projectTypeEN: "Website > Combat Culture & E-Commerce Design",
    year: "2026",
    status: "completed",
    summaryTR: "KAGESTUDIO için dövüş sporları ve koleksiyon kültürünü yansıtan karanlık, güçlü ve premium bir website tasarımı hazırlandı. Büyük tipografi, sinematik görseller, minimalist navigasyon ve koleksiyon odaklı e-ticaret yapısı bir araya getirilerek markanın güçlü karakterini dijital ortamda yansıtan etkileyici bir vitrin oluşturuldu.",
    summaryEN: "A dark, bold, and premium website experience was designed for KAGESTUDIO to reflect the visual language of combat sports and collector culture. Oversized typography, cinematic imagery, minimal navigation, and a collection-focused e-commerce structure were combined to create a distinctive digital storefront for the brand.",
    descriptionTR: "KAGESTUDIO için dövüş sporları ve koleksiyon kültürünü yansıtan karanlık, güçlü ve premium bir website tasarımı hazırlandı. Büyük tipografi, sinematik görseller, minimalist navigasyon ve koleksiyon odaklı e-ticaret yapısı bir araya getirilerek markanın güçlü karakterini dijital ortamda yansıtan etkileyici bir vitrin oluşturuldu.",
    descriptionEN: "A dark, bold, and premium website experience was designed for KAGESTUDIO to reflect the visual language of combat sports and collector culture. Oversized typography, cinematic imagery, minimal navigation, and a collection-focused e-commerce structure were combined to create a distinctive digital storefront for the brand.",
    challengeTR: "KAGESTUDIO’nun dövüş sporları odaklı güçlü marka karakterini dijital ortamda etkileyici biçimde yansıtacak, aynı zamanda ürün ve koleksiyon keşfini destekleyecek modern bir web deneyimine ihtiyacı vardı. Tasarımın hem sert ve disiplinli marka atmosferini koruması hem de kullanıcıyı ürünlere yönlendiren sade ve anlaşılır bir yapı sunması gerekiyordu.",
    challengeEN: "KAGESTUDIO needed a modern digital experience capable of translating its strong combat-sports identity into the web while also supporting product and collection discovery. The design needed to preserve the brand’s disciplined and intense character without sacrificing clarity, usability, or e-commerce navigation.",
    solutionTR: "Markanın sert, karanlık ve disiplinli duruşuna uygun olarak sinematik bir görsel atmosfer, yüksek kontrastlı büyük tipografi, sade navigasyon ve koleksiyon odaklı bir e-ticaret arayüzü tasarlandı. Ana sayfa deneyimi, güçlü hero kompozisyonu ve kontrollü görsel hiyerarşiyle kullanıcıyı ilk ekrandan itibaren KAGESTUDIO’nun dövüş kültürü atmosferine dahil edecek şekilde kurgulandı.",
    solutionEN: "A cinematic visual environment, oversized high-contrast typography, minimal navigation, and a collection-focused e-commerce interface were designed around the brand’s dark and disciplined identity. The homepage uses a strong hero composition and controlled visual hierarchy to immerse visitors in KAGESTUDIO’s combat-culture atmosphere from the first screen.",
    resultTR: "KAGESTUDIO için markanın güçlü karakterini destekleyen, premium görünen ve kullanıcıyı koleksiyonları keşfetmeye yönlendiren etkileyici bir web deneyimi oluşturuldu. Çalışma; görsel kimlik, kullanıcı deneyimi ve e-ticaret odağını tek bir dijital yapı içinde birleştirerek markanın online sunumunu daha profesyonel, özgün ve satış odaklı bir seviyeye taşıdı.",
    resultEN: "The resulting website delivers a strong, premium digital presence that reinforces the KAGESTUDIO identity while guiding users toward product and collection discovery. The project combines visual identity, user experience, and e-commerce presentation within a cohesive digital system, creating a more distinctive and commercially focused online presence.",
    roleTR: "E-Ticaret Website Tasarımı & UI/UX",
    roleEN: "E-Commerce Website Design & UI/UX",
    desktopIcon: "/projects/kagestudio-website-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/kagestudio-website-tasarimi/thumbnail.webp",
      width: 130,
      height: 81,
      scale: 1,
      altTR: "KAGESTUDIO Website Tasarımı Masaüstü İkonu",
      altEN: "KAGESTUDIO Website Design Desktop Icon"
    },
    thumbnail: "/projects/kagestudio-website-tasarimi/thumbnail.webp",
    cover: "/projects/kagestudio-website-tasarimi/cover.webp",
    initials: "KG",
    servicesTR: [
      "E-Ticaret Website Tasarımı",
      "Website Tasarımı",
      "UI/UX Tasarımı",
      "Koleksiyon Sunumu",
      "Responsive Tasarım"
    ],
    servicesEN: [
      "E-Commerce Website Design",
      "Website Design",
      "UI/UX Design",
      "Collection Presentation",
      "Responsive Design"
    ],
    services: [
      "E-Commerce Website Design",
      "Website Design",
      "UI/UX Design",
      "Collection Presentation",
      "Responsive Design"
    ],
    tools: [],
    externalLinks: [
      {
        id: "live-site",
        type: "live",
        labelTR: "Siteyi Canlı Gör",
        labelEN: "View Live Site",
        href: "https://kagestd.com"
      }
    ],
    media: [
      {
        id: "media-2",
        type: "image",
        src: "/projects/kagestudio-website-tasarimi/media/02-homepage-browser.webp",
        altTR: "KAGESTUDIO web sitesi ana sayfası, büyük “THE ART OF COMBAT” tipografisi ve dövüşçü görseli.",
        altEN: "KAGESTUDIO homepage featuring oversized “THE ART OF COMBAT” typography and a fighter visual.",
        captionTR: "KAGESTUDIO web sitesi ana sayfa ve “THE ART OF COMBAT” hero alanı",
        captionEN: "KAGESTUDIO homepage and “THE ART OF COMBAT” hero section",
        layout: "full",
        width: 1024,
        height: 640
      },
      {
        id: "media-1",
        type: "image",
        src: "/projects/kagestudio-website-tasarimi/media/01-combat-laptop-mockup.webp",
        altTR: "Karanlık dövüş salonu atmosferinde KAGESTUDIO web sitesinin açık olduğu dizüstü bilgisayar.",
        altEN: "Laptop displaying the KAGESTUDIO website in a dark combat-gym environment.",
        captionTR: "KAGESTUDIO web sitesi — premium dövüş kültürü odaklı dijital sunum",
        captionEN: "KAGESTUDIO website — premium combat-culture digital presentation",
        layout: "full",
        width: 1024,
        height: 576
      },
      {
        id: "media-3",
        type: "image",
        src: "/projects/kagestudio-website-tasarimi/media/03-hero-detail.webp",
        altTR: "KAGESTUDIO büyük başlık tipografisi ve koleksiyon keşfi alanı detayı.",
        altEN: "KAGESTUDIO oversized headline typography and collection discovery area detail.",
        captionTR: "Büyük tipografi, sinematik dövüşçü görseli ve koleksiyon yönlendirmesi",
        captionEN: "Oversized typography, cinematic fighter visual and collection call-to-action",
        layout: "full",
        width: 1600,
        height: 920
      },
      {
        id: "media-4",
        type: "image",
        src: "/projects/kagestudio-website-tasarimi/media/04-premium-presentation.webp",
        altTR: "KAGESTUDIO web sitesinin karanlık dövüş salonu ortamındaki masaüstü cihaz sunumu.",
        altEN: "Desktop device presentation of the KAGESTUDIO website in a dark combat gym environment.",
        captionTR: "KAGESTUDIO karanlık & premium dijital marka deneyimi sunumu",
        captionEN: "KAGESTUDIO dark & premium digital brand experience presentation",
        layout: "full",
        width: 1600,
        height: 893
      }
    ],
    desktop: {
      x: 8,
      y: 56
    },
    initialWindow: {
      width: 780,
      height: 640
    },
    featured: true,
    sortOrder: 3,
    featuredOrder: 3
  },

  {
    id: "deva-yangin-website-tasarimi",
    slug: "deva-yangin-website-tasarimi",
    workspace: "web",
    workspaceId: "web",
    categoryIds: [
      "website",
      "brand-identity"
    ],
    titleTR: "Deva Yangın Website Tasarımı",
    titleEN: "Deva Fire & Safety Website Design",
    desktopLabelTR: "Deva Yangın",
    desktopLabelEN: "Deva Yangın",
    client: "Deva Yangın",
    categoryTR: "Kurumsal Web Sitesi & UI/UX",
    categoryEN: "Corporate Website & UI/UX",
    projectTypeTR: "Web Sitesi > Yangın Güvenliği & Kurumsal Tasarım",
    projectTypeEN: "Website > Fire Safety & Corporate Design",
    year: "2026",
    status: "completed",
    summaryTR: "Deva Yangın için yangın söndürme ve güvenlik sistemleri sektörüne uygun, kurumsal ve güven veren bir website tasarımı hazırlandı. Koyu görsel sistem, kırmızı vurgu renkleri, güçlü tipografi, hizmet odaklı içerik yapısı ve doğrudan iletişim aksiyonları bir araya getirilerek markanın profesyonel duruşunu destekleyen modern bir dijital deneyim oluşturuldu.",
    summaryEN: "A modern corporate website was designed for Deva Yangın to reflect the professional and trust-oriented character of the fire extinguishing and safety systems sector. A dark visual system, red accents, strong typography, service-focused content, and direct contact actions were combined to create a clear and professional digital experience for the brand.",
    descriptionTR: "Deva Yangın için yangın söndürme ve güvenlik sistemleri sektörüne uygun, kurumsal ve güven veren bir website tasarımı hazırlandı. Koyu görsel sistem, kırmızı vurgu renkleri, güçlü tipografi, hizmet odaklı içerik yapısı ve doğrudan iletişim aksiyonları bir araya getirilerek markanın profesyonel duruşunu destekleyen modern bir dijital deneyim oluşturuldu.",
    descriptionEN: "A modern corporate website was designed for Deva Yangın to reflect the professional and trust-oriented character of the fire extinguishing and safety systems sector. A dark visual system, red accents, strong typography, service-focused content, and direct contact actions were combined to create a clear and professional digital experience for the brand.",
    challengeTR: "Deva Yangın’ın yangın söndürme ve güvenlik sistemleri alanındaki hizmetlerini profesyonel, güven veren ve kurumsal bir dijital yapı içinde sunabileceği modern bir web sitesine ihtiyacı vardı. Farklı hizmet ve ekipman kategorilerinin kullanıcı tarafından kolayca anlaşılması, güvenlik odaklı marka algısının güçlendirilmesi ve ziyaretçilerin hızlı biçimde iletişime yönlendirilmesi tasarımın temel ihtiyaçlarını oluşturuyordu.",
    challengeEN: "Deva Yangın needed a modern website capable of presenting its fire extinguishing and safety-system services within a professional, trustworthy, and corporate digital structure. The interface needed to make multiple service and equipment categories easy to understand, reinforce the brand’s safety-focused positioning, and give visitors clear paths to contact the company.",
    solutionTR: "Markanın sektörüne uygun olarak koyu zemin, yüksek kontrastlı beyaz ve kırmızı tipografi, güçlü yangın görselleri ve sade navigasyon yapısıyla kurumsal bir website arayüzü tasarlandı. Yangın ekipmanları, söndürme sistemleri ve güvenlik çözümleri gibi temel hizmet alanları anlaşılır bir bilgi mimarisi içinde yapılandırılırken, hizmetler ve iletişim aksiyonları kullanıcıyı hızlıca yönlendirecek biçimde görünür hale getirildi.",
    solutionEN: "A corporate interface was created around a dark background, high-contrast white and red typography, strong fire-related imagery, and simplified navigation. Key areas such as fire equipment, suppression systems, and safety solutions were organized within a clear information architecture, while service and contact actions were positioned prominently to guide users efficiently.",
    resultTR: "Deva Yangın için sektörel güven algısını destekleyen, profesyonel ve marka kimliğiyle uyumlu bir web deneyimi oluşturuldu. Hizmet alanlarının daha net sunulması, güçlü kurumsal görsel dil ve görünür iletişim aksiyonları sayesinde markanın dijital sunumu daha düzenli, erişilebilir ve güven veren bir yapıya kavuştu.",
    resultEN: "The resulting website provides Deva Yangın with a professional digital presence aligned with the trust requirements of the fire-safety sector. Clearer service presentation, a strong corporate visual language, and visible contact actions created a more structured, accessible, and confidence-building online experience.",
    roleTR: "Website Tasarımı & UI/UX",
    roleEN: "Website Design & UI/UX",
    desktopIcon: "/projects/deva-yangin-website-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/deva-yangin-website-tasarimi/thumbnail.webp",
      width: 130,
      height: 81,
      scale: 1,
      altTR: "Deva Yangın Website Tasarımı Masaüstü İkonu",
      altEN: "Deva Fire & Safety Website Design Desktop Icon"
    },
    thumbnail: "/projects/deva-yangin-website-tasarimi/thumbnail.webp",
    cover: "/projects/deva-yangin-website-tasarimi/cover.webp",
    initials: "DY",
    servicesTR: [
      "Website Tasarımı",
      "UI/UX Tasarımı",
      "Kurumsal Web Tasarımı",
      "Responsive Tasarım",
      "İçerik Hiyerarşisi",
      "Hizmet Odaklı Arayüz"
    ],
    servicesEN: [
      "Website Design",
      "UI/UX Design",
      "Corporate Web Design",
      "Responsive Design",
      "Content Hierarchy",
      "Service-Focused Interface"
    ],
    services: [
      "Website Design",
      "UI/UX Design",
      "Corporate Web Design",
      "Responsive Design",
      "Content Hierarchy",
      "Service-Focused Interface"
    ],
    tools: [],
    externalLinks: [
      {
        id: "live-site",
        type: "live",
        labelTR: "Siteyi Canlı Gör",
        labelEN: "View Live Site",
        href: "https://devayangin.com"
      }
    ],
    media: [
      {
        id: "media-2",
        type: "image",
        src: "/projects/deva-yangin-website-tasarimi/media/02-homepage-browser.webp",
        altTR: "Deva Yangın web sitesi ana sayfası, yangın görseli ve kırmızı iletişim aksiyonları.",
        altEN: "Deva Yangın website homepage featuring a fire visual and red service/contact actions.",
        captionTR: "Deva Yangın web sitesi ana sayfa görünümü",
        captionEN: "Deva Yangın website homepage view",
        layout: "full",
        width: 1024,
        height: 639
      },
      {
        id: "media-1",
        type: "image",
        src: "/projects/deva-yangin-website-tasarimi/media/01-laptop-presentation.webp",
        altTR: "Deva Yangın web sitesinin açık olduğu dizüstü bilgisayar, açık gri minimalist sunum ortamında.",
        altEN: "Laptop displaying the Deva Yangın website in a minimal light-gray presentation environment.",
        captionTR: "Deva Yangın web sitesinin kurumsal laptop sunumu",
        captionEN: "Corporate laptop presentation of the Deva Yangın website",
        layout: "full",
        width: 1024,
        height: 682
      },
      {
        id: "media-3",
        type: "image",
        src: "/projects/deva-yangin-website-tasarimi/media/03-hero-detail.webp",
        altTR: "Deva Yangın ana sayfası, yangın görseli, başlık tipografisi ve hizmetlerimiz butonu detayı.",
        altEN: "Deva Yangın homepage hero section, fire visual, headline typography and services button detail.",
        captionTR: "Deva Yangın kurumsal hero alanı, başlık hiyerarşisi ve hızlı iletişim aksiyonları",
        captionEN: "Deva Yangın corporate hero section, headline hierarchy and direct contact actions",
        layout: "full",
        width: 1600,
        height: 875
      },
      {
        id: "media-4",
        type: "image",
        src: "/projects/deva-yangin-website-tasarimi/media/04-fire-safety-presentation.webp",
        altTR: "Endüstriyel yangın güvenliği ve mühendislik stüdyosu ortamında Deva Yangın web sitesi masaüstü cihaz sunumu.",
        altEN: "Desktop device presentation of the Deva Yangın website in an industrial fire safety and engineering studio setting.",
        captionTR: "Deva Yangın yangın güvenliği ve mühendislik çalışma alanında kurumsal masaüstü sunumu",
        captionEN: "Deva Yangın corporate desktop presentation in a fire safety and engineering workspace",
        layout: "full",
        width: 1600,
        height: 893
      },
      {
        id: "media-5",
        type: "image",
        src: "/projects/deva-yangin-website-tasarimi/media/05-service-architecture.webp",
        altTR: "Deva Yangın web sitesinin yangın güvenliği, söndürme sistemleri ve iletişim odaklı UX yapısı.",
        altEN: "Deva Yangın website UX structure showing fire safety, suppression systems and contact-focused hierarchy.",
        captionTR: "Sektörel güven ve hızlı iletişim akışını destekleyen arayüz ve hizmet mimarisi",
        captionEN: "Interface and service architecture supporting industrial trust and direct contact flow",
        layout: "full",
        width: 1600,
        height: 900
      }
    ],
    desktop: {
      x: 8,
      y: 122
    },
    initialWindow: {
      width: 780,
      height: 640
    },
    featured: true,
    sortOrder: 4,
    featuredOrder: 4
  },

  {
    id: "emix-creative-website-tasarimi",
    slug: "emix-creative-website-tasarimi",
    workspace: "web",
    workspaceId: "web",
    categoryIds: [
      "website",
      "brand-identity"
    ],
    titleTR: "eMix Creative Website Tasarımı",
    titleEN: "eMix Creative Agency Website Design",
    desktopLabelTR: "eMix Creative",
    desktopLabelEN: "eMix Creative",
    client: "eMix Creative",
    categoryTR: "Dijital Ajans & Kurumsal Web",
    categoryEN: "Digital Agency & Corporate Web",
    projectTypeTR: "Web Sitesi > Dijital Ajans & Yaratıcı Hizmetler",
    projectTypeEN: "Website > Digital Agency & Creative Services",
    year: "2024",
    status: "completed",
    summaryTR: "eMix Creative için dijital medya ajansı kimliğini yansıtan modern, profesyonel ve dönüşüm odaklı bir website tasarımı hazırlandı. Hizmet alanları, yaratıcı üretim yetkinlikleri, marka dili ve iletişim aksiyonları güçlü görsel hiyerarşi ve kullanıcı dostu bir yapı içinde bir araya getirilerek ajansın dijital hizmetlerini destekleyen kapsamlı bir web deneyimi oluşturuldu.",
    summaryEN: "A modern, professional, and conversion-focused website was designed for eMix Creative to reflect its identity as a digital media and creative agency. Service areas, creative-production capabilities, brand communication, and contact actions were organized through a strong visual hierarchy and user-friendly structure to create a comprehensive digital agency experience.",
    descriptionTR: "eMix Creative için dijital medya ajansı kimliğini yansıtan modern, profesyonel ve dönüşüm odaklı bir website tasarımı hazırlandı. Hizmet alanları, yaratıcı üretim yetkinlikleri, marka dili ve iletişim aksiyonları güçlü görsel hiyerarşi ve kullanıcı dostu bir yapı içinde bir araya getirilerek ajansın dijital hizmetlerini destekleyen kapsamlı bir web deneyimi oluşturuldu.",
    descriptionEN: "A modern, professional, and conversion-focused website was designed for eMix Creative to reflect its identity as a digital media and creative agency. Service areas, creative-production capabilities, brand communication, and contact actions were organized through a strong visual hierarchy and user-friendly structure to create a comprehensive digital agency experience.",
    challengeTR: "eMix Creative’in web tasarımı, dijital medya, yaratıcı üretim, sosyal medya, reklam ve teknoloji odaklı farklı hizmetlerini tek bir kurumsal yapı altında anlaşılır biçimde sunabileceği modern bir web deneyimine ihtiyacı vardı. Çok sayıda hizmet alanının kullanıcıyı yormadan organize edilmesi, ajansın yaratıcı karakterinin görsel olarak güçlendirilmesi ve ziyaretçilerin proje veya hizmet talebi için hızlı biçimde iletişime yönlendirilmesi temel ihtiyaçları oluşturuyordu.",
    challengeEN: "eMix Creative needed a modern website capable of presenting its web design, digital media, creative production, social media, advertising, and technology-focused services within one clear corporate structure. The experience needed to organize a broad service offering without overwhelming users, reinforce the agency’s creative identity, and provide direct paths for potential clients to make contact.",
    solutionTR: "Markanın yaratıcı ve dijital karakterine uygun olarak güçlü başlık yapısı, sade navigasyon, hizmet odaklı içerik alanları, marka vurguları ve görünür iletişim aksiyonlarıyla modern bir website arayüzü tasarlandı. Ana sayfada hizmetlerin, yaratıcı üretim alanlarının ve proje yönlendirmelerinin anlaşılır bir görsel hiyerarşi içinde sunulmasına odaklanılırken, kullanıcıyı hizmet keşfinden iletişime taşıyan daha doğrudan bir deneyim kurgulandı.",
    solutionEN: "A modern interface was designed around strong typography, simplified navigation, service-focused content, distinctive brand elements, and visible contact actions. The homepage organizes agency services, creative-production capabilities, and project pathways within a clear visual hierarchy while creating a more direct journey from service discovery to client contact.",
    resultTR: "eMix Creative için markanın yaratıcı ve dijital gücünü yansıtan, profesyonel ve kullanıcı dostu bir web deneyimi oluşturuldu. Hizmetlerin daha net yapılandırılması, görsel marka dilinin güçlendirilmesi ve iletişim aksiyonlarının görünür hale getirilmesiyle ajansın dijital vitrini daha bütünlüklü, modern ve potansiyel müşteriler için erişilebilir bir yapıya kavuştu.",
    resultEN: "The resulting website gives eMix Creative a professional and user-friendly digital presence that reflects the agency’s creative and digital capabilities. Clearer service organization, stronger visual branding, and visible contact actions create a more cohesive and accessible digital storefront for potential clients.",
    roleTR: "Website Tasarımı & UI/UX",
    roleEN: "Website Design & UI/UX",
    desktopIcon: "/projects/emix-creative-website-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/emix-creative-website-tasarimi/thumbnail.webp",
      width: 130,
      height: 81,
      scale: 1,
      altTR: "eMix Creative Website Tasarımı Masaüstü İkonu",
      altEN: "eMix Creative Agency Website Design Desktop Icon"
    },
    thumbnail: "/projects/emix-creative-website-tasarimi/thumbnail.webp",
    cover: "/projects/emix-creative-website-tasarimi/cover.webp",
    initials: "EM",
    servicesTR: [
      "Website Tasarımı",
      "UI/UX Tasarımı",
      "Kurumsal Web Tasarımı",
      "Responsive Tasarım",
      "İçerik Hiyerarşisi",
      "Dönüşüm Odaklı Arayüz"
    ],
    servicesEN: [
      "Website Design",
      "UI/UX Design",
      "Corporate Web Design",
      "Responsive Design",
      "Content Hierarchy",
      "Conversion-Focused Interface"
    ],
    services: [
      "Website Design",
      "UI/UX Design",
      "Corporate Web Design",
      "Responsive Design",
      "Content Hierarchy",
      "Conversion-Focused Interface"
    ],
    tools: [],
    externalLinks: [
      {
        id: "live-site",
        type: "live",
        labelTR: "Siteyi Canlı Gör",
        labelEN: "View Live Site",
        href: "https://emixcreative.com"
      }
    ],
    media: [
      {
        id: "media-2",
        type: "image",
        src: "/projects/emix-creative-website-tasarimi/media/02-dark-agency-homepage.webp",
        altTR: "eMix Creative web sitesi ana sayfası, koyu lacivert arayüz ve yaratıcı hizmet vurguları.",
        altEN: "eMix Creative homepage featuring a dark navy interface and creative service highlights.",
        captionTR: "eMix Creative web sitesi koyu tema ana sayfa görünümü",
        captionEN: "eMix Creative website dark theme homepage view",
        layout: "full",
        width: 1024,
        height: 639
      },
      {
        id: "media-1",
        type: "image",
        src: "/projects/emix-creative-website-tasarimi/media/01-agency-laptop-presentation.webp",
        altTR: "eMix Creative web sitesinin açık olduğu dizüstü bilgisayar, sıcak ve modern yaratıcı çalışma ortamında.",
        altEN: "Laptop displaying the eMix Creative website in a warm modern creative workspace.",
        captionTR: "eMix Creative web sitesinin modern dijital ajans sunumu",
        captionEN: "Modern digital-agency presentation of the eMix Creative website",
        layout: "full",
        width: 1024,
        height: 682
      },
      {
        id: "media-3",
        type: "image",
        src: "/projects/emix-creative-website-tasarimi/media/03-service-hero-detail.webp",
        altTR: "eMix Creative ana sayfası, marka güçlendirme başlığı, analitik kartları ve megafonlu model görseli.",
        altEN: "eMix Creative homepage hero section, brand growth headline, analytics cards and model with megaphone.",
        captionTR: "eMix Creative ajans ana sayfa hero alanı ve analitik çözümler detayı",
        captionEN: "eMix Creative agency homepage hero section and analytics solutions detail",
        layout: "full",
        width: 1600,
        height: 1041
      },
      {
        id: "media-4",
        type: "image",
        src: "/projects/emix-creative-website-tasarimi/media/04-agency-presentation.webp",
        altTR: "Kreatif ajans stüdyo ortamında eMix Creative web sitesi masaüstü cihaz sunumu.",
        altEN: "Desktop device presentation of the eMix Creative website in a creative agency studio setting.",
        captionTR: "eMix Creative modern kreatif stüdyo çalışma alanında kurumsal masaüstü sunumu",
        captionEN: "eMix Creative corporate desktop presentation in a modern creative studio workspace",
        layout: "full",
        width: 1600,
        height: 893
      },
      {
        id: "media-5",
        type: "image",
        src: "/projects/emix-creative-website-tasarimi/media/05-service-ecosystem.webp",
        altTR: "eMix Creative web sitesinin tasarım, yazılım, pazarlama ve iletişim odaklı UX yapısı.",
        altEN: "eMix Creative website UX structure showing design, software, marketing and contact-focused hierarchy.",
        captionTR: "Kreatif ajans kimliğini ve hızlı iletişim akışını destekleyen arayüz ve hizmet ekosistemi",
        captionEN: "Interface and service ecosystem supporting creative agency identity and direct contact flow",
        layout: "full",
        width: 1600,
        height: 900
      }
    ],
    desktop: {
      x: 8,
      y: 144
    },
    initialWindow: {
      width: 780,
      height: 640
    },
    featured: true,
    sortOrder: 5,
    featuredOrder: 5
  },

  {
    id: "iuckmk-website-tasarimi",
    slug: "iuckmk-website-tasarimi",
    workspace: "web",
    workspaceId: "web",
    categoryIds: [
      "website",
      "brand-identity"
    ],
    titleTR: "IUCKMK Website Tasarımı",
    titleEN: "IUCKMK Student Club Website Design",
    desktopLabelTR: "IUCKMK",
    desktopLabelEN: "IUCKMK",
    client: "IUCKMK",
    categoryTR: "Topluluk & Kurumsal Web",
    categoryEN: "Community & Organization Web",
    projectTypeTR: "Web Sitesi > Öğrenci Kulübü & Topluluk Portalı",
    projectTypeEN: "Website > Student Club & Community Portal",
    year: "2024",
    status: "completed",
    summaryTR: "IUCKMK için kulüp kimliğini, projelerini ve öğrenci topluluğu faaliyetlerini dijital ortamda düzenli ve profesyonel biçimde sunan modern bir website tasarımı hazırlandı. Etkinlikler, teknik geziler, kariyer çalışmaları, sosyal projeler, akademik içerikler ve ekip bilgileri sade navigasyon ve kullanıcı dostu içerik yapısıyla tek bir dijital platformda bir araya getirildi.",
    summaryEN: "A modern website was designed for IUCKMK to present the club’s identity, projects, and student-community activities through a structured and professional digital platform. Events, technical visits, career initiatives, social projects, academic content, and team information were brought together through clear navigation and a user-friendly content structure.",
    descriptionTR: "IUCKMK için kulüp kimliğini, projelerini ve öğrenci topluluğu faaliyetlerini dijital ortamda düzenli ve profesyonel biçimde sunan modern bir website tasarımı hazırlandı. Etkinlikler, teknik geziler, kariyer çalışmaları, sosyal projeler, akademik içerikler ve ekip bilgileri sade navigasyon ve kullanıcı dostu içerik yapısıyla tek bir dijital platformda bir araya getirildi.",
    descriptionEN: "A modern website was designed for IUCKMK to present the club’s identity, projects, and student-community activities through a structured and professional digital platform. Events, technical visits, career initiatives, social projects, academic content, and team information were brought together through clear navigation and a user-friendly content structure.",
    challengeTR: "IUCKMK’nın etkinliklerini, projelerini, akademik çalışmalarını ve öğrenci topluluğu faaliyetlerini farklı dijital kanallara dağılmadan tek bir platformda düzenli biçimde sunabileceği bir web sitesine ihtiyacı vardı. Çok sayıda faaliyet alanının kullanıcı tarafından kolayca keşfedilmesi, kulüp kimliğinin profesyonel biçimde temsil edilmesi ve öğrencilere güncel içeriklere hızlı erişim sağlanması temel ihtiyaçları oluşturuyordu.",
    challengeEN: "IUCKMK needed a website capable of bringing its events, projects, academic initiatives, and student-community activities together within a single organized digital platform. The experience needed to make a broad range of activities easy to discover, represent the club identity professionally, and provide students with clear access to relevant content.",
    solutionTR: "Kulübün akademik ve öğrenci odaklı yapısına uygun olarak sade, açık ve bilgilendirici bir website arayüzü tasarlandı. Projeler, teknik geziler, kariyer desteği, sosyal etkinlikler, akademik içerikler ve ekip bilgileri belirgin navigasyon başlıkları altında yapılandırıldı. Ana sayfada kulübün kimliğini ve faaliyetlerini güçlü bir hero alanıyla öne çıkaran, kullanıcıyı içerik keşfine yönlendiren anlaşılır bir bilgi mimarisi oluşturuldu.",
    solutionEN: "A clean and informative interface was designed around the club’s academic and student-focused character. Projects, technical visits, career support, social events, academic content, and team information were structured under clearly defined navigation areas. The homepage uses a strong introductory hero and a straightforward information architecture to communicate the club identity and guide visitors toward its activities.",
    resultTR: "IUCKMK için kulüp faaliyetlerini daha düzenli ve profesyonel biçimde sunan, içerik erişimini kolaylaştıran ve öğrenci topluluğunun dijital görünürlüğünü destekleyen bütünlüklü bir web deneyimi oluşturuldu. Farklı proje ve etkinlik alanlarının tek yapı altında toplanmasıyla kulübün dijital iletişimi daha erişilebilir, anlaşılır ve kurumsal bir görünüme kavuştu.",
    resultEN: "The resulting website provides IUCKMK with a more structured and professional way to present its activities while improving access to club content and supporting the digital visibility of the student community. Bringing multiple project and event areas into one system created a clearer, more accessible, and more cohesive online presence.",
    roleTR: "Website Tasarımı & UI/UX",
    roleEN: "Website Design & UI/UX",
    desktopIcon: "/projects/iuckmk-website-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/iuckmk-website-tasarimi/thumbnail.webp",
      width: 130,
      height: 81,
      scale: 1,
      altTR: "IUCKMK Website Tasarımı Masaüstü İkonu",
      altEN: "IUCKMK Student Club Website Design Desktop Icon"
    },
    thumbnail: "/projects/iuckmk-website-tasarimi/thumbnail.webp",
    cover: "/projects/iuckmk-website-tasarimi/cover.webp",
    initials: "KMK",
    servicesTR: [
      "Website Tasarımı",
      "UI/UX Tasarımı",
      "Bilgi Mimarisi",
      "Responsive Tasarım",
      "İçerik Hiyerarşisi",
      "Topluluk Web Tasarımı"
    ],
    servicesEN: [
      "Website Design",
      "UI/UX Design",
      "Information Architecture",
      "Responsive Design",
      "Content Hierarchy",
      "Community Website Design"
    ],
    services: [
      "Website Design",
      "UI/UX Design",
      "Information Architecture",
      "Responsive Design",
      "Content Hierarchy",
      "Community Website Design"
    ],
    tools: [],
    externalLinks: [
      {
        id: "live-site",
        type: "live",
        labelTR: "Siteyi Canlı Gör",
        labelEN: "View Live Site",
        href: "https://iuckmk.com"
      }
    ],
    media: [
      {
        id: "media-2",
        type: "image",
        src: "/projects/iuckmk-website-tasarimi/media/02-homepage-browser.webp",
        altTR: "IUCKMK ana sayfası, kulüp navigasyonu ve etkinlik salonu hero görseli.",
        altEN: "IUCKMK homepage featuring club navigation and an event-auditorium hero image.",
        captionTR: "IUCKMK web sitesi ana sayfa ve navigasyon görünümü",
        captionEN: "IUCKMK website homepage and navigation view",
        layout: "full",
        width: 1024,
        height: 639
      },
      {
        id: "media-1",
        type: "image",
        src: "/projects/iuckmk-website-tasarimi/media/01-imac-presentation.webp",
        altTR: "IUCKMK web sitesinin açık olduğu iMac, aydınlık ve minimalist çalışma alanında.",
        altEN: "iMac displaying the IUCKMK website in a bright minimalist workspace.",
        captionTR: "IUCKMK web sitesinin modern masaüstü sunumu",
        captionEN: "Modern desktop presentation of the IUCKMK website",
        layout: "full",
        width: 1024,
        height: 682
      },
      {
        id: "media-3",
        type: "image",
        src: "/projects/iuckmk-website-tasarimi/media/03-navigation-detail.webp",
        altTR: "IUCKMK ana sayfası, kulüp logosu, 12 kategorili navigasyon yapısı ve karşılama alanı detayı.",
        altEN: "IUCKMK homepage, club logo, 12-category navigation structure and welcome hero section detail.",
        captionTR: "IUCKMK kapsamlı bilgi mimarisi, kulüp kimliği ve navigasyon yapısı",
        captionEN: "IUCKMK comprehensive information architecture, club identity and navigation structure",
        layout: "full",
        width: 1600,
        height: 890
      },
      {
        id: "media-4",
        type: "image",
        src: "/projects/iuckmk-website-tasarimi/media/04-community-presentation.webp",
        altTR: "Akademik kampüs ve çalışma alanında IUCKMK web sitesi masaüstü cihaz sunumu.",
        altEN: "Desktop device presentation of the IUCKMK website in an academic campus and workspace setting.",
        captionTR: "IUCKMK modern akademik çalışma alanında kurumsal masaüstü sunumu",
        captionEN: "IUCKMK corporate desktop presentation in a modern academic workspace",
        layout: "full",
        width: 1600,
        height: 893
      },
      {
        id: "media-5",
        type: "image",
        src: "/projects/iuckmk-website-tasarimi/media/05-content-architecture.webp",
        altTR: "IUCKMK web sitesinin projeler, etkinlikler ve topluluk odaklı bilgi mimarisi şeması.",
        altEN: "IUCKMK website information architecture diagram showing projects, events and community structure.",
        captionTR: "Kulüp faaliyetlerini ve içerik erişimini organize eden bilgi mimarisi sistemi",
        captionEN: "Information architecture system organizing club activities and content accessibility",
        layout: "full",
        width: 1600,
        height: 900
      }
    ],
    desktop: {
      x: 8,
      y: 166
    },
    initialWindow: {
      width: 780,
      height: 640
    },
    featured: true,
    sortOrder: 6,
    featuredOrder: 6
  },

  {
    id: "engin-perde-website-optimizasyonu",
    slug: "engin-perde-website-optimizasyonu",
    workspace: "web",
    workspaceId: "web",
    categoryIds: [
      "website",
      "ecommerce"
    ],
    titleTR: "Engin Perde Website Optimizasyonu",
    titleEN: "Engin Perde Website Optimization",
    desktopLabelTR: "Engin Perde Web",
    desktopLabelEN: "Engin Perde Web",
    client: "Engin Perde",
    categoryTR: "Web & E-Ticaret Optimizasyonu",
    categoryEN: "Web & E-Commerce Optimization",
    projectTypeTR: "Web Sitesi > Ürün & Fiyatlandırma Optimizasyonu",
    projectTypeEN: "Website > Product & Pricing Optimization",
    year: "2026",
    status: "completed",
    summaryTR: "Engin Perde web sitesinde ürün yapısı ve fiyatlandırma sistemi optimize edildi. Perde ürünleri için en ve boy ölçülerine göre çalışan fiyat hesaplama altyapısı düzenlenerek kullanıcıların daha doğru, pratik ve kişiselleştirilmiş fiyat alabilmesi sağlandı.",
    summaryEN: "The product structure and pricing system of the Engin Perde website were optimized. A width- and height-based pricing infrastructure was improved for curtain products so users could receive more accurate, practical, and personalized pricing.",
    descriptionTR: "Engin Perde web sitesinde ürün yapısı ve fiyatlandırma sistemi optimize edildi. Perde ürünleri için en ve boy ölçülerine göre çalışan fiyat hesaplama altyapısı düzenlenerek kullanıcıların daha doğru, pratik ve kişiselleştirilmiş fiyat alabilmesi sağlandı.",
    descriptionEN: "The product structure and pricing system of the Engin Perde website were optimized. A width- and height-based pricing infrastructure was improved for curtain products so users could receive more accurate, practical, and personalized pricing.",
    challengeTR: "Engin Perde’nin perde ürünlerinde fiyatlandırma süreci standart ürün fiyatından daha karmaşıktı. Ürünlerin en ve boy ölçülerine göre fiyatlandırılması gerektiği için kullanıcıların doğru fiyatı kolayca görebileceği, ürün yapısıyla uyumlu çalışan bir sisteme ihtiyaç vardı.",
    challengeEN: "The pricing process for Engin Perde’s curtain products was more complex than standard e-commerce product pricing. Since products needed to be priced according to width and height, the site required a system aligned with the product structure where users could easily see the correct price.",
    solutionTR: "Web sitesindeki ürün yapısı optimize edilerek en ve boy ölçülerine göre fiyat hesaplayabilen bir fiyatlandırma sistemi kurgulandı. Ürün varyasyonları, ölçü alanları ve fiyat hesaplama mantığı kullanıcı deneyimini kolaylaştıracak şekilde düzenlendi. Böylece müşteriler seçtikleri ölçülere göre daha net ve doğru fiyat bilgisine ulaşabilir hale getirildi.",
    solutionEN: "The website’s product structure was optimized and a pricing system capable of calculating prices based on width and height was implemented. Product variations, measurement inputs, and pricing logic were arranged in a way that improved the user experience, allowing customers to access clearer and more accurate pricing based on their selected dimensions.",
    resultTR: "Engin Perde web sitesi için daha işlevsel, kullanıcı dostu ve satış sürecini destekleyen bir ürün/fiyatlandırma yapısı oluşturuldu. Ölçü bazlı fiyatlandırma sistemi sayesinde kullanıcı deneyimi iyileştirildi, ürün yönetimi daha düzenli hale getirildi ve online satış süreci daha profesyonel bir yapıya kavuştu.",
    resultEN: "A more functional, user-friendly, and sales-supporting product/pricing structure was created for the Engin Perde website. Thanks to the measurement-based pricing system, user experience was improved, product management became more organized, and the online sales process gained a more professional structure.",
    roleTR: "E-Ticaret & Ürün Sistemi Optimizasyonu",
    roleEN: "E-Commerce & Product System Optimization",
    desktopIcon: "/projects/engin-perde-website-optimizasyonu/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/engin-perde-website-optimizasyonu/thumbnail.webp",
      width: 130,
      height: 81,
      scale: 1,
      altTR: "Engin Perde Website Optimizasyonu Masaüstü İkonu",
      altEN: "Engin Perde Website Optimization Desktop Icon"
    },
    thumbnail: "/projects/engin-perde-website-optimizasyonu/thumbnail.webp",
    cover: "/projects/engin-perde-website-optimizasyonu/cover.webp",
    initials: "EP",
    servicesTR: [
      "Website Optimization",
      "E-Commerce Optimization",
      "Product Structure",
      "Measurement-Based Pricing",
      "UX Improvement",
      "Pricing System Setup"
    ],
    servicesEN: [
      "Website Optimization",
      "E-Commerce Optimization",
      "Product Structure",
      "Measurement-Based Pricing",
      "UX Improvement",
      "Pricing System Setup"
    ],
    services: [
      "Website Optimization",
      "E-Commerce Optimization",
      "Product Structure",
      "Measurement-Based Pricing",
      "UX Improvement",
      "Pricing System Setup"
    ],
    tools: [],
    externalLinks: [
      {
        id: "live-site",
        type: "live",
        labelTR: "Siteyi Canlı Gör",
        labelEN: "View Live Site",
        href: "https://enginperde.com"
      }
    ],
    media: [
      {
        id: "media-2",
        type: "image",
        src: "/projects/engin-perde-website-optimizasyonu/media/02-homepage.webp",
        altTR: "Engin Perde web sitesi ana sayfası ve perde koleksiyonu hero alanı.",
        altEN: "Engin Perde website homepage with a curtain collection hero section.",
        captionTR: "Engin Perde web sitesi ana sayfa görünümü",
        captionEN: "Engin Perde website homepage",
        layout: "full",
        width: 1024,
        height: 640
      },
      {
        id: "media-1",
        type: "image",
        src: "/projects/engin-perde-website-optimizasyonu/media/01-product-detail-mockup.webp",
        altTR: "Engin Perde ürün detay sayfasının açık olduğu dizüstü bilgisayar, perde showroom atmosferinde.",
        altEN: "Laptop displaying the Engin Perde product detail page in a curtain showroom environment.",
        captionTR: "Ürün detay ve ölçü bazlı fiyatlandırma deneyimi",
        captionEN: "Product detail and measurement-based pricing experience",
        layout: "full",
        width: 1024,
        height: 768
      },
      {
        id: "media-3",
        type: "image",
        src: "/projects/engin-perde-website-optimizasyonu/media/03-pricing-system-showcase.webp",
        altTR: "Engin Perde ölçü bazlı fiyatlandırma sistemi şeması ve hesaplama adımları.",
        altEN: "Engin Perde measurement-based pricing system diagram and calculation steps.",
        captionTR: "En ve boy ölçülerine dayalı dinamik fiyat hesaplama mimarisi",
        captionEN: "Dynamic price calculation architecture based on width and height measurements",
        layout: "full",
        width: 1600,
        height: 1000
      },
      {
        id: "media-4",
        type: "image",
        src: "/projects/engin-perde-website-optimizasyonu/media/04-website-presentation.webp",
        altTR: "Engin Perde web sitesinin tarayıcı çerçevesi içindeki modern masaüstü sunumu.",
        altEN: "Modern desktop presentation of the Engin Perde website within a browser frame.",
        captionTR: "Engin Perde kurumsal web platformu masaüstü sunumu",
        captionEN: "Engin Perde corporate web platform desktop presentation",
        layout: "full",
        width: 1600,
        height: 1000
      }
    ],
    desktop: {
      x: 8,
      y: 12
    },
    initialWindow: {
      width: 780,
      height: 640
    },
    featured: false,
    sortOrder: 7
  },

  {
    id: "sanda-yachting-website-ceviri-calismasi",
    slug: "sanda-yachting-website-ceviri-calismasi",
    workspace: "web",
    workspaceId: "web",
    categoryIds: [
      "website",
      "seo"
    ],
    titleTR: "Sanda Yachting Website Çeviri Çalışması",
    titleEN: "Sanda Yachting Website Translation Work",
    desktopLabelTR: "Sanda Yachting Web",
    desktopLabelEN: "Sanda Yachting Web",
    client: "Sanda Yachting",
    categoryTR: "Web Sitesi & İçerik Lokalizasyonu",
    categoryEN: "Website & Content Localization",
    projectTypeTR: "Web Sitesi > Çeviri & İçerik Lokalizasyonu",
    projectTypeEN: "Website > Translation & Content Localization",
    year: "2026",
    status: "completed",
    summaryTR: "Sanda Yachting web sitesi için Türkçe ve İngilizce dil uyumluluğunu güçlendiren çeviri çalışması yapıldı. Site içerikleri, marka dili korunarak daha anlaşılır, profesyonel ve uluslararası kullanıcı deneyimine uygun hale getirildi.",
    summaryEN: "A translation and language adaptation project was carried out for the Sanda Yachting website to strengthen Turkish and English language consistency. The site content was refined to be clearer, more professional, and more suitable for an international user experience while preserving the brand tone.",
    descriptionTR: "Sanda Yachting web sitesi için Türkçe ve İngilizce dil uyumluluğunu güçlendiren çeviri çalışması yapıldı. Site içerikleri, marka dili korunarak daha anlaşılır, profesyonel ve uluslararası kullanıcı deneyimine uygun hale getirildi.",
    descriptionEN: "A translation and language adaptation project was carried out for the Sanda Yachting website to strengthen Turkish and English language consistency. The site content was refined to be clearer, more professional, and more suitable for an international user experience while preserving the brand tone.",
    challengeTR: "Sanda Yachting’in web sitesinde Türkçe ve İngilizce içeriklerin dil açısından tutarlı, profesyonel ve hedef kitleye uygun şekilde sunulması gerekiyordu. Özellikle yatçılık ve turizm alanındaki hizmetlerin uluslararası kullanıcılar tarafından net anlaşılması önemliydi.",
    challengeEN: "The Turkish and English content on the Sanda Yachting website needed to be presented in a consistent, professional, and audience-appropriate way. It was especially important that the yacht tourism services be clearly understood by international users.",
    solutionTR: "Web sitesindeki içerikler Türkçe ve İngilizce dil yapısına uygun şekilde düzenlendi. Marka tonu korunarak başlıklar, açıklamalar, hizmet metinleri ve kullanıcıya yönelik yönlendirmeler daha doğal, anlaşılır ve profesyonel bir çeviri diliyle hazırlandı.",
    solutionEN: "The website content was revised in line with Turkish and English language structures. While preserving the brand tone, headings, descriptions, service texts, and user-facing guidance were rewritten in a more natural, clear, and professional translation style.",
    resultTR: "Sanda Yachting web sitesi, Türkçe ve İngilizce kullanıcılar için daha anlaşılır, güven veren ve profesyonel bir içerik yapısına kavuştu. Çalışma, markanın uluslararası dijital iletişimini güçlendiren daha tutarlı bir web deneyimi sağladı.",
    resultEN: "The Sanda Yachting website gained a clearer, more trustworthy, and more professional content structure for both Turkish and English users. The work created a more consistent web experience and strengthened the brand’s international digital communication.",
    roleTR: "İçerik Düzenleme & Çeviri Adaptasyonu",
    roleEN: "Content Editing & Translation Adaptation",
    desktopIcon: "/projects/sanda-yachting-website-ceviri-calismasi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/sanda-yachting-website-ceviri-calismasi/thumbnail.webp",
      width: 130,
      height: 81,
      scale: 1,
      altTR: "Sanda Yachting Website Çeviri Çalışması Masaüstü İkonu",
      altEN: "Sanda Yachting Website Translation Work Desktop Icon"
    },
    thumbnail: "/projects/sanda-yachting-website-ceviri-calismasi/thumbnail.webp",
    cover: "/projects/sanda-yachting-website-ceviri-calismasi/cover.webp",
    initials: "SY",
    servicesTR: [
      "Website Translation",
      "Content Localization",
      "Turkish / English Adaptation",
      "Web Content Editing",
      "UX Writing",
      "Brand Language Alignment"
    ],
    servicesEN: [
      "Website Translation",
      "Content Localization",
      "Turkish / English Adaptation",
      "Web Content Editing",
      "UX Writing",
      "Brand Language Alignment"
    ],
    services: [
      "Website Translation",
      "Content Localization",
      "Turkish / English Adaptation",
      "Web Content Editing",
      "UX Writing",
      "Brand Language Alignment"
    ],
    tools: [],
    externalLinks: [
      {
        id: "live-site",
        type: "live",
        labelTR: "Siteyi Canlı Gör",
        labelEN: "View Live Site",
        href: "https://sandayachting.com/tr/"
      }
    ],
    media: [
      {
        id: "media-2",
        type: "image",
        src: "/projects/sanda-yachting-website-ceviri-calismasi/media/02-homepage-screenshot.webp",
        altTR: "Sanda Yachting web sitesi ana sayfası ve Akdeniz gulet filosu hero alanı.",
        altEN: "Sanda Yachting website homepage with Mediterranean gulet fleet hero section.",
        captionTR: "Sanda Yachting web sitesi ana sayfa görünümü",
        captionEN: "Sanda Yachting website homepage",
        layout: "full",
        width: 1024,
        height: 640
      },
      {
        id: "media-1",
        type: "image",
        src: "/projects/sanda-yachting-website-ceviri-calismasi/media/01-laptop-mockup.webp",
        altTR: "Sanda Yachting web sitesinin açık olduğu dizüstü bilgisayar, deniz manzaralı aydınlık oda atmosferinde.",
        altEN: "Laptop displaying the Sanda Yachting website in a bright seaside room atmosphere.",
        captionTR: "Sanda Yachting kurumsal web sitesi masaüstü deneyimi",
        captionEN: "Sanda Yachting corporate website desktop experience",
        layout: "full",
        width: 819,
        height: 1024
      },
      {
        id: "media-3",
        type: "image",
        src: "/projects/sanda-yachting-website-ceviri-calismasi/media/03-content-localization-showcase.webp",
        altTR: "Sanda Yachting Türkçe ve İngilizce içerik lokalizasyonu ve UX metinleri şeması.",
        altEN: "Sanda Yachting Turkish and English content localization and UX writing diagram.",
        captionTR: "Türkçe ve İngilizce dil uyumu & UX içerik mimarisi",
        captionEN: "Turkish and English language consistency & UX content architecture",
        layout: "full",
        width: 1600,
        height: 1000
      },
      {
        id: "media-4",
        type: "image",
        src: "/projects/sanda-yachting-website-ceviri-calismasi/media/04-website-presentation.webp",
        altTR: "Sanda Yachting web sitesinin modern tarayıcı penceresi içindeki sunumu.",
        altEN: "Modern browser window presentation of the Sanda Yachting website.",
        captionTR: "Sanda Yachting resmi web platformu sunumu",
        captionEN: "Sanda Yachting official web platform presentation",
        layout: "full",
        width: 1600,
        height: 1000
      }
    ],
    desktop: {
      x: 8,
      y: 34
    },
    initialWindow: {
      width: 780,
      height: 640
    },
    featured: false,
    sortOrder: 8
  },

  {
    id: "ceylanlar-site-yonetimi-website-tasarimi",
    slug: "ceylanlar-site-yonetimi-website-tasarimi",
    workspace: "web",
    workspaceId: "web",
    categoryIds: [
      "website",
      "brand-identity"
    ],
    titleTR: "Ceylanlar Site Yönetimi Website Tasarımı",
    titleEN: "Ceylanlar Site Management Website Design",
    desktopLabelTR: "Ceylanlar Web",
    desktopLabelEN: "Ceylanlar Web",
    client: "Ceylanlar Site Yönetimi",
    categoryTR: "Kurumsal Web Sitesi & UI/UX",
    categoryEN: "Corporate Website & UI/UX",
    projectTypeTR: "Web Sitesi > Kurumsal Site Yönetimi Tasarımı",
    projectTypeEN: "Website > Corporate Property Management Design",
    year: "2024",
    status: "completed",
    summaryTR: "Ceylanlar Site Yönetimi için profesyonel site yönetimi hizmetlerini dijital ortamda güven veren, kurumsal ve modern bir arayüzle sunan website tasarımı hazırlandı. Güçlü görsel hiyerarşi, hizmet odaklı içerik yapısı ve hızlı iletişim aksiyonları bir araya getirilerek markanın profesyonel hizmet yaklaşımını destekleyen kullanıcı dostu bir web deneyimi oluşturuldu.",
    summaryEN: "A modern corporate website was designed for Ceylanlar Site Yönetimi to present its professional property-management services through a trustworthy and structured digital experience. Strong visual hierarchy, service-focused content, and direct contact actions were combined to create a user-friendly interface that supports the brand’s professional positioning.",
    descriptionTR: "Ceylanlar Site Yönetimi için profesyonel site yönetimi hizmetlerini dijital ortamda güven veren, kurumsal ve modern bir arayüzle sunan website tasarımı hazırlandı. Güçlü görsel hiyerarşi, hizmet odaklı içerik yapısı ve hızlı iletişim aksiyonları bir araya getirilerek markanın profesyonel hizmet yaklaşımını destekleyen kullanıcı dostu bir web deneyimi oluşturuldu.",
    descriptionEN: "A modern corporate website was designed for Ceylanlar Site Yönetimi to present its professional property-management services through a trustworthy and structured digital experience. Strong visual hierarchy, service-focused content, and direct contact actions were combined to create a user-friendly interface that supports the brand’s professional positioning.",
    challengeTR: "Ceylanlar Site Yönetimi’nin profesyonel site yönetimi hizmetlerini daha kurumsal, erişilebilir ve güven veren bir dijital yapı içinde sunabileceği modern bir web sitesine ihtiyacı vardı. Farklı hizmet alanlarının kullanıcı tarafından kolayca anlaşılması, markanın profesyonel algısının güçlendirilmesi ve ziyaretçilerin hızlı biçimde iletişime yönlendirilmesi tasarımın temel ihtiyaçlarını oluşturuyordu.",
    challengeEN: "Ceylanlar Site Yönetimi needed a modern digital platform capable of presenting its professional property-management services in a more corporate, accessible, and trustworthy way. The website needed to make multiple service areas easy to understand, strengthen the brand’s professional perception, and provide clear paths for visitors to make contact quickly.",
    solutionTR: "Markanın kurumsal yapısına uygun koyu görsel tema, yüksek kontrastlı başlık kullanımı, sade navigasyon ve hizmet odaklı içerik alanlarıyla modern bir website arayüzü tasarlandı. Kullanıcının ana hizmetlere kolayca ulaşabilmesi için bilgi mimarisi sadeleştirilirken, telefon, hızlı teklif ve WhatsApp gibi iletişim aksiyonları görünür noktalarda konumlandırıldı. Böylece kurumsal sunum ile hızlı kullanıcı aksiyonu aynı deneyim içinde bir araya getirildi.",
    solutionEN: "A modern interface was designed around a dark corporate visual system, high-contrast typography, simplified navigation, and service-focused content areas. The information architecture was structured to make core services easy to discover, while direct actions such as phone contact, quick quotation, and WhatsApp were positioned prominently throughout the experience. This brought corporate presentation and rapid user action together within the same interface.",
    resultTR: "Ceylanlar Site Yönetimi için güven veren, profesyonel ve marka kimliğiyle uyumlu bir web deneyimi oluşturuldu. Hizmetlerin daha net sunulması, iletişim seçeneklerinin görünür hale getirilmesi ve güçlü kurumsal görsel dil sayesinde markanın dijital sunumu daha düzenli, erişilebilir ve profesyonel bir yapıya kavuştu.",
    resultEN: "The resulting website provides Ceylanlar Site Yönetimi with a professional and trustworthy digital presence aligned with its corporate identity. Clearer service presentation, visible contact options, and a strong visual system created a more structured, accessible, and professional online experience for the brand.",
    roleTR: "Website Tasarımı & UI/UX",
    roleEN: "Website Design & UI/UX",
    desktopIcon: "/projects/ceylanlar-site-yonetimi-website-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/ceylanlar-site-yonetimi-website-tasarimi/thumbnail.webp",
      width: 130,
      height: 81,
      scale: 1,
      altTR: "Ceylanlar Site Yönetimi Website Tasarımı Masaüstü İkonu",
      altEN: "Ceylanlar Site Management Website Design Desktop Icon"
    },
    thumbnail: "/projects/ceylanlar-site-yonetimi-website-tasarimi/thumbnail.webp",
    cover: "/projects/ceylanlar-site-yonetimi-website-tasarimi/cover.webp",
    initials: "CS",
    servicesTR: [
      "Website Tasarımı",
      "UI/UX Tasarımı",
      "Kurumsal Web Tasarımı",
      "Responsive Tasarım",
      "İçerik Hiyerarşisi",
      "İletişim Odaklı Arayüz"
    ],
    servicesEN: [
      "Website Design",
      "UI/UX Design",
      "Corporate Web Design",
      "Responsive Design",
      "Content Hierarchy",
      "Contact-Focused Interface"
    ],
    services: [
      "Website Design",
      "UI/UX Design",
      "Corporate Web Design",
      "Responsive Design",
      "Content Hierarchy",
      "Contact-Focused Interface"
    ],
    tools: [],
    externalLinks: [
      {
        id: "live-site",
        type: "live",
        labelTR: "Siteyi Canlı Gör",
        labelEN: "View Live Site",
        href: "https://ceylanlaryonetim.com"
      }
    ],
    media: [
      {
        id: "media-2",
        type: "image",
        src: "/projects/ceylanlar-site-yonetimi-website-tasarimi/media/02-homepage-browser.webp",
        altTR: "Ceylanlar Site Yönetimi ana sayfası, site yaşam alanı görseli ve turuncu iletişim aksiyonları.",
        altEN: "Ceylanlar Site Yönetimi homepage with a residential complex hero image and orange contact actions.",
        captionTR: "Ceylanlar Site Yönetimi web sitesi ana sayfa ve kurumsal hero alanı",
        captionEN: "Ceylanlar Site Management website homepage and corporate hero section",
        layout: "full",
        width: 1024,
        height: 640
      },
      {
        id: "media-1",
        type: "image",
        src: "/projects/ceylanlar-site-yonetimi-website-tasarimi/media/01-lifestyle-laptop.webp",
        altTR: "Ceylanlar Site Yönetimi web sitesinin açık olduğu dizüstü bilgisayar, modern masa ve kahve sunumu.",
        altEN: "Laptop displaying the Ceylanlar Site Yönetimi website on a modern desk with a coffee setting.",
        captionTR: "Ceylanlar Site Yönetimi web sitesinin kurumsal dijital sunumu",
        captionEN: "Corporate digital presentation of the Ceylanlar Site Yönetimi website",
        layout: "full",
        width: 719,
        height: 847
      },
      {
        id: "media-3",
        type: "image",
        src: "/projects/ceylanlar-site-yonetimi-website-tasarimi/media/03-hero-detail.webp",
        altTR: "Ceylanlar Site Yönetimi büyük başlık tipografisi ve hızlı teklif aksiyonu detayı.",
        altEN: "Ceylanlar Site Management headline typography and quick quote action detail.",
        captionTR: "Kurumsal başlık hiyerarşisi, site yaşam alanı görseli ve hızlı teklif butonları",
        captionEN: "Corporate headline hierarchy, residential environment visual and quick quote buttons",
        layout: "full",
        width: 1600,
        height: 938
      },
      {
        id: "media-4",
        type: "image",
        src: "/projects/ceylanlar-site-yonetimi-website-tasarimi/media/04-corporate-presentation.webp",
        altTR: "Modern kurumsal ofis ortamında Ceylanlar Site Yönetimi web sitesini gösteren dizüstü bilgisayar.",
        altEN: "Laptop displaying the Ceylanlar Site Management website in a modern corporate office setting.",
        captionTR: "Ceylanlar Site Yönetimi modern ofis ortamında kurumsal masaüstü sunumu",
        captionEN: "Ceylanlar Site Management corporate desktop presentation in a modern office environment",
        layout: "full",
        width: 1600,
        height: 893
      },
      {
        id: "media-5",
        type: "image",
        src: "/projects/ceylanlar-site-yonetimi-website-tasarimi/media/05-service-experience.webp",
        altTR: "Ceylanlar Site Yönetimi arayüzünün hizmet sunumu ve iletişim odaklı UX yapısı.",
        altEN: "Ceylanlar Site Management interface structure showing service presentation and contact-focused UX.",
        captionTR: "Hizmet keşfi ve hızlı iletişim akışını destekleyen arayüz hiyerarşisi",
        captionEN: "Interface hierarchy supporting service discovery and instant contact flow",
        layout: "full",
        width: 1600,
        height: 900
      }
    ],
    desktop: {
      x: 8,
      y: 78
    },
    initialWindow: {
      width: 780,
      height: 640
    },
    featured: false,
    sortOrder: 9
  },

  {
    id: "alchemia-subat-2025-dergi-tasarimi",
    slug: "alchemia-subat-2025-dergi-tasarimi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "graphic-design"
    ],
    titleTR: "Alchemia Şubat 2025 Dergi Tasarımı",
    titleEN: "Alchemia February 2025 Magazine Design",
    desktopLabelTR: "Alchemia Dergi",
    desktopLabelEN: "Alchemia Magazine",
    client: "Alchemia",
    categoryTR: "Grafik & Editoryal Tasarım",
    categoryEN: "Graphic & Editorial Design",
    projectTypeTR: "Grafik Tasarım > Dergi Tasarımı",
    projectTypeEN: "Graphic Design > Magazine Design",
    year: "2025",
    status: "completed",
    summaryTR: "Alchemia’nın Şubat 2025 sayısı için kapak tasarımı ve iç sayfa düzenlerini kapsayan bütünlüklü bir dergi tasarımı hazırlandı. Bilim, kültür ve akademik içerikler; güçlü tipografi, modern editoryal hiyerarşi ve yayın kimliğini destekleyen görsel sistem aracılığıyla daha düzenli, okunabilir ve dikkat çekici bir formatta sunuldu.",
    summaryEN: "A cohesive magazine design was developed for the February 2025 issue of Alchemia, covering both the cover concept and interior editorial layouts. Scientific, cultural, and academic content was organized through strong typography, modern editorial hierarchy, and a visual system designed to strengthen the publication’s identity and readability.",
    descriptionTR: "Alchemia’nın Şubat 2025 sayısı için kapak tasarımı ve iç sayfa düzenlerini kapsayan bütünlüklü bir dergi tasarımı hazırlandı. Bilim, kültür ve akademik içerikler; güçlü tipografi, modern editoryal hiyerarşi ve yayın kimliğini destekleyen görsel sistem aracılığıyla daha düzenli, okunabilir ve dikkat çekici bir formatta sunuldu.",
    descriptionEN: "A cohesive magazine design was developed for the February 2025 issue of Alchemia, covering both the cover concept and interior editorial layouts. Scientific, cultural, and academic content was organized through strong typography, modern editorial hierarchy, and a visual system designed to strengthen the publication’s identity and readability.",
    challengeTR: "Alchemia’nın Şubat 2025 sayısında farklı konu ve içerik türlerinin tek bir yayın kimliği altında düzenli biçimde sunulması gerekiyordu. Bilimsel, kültürel ve akademik içeriklerin yoğunluğunu korurken sayfaların okunabilirliğini artıracak, okuyucunun içerik hiyerarşisini kolayca takip edebileceği ve derginin görsel karakterini güçlendirecek tutarlı bir editoryal sisteme ihtiyaç vardı.",
    challengeEN: "The February 2025 issue of Alchemia needed to bring different types of scientific, cultural, and academic content together within one coherent publication identity. The challenge was to preserve the richness of the content while improving readability, establishing a clear editorial hierarchy, and creating a visual system that strengthened the magazine’s character.",
    solutionTR: "Dergi için kapak kompozisyonu, tipografi sistemi, içerik hiyerarşisi ve iç sayfa düzenleri editoryal bütünlük sağlayacak biçimde kurgulandı. Büyük ve karakteristik başlık kullanımı, güçlü görsel odaklar, kontrollü metin blokları ve modern sayfa düzenleriyle içeriklerin daha akıcı takip edilmesi hedeflendi. Bilim ve kültür eksenindeki yayın dili, çağdaş ve dikkat çekici bir görsel kimlikle desteklendi.",
    solutionEN: "The magazine was structured around a cohesive cover composition, typography system, content hierarchy, and editorial page layouts. Characterful headline typography, strong visual focal points, controlled text blocks, and contemporary layout principles were used to improve content flow while supporting the publication’s scientific and cultural identity with a distinctive visual language.",
    resultTR: "Alchemia Şubat 2025 sayısı için profesyonel, düzenli ve görsel etkisi yüksek bir yayın tasarımı oluşturuldu. Tutarlı editoryal sistem sayesinde içerikler daha güçlü bir hiyerarşiyle sunulurken derginin yayın kimliği daha belirgin, çağdaş ve bütünlüklü bir görünüme kavuştu.",
    resultEN: "The February 2025 issue of Alchemia resulted in a professional and visually distinctive publication system. A consistent editorial structure strengthened the hierarchy of the content while giving the magazine a more recognizable, contemporary, and cohesive visual identity.",
    roleTR: "Editoryal Tasarım & Grafik Tasarım",
    roleEN: "Editorial Design & Graphic Design",
    desktopIcon: "/projects/alchemia-subat-2025-dergi-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/alchemia-subat-2025-dergi-tasarimi/thumbnail.webp",
      width: 72,
      height: 92,
      scale: 1,
      altTR: "Alchemia Şubat 2025 Dergi Tasarımı Masaüstü İkonu",
      altEN: "Alchemia February 2025 Magazine Design Desktop Icon"
    },
    thumbnail: "/projects/alchemia-subat-2025-dergi-tasarimi/thumbnail.webp",
    cover: "/projects/alchemia-subat-2025-dergi-tasarimi/cover.webp",
    initials: "ALC",
    servicesTR: [
      "Grafik Tasarım",
      "Editoryal Tasarım",
      "Dergi Tasarımı",
      "Kapak Tasarımı",
      "Sayfa Düzeni",
      "Tipografi"
    ],
    servicesEN: [
      "Graphic Design",
      "Editorial Design",
      "Magazine Design",
      "Cover Design",
      "Layout Design",
      "Typography"
    ],
    services: [
      "Graphic Design",
      "Editorial Design",
      "Magazine Design",
      "Cover Design",
      "Layout Design",
      "Typography"
    ],
    tools: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/alchemia-subat-2025-dergi-tasarimi/media/01-magazine-cover-mockup.webp",
        altTR: "Mor arka plan üzerinde Alchemia Şubat 2025 dergisinin fiziksel kapak mockup sunumu.",
        altEN: "Physical mockup presentation of the February 2025 Alchemia magazine on a purple background.",
        captionTR: "Alchemia Şubat 2025 sayısının dergi kapak sunumu",
        captionEN: "Magazine cover presentation for the February 2025 issue of Alchemia",
        layout: "full",
        width: 1024,
        height: 682
      },
      {
        id: "media-2",
        type: "image",
        src: "/projects/alchemia-subat-2025-dergi-tasarimi/media/02-cover-detail.webp",
        altTR: "Alchemia masthead, kimya balonu amblemi ve kozmik görsel detay çekimi.",
        altEN: "Close-up detail shot of the Alchemia masthead, flask emblem, and cosmic artwork.",
        captionTR: "Kapak tipografisi, amblem ve kozmik illüstrasyon detayları",
        captionEN: "Cover typography, emblem and cosmic illustration details",
        layout: "full",
        width: 1200,
        height: 930
      },
      {
        id: "media-3",
        type: "image",
        src: "/projects/alchemia-subat-2025-dergi-tasarimi/media/03-editorial-presentation.webp",
        altTR: "Sade ve modern stüdyo masasında Alchemia dergisi editoryal sunumu.",
        altEN: "Editorial presentation of the Alchemia magazine on a sleek modern studio desk.",
        captionTR: "Minimal stüdyo ortamında dergi editoryal sunumu",
        captionEN: "Magazine editorial presentation in a minimal studio setting",
        layout: "full",
        width: 1600,
        height: 900
      },
      {
        id: "media-4",
        type: "image",
        src: "/projects/alchemia-subat-2025-dergi-tasarimi/media/04-publication-system.webp",
        altTR: "Kapak kompozisyonu, tipografi sistemi, ızgara düzeni ve yayın bütünlüğü adımlarını gösteren vaka çalışması şeması.",
        altEN: "Case study diagram illustrating cover composition, typography system, grid layout, and publication identity.",
        captionTR: "Alchemia Şubat 2025 editoryal tasarım sistemi ve içerik hiyerarşisi şeması",
        captionEN: "Alchemia February 2025 editorial design system and content hierarchy diagram",
        layout: "full",
        width: 1600,
        height: 1000
      }
    ],
    desktop: {
      x: 8,
      y: 12
    },
    initialWindow: {
      width: 760,
      height: 640
    },
    featured: false,
    sortOrder: 10
  },

  {
    id: "kmz-2025",
    slug: "kmz-2025",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "graphic-design",
      "brand-identity"
    ],
    titleTR: "KMZ 2025",
    titleEN: "KMZ 2025",
    desktopLabelTR: "KMZ 2025",
    desktopLabelEN: "KMZ 2025",
    client: "KMZ 2025",
    categoryTR: "Grafik Tasarım > Etkinlik Tasarımı & Görsel Kimlik",
    categoryEN: "Graphic Design > Event Design & Visual Identity",
    projectTypeTR: "Etkinlik Görsel Tasarımı & Grafik Tasarım",
    projectTypeEN: "Event Visual Design & Graphic Design",
    year: "2025",
    status: "completed",
    featured: true,
    featuredOrder: 1,
    desktop: {
      x: 32,
      y: 28
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 11,
    roleTR: "Etkinlik Görsel Tasarımı & Grafik Tasarım",
    roleEN: "Event Visual Design & Graphic Design",
    desktopIcon: "/projects/kmz-2025/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/kmz-2025/thumbnail.webp",
      width: 70,
      height: 92,
      scale: 1,
      altTR: "KMZ 2025 Masaüstü İkonu",
      altEN: "KMZ 2025 Desktop Icon"
    },
    thumbnail: "/projects/kmz-2025/thumbnail.webp",
    cover: "/projects/kmz-2025/cover.webp",
    initials: "KMZ",
    servicesTR: [
      "Grafik Tasarım",
      "Etkinlik Tasarımı",
      "Görsel Kimlik",
      "Afiş Tasarımı",
      "Baskı Tasarımı",
      "Etkinlik Materyalleri"
    ],
    servicesEN: [
      "Graphic Design",
      "Event Design",
      "Visual Identity",
      "Poster Design",
      "Print Design",
      "Event Collateral"
    ],
    services: [
      "Graphic Design",
      "Event Design",
      "Visual Identity",
      "Poster Design",
      "Print Design",
      "Event Collateral"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/kmz-2025/media/01-kmz-2025-primary-poster.webp",
        altTR: "KMZ 2025 Kimya Mühendisliği Zirvesi ana afiş tasarımı, dış mekan ışıklı reklam panosu sunumu.",
        altEN: "KMZ 2025 Chemical Engineering Summit primary poster design in an outdoor lightbox showcase.",
        captionTR: "KMZ 2025 etkinlik görsel kimliğinin ana afiş uygulaması",
        captionEN: "Primary poster application of the KMZ 2025 event visual identity",
        layout: "portrait",
        width: 779,
        height: 1024
      }
    ],
    summaryTR: "KMZ 2025 Kimya Mühendisliği Zirvesi için etkinliğin farklı iletişim ve fiziksel uygulamalarında kullanılmak üzere bütünlüklü bir görsel tasarım sistemi hazırlandı. Zirvenin bilimsel, teknik ve akademik karakteri; güçlü tipografi, koyu görsel atmosfer, mavi enerji vurguları ve modern kompozisyon diliyle farklı etkinlik materyallerine taşındı.",
    summaryEN: "A cohesive visual design system was developed for the KMZ 2025 Chemical Engineering Summit across multiple event communication and physical touchpoints. The summit’s scientific, technical, and academic character was translated into a consistent visual language through strong typography, a dark visual atmosphere, blue energy accents, and contemporary compositions.",
    challengeTR: "KMZ 2025 için yalnızca dikkat çekici tek bir afiş değil, etkinliğin farklı materyallerinde sürdürülebilecek güçlü ve tutarlı bir görsel kimliğe ihtiyaç vardı. Kimya mühendisliği odağının bilimsel ve teknik karakterini korurken genç katılımcılara hitap eden dinamik bir görsel dil oluşturmak ve farklı baskılı etkinlik materyallerinde aynı kimliği devam ettirmek projenin temel tasarım ihtiyacını oluşturdu.",
    challengeEN: "KMZ 2025 required more than a single attention-grabbing poster; the event needed a strong and consistent visual identity that could extend across multiple event materials. The challenge was to preserve the scientific and technical character of chemical engineering while creating a dynamic visual language suitable for a young audience and adaptable across different printed and physical touchpoints.",
    solutionTR: "Etkinliğin kimya mühendisliği temasını merkeze alan koyu ve teknik bir görsel sistem kurgulandı. Büyük ve net KMZ’25 tipografisi, metalik endüstriyel formlar, elektrik-mavi enerji efektleri ve yüksek kontrastlı bilgi alanlarıyla güçlü bir ana tasarım dili oluşturuldu. Etkinlik bilgileri okunabilir bir hiyerarşi içinde düzenlenirken aynı görsel sistemin görevli kartları, bandrol ve diğer etkinlik materyallerine uyarlanabilecek esnek bir yapıda ilerlemesi hedeflendi.",
    solutionEN: "A dark, technical visual system centered on the chemical-engineering theme was developed for the event. Large KMZ’25 typography, metallic industrial forms, electric-blue energy effects, and high-contrast information areas established the core identity. Event information was organized through a clear hierarchy while the overall system was designed to remain adaptable across staff cards, physical collateral, and other event materials.",
    resultTR: "KMZ 2025 için etkinliğin bilimsel ve teknik karakterini güçlü biçimde yansıtan, farklı uygulamalara taşınabilir bütünlüklü bir görsel kimlik oluşturuldu. Ana afişten etkinlik içi materyallere uzanan tasarım dili sayesinde zirvenin iletişimi daha tutarlı, dikkat çekici ve profesyonel bir görünüme kavuştu.",
    resultEN: "KMZ 2025 received a cohesive visual identity capable of communicating the summit’s scientific and technical character across multiple applications. Extending the same design language from the primary poster to event collateral created a more consistent, distinctive, and professional visual presence for the summit.",
    seo: {
      titleTR: "KMZ 2025 — Etkinlik Görsel Kimliği & Tasarım Sistemi | Kerem Mıhçı",
      titleEN: "KMZ 2025 — Event Visual Identity & Design System | Kerem Mıhçı",
      descriptionTR: "KMZ 2025 Kimya Mühendisliği Zirvesi etkinlik görsel kimliği, afiş ve etkinlik tasarım sistemi vaka çalışması.",
      descriptionEN: "Case study of the KMZ 2025 Chemical Engineering Summit event visual identity, poster, and event design system.",
      ogImage: "/projects/kmz-2025/cover.webp"
    }
  },

  {
    id: "fling-arena",
    slug: "fling-arena",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "brand-identity",
      "graphic-design"
    ],
    titleTR: "Fling Arena",
    titleEN: "Fling Arena",
    desktopLabelTR: "FLING ARENA",
    desktopLabelEN: "FLING ARENA",
    client: "KIXOGAMES",
    categoryTR: "Marka Kimliği > Oyun Görsel Tasarımı & Asset Tasarımı",
    categoryEN: "Brand Identity > Game Visual Design & Asset Design",
    projectTypeTR: "Oyun Görsel Kimliği & Grafik Tasarım",
    projectTypeEN: "Game Visual Identity & Graphic Design",
    year: "2026",
    status: "completed",
    featured: true,
    featuredOrder: 2,
    desktop: {
      x: 64,
      y: 36
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 12,
    roleTR: "Oyun Görsel Kimliği & Grafik Tasarım",
    roleEN: "Game Visual Identity & Graphic Design",
    desktopIcon: "/projects/fling-arena/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/fling-arena/thumbnail.webp",
      width: 123,
      height: 92,
      scale: 1,
      altTR: "Fling Arena Masaüstü İkonu",
      altEN: "Fling Arena Desktop Icon"
    },
    thumbnail: "/projects/fling-arena/thumbnail.webp",
    cover: "/projects/fling-arena/cover.webp",
    initials: "FA",
    servicesTR: [
      "Marka Kimliği",
      "Logo Tasarımı",
      "Grafik Tasarım",
      "Oyun Görsel Tasarımı",
      "Oyun İçi Grafik Tasarımı",
      "Asset Tasarımı",
      "Dijital Tasarım"
    ],
    servicesEN: [
      "Brand Identity",
      "Logo Design",
      "Graphic Design",
      "Game Visual Design",
      "In-Game Graphic Design",
      "Game Asset Design",
      "Digital Design"
    ],
    services: [
      "Brand Identity",
      "Logo Design",
      "Graphic Design",
      "Game Visual Design",
      "In-Game Graphic Design",
      "Game Asset Design",
      "Digital Design"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/fling-arena/media/01-fling-arena-identity.webp",
        altTR: "Fling Arena oyun projesi için arena temalı marka kimliği ve logo sunumu.",
        altEN: "Arena-themed brand identity and logo presentation for the Fling Arena game project.",
        captionTR: "Fling Arena oyun projesi için arena temalı marka kimliği ve logo sunumu",
        captionEN: "Arena-themed brand identity and logo presentation for the Fling Arena game project",
        layout: "full",
        width: 1024,
        height: 768
      }
    ],
    summaryTR: "Fling Arena için oyunun rekabetçi, dinamik ve eğlenceli karakterini farklı dijital temas noktalarında sürdürebilecek bütünlüklü bir görsel kimlik sistemi hazırlandı. Çalışma; logo ve marka kimliğinin yanı sıra oyun içi grafikler, görsel assetler ve oyunun genel tasarım dilini destekleyen dijital uygulamaları kapsayarak markanın hem oyun içerisinde hem de tanıtım iletişiminde tutarlı ve güçlü bir görünüme kavuşmasını hedefledi.",
    summaryEN: "A cohesive visual identity system was developed for Fling Arena to carry the game's competitive, dynamic, and playful character across multiple digital touchpoints. The project extended beyond the logo and brand identity to include in-game graphics, visual assets, and supporting digital applications, creating a consistent and distinctive visual language for both the game experience and its broader communication.",
    challengeTR: "Fling Arena için yalnızca akılda kalıcı bir logo değil, oyun içindeki farklı görsel uygulamalarda sürdürülebilecek güçlü ve tanınabilir bir tasarım sistemine ihtiyaç vardı. Kimliğin rekabetçi arena atmosferini yansıtması, küçük dijital kullanımlardan daha büyük tanıtım görsellerine kadar ölçeklenebilmesi ve oyun içi assetlerle aynı görsel dili koruyabilmesi projenin temel tasarım gereksinimlerini oluşturdu.",
    challengeEN: "Fling Arena required more than a recognizable logo; it needed a strong and distinctive visual system capable of extending across different in-game applications. The identity had to reflect the competitive arena atmosphere, scale effectively from small digital uses to larger promotional visuals, and maintain visual consistency across the game's supporting assets.",
    solutionTR: "Oyunun arena ve rekabet temasını temel alan güçlü bir görsel dil geliştirildi. Kalın tipografi, rozet ve amblem yaklaşımı, altın tonlu konturlar, koyu yüzeyler ve sıcak vurgu renkleri marka kimliğinin temelini oluştururken bu sistem oyun içi grafik ve assetlere uyarlanabilecek şekilde genişletildi. Logo, oyun içi görseller ve destekleyici grafik öğeler aynı tasarım karakteri altında bir araya getirilerek Fling Arena için bütünlüklü bir görsel ekosistem oluşturuldu.",
    solutionEN: "A strong visual language was developed around the game's arena and competitive themes. Bold typography, badge-inspired forms, gold-toned outlines, dark surfaces, and warm accent colors formed the foundation of the identity, while the system was extended into in-game graphics and visual assets. The logo, game visuals, and supporting design elements were unified under a consistent visual character to create a cohesive Fling Arena ecosystem.",
    resultTR: "Fling Arena için oyun içinde ve marka iletişiminde birlikte çalışabilen güçlü, enerjik ve ölçeklenebilir bir görsel kimlik oluşturuldu. Logo sisteminden oyun içi assetlere uzanan ortak tasarım dili sayesinde marka daha tanınabilir, tutarlı ve profesyonel bir görsel yapıya kavuştu.",
    resultEN: "Fling Arena received a strong, energetic, and scalable visual identity capable of functioning consistently across both the game experience and broader brand communication. Extending a shared design language from the logo system into in-game assets created a more recognizable, cohesive, and professional visual presence.",
    seo: {
      titleTR: "Fling Arena — Kerem Mıhçı",
      titleEN: "Fling Arena — Kerem Mıhçı",
      descriptionTR: "KIXOGAMES için Fling Arena oyun görsel kimliği, logo sistemi ve asset tasarımı vaka çalışması.",
      descriptionEN: "Case study of the Fling Arena game visual identity, logo system, and asset design for KIXOGAMES.",
      ogImage: "/projects/fling-arena/cover.webp"
    }
  },

  {
    id: "kagestudio-marka-kimligi",
    slug: "kagestudio-marka-kimligi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "brand-identity",
      "graphic-design",
      "ecommerce"
    ],
    titleTR: "KAGESTUDIO Marka Kimliği",
    titleEN: "KAGESTUDIO Brand Identity",
    desktopLabelTR: "KAGESTUDIO",
    desktopLabelEN: "KAGESTUDIO",
    client: "KAGESTUDIO",
    categoryTR: "Marka Kimliği > Dijital & E-Ticaret Tasarımı",
    categoryEN: "Brand Identity > Digital & E-commerce Design",
    projectTypeTR: "Marka Kimliği & Dijital Tasarım",
    projectTypeEN: "Brand Identity & Digital Design",
    year: "2025",
    status: "completed",
    featured: true,
    featuredOrder: 3,
    desktop: {
      x: 48,
      y: 52
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 13,
    roleTR: "Marka Kimliği & Dijital Tasarım",
    roleEN: "Brand Identity & Digital Design",
    desktopIcon: "/projects/kagestudio-marka-kimligi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/kagestudio-marka-kimligi/thumbnail.webp",
      width: 130,
      height: 73,
      scale: 1,
      altTR: "KAGESTUDIO Marka Kimliği Masaüstü İkonu",
      altEN: "KAGESTUDIO Brand Identity Desktop Icon"
    },
    thumbnail: "/projects/kagestudio-marka-kimligi/thumbnail.webp",
    cover: "/projects/kagestudio-marka-kimligi/cover.webp",
    initials: "KS",
    servicesTR: [
      "Marka Kimliği",
      "Logo Tasarımı",
      "Marka Kiti",
      "Grafik Tasarım",
      "E-Ticaret Ürün Tasarımı",
      "Dijital Tasarım",
      "Görsel Sistem Tasarımı"
    ],
    servicesEN: [
      "Brand Identity",
      "Logo Design",
      "Brand Kit",
      "Graphic Design",
      "E-commerce Product Design",
      "Digital Design",
      "Visual System Design"
    ],
    services: [
      "Brand Identity",
      "Logo Design",
      "Brand Kit",
      "Graphic Design",
      "E-commerce Product Design",
      "Digital Design",
      "Visual System Design"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/kagestudio-marka-kimligi/media/01-kagestudio-brand-identity.webp",
        altTR: "KAGESTUDIO dövüş sporları markası için logo ve marka kimliği sunumu.",
        altEN: "Logo and brand identity presentation for the KAGESTUDIO combat-sports brand.",
        captionTR: "KAGESTUDIO dövüş sporları markası için logo ve marka kimliği sunumu",
        captionEN: "Logo and brand identity presentation for the KAGESTUDIO combat-sports brand",
        layout: "full",
        width: 1024,
        height: 576
      }
    ],
    summaryTR: "KAGESTUDIO için dövüş sporları, disiplin ve güçlü rekabet kültürünü yansıtan bütünlüklü bir marka kimliği sistemi geliştirildi. Çalışma; logo tasarımı ve marka kitinin yanı sıra e-ticaret ürün görselleri ve markanın farklı dijital uygulamalarda kullanacağı görsel tasarım dilini kapsayacak şekilde kurgulandı. Güçlü sembol yapısı, koyu görsel atmosfer ve kontrollü altın tonlarıyla markanın profesyonel ve ayırt edici karakteri desteklendi.",
    summaryEN: "A cohesive brand identity system was developed for KAGESTUDIO to reflect the strength, discipline, and competitive culture associated with combat sports. The work extended beyond the logo to include the brand kit, e-commerce product visuals, and a broader visual language for digital brand applications. A strong symbol system, dark visual atmosphere, and controlled gold accents helped establish a distinctive and professional brand character.",
    challengeTR: "KAGESTUDIO’nun dövüş sporları ve koleksiyon kültürüyle ilişkili güçlü marka karakterini farklı temas noktalarında tutarlı biçimde sürdürebilecek bir görsel kimliğe ihtiyacı vardı. Kimliğin yalnızca logoda değil, marka kitinde, e-ticaret ürün sunumlarında ve dijital iletişim materyallerinde de tanınabilir kalması; sert ve disiplinli marka karakterini profesyonel bir tasarım sistemi içinde aktarması gerekiyordu.",
    challengeEN: "KAGESTUDIO required a visual identity capable of consistently carrying its strong combat-sports and collector-culture character across multiple brand touchpoints. The identity needed to remain recognizable not only through the logo, but also throughout the brand kit, e-commerce product presentations, and digital communication materials while maintaining a disciplined and professional visual language.",
    solutionTR: "Marka için sekizgen dövüş alanı formu, sporcu silüeti ve teknik çizim hissi taşıyan geometrik detaylardan oluşan güçlü bir sembol sistemi geliştirildi. Siyah ve koyu yüzeyler kontrollü altın vurgularla desteklenerek premium ve sert bir görsel karakter oluşturuldu. Bu temel kimlik, yalnızca logo kullanımıyla sınırlı bırakılmayarak marka kiti, e-ticaret ürün görselleri ve farklı dijital uygulamalarda sürdürülebilecek esnek bir tasarım sistemine dönüştürüldü.",
    solutionEN: "A strong symbol system was developed using an octagonal combat-arena form, fighter silhouette, and geometric details inspired by technical construction drawings. Dark surfaces were combined with controlled gold accents to establish a premium and disciplined character. Rather than limiting the identity to logo usage, the visual language was designed as a flexible system capable of extending across the brand kit, e-commerce product visuals, and other digital applications.",
    resultTR: "KAGESTUDIO için logodan e-ticaret ürün sunumlarına kadar farklı marka uygulamalarında birlikte çalışabilen güçlü ve tutarlı bir görsel kimlik oluşturuldu. Geliştirilen marka sistemi, KAGESTUDIO’nun dövüş sporları odaklı karakterini daha profesyonel, tanınabilir ve bütünlüklü bir görsel yapıya taşıdı.",
    resultEN: "KAGESTUDIO received a strong and consistent visual identity capable of functioning across multiple brand applications, from the logo system to e-commerce product presentation. The resulting system established a more professional, recognizable, and cohesive visual presence around the brand’s combat-sports character.",
    seo: {
      titleTR: "KAGESTUDIO Marka Kimliği — Kerem Mıhçı",
      titleEN: "KAGESTUDIO Brand Identity — Kerem Mıhçı",
      descriptionTR: "KAGESTUDIO dövüş sporları markası için marka kimliği, logo sistemi ve e-ticaret ürün görsel tasarımı vaka çalışması.",
      descriptionEN: "Case study of the brand identity, logo system, and e-commerce product visual design for KAGESTUDIO.",
      ogImage: "/projects/kagestudio-marka-kimligi/cover.webp"
    }
  },

  {
    id: "eigestore-marka-kimligi",
    slug: "eigestore-marka-kimligi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "brand-identity",
      "graphic-design",
      "ecommerce"
    ],
    titleTR: "EigeStore Marka Kimliği",
    titleEN: "EigeStore Brand Identity",
    desktopLabelTR: "EigeStore",
    desktopLabelEN: "EigeStore",
    client: "EigeStore",
    categoryTR: "Marka Kimliği > Kurumsal & E-Ticaret Tasarımı",
    categoryEN: "Brand Identity > Corporate & E-commerce Design",
    projectTypeTR: "Marka Kimliği & Grafik Tasarım",
    projectTypeEN: "Brand Identity & Graphic Design",
    year: "2024",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 14,
    roleTR: "Marka Kimliği & Grafik Tasarım",
    roleEN: "Brand Identity & Graphic Design",
    desktopIcon: "/projects/eigestore-marka-kimligi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/eigestore-marka-kimligi/thumbnail.webp",
      width: 130,
      height: 87,
      scale: 1,
      altTR: "EigeStore Marka Kimliği Kartvizit Sunumu",
      altEN: "EigeStore Brand Identity Business Card Presentation"
    },
    thumbnail: "/projects/eigestore-marka-kimligi/thumbnail.webp",
    cover: "/projects/eigestore-marka-kimligi/cover.webp",
    initials: "ES",
    servicesTR: [
      "Marka Kimliği",
      "Logo Kullanımı",
      "Kartvizit Tasarımı",
      "Grafik Tasarım",
      "Website Mockup",
      "Ürün Görsel Tasarımı",
      "E-Ticaret Tasarımı",
      "Dijital Tasarım"
    ],
    servicesEN: [
      "Brand Identity",
      "Logo Application",
      "Business Card Design",
      "Graphic Design",
      "Website Mockup",
      "Product Visual Design",
      "E-commerce Design",
      "Digital Design"
    ],
    services: [
      "Brand Identity",
      "Logo Application",
      "Business Card Design",
      "Graphic Design",
      "Website Mockup",
      "Product Visual Design",
      "E-commerce Design",
      "Digital Design"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/eigestore-marka-kimligi/media/01-eigestore-logo.webp",
        altTR: "EigeStore marka kimliği için geometrik logo tasarımı.",
        altEN: "Geometric logo design for the EigeStore brand identity.",
        captionTR: "EigeStore marka kimliği geometrik logo sembolü",
        captionEN: "EigeStore brand identity geometric logo symbol",
        layout: "contained",
        width: 1024,
        height: 1024
      },
      {
        id: "media-2",
        type: "image",
        src: "/projects/eigestore-marka-kimligi/media/02-eigestore-business-card.webp",
        altTR: "EigeStore marka kimliği için ön ve arka yüz kartvizit tasarımı sunumu.",
        altEN: "Front and back business-card design presentation for the EigeStore brand identity.",
        captionTR: "EigeStore kurumsal kartvizit tasarımı ve marka kimliği uygulaması",
        captionEN: "EigeStore corporate business card design and brand identity application",
        layout: "full",
        width: 1024,
        height: 682
      }
    ],
    summaryTR: "EigeStore için markanın modern, enerjik ve e-ticaret odaklı karakterini farklı temas noktalarında sürdürebilecek bütünlüklü bir görsel kimlik sistemi geliştirildi. Çalışma; logo ve marka kullanımının yanı sıra kartvizit tasarımı, website sunum mockupları, ürün odaklı grafikler ve markanın dijital iletişiminde kullanılabilecek farklı görsel uygulamaları kapsayacak şekilde kurgulandı.",
    summaryEN: "A cohesive visual identity system was developed for EigeStore to carry the brand’s modern, energetic, and e-commerce-focused character across multiple touchpoints. The work extended beyond the logo to include business-card design, website presentation mockups, product-focused graphics, and supporting visual applications for the brand’s digital communication.",
    descriptionTR: "EigeStore için markanın modern, enerjik ve e-ticaret odaklı karakterini farklı temas noktalarında sürdürebilecek bütünlüklü bir görsel kimlik sistemi geliştirildi. Çalışma; logo ve marka kullanımının yanı sıra kartvizit tasarımı, website sunum mockupları, ürün odaklı grafikler ve markanın dijital iletişiminde kullanılabilecek farklı görsel uygulamaları kapsayacak şekilde kurgulandı.",
    descriptionEN: "A cohesive visual identity system was developed for EigeStore to carry the brand’s modern, energetic, and e-commerce-focused character across multiple touchpoints. The work extended beyond the logo to include business-card design, website presentation mockups, product-focused graphics, and supporting visual applications for the brand’s digital communication.",
    challengeTR: "EigeStore’un farklı basılı ve dijital uygulamalarda tanınabilirliğini koruyacak tutarlı bir görsel sisteme ihtiyacı vardı. Marka kimliğinin kartvizit gibi kurumsal materyallerde, website sunumlarında ve ürün odaklı grafik tasarım çalışmalarında aynı karakteri sürdürebilmesi; aynı zamanda genç, modern ve ticari yapısını kaybetmeden profesyonel görünmesi projenin temel tasarım ihtiyacını oluşturdu.",
    challengeEN: "EigeStore needed a consistent visual system capable of maintaining brand recognition across both printed and digital applications. The identity had to work coherently across business cards, website presentations, and product-focused graphic-design materials while preserving the brand’s youthful, modern, and commercially focused character.",
    solutionTR: "Markanın geometrik logo yapısı ve sıcak renk paleti temel alınarak farklı uygulamalara uyarlanabilen esnek bir görsel sistem oluşturuldu. Kartvizit tasarımında sade bilgi hiyerarşisi, koyu zeminler ve sıcak vurgu renkleriyle kurumsal bir yapı kurulurken; website mockupları ve ürün odaklı grafik çalışmalarında da aynı marka karakterinin sürdürülebileceği ortak bir tasarım dili geliştirildi.",
    solutionEN: "A flexible visual system was built around the brand’s geometric logo structure and warm color palette. The business-card design combines clear information hierarchy, dark surfaces, and warm accent colors to create a professional identity, while the same visual language was structured to extend into website presentation mockups and product-focused graphic applications.",
    resultTR: "EigeStore için kartvizitten dijital ürün sunumlarına kadar farklı uygulamalarda birlikte çalışabilen daha tutarlı ve profesyonel bir marka kimliği oluşturuldu. Geliştirilen görsel sistem, markanın e-ticaret ve dijital iletişim alanlarında daha tanınabilir, modern ve bütünlüklü bir görünüme kavuşmasını destekledi.",
    resultEN: "EigeStore received a more cohesive and professional brand identity capable of working across multiple applications, from business cards to digital product presentations. The resulting visual system helped establish a more recognizable, modern, and consistent presence across the brand’s e-commerce and digital communication touchpoints.",
    seo: {
      titleTR: "EigeStore Marka Kimliği — Kerem Mıhçı",
      titleEN: "EigeStore Brand Identity — Kerem Mıhçı",
      descriptionTR: "EigeStore için marka kimliği, logo sistemi, kartvizit ve dijital marka tasarımı vaka çalışması.",
      descriptionEN: "Case study of the brand identity, logo system, business card, and digital brand design for EigeStore.",
      ogImage: "/projects/eigestore-marka-kimligi/cover.webp"
    }
  },

  {
    id: "hizir-yangin-marka-kimligi",
    slug: "hizir-yangin-marka-kimligi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "brand-identity",
      "graphic-design"
    ],
    titleTR: "Hızır Yangın Marka Kimliği",
    titleEN: "Hızır Yangın Brand Identity",
    desktopLabelTR: "Hızır Yangın",
    desktopLabelEN: "Hızır Yangın",
    client: "Hızır Yangın",
    categoryTR: "Marka Kimliği > Kurumsal Tasarım",
    categoryEN: "Brand Identity > Corporate Design",
    projectTypeTR: "Marka Kimliği & Grafik Tasarım",
    projectTypeEN: "Brand Identity & Graphic Design",
    year: "2024",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 15,
    roleTR: "Marka Kimliği & Grafik Tasarım",
    roleEN: "Brand Identity & Graphic Design",
    desktopIcon: "/projects/hizir-yangin-marka-kimligi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/hizir-yangin-marka-kimligi/thumbnail.webp",
      width: 130,
      height: 91,
      scale: 1,
      altTR: "Hızır Yangın Marka Kimliği Cam Tabela Sunumu",
      altEN: "Hızır Yangın Brand Identity Glass Signage Presentation"
    },
    thumbnail: "/projects/hizir-yangin-marka-kimligi/thumbnail.webp",
    cover: "/projects/hizir-yangin-marka-kimligi/cover.webp",
    initials: "HY",
    servicesTR: [
      "Marka Kimliği",
      "Logo Tasarımı",
      "Kartvizit Tasarımı",
      "Kurumsal Kimlik",
      "Tabela & Yönlendirme Tasarımı",
      "Grafik Tasarım"
    ],
    servicesEN: [
      "Brand Identity",
      "Logo Design",
      "Business Card Design",
      "Corporate Identity",
      "Signage Design",
      "Graphic Design"
    ],
    services: [
      "Brand Identity",
      "Logo Design",
      "Business Card Design",
      "Corporate Identity",
      "Signage Design",
      "Graphic Design"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/hizir-yangin-marka-kimligi/media/01-hizir-yangin-tabela-mockup.webp",
        altTR: "Hızır Yangın Söndürme ve Güvenlik Sistemleri için şeffaf cam ofis tabelası ve logo sunumu.",
        altEN: "Transparent glass office signage and logo presentation for Hızır Yangın Fire Suppression and Safety Systems.",
        captionTR: "Hızır Yangın kurumsal cam tabela ve logo uygulaması",
        captionEN: "Hızır Yangın corporate glass signage and logo application",
        layout: "full",
        width: 1024,
        height: 716
      },
      {
        id: "media-2",
        type: "image",
        src: "/projects/hizir-yangin-marka-kimligi/media/02-hizir-yangin-kartvizit-mockup.webp",
        altTR: "Hızır Yangın için ön/arka yüz 2D yerleşim ve 3D perspektif kurumsal kartvizit tasarımı sunumu.",
        altEN: "Front/back 2D layout and 3D perspective corporate business-card design presentation for Hızır Yangın.",
        captionTR: "Hızır Yangın kurumsal kartvizit tasarımı ve 3D sunumu",
        captionEN: "Hızır Yangın corporate business card design and 3D mockup",
        layout: "contained",
        width: 800,
        height: 800
      }
    ],
    summaryTR: "Hızır Yangın Söndürme ve Güvenlik Sistemleri için sektörün gerektirdiği güven, hız ve koruma reflekslerini yansıtan güçlü bir kurumsal marka kimliği geliştirildi. Çalışma; yangın söndürme tüpü formu ve alev dinamizmiyle harmanlanan özel tipografik logo tasarımından cam ofis tabelası ve kurumsal kartvizit uygulamalarına kadar uzanan bütünlüklü bir görsel dil üzerine kurgulandı.",
    summaryEN: "A strong corporate brand identity was developed for Hızır Yangın Fire Suppression and Safety Systems, reflecting the industry's essential values of safety, rapid response, and protection. The design integrates a custom typographic logo featuring fire extinguisher iconography and flame elements, extending across glass office signage and corporate business-card applications.",
    descriptionTR: "Hızır Yangın Söndürme ve Güvenlik Sistemleri için sektörün gerektirdiği güven, hız ve koruma reflekslerini yansıtan güçlü bir kurumsal marka kimliği geliştirildi. Çalışma; yangın söndürme tüpü formu ve alev dinamizmiyle harmanlanan özel tipografik logo tasarımından cam ofis tabelası ve kurumsal kartvizit uygulamalarına kadar uzanan bütünlüklü bir görsel dil üzerine kurgulandı.",
    descriptionEN: "A strong corporate brand identity was developed for Hızır Yangın Fire Suppression and Safety Systems, reflecting the industry's essential values of safety, rapid response, and protection. The design integrates a custom typographic logo featuring fire extinguisher iconography and flame elements, extending across glass office signage and corporate business-card applications.",
    challengeTR: "Yangın güvenliği ve söndürme sistemleri sektöründe faaliyet gösteren markanın; hem kurumsal ciddiyeti hem de acil durumlara anında müdahale gücünü hissettiren akılda kalıcı bir kimliğe ihtiyacı vardı. Logodan kartvizite, tabela yönlendirmelerinden basılı materyallere kadar tüm temas noktalarında sektör dinamiklerini doğru aktarabilen ve güven veren profesyonel bir görsel yapı kurulması hedeflendi.",
    challengeEN: "Operating within the fire safety and suppression sector, Hızır Yangın needed a memorable visual identity conveying both corporate reliability and swift emergency readiness. The primary goal was to establish a trustworthy and professional visual system capable of carrying fire safety semantics across business cards, office signage, and corporate collateral.",
    solutionTR: "Marka isminin merkezindeki 'Z' harfinde yangın söndürme tüpü formu stilize edilerek harf içlerine entegre alev detaylarıyla dikkat çekici bir logo sembolizmi oluşturuldu. Koyu antrasit ve alev kırmızısı/turuncusu tonları dengelenerek kurumsal ciddiyet ile dinamizm bir araya getirildi. Tasarım; şeffaf cam tabela sunumu ve kurumsal kartvizit yerleşimleriyle tamamlanarak markanın fiziksel ve kurumsal alanlarda güçlü bir duruş sergilemesi sağlandı.",
    solutionEN: "A stylized fire-extinguisher form was integrated into the central letter structure alongside controlled flame accents, creating a distinctive typographic logo. Deep anthracite and flame red/orange tones were balanced to combine corporate authority with dynamism. The identity was then extended into transparent glass signage mockups and dual-sided corporate business cards, establishing a robust presence across physical and corporate applications.",
    resultTR: "Hızır Yangın için sektöründe anında fark edilen, güven veren ve kurumsal iletişimi güçlendiren modern bir marka kimliği ortaya çıkarıldı. Logo, tabela ve kartvizit bileşenlerinin tutarlı birlikteliği, markanın profesyonel hizmet algısını ve müşteri güvenini pekiştirdi.",
    resultEN: "Hızır Yangın received a recognizable, trust-inspiring, and modern brand identity strengthening its market communication. The cohesive harmony between logo, architectural signage, and corporate business cards reinforced the company's professional service perception and client trust.",
    seo: {
      titleTR: "Hızır Yangın Marka Kimliği — Kerem Mıhçı",
      titleEN: "Hızır Yangın Brand Identity — Kerem Mıhçı",
      descriptionTR: "Hızır Yangın Söndürme ve Güvenlik Sistemleri için marka kimliği, logo tasarımı, tabela ve kartvizit vaka çalışması.",
      descriptionEN: "Case study of the brand identity, logo design, signage, and business card design for Hızır Yangın.",
      ogImage: "/projects/hizir-yangin-marka-kimligi/cover.webp"
    }
  },

  {
    id: "emix-qr-menu",
    slug: "emix-qr-menu",
    workspace: "web",
    workspaceId: "web",
    categoryIds: [
      "website",
      "brand-identity",
      "ecommerce"
    ],
    titleTR: "eMix QR Menü Website & Yönetim Sistemi",
    titleEN: "eMix QR Menu Website & Management System",
    desktopLabelTR: "eMix QR Menü",
    desktopLabelEN: "eMix QR Menu",
    client: "eMix QR Menü",
    categoryTR: "Web Uygulama & Dijital Ürün",
    categoryEN: "Web Application & Digital Product",
    projectTypeTR: "Web Uygulama & Dijital Ürün",
    projectTypeEN: "Web Application & Digital Product",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 16,
    roleTR: "Web Tasarım, Web Development & Dijital Ürün Tasarımı",
    roleEN: "Web Design, Web Development & Digital Product Design",
    desktopIcon: "/projects/emix-qr-menu/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/emix-qr-menu/thumbnail.webp",
      width: 130,
      height: 81,
      scale: 1,
      altTR: "eMix QR Menü dijital menü sistemi ürün websitesi ana sayfa arayüzü.",
      altEN: "Homepage interface of the eMix QR Menü digital menu system website."
    },
    thumbnail: "/projects/emix-qr-menu/thumbnail.webp",
    cover: "/projects/emix-qr-menu/cover.webp",
    initials: "EQ",
    servicesTR: [
      "Web Tasarım",
      "Web Development",
      "UI/UX Design",
      "QR Menü Sistemi",
      "Yönetim Paneli",
      "Dashboard Design",
      "Responsive Design",
      "Dijital Ürün Tasarımı",
      "Sistem Arayüzü"
    ],
    servicesEN: [
      "Web Design",
      "Web Development",
      "UI/UX Design",
      "QR Menu System",
      "Management Panel",
      "Dashboard Design",
      "Responsive Design",
      "Digital Product Design",
      "System Interface Design"
    ],
    services: [
      "Web Design",
      "Web Development",
      "UI/UX Design",
      "QR Menu System",
      "Management Panel",
      "Dashboard Design",
      "Responsive Design",
      "Digital Product Design",
      "System Interface Design"
    ],
    tools: [],
    externalLinks: [
      {
        id: "live-site",
        type: "live",
        labelTR: "Siteyi Canlı Gör",
        labelEN: "View Live Site",
        href: "https://emixqrmenu.com"
      }
    ],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/emix-qr-menu/media/01-emix-qr-menu-website.webp",
        altTR: "eMix QR Menü dijital menü sistemi ürün websitesi ana sayfa arayüzü.",
        altEN: "Homepage interface of the eMix QR Menü digital menu system website.",
        captionTR: "eMix QR Menü ürün websitesi ana sayfa arayüzü",
        captionEN: "eMix QR Menü product website homepage interface",
        layout: "full",
        width: 1024,
        height: 639
      },
      {
        id: "media-2",
        type: "image",
        src: "/projects/emix-qr-menu/media/02-emix-qr-menu-admin-dashboard.webp",
        altTR: "eMix QR Menü sistem yönetimi admin dashboard arayüzü.",
        altEN: "Administration dashboard interface of the eMix QR Menü management system.",
        captionTR: "eMix QR Menü sistem yönetimi ve admin paneli",
        captionEN: "eMix QR Menü system management and administration dashboard",
        layout: "full",
        width: 1024,
        height: 639
      }
    ],
    summaryTR: "eMix QR Menü için işletmelerin menülerini dijital ortamda yönetebilmesini sağlayan QR menü sisteminin website arayüzü ve yönetim paneli hazırlandı. Projede ürünün tanıtım sitesi, işletme ve kullanıcı yönetimi, menü altyapısı, sistem istatistikleri ve operasyonel yönetim araçları aynı dijital ürün ekosistemi içerisinde kurgulandı.",
    summaryEN: "A website interface and management system were developed for eMix QR Menü, a digital QR menu product designed to help businesses manage their menus online. The project brings together the public product website, business and user management, menu infrastructure, system statistics, and operational administration tools within a cohesive digital product ecosystem.",
    descriptionTR: "eMix QR Menü için işletmelerin menülerini dijital ortamda yönetebilmesini sağlayan QR menü sisteminin website arayüzü ve yönetim paneli hazırlandı. Projede ürünün tanıtım sitesi, işletme ve kullanıcı yönetimi, menü altyapısı, sistem istatistikleri ve operasyonel yönetim araçları aynı dijital ürün ekosistemi içerisinde kurgulandı.",
    descriptionEN: "A website interface and management system were developed for eMix QR Menü, a digital QR menu product designed to help businesses manage their menus online. The project brings together the public product website, business and user management, menu infrastructure, system statistics, and operational administration tools within a cohesive digital product ecosystem.",
    challengeTR: "Restoran, kafe ve benzeri işletmelerin fiziksel menüler yerine kolayca güncellenebilen dijital menüler kullanabilmesini sağlayacak; aynı zamanda sistemi yöneten taraf için işletme, kullanıcı ve menü süreçlerinin merkezi olarak takip edilebileceği kapsamlı bir yapıya ihtiyaç vardı. Sistemin yalnızca işlevsel olması değil, işletmelere sunulabilecek profesyonel bir dijital ürün gibi görünmesi ve tanıtım sitesi ile yönetim panelinin aynı marka dili altında tutarlı çalışması da projenin temel gereksinimlerindendi.",
    challengeEN: "Restaurants, cafés, and similar businesses needed a digital menu system that could replace static physical menus with an interface that was easier to update and manage. At the same time, the platform required a centralized administration layer for managing businesses, users, menus, and system activity. The product also needed to present itself professionally, with the marketing website and management interface operating under a consistent visual language.",
    solutionTR: "eMix QR Menü için koyu lacivert ve turuncu vurgu renklerini temel alan modern bir dijital ürün arayüzü oluşturuldu. Tanıtım sitesinde sistemin özellikleri, kullanım modeli, fiyatlandırma, sık sorulan sorular ve iletişim alanları kullanıcıyı ürünü keşfetmeye yönlendirecek şekilde kurgulandı. Sistem tarafında ise merkezi bir yönetim paneli hazırlanarak işletmeler, kullanıcılar, ürün ve menü verileri, QR kullanım istatistikleri, menü yedekleri, destek talepleri, duyurular, aktivite kayıtları ve sistem ayarları gibi operasyonel alanların tek yapı üzerinden yönetilebilmesi hedeflendi. Arayüz, yoğun yönetim ekranlarında bilgilerin hızlı okunmasını sağlayacak sade ve işlevsel bir görsel sistemle tasarlandı.",
    solutionEN: "A modern digital product interface was created around eMix QR Menü’s dark navy foundation and orange accent system. The public website was structured around product features, workflow explanation, pricing, frequently asked questions, and contact actions to guide prospective users through the product. On the system side, a centralized administration dashboard was designed around business and user management, product and menu data, QR usage statistics, menu backups, support requests, announcements, activity logs, and system settings. The interface prioritizes clarity and efficient information scanning across data-heavy management screens.",
    resultTR: "eMix QR Menü için yalnızca bir tanıtım websitesi değil, işletme ve sistem yönetimini destekleyen bütünlüklü bir dijital ürün deneyimi oluşturuldu. Tanıtım sitesi, QR menü altyapısı ve yönetim panelinin ortak bir tasarım sistemi içerisinde bir araya getirilmesiyle ürün daha profesyonel, ölçeklenebilir ve kullanıcı dostu bir yapıya kavuştu.",
    resultEN: "eMix QR Menü became more than a standalone marketing website, evolving into a cohesive digital product experience supporting both customer-facing communication and operational system management. Bringing the website, QR menu infrastructure, and administration dashboard together under one consistent design system created a more professional, scalable, and user-friendly product structure.",
    seo: {
      titleTR: "eMix QR Menü Website & Yönetim Sistemi — Kerem Mıhçı",
      titleEN: "eMix QR Menu Website & Management System — Kerem Mıhçı",
      descriptionTR: "eMix QR Menü dijital menü platformu için website tasarımı, admin yönetim paneli ve dijital ürün arayüzü vaka çalışması.",
      descriptionEN: "Case study of the website design, admin management panel, and digital product interface for the eMix QR Menü platform.",
      ogImage: "/projects/emix-qr-menu/cover.webp"
    }
  },

  {
    id: "planfiq-logo-tasarimi",
    slug: "planfiq-logo-tasarimi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "brand-identity",
      "graphic-design"
    ],
    titleTR: "PlanFIQ Logo Tasarımı",
    titleEN: "PlanFIQ Logo Design",
    desktopLabelTR: "PlanFIQ",
    desktopLabelEN: "PlanFIQ",
    client: "PlanFIQ",
    categoryTR: "Marka Kimliği > Logo & Kurumsal Tasarım",
    categoryEN: "Brand Identity > Logo & Corporate Design",
    projectTypeTR: "Marka Kimliği & Logo Tasarımı",
    projectTypeEN: "Brand Identity & Logo Design",
    year: "2026",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 17,
    roleTR: "Logo & Marka Kimliği Tasarımı",
    roleEN: "Logo & Brand Identity Design",
    desktopIcon: "/projects/planfiq-logo-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/planfiq-logo-tasarimi/thumbnail.webp",
      width: 130,
      height: 73,
      scale: 1,
      altTR: "PlanFIQ için teal ve koyu tonlarda P-Q monogramı ve yükseliş oku içeren logo sunumu.",
      altEN: "PlanFIQ logo presentation featuring a P-Q monogram and upward growth arrow in teal and dark tones."
    },
    thumbnail: "/projects/planfiq-logo-tasarimi/thumbnail.webp",
    cover: "/projects/planfiq-logo-tasarimi/cover.webp",
    initials: "PF",
    servicesTR: [
      "Logo Tasarımı",
      "Marka Kimliği",
      "Monogram Tasarımı",
      "Grafik Tasarım",
      "Kurumsal Görsel Tasarım"
    ],
    servicesEN: [
      "Logo Design",
      "Brand Identity",
      "Monogram Design",
      "Graphic Design",
      "Corporate Visual Design"
    ],
    services: [
      "Logo Design",
      "Brand Identity",
      "Monogram Design",
      "Graphic Design",
      "Corporate Visual Design"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/planfiq-logo-tasarimi/media/01-planfiq-logo-presentation.webp",
        altTR: "PlanFIQ için teal ve koyu tonlarda P-Q monogramı ve yükseliş oku içeren logo sunumu.",
        altEN: "PlanFIQ logo presentation featuring a P-Q monogram and upward growth arrow in teal and dark tones.",
        captionTR: "PlanFIQ logo ve kurumsal görsel kimlik sunumu",
        captionEN: "PlanFIQ logo and corporate visual identity presentation",
        layout: "full",
        width: 1024,
        height: 576
      }
    ],
    summaryTR: "PlanFIQ için finans, planlama ve büyüme odağını yansıtan modern ve kurumsal bir logo tasarımı hazırlandı. Güçlü monogram yapısı, yukarı yönlü büyüme oku ve kontrollü teal-koyu renk sistemiyle markanın güvenilir, analitik ve hedef odaklı karakterini destekleyen profesyonel bir görsel kimlik temeli oluşturuldu.",
    summaryEN: "A modern and corporate logo was designed for PlanFIQ to reflect the brand’s focus on finance, planning, and growth. A strong monogram structure, upward growth arrow, and controlled teal-and-dark color system establish a professional visual foundation that communicates reliability, analytical thinking, and goal-oriented progress.",
    descriptionTR: "PlanFIQ için finans, planlama ve büyüme odağını yansıtan modern ve kurumsal bir logo tasarımı hazırlandı. Güçlü monogram yapısı, yukarı yönlü büyüme oku ve kontrollü teal-koyu renk sistemiyle markanın güvenilir, analitik ve hedef odaklı karakterini destekleyen profesyonel bir görsel kimlik temeli oluşturuldu.",
    descriptionEN: "A modern and corporate logo was designed for PlanFIQ to reflect the brand’s focus on finance, planning, and growth. A strong monogram structure, upward growth arrow, and controlled teal-and-dark color system establish a professional visual foundation that communicates reliability, analytical thinking, and goal-oriented progress.",
    challengeTR: "PlanFIQ için finansal planlama, strateji ve büyüme kavramlarını tek bakışta aktarabilecek; kurumsal, güven veren ve farklı dijital ya da basılı kullanım alanlarında ölçeklenebilecek güçlü bir marka sembolüne ihtiyaç vardı. Tasarımın finans sektörünün profesyonel karakterini korurken markayı jenerik finans logolarından ayrıştırması önemliydi.",
    challengeEN: "PlanFIQ needed a strong brand symbol capable of communicating financial planning, strategy, and growth at a glance while remaining professional, trustworthy, and scalable across both digital and print applications. The identity also needed enough distinction to avoid feeling like a generic finance-sector logo.",
    solutionTR: "Marka için “P” ve “Q” harflerini bir araya getiren güçlü bir monogram yapısı geliştirildi. Formun içerisinden yükselen ok sembolü büyüme, gelişim ve hedef odaklılığı destekleyen ana görsel unsur olarak kullanıldı. Teal/yeşil tonları koyu grafit yüzeylerle dengelenerek finans ve strateji alanına uygun modern, güven veren ve profesyonel bir görsel karakter oluşturuldu.",
    solutionEN: "A strong monogram combining the letters “P” and “Q” was developed as the core identity element. An upward arrow integrated into the form became the primary symbol of growth, progress, and goal-oriented thinking. Teal and green accents were balanced with dark graphite tones to establish a modern, trustworthy, and professional visual character suited to finance and strategic planning.",
    resultTR: "PlanFIQ için sade, güçlü ve akılda kalıcı bir logo sistemi oluşturuldu. Geliştirilen monogram ve büyüme sembolü, markanın finans ve planlama odağını net biçimde desteklerken web, sosyal medya, kurumsal sunumlar ve basılı materyaller gibi farklı uygulamalara taşınabilecek profesyonel bir görsel temel sağladı.",
    resultEN: "PlanFIQ received a simple, strong, and memorable logo system. The monogram and growth symbol clearly support the brand’s finance and planning positioning while providing a professional visual foundation capable of scaling across web, social media, corporate presentations, and printed applications.",
    seo: {
      titleTR: "PlanFIQ Logo Tasarımı — Kerem Mıhçı",
      titleEN: "PlanFIQ Logo Design — Kerem Mıhçı",
      descriptionTR: "PlanFIQ finans ve planlama markası için logo tasarımı, P-Q monogramı ve görsel kimlik temeli vaka çalışması.",
      descriptionEN: "Case study of the logo design, P-Q monogram, and visual identity foundation for the PlanFIQ finance and planning brand.",
      ogImage: "/projects/planfiq-logo-tasarimi/cover.webp"
    }
  },

  {
    id: "ceylanlar-site-yonetimi-marka-kimligi",
    slug: "ceylanlar-site-yonetimi-marka-kimligi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "brand-identity",
      "graphic-design"
    ],
    titleTR: "Ceylanlar Site Yönetimi Marka Kimliği",
    titleEN: "Ceylanlar Site Yönetimi Brand Identity",
    desktopLabelTR: "CEYLANLAR",
    desktopLabelEN: "CEYLANLAR",
    client: "Ceylanlar Site Yönetimi",
    categoryTR: "Marka Kimliği > Logo & Kurumsal Tasarım",
    categoryEN: "Brand Identity > Logo & Corporate Design",
    projectTypeTR: "Marka Kimliği & Logo Tasarımı",
    projectTypeEN: "Brand Identity & Logo Design",
    year: "2024",
    status: "completed",
    featured: true,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 18,
    roleTR: "Marka Kimliği & Grafik Tasarım",
    roleEN: "Brand Identity & Graphic Design",
    desktopIcon: "/projects/ceylanlar-site-yonetimi-marka-kimligi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/ceylanlar-site-yonetimi-marka-kimligi/thumbnail.webp",
      width: 130,
      height: 80,
      scale: 1,
      altTR: "Ceylanlar Site Yönetimi için bina ve ceylan sembolünü birleştiren logo ve marka kimliği sunumu.",
      altEN: "Logo and brand identity presentation for Ceylanlar Site Yönetimi combining an architectural form with a gazelle symbol."
    },
    thumbnail: "/projects/ceylanlar-site-yonetimi-marka-kimligi/thumbnail.webp",
    cover: "/projects/ceylanlar-site-yonetimi-marka-kimligi/cover.webp",
    initials: "CS",
    servicesTR: [
      "Marka Kimliği",
      "Logo Tasarımı",
      "Marka Kiti",
      "Kartvizit Tasarımı",
      "Kurumsal Grafik Tasarım",
      "Baskı Tasarımı",
      "Görsel Sistem Tasarımı"
    ],
    servicesEN: [
      "Brand Identity",
      "Logo Design",
      "Brand Kit",
      "Business Card Design",
      "Corporate Graphic Design",
      "Print Design",
      "Visual System Design"
    ],
    services: [
      "Brand Identity",
      "Logo Design",
      "Brand Kit",
      "Business Card Design",
      "Corporate Graphic Design",
      "Print Design",
      "Visual System Design"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/ceylanlar-site-yonetimi-marka-kimligi/media/01-ceylanlar-brand-identity.webp",
        altTR: "Ceylanlar Site Yönetimi için bina ve ceylan sembolünü birleştiren logo ve marka kimliği sunumu.",
        altEN: "Logo and brand identity presentation for Ceylanlar Site Yönetimi combining an architectural form with a gazelle symbol.",
        captionTR: "Ceylanlar Site Yönetimi logo ve marka kimliği uygulaması",
        captionEN: "Ceylanlar Site Yönetimi logo and brand identity application",
        layout: "full",
        width: 654,
        height: 404
      }
    ],
    summaryTR: "Ceylanlar Site Yönetimi için profesyonel site yönetimi hizmetlerindeki güven, düzen ve prestij algısını farklı kurumsal temas noktalarında sürdürebilecek bütünlüklü bir marka kimliği geliştirildi. Çalışma; logo tasarımının yanı sıra marka kiti, kartvizit ve markanın ihtiyaç duyduğu farklı kurumsal grafik uygulamalarına genişleyebilecek tutarlı bir görsel sistem olarak kurgulandı.",
    summaryEN: "A cohesive brand identity was developed for Ceylanlar Site Yönetimi to communicate trust, organization, and a premium professional character across multiple corporate touchpoints. The work extended beyond the logo into a visual system designed to support the brand kit, business-card design, and additional corporate graphic applications.",
    descriptionTR: "Ceylanlar Site Yönetimi için profesyonel site yönetimi hizmetlerindeki güven, düzen ve prestij algısını farklı kurumsal temas noktalarında sürdürebilecek bütünlüklü bir marka kimliği geliştirildi. Çalışma; logo tasarımının yanı sıra marka kiti, kartvizit ve markanın ihtiyaç duyduğu farklı kurumsal grafik uygulamalarına genişleyebilecek tutarlı bir görsel sistem olarak kurgulandı.",
    descriptionEN: "A cohesive brand identity was developed for Ceylanlar Site Yönetimi to communicate trust, organization, and a premium professional character across multiple corporate touchpoints. The work extended beyond the logo into a visual system designed to support the brand kit, business-card design, and additional corporate graphic applications.",
    challengeTR: "Ceylanlar Site Yönetimi’nin profesyonel site yönetimi hizmetlerini temsil edecek güçlü bir logoya sahip olmasının yanı sıra bu kimliği farklı kurumsal ve basılı uygulamalarda tutarlı biçimde sürdürebilmesi gerekiyordu. Marka yapısının güven, düzen ve profesyonellik kavramlarını yansıtması; kartvizit, marka kiti ve diğer kurumsal materyallerde tanınabilirliğini koruyabilmesi projenin temel tasarım ihtiyacını oluşturdu.",
    challengeEN: "Ceylanlar Site Yönetimi needed more than a strong logo for its professional property-management services; it required a visual identity capable of remaining consistent across different corporate and printed applications. The system needed to communicate trust, organization, and professionalism while maintaining brand recognition across business cards, brand-kit materials, and other corporate collateral.",
    solutionTR: "Marka için bina formu ile dinamik ceylan figürünü bir araya getiren karakteristik bir sembol sistemi geliştirildi. Mimari yapı site yönetimi ve düzen kavramını desteklerken ceylan figürü hareket, çeviklik ve ayırt edici marka karakteri sağladı. Güçlü tipografi ve kontrollü kurumsal görsel dil, kimliğin logo kullanımının ötesine geçerek kartvizit, marka kiti ve farklı kurumsal grafik uygulamalarında sürdürülebileceği esnek bir sistem olarak yapılandırıldı.",
    solutionEN: "A distinctive symbol system was developed by combining an architectural building form with a dynamic gazelle figure. The architectural structure reinforces ideas of property management and organization, while the gazelle adds movement, agility, and a recognizable brand character. Strong typography and a controlled corporate visual language allowed the identity to extend beyond the logo into business cards, brand-kit materials, and other corporate graphic applications.",
    resultTR: "Ceylanlar Site Yönetimi için farklı kurumsal temas noktalarında birlikte çalışabilen profesyonel ve tanınabilir bir marka kimliği oluşturuldu. Logo, marka kiti, kartvizit ve diğer kurumsal grafik ihtiyaçlarına genişleyebilen ortak tasarım dili markanın güven veren, düzenli ve prestijli görsel karakterini güçlendirdi.",
    resultEN: "Ceylanlar Site Yönetimi received a professional and recognizable brand identity capable of working consistently across multiple corporate touchpoints. A shared visual language extending from the logo into the brand kit, business cards, and other corporate graphic requirements strengthened the brand’s trustworthy, organized, and premium visual character.",
    seo: {
      titleTR: "Ceylanlar Site Yönetimi Marka Kimliği — Kerem Mıhçı",
      titleEN: "Ceylanlar Site Yönetimi Brand Identity — Kerem Mıhçı",
      descriptionTR: "Ceylanlar Site Yönetimi için marka kimliği, logo sistemi, marka kiti ve kurumsal grafik tasarımı vaka çalışması.",
      descriptionEN: "Case study of the brand identity, logo system, brand kit, and corporate graphic design for Ceylanlar Site Yönetimi.",
      ogImage: "/projects/ceylanlar-site-yonetimi-marka-kimligi/cover.webp"
    }
  },

  {
    id: "deva-yangin-marka-kimligi",
    slug: "deva-yangin-marka-kimligi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "brand-identity",
      "graphic-design"
    ],
    titleTR: "Deva Yangın Marka Kimliği",
    titleEN: "Deva Yangın Brand Identity",
    desktopLabelTR: "DEVA YANGIN",
    desktopLabelEN: "DEVA YANGIN",
    client: "Deva Yangın",
    categoryTR: "Marka Kimliği > Logo & Kurumsal Tasarım",
    categoryEN: "Brand Identity > Logo & Corporate Design",
    projectTypeTR: "Marka Kimliği & Logo Tasarımı",
    projectTypeEN: "Brand Identity & Logo Design",
    year: "2025",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 19,
    roleTR: "Marka Kimliği & Grafik Tasarım",
    roleEN: "Brand Identity & Graphic Design",
    desktopIcon: "/projects/deva-yangin-marka-kimligi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/deva-yangin-marka-kimligi/thumbnail.webp",
      width: 130,
      height: 87,
      scale: 1,
      altTR: "Deva Yangın için alev formu ve güçlü tipografi içeren logo ve marka kimliği sunumu.",
      altEN: "Logo and brand identity presentation for Deva Yangın featuring a flame motif and strong typography."
    },
    thumbnail: "/projects/deva-yangin-marka-kimligi/thumbnail.webp",
    cover: "/projects/deva-yangin-marka-kimligi/cover.webp",
    initials: "DY",
    servicesTR: [
      "Marka Kimliği",
      "Logo Tasarımı",
      "Marka Kiti",
      "Grafik Tasarım",
      "Kurumsal Grafik Tasarım",
      "Görsel Sistem Tasarımı"
    ],
    servicesEN: [
      "Brand Identity",
      "Logo Design",
      "Brand Kit",
      "Graphic Design",
      "Corporate Graphic Design",
      "Visual System Design"
    ],
    services: [
      "Brand Identity",
      "Logo Design",
      "Brand Kit",
      "Graphic Design",
      "Corporate Graphic Design",
      "Visual System Design"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/deva-yangin-marka-kimligi/media/01-deva-yangin-brand-identity.webp",
        altTR: "Deva Yangın için alev formu ve güçlü tipografi içeren logo ve marka kimliği sunumu.",
        altEN: "Logo and brand identity presentation for Deva Yangın featuring a flame motif and strong typography.",
        captionTR: "Deva Yangın logo ve marka kimliği uygulaması",
        captionEN: "Deva Yangın logo and brand identity application",
        layout: "full",
        width: 1024,
        height: 682
      }
    ],
    summaryTR: "Deva Yangın için yangın söndürme ve güvenlik sistemleri sektöründeki profesyonel ve güven veren konumunu destekleyen bütünlüklü bir marka kimliği geliştirildi. Çalışma; logo tasarımının yanı sıra marka kiti ve farklı kurumsal uygulamalarda sürdürülebilecek görsel kimlik sistemini kapsayacak şekilde kurgulandı. Alev formu, güçlü tipografi ve kontrollü koyu-kırmızı renk dengesiyle markanın sektörel karakteri net ve tanınabilir bir görsel dile dönüştürüldü.",
    summaryEN: "A cohesive brand identity was developed for Deva Yangın to support its professional and trustworthy positioning within the fire-suppression and safety-systems sector. The work extended beyond the logo into a brand kit and visual identity system designed to remain consistent across different corporate applications. A flame motif, strong typography, and a controlled dark-and-red color balance translate the brand’s sector identity into a clear and recognizable visual language.",
    descriptionTR: "Deva Yangın için yangın söndürme ve güvenlik sistemleri sektöründeki profesyonel ve güven veren konumunu destekleyen bütünlüklü bir marka kimliği geliştirildi. Çalışma; logo tasarımının yanı sıra marka kiti ve farklı kurumsal uygulamalarda sürdürülebilecek görsel kimlik sistemini kapsayacak şekilde kurgulandı. Alev formu, güçlü tipografi ve kontrollü koyu-kırmızı renk dengesiyle markanın sektörel karakteri net ve tanınabilir bir görsel dile dönüştürüldü.",
    descriptionEN: "A cohesive brand identity was developed for Deva Yangın to support its professional and trustworthy positioning within the fire-suppression and safety-systems sector. The work extended beyond the logo into a brand kit and visual identity system designed to remain consistent across different corporate applications. A flame motif, strong typography, and a controlled dark-and-red color balance translate the brand’s sector identity into a clear and recognizable visual language.",
    challengeTR: "Deva Yangın’ın yangın söndürme ve güvenlik sistemleri alanındaki hizmetlerini temsil edecek güçlü bir logoya sahip olmasının yanı sıra bu kimliği farklı kurumsal temas noktalarında tutarlı biçimde sürdürebilecek bir marka sistemine ihtiyacı vardı. Görsel yapının güven, profesyonellik ve sektörel uzmanlık algısını desteklemesi; dijital ve basılı uygulamalarda tanınabilirliğini koruması projenin temel tasarım ihtiyacını oluşturdu.",
    challengeEN: "Deva Yangın needed more than a strong logo representing its fire-suppression and safety-system services; it required a brand system capable of maintaining visual consistency across multiple corporate touchpoints. The identity needed to communicate trust, professionalism, and sector expertise while remaining recognizable across both digital and printed applications.",
    solutionTR: "Marka için yangın temasını doğrudan fakat kurumsal bir yaklaşımla aktaran alev formu, güçlü harf yapısı ve koyu-kırmızı renk sistemi geliştirildi. Alev sembolü DEVA kelime markasına entegre edilerek sektörel çağrışım logonun ayrılmaz bir parçası haline getirildi. Oluşturulan temel kimlik yalnızca logo uygulamasıyla sınırlı bırakılmayarak marka kiti ve farklı kurumsal görsel ihtiyaçlarda sürdürülebilecek esnek bir tasarım sistemi olarak yapılandırıldı.",
    solutionEN: "A flame form, strong letter construction, and dark-red color system were developed to communicate the fire-safety theme in a direct yet corporate manner. The flame symbol was integrated into the DEVA wordmark, making the sector reference an inherent part of the identity. The resulting system was structured to extend beyond the logo into a flexible brand kit and additional corporate visual applications.",
    resultTR: "Deva Yangın için logodan marka kitine uzanan, profesyonel ve tutarlı bir görsel kimlik sistemi oluşturuldu. Güçlü sembol dili ve kontrollü kurumsal tasarım yaklaşımı markanın yangın güvenliği sektöründeki görünümünü daha tanınabilir, güven veren ve bütünlüklü bir yapıya taşıdı.",
    resultEN: "Deva Yangın received a professional and consistent visual identity extending from the logo into the broader brand kit. The strong symbol language and controlled corporate design approach established a more recognizable, trustworthy, and cohesive visual presence within the fire-safety sector.",
    seo: {
      titleTR: "Deva Yangın Marka Kimliği — Kerem Mıhçı",
      titleEN: "Deva Yangın Brand Identity — Kerem Mıhçı",
      descriptionTR: "Deva Yangın Söndürme ve Güvenlik Sistemleri için marka kimliği, logo sistemi ve kurumsal görsel kimlik vaka çalışması.",
      descriptionEN: "Case study of the brand identity, logo system, and corporate visual identity for Deva Yangın Fire Systems.",
      ogImage: "/projects/deva-yangin-marka-kimligi/cover.webp"
    }
  },

  {
    id: "goobzy-logo-tasarimi",
    slug: "goobzy-logo-tasarimi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "brand-identity",
      "graphic-design"
    ],
    titleTR: "Goobzy Logo Tasarımı",
    titleEN: "Goobzy Logo Design",
    desktopLabelTR: "Goobzy",
    desktopLabelEN: "Goobzy",
    client: "Goobzy",
    categoryTR: "Marka Kimliği > Logo Tasarımı",
    categoryEN: "Brand Identity > Logo Design",
    projectTypeTR: "Logo & Marka Kimliği Tasarımı",
    projectTypeEN: "Logo & Brand Identity Design",
    year: "2024",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 20,
    roleTR: "Logo & Marka Kimliği Tasarımı",
    roleEN: "Logo & Brand Identity Design",
    desktopIcon: "/projects/goobzy-logo-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/goobzy-logo-tasarimi/thumbnail.webp",
      width: 130,
      height: 87,
      scale: 1,
      altTR: "Goobzy için sarı balon üzerinde G harfi ve karakter öğesini birleştiren logo uygulaması.",
      altEN: "Goobzy logo application on a yellow balloon combining a G letterform with a character element."
    },
    thumbnail: "/projects/goobzy-logo-tasarimi/thumbnail.webp",
    cover: "/projects/goobzy-logo-tasarimi/cover.webp",
    initials: "GZ",
    servicesTR: [
      "Logo Tasarımı",
      "Marka Kimliği",
      "Sembol Tasarımı",
      "Grafik Tasarım",
      "Görsel Kimlik"
    ],
    servicesEN: [
      "Logo Design",
      "Brand Identity",
      "Symbol Design",
      "Graphic Design",
      "Visual Identity"
    ],
    services: [
      "Logo Design",
      "Brand Identity",
      "Symbol Design",
      "Graphic Design",
      "Visual Identity"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/goobzy-logo-tasarimi/media/01-goobzy-logo-application.webp",
        altTR: "Goobzy için sarı balon üzerinde G harfi ve karakter öğesini birleştiren logo uygulaması.",
        altEN: "Goobzy logo application on a yellow balloon combining a G letterform with a character element.",
        captionTR: "Goobzy logo ve marka kimliği uygulaması",
        captionEN: "Goobzy logo and brand identity application",
        layout: "full",
        width: 1024,
        height: 683
      }
    ],
    summaryTR: "Goobzy için eğlenceli, modern ve akılda kalıcı bir logo tasarımı hazırlandı. Yumuşak form dili, karakter odaklı sembol yapısı ve sıcak renk yaklaşımıyla markanın samimi, yaratıcı ve dinamik karakterini destekleyen güçlü bir görsel kimlik temeli oluşturuldu.",
    summaryEN: "A playful, modern, and memorable logo was designed for Goobzy. A soft form language, character-driven symbol, and warm visual approach establish a strong identity foundation that reflects the brand’s friendly, creative, and dynamic personality.",
    descriptionTR: "Goobzy için eğlenceli, modern ve akılda kalıcı bir logo tasarımı hazırlandı. Yumuşak form dili, karakter odaklı sembol yapısı ve sıcak renk yaklaşımıyla markanın samimi, yaratıcı ve dinamik karakterini destekleyen güçlü bir görsel kimlik temeli oluşturuldu.",
    descriptionEN: "A playful, modern, and memorable logo was designed for Goobzy. A soft form language, character-driven symbol, and warm visual approach establish a strong identity foundation that reflects the brand’s friendly, creative, and dynamic personality.",
    challengeTR: "Goobzy için markanın enerjik ve samimi karakterini ilk bakışta aktarabilecek, kolay hatırlanabilir ve farklı kullanım alanlarına uyum sağlayabilecek özgün bir logo sistemine ihtiyaç vardı. Tasarımın eğlenceli görünürken amatör hissettirmemesi ve dijital ya da basılı uygulamalarda tanınabilirliğini koruması projenin temel gereksinimlerini oluşturdu.",
    challengeEN: "Goobzy required an original logo system capable of immediately communicating the brand’s energetic and friendly character while remaining memorable and adaptable across different applications. The design needed to feel playful without appearing unrefined and had to maintain strong recognition across both digital and printed use cases.",
    solutionTR: "Marka için yumuşak ve eğlenceli form diline sahip, karakter hissini destekleyen ayırt edici bir sembol yaklaşımı geliştirildi. “G” harfi görsel kimliğin ana odağı haline getirilirken sıcak sarı tonları ve sevimli karakter dili markanın yaratıcı yapısını güçlendirdi. Logo, küçük dijital kullanımlardan daha büyük fiziksel uygulamalara kadar tanınabilirliğini koruyabilecek sade ve güçlü bir yapıda kurgulandı.",
    solutionEN: "A distinctive symbol approach was developed around a soft and playful visual language with a strong character-driven quality. The letter “G” became the primary identity focus, supported by warm yellow tones and a friendly character treatment that reinforces the brand’s creative personality. The logo was structured to remain recognizable from small digital applications to larger physical brand uses.",
    resultTR: "Goobzy için samimi, dikkat çekici ve kolay hatırlanabilir bir logo sistemi oluşturuldu. Geliştirilen görsel yapı markanın yaratıcı ve eğlenceli karakterini güçlendirirken sosyal medya, dijital kullanım, promosyon uygulamaları ve farklı fiziksel marka materyallerine taşınabilecek esnek bir kimlik temeli sağladı.",
    resultEN: "Goobzy received a friendly, distinctive, and memorable logo system. The resulting visual structure strengthens the brand’s creative and playful character while providing a flexible identity foundation suitable for social media, digital applications, promotional use, and other physical brand touchpoints.",
    seo: {
      titleTR: "Goobzy Logo Tasarımı — Kerem Mıhçı",
      titleEN: "Goobzy Logo Design — Kerem Mıhçı",
      descriptionTR: "Goobzy için eğlenceli ve modern logo tasarımı, karakter odaklı sembol ve görsel kimlik temeli vaka çalışması.",
      descriptionEN: "Case study of the playful and modern logo design, character-driven symbol, and visual identity foundation for Goobzy.",
      ogImage: "/projects/goobzy-logo-tasarimi/cover.webp"
    }
  },

  {
    id: "yanarsan-yangin-logo-tasarimi",
    slug: "yanarsan-yangin-logo-tasarimi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "brand-identity",
      "graphic-design"
    ],
    titleTR: "Yanarsan Yangın Logo Tasarımı",
    titleEN: "Yanarsan Yangın Logo Design",
    desktopLabelTR: "Yanarsan",
    desktopLabelEN: "Yanarsan",
    client: "Yanarsan Yangın",
    categoryTR: "Marka Kimliği > Logo Tasarımı",
    categoryEN: "Brand Identity > Logo Design",
    projectTypeTR: "Logo & Marka Kimliği Tasarımı",
    projectTypeEN: "Logo & Brand Identity Design",
    year: "2025",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 21,
    roleTR: "Logo & Marka Kimliği Tasarımı",
    roleEN: "Logo & Brand Identity Design",
    desktopIcon: "/projects/yanarsan-yangin-logo-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/yanarsan-yangin-logo-tasarimi/thumbnail.webp",
      width: 130,
      height: 87,
      scale: 1,
      altTR: "Yanarsan Yangın için kırmızı yüzey üzerinde beyaz kabartma logo ve kurumsal kimlik uygulaması.",
      altEN: "White embossed logo and corporate identity application for Yanarsan Yangın on a red surface."
    },
    thumbnail: "/projects/yanarsan-yangin-logo-tasarimi/thumbnail.webp",
    cover: "/projects/yanarsan-yangin-logo-tasarimi/cover.webp",
    initials: "YY",
    servicesTR: [
      "Logo Tasarımı",
      "Marka Kimliği",
      "Grafik Tasarım",
      "Kurumsal Görsel Tasarım"
    ],
    servicesEN: [
      "Logo Design",
      "Brand Identity",
      "Graphic Design",
      "Corporate Visual Design"
    ],
    services: [
      "Logo Design",
      "Brand Identity",
      "Graphic Design",
      "Corporate Visual Design"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/yanarsan-yangin-logo-tasarimi/media/01-yanarsan-logo-application.webp",
        altTR: "Yanarsan Yangın için kırmızı yüzey üzerinde beyaz kabartma logo ve kurumsal kimlik uygulaması.",
        altEN: "White embossed logo and corporate identity application for Yanarsan Yangın on a red surface.",
        captionTR: "Yanarsan Yangın logo ve kurumsal kimlik uygulaması",
        captionEN: "Yanarsan Yangın logo and corporate identity application",
        layout: "full",
        width: 1024,
        height: 682
      }
    ],
    summaryTR: "Yanarsan Yangın için yangın söndürme ve güvenlik sistemleri sektörüne uygun, güçlü ve kurumsal bir logo tasarımı hazırlandı. Sade fakat dikkat çekici tipografi, güçlü marka görünürlüğü ve kontrollü kırmızı-koyu renk yaklaşımıyla markanın güven, dayanıklılık ve profesyonellik odaklı karakterini destekleyen bir görsel kimlik temeli oluşturuldu.",
    summaryEN: "A strong and corporate logo was designed for Yanarsan Yangın to reflect the professional character of the fire-suppression and safety-systems sector. Clear typography, strong brand visibility, and a controlled red-and-dark visual approach establish an identity foundation centered on trust, durability, and professionalism.",
    descriptionTR: "Yanarsan Yangın için yangın söndürme ve güvenlik sistemleri sektörüne uygun, güçlü ve kurumsal bir logo tasarımı hazırlandı. Sade fakat dikkat çekici tipografi, güçlü marka görünürlüğü ve kontrollü kırmızı-koyu renk yaklaşımıyla markanın güven, dayanıklılık ve profesyonellik odaklı karakterini destekleyen bir görsel kimlik temeli oluşturuldu.",
    descriptionEN: "A strong and corporate logo was designed for Yanarsan Yangın to reflect the professional character of the fire-suppression and safety-systems sector. Clear typography, strong brand visibility, and a controlled red-and-dark visual approach establish an identity foundation centered on trust, durability, and professionalism.",
    challengeTR: "Yanarsan Yangın’ın yangın güvenliği sektöründeki hizmetlerini temsil edecek, kurumsal güven algısını güçlendirecek ve farklı kullanım alanlarında net biçimde çalışabilecek güçlü bir marka logosuna ihtiyacı vardı. Logonun sektörel karakteri korurken tabela, web, sosyal medya ve basılı materyaller gibi farklı ölçeklerde okunabilirliğini ve tanınabilirliğini sürdürebilmesi projenin temel tasarım ihtiyacını oluşturdu.",
    challengeEN: "Yanarsan Yangın needed a strong brand logo capable of representing its fire-safety services, reinforcing corporate trust, and remaining clear across different applications. The identity needed to preserve its sector-specific character while maintaining readability and recognition across signage, web, social media, and printed materials.",
    solutionTR: "Marka için sade, güçlü ve uygulanabilir bir tipografik logo yaklaşımı geliştirildi. Yangın güvenliği sektörünün güçlü ve dikkat gerektiren karakteri kırmızı renk vurgusu ve net harf yapısıyla desteklenirken, logo farklı dijital ve fiziksel kullanım alanlarında rahatlıkla uygulanabilecek dengeli ve kurumsal bir yapıda kurgulandı.",
    solutionEN: "A clean, strong, and practical typographic logo approach was developed for the brand. The high-impact character of the fire-safety sector was reinforced through red accents and clear letterforms, while the overall identity was structured to remain balanced, corporate, and adaptable across both digital and physical applications.",
    resultTR: "Yanarsan Yangın için profesyonel, güven veren ve sektörel kimlikle uyumlu bir logo sistemi oluşturuldu. Geliştirilen görsel yapı; web sitesi, sosyal medya, tabela ve kurumsal basılı materyaller gibi farklı uygulamalarda markanın tutarlı ve tanınabilir bir görünüm sergilemesini destekleyen güçlü bir kimlik temeli sağladı.",
    resultEN: "Yanarsan Yangın received a professional, trustworthy, and sector-appropriate logo system. The resulting visual structure provides a strong identity foundation capable of maintaining a consistent and recognizable brand presence across the website, social media, signage, and corporate printed materials.",
    seo: {
      titleTR: "Yanarsan Yangın Logo Tasarımı — Kerem Mıhçı",
      titleEN: "Yanarsan Yangın Logo Design — Kerem Mıhçı",
      descriptionTR: "Yanarsan Yangın Söndürme ve Güvenlik Sistemleri için logo tasarımı ve kurumsal kimlik temeli vaka çalışması.",
      descriptionEN: "Case study of the logo design and corporate identity foundation for Yanarsan Yangın Fire & Safety Systems.",
      ogImage: "/projects/yanarsan-yangin-logo-tasarimi/cover.webp"
    }
  },

  {
    id: "emix-creative-logo-tasarimi",
    slug: "emix-creative-logo-tasarimi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "brand-identity",
      "graphic-design"
    ],
    titleTR: "eMix Creative Logo Tasarımı",
    titleEN: "eMix Creative Logo Design",
    desktopLabelTR: "eMix Creative",
    desktopLabelEN: "eMix Creative",
    client: "eMix Creative",
    categoryTR: "Marka Kimliği > Logo Tasarımı",
    categoryEN: "Brand Identity > Logo Design",
    projectTypeTR: "Logo & Marka Kimliği Tasarımı",
    projectTypeEN: "Logo & Brand Identity Design",
    year: "2024",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 22,
    roleTR: "Logo & Marka Kimliği Tasarımı",
    roleEN: "Logo & Brand Identity Design",
    desktopIcon: "/projects/emix-creative-logo-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/emix-creative-logo-tasarimi/thumbnail.webp",
      width: 130,
      height: 87,
      scale: 1,
      altTR: "eMix Creative için kraft kağıt yüzey üzerinde turuncu, kırmızı ve siyah monogram logo uygulaması.",
      altEN: "eMix Creative monogram logo application in orange, red, and black on a kraft paper surface."
    },
    thumbnail: "/projects/emix-creative-logo-tasarimi/thumbnail.webp",
    cover: "/projects/emix-creative-logo-tasarimi/cover.webp",
    initials: "EC",
    servicesTR: [
      "Logo Tasarımı",
      "Marka Kimliği",
      "Monogram Tasarımı",
      "Grafik Tasarım",
      "Görsel Kimlik Tasarımı"
    ],
    servicesEN: [
      "Logo Design",
      "Brand Identity",
      "Monogram Design",
      "Graphic Design",
      "Visual Identity Design"
    ],
    services: [
      "Logo Design",
      "Brand Identity",
      "Monogram Design",
      "Graphic Design",
      "Visual Identity Design"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/emix-creative-logo-tasarimi/media/01-emix-creative-logo-application.webp",
        altTR: "eMix Creative için kraft kağıt yüzey üzerinde turuncu, kırmızı ve siyah monogram logo uygulaması.",
        altEN: "eMix Creative monogram logo application in orange, red, and black on a kraft paper surface.",
        captionTR: "eMix Creative logo ve fiziksel marka kimliği uygulaması",
        captionEN: "eMix Creative logo and physical brand identity application",
        layout: "full",
        width: 1024,
        height: 682
      }
    ],
    summaryTR: "eMix Creative için dijital medya ajansının yaratıcı, teknolojik ve dinamik karakterini yansıtan modern ve akılda kalıcı bir logo tasarımı hazırlandı. Keskin geometrik form dili, turuncu-kırmızı geçişleri ve güçlü monogram yapısıyla markanın dijital üretim ve yaratıcı iletişim odağını destekleyen tanınabilir bir görsel kimlik temeli oluşturuldu.",
    summaryEN: "A modern and memorable logo was designed for eMix Creative to reflect the creative, technological, and dynamic character of the digital media agency. Sharp geometric forms, orange-red transitions, and a strong monogram structure establish a recognizable visual identity foundation supporting the brand’s focus on digital production and creative communication.",
    descriptionTR: "eMix Creative için dijital medya ajansının yaratıcı, teknolojik ve dinamik karakterini yansıtan modern ve akılda kalıcı bir logo tasarımı hazırlandı. Keskin geometrik form dili, turuncu-kırmızı geçişleri ve güçlü monogram yapısıyla markanın dijital üretim ve yaratıcı iletişim odağını destekleyen tanınabilir bir görsel kimlik temeli oluşturuldu.",
    descriptionEN: "A modern and memorable logo was designed for eMix Creative to reflect the creative, technological, and dynamic character of the digital media agency. Sharp geometric forms, orange-red transitions, and a strong monogram structure establish a recognizable visual identity foundation supporting the brand’s focus on digital production and creative communication.",
    challengeTR: "eMix Creative’in dijital medya, yaratıcı üretim ve teknoloji odaklı hizmetlerini temsil edecek; modern, profesyonel ve farklı kullanım alanlarında kolayca tanınabilecek güçlü bir marka sembolüne ihtiyacı vardı. Logonun dijital ajans karakterini yansıtırken sosyal medya, web, sunum ve fiziksel marka uygulamalarında ölçeklenebilirliğini koruması projenin temel tasarım ihtiyacını oluşturdu.",
    challengeEN: "eMix Creative needed a strong brand symbol capable of representing its digital-media, creative-production, and technology-focused services while remaining modern, professional, and recognizable across different applications. The logo needed to reflect the agency’s digital character while maintaining scalability across social media, web, presentations, and physical brand applications.",
    solutionTR: "Marka için “M” harfinden hareketle keskin, geometrik ve dinamik bir monogram sistemi geliştirildi. İç içe geçen form yapısı markanın dijital ve yaratıcı karakterini desteklerken turuncu, kırmızı ve koyu tonların birlikte kullanımı enerjik ve güçlü bir ajans görünümü oluşturdu. Logo, hem dijital ekranlarda hem de basılı ve fiziksel marka uygulamalarında tanınabilirliğini koruyabilecek sade ve uygulanabilir bir yapıda tasarlandı.",
    solutionEN: "A sharp, geometric, and dynamic monogram system was developed around the letter “M”. The interlocking structure supports the brand’s digital and creative character, while the combination of orange, red, and dark tones creates an energetic and distinctive agency presence. The logo was designed as a clear and adaptable system capable of maintaining recognition across digital screens, printed materials, and physical brand applications.",
    resultTR: "eMix Creative için profesyonel, dikkat çekici ve farklı temas noktalarında kullanılabilecek güçlü bir logo sistemi oluşturuldu. Geliştirilen monogram ve renk yaklaşımı markanın yaratıcı ve teknolojik karakterini daha tanınabilir hale getirirken web sitesi, sosyal medya, sunumlar, reklam materyalleri ve fiziksel marka uygulamalarına taşınabilecek güçlü bir görsel temel sağladı.",
    resultEN: "eMix Creative received a professional and distinctive logo system capable of working across multiple brand touchpoints. The resulting monogram and color approach strengthen the brand’s creative and technological character while providing a recognizable visual foundation for the website, social media, presentations, advertising materials, and physical brand applications.",
    seo: {
      titleTR: "eMix Creative Logo Tasarımı — Kerem Mıhçı",
      titleEN: "eMix Creative Logo Design — Kerem Mıhçı",
      descriptionTR: "eMix Creative dijital medya ajansı için modern logo tasarımı, geometrik monogram ve görsel kimlik temeli vaka çalışması.",
      descriptionEN: "Case study of the modern logo design, geometric monogram, and visual identity foundation for eMix Creative digital agency.",
      ogImage: "/projects/emix-creative-logo-tasarimi/cover.webp"
    }
  },

  {
    id: "kixogames-logo-tasarimi",
    slug: "kixogames-logo-tasarimi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "brand-identity",
      "graphic-design"
    ],
    titleTR: "KIXOGAMES Logo Tasarımı",
    titleEN: "KIXOGAMES Logo Design",
    desktopLabelTR: "KIXOGAMES",
    desktopLabelEN: "KIXOGAMES",
    client: "KIXOGAMES",
    categoryTR: "Marka Kimliği > Logo Tasarımı",
    categoryEN: "Brand Identity > Logo Design",
    projectTypeTR: "Logo & Marka Kimliği Tasarımı",
    projectTypeEN: "Logo & Brand Identity Design",
    year: "2026",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 23,
    roleTR: "Logo & Marka Kimliği Tasarımı",
    roleEN: "Logo & Brand Identity Design",
    desktopIcon: "/projects/kixogames-logo-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/kixogames-logo-tasarimi/thumbnail.webp",
      width: 104,
      height: 130,
      scale: 1,
      altTR: "KIXOGAMES için mor, mavi ve pembe neon geçişlere sahip K monogram logo ve oyun odaklı marka kimliği sunumu.",
      altEN: "KIXOGAMES gaming brand identity presentation featuring a K monogram with purple, blue, and pink neon gradients."
    },
    thumbnail: "/projects/kixogames-logo-tasarimi/thumbnail.webp",
    cover: "/projects/kixogames-logo-tasarimi/cover.webp",
    initials: "KX",
    servicesTR: [
      "Logo Tasarımı",
      "Marka Kimliği",
      "Monogram Tasarımı",
      "Grafik Tasarım",
      "Oyun Görsel Tasarımı",
      "Dijital Görsel Kimlik"
    ],
    servicesEN: [
      "Logo Design",
      "Brand Identity",
      "Monogram Design",
      "Graphic Design",
      "Game Visual Design",
      "Digital Visual Identity"
    ],
    services: [
      "Logo Design",
      "Brand Identity",
      "Monogram Design",
      "Graphic Design",
      "Game Visual Design",
      "Digital Visual Identity"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/kixogames-logo-tasarimi/media/01-kixogames-logo-identity.webp",
        altTR: "KIXOGAMES için mor, mavi ve pembe neon geçişlere sahip K monogram logo ve oyun odaklı marka kimliği sunumu.",
        altEN: "KIXOGAMES gaming brand identity presentation featuring a K monogram with purple, blue, and pink neon gradients.",
        captionTR: "KIXOGAMES logo ve oyun odaklı görsel kimlik uygulaması",
        captionEN: "KIXOGAMES logo and gaming-focused visual identity application",
        layout: "full",
        width: 819,
        height: 1024
      }
    ],
    summaryTR: "KIXOGAMES için oyun ve dijital eğlence dünyasının dinamik, teknolojik ve enerjik karakterini yansıtan modern bir logo tasarımı hazırlandı. Keskin geometrik formlardan oluşan “K” monogramı, mor-pembe-mavi neon geçişleri ve kontrollü dijital tipografiyle markanın oyun sektörüne uygun güçlü ve akılda kalıcı görsel kimlik temeli oluşturuldu.",
    summaryEN: "A modern logo was designed for KIXOGAMES to reflect the dynamic, technological, and energetic character of gaming and digital entertainment. A sharp geometric “K” monogram, purple-pink-blue neon transitions, and controlled digital typography establish a strong and memorable visual identity foundation suited to the gaming industry.",
    descriptionTR: "KIXOGAMES için oyun ve dijital eğlence dünyasının dinamik, teknolojik ve enerjik karakterini yansıtan modern bir logo tasarımı hazırlandı. Keskin geometrik formlardan oluşan “K” monogramı, mor-pembe-mavi neon geçişleri ve kontrollü dijital tipografiyle markanın oyun sektörüne uygun güçlü ve akılda kalıcı görsel kimlik temeli oluşturuldu.",
    descriptionEN: "A modern logo was designed for KIXOGAMES to reflect the dynamic, technological, and energetic character of gaming and digital entertainment. A sharp geometric “K” monogram, purple-pink-blue neon transitions, and controlled digital typography establish a strong and memorable visual identity foundation suited to the gaming industry.",
    challengeTR: "KIXOGAMES için oyun ve dijital eğlence sektörüne uygun, güçlü ve kolay hatırlanabilir bir marka sembolüne ihtiyaç vardı. Kimliğin teknolojik ve enerjik görünürken jenerik oyun logolarından ayrışması; sosyal medya, oyun platformları, yayın görselleri ve farklı dijital kullanım alanlarında küçük ölçekte dahi tanınabilirliğini koruması projenin temel tasarım gereksinimlerini oluşturdu.",
    challengeEN: "KIXOGAMES required a strong and memorable brand symbol suited to the gaming and digital-entertainment industry. The identity needed to feel technological and energetic without becoming another generic gaming logo, while maintaining recognition across social media, game platforms, streaming graphics, and other digital applications even at smaller scales.",
    solutionTR: "Marka için “K” harfi merkezli, keskin ve hareket hissi taşıyan geometrik bir monogram geliştirildi. Beyaz ana form ile mor, pembe ve mavi neon geçişleri bir araya getirilerek oyun dünyasına uygun güçlü bir kontrast ve dijital atmosfer oluşturuldu. Geniş harf aralığına sahip modern tipografi, monogramın futuristik karakterini destekleyecek ve farklı dijital yüzeylerde okunabilirliği koruyacak şekilde kurgulandı.",
    solutionEN: "A sharp geometric monogram centered on the letter “K” was developed with a strong sense of movement. The white primary form was combined with purple, pink, and blue neon transitions to create strong contrast and a digital atmosphere suited to gaming. Modern typography with controlled spacing reinforces the futuristic character of the symbol while maintaining readability across different digital surfaces.",
    resultTR: "KIXOGAMES için dikkat çekici, güçlü ve oyun sektörüyle uyumlu bir logo sistemi oluşturuldu. Geliştirilen monogram, renk geçişleri ve tipografik yapı markanın dijital kimliğini daha profesyonel ve tanınabilir hale getirirken sosyal medya, oyun platformları, yayın görselleri ve promosyon materyallerine taşınabilecek esnek bir görsel temel sağladı.",
    resultEN: "KIXOGAMES received a distinctive and powerful logo system aligned with the gaming industry. The resulting monogram, color transitions, and typography establish a more professional and recognizable digital identity while providing a flexible visual foundation for social media, gaming platforms, streaming graphics, and promotional materials.",
    seo: {
      titleTR: "KIXOGAMES Logo Tasarımı — Kerem Mıhçı",
      titleEN: "KIXOGAMES Logo Design — Kerem Mıhçı",
      descriptionTR: "KIXOGAMES oyun stüdyosu için modern logo tasarımı, geometrik K monogramı ve neon görsel kimlik temeli vaka çalışması.",
      descriptionEN: "Case study of the modern logo design, geometric K monogram, and neon visual identity foundation for KIXOGAMES game studio.",
      ogImage: "/projects/kixogames-logo-tasarimi/cover.webp"
    }
  },

  {
    id: "kiyris-games-logo-tasarimi",
    slug: "kiyris-games-logo-tasarimi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "brand-identity",
      "graphic-design"
    ],
    titleTR: "KIYRIS GAMES Logo Tasarımı",
    titleEN: "KIYRIS GAMES Logo Design",
    desktopLabelTR: "KIYRIS GAMES",
    desktopLabelEN: "KIYRIS GAMES",
    client: "KIYRIS GAMES",
    categoryTR: "Marka Kimliği > Logo Tasarımı",
    categoryEN: "Brand Identity > Logo Design",
    projectTypeTR: "Logo & Marka Kimliği Tasarımı",
    projectTypeEN: "Logo & Brand Identity Design",
    year: "2026",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 24,
    roleTR: "Logo & Marka Kimliği Tasarımı",
    roleEN: "Logo & Brand Identity Design",
    desktopIcon: "/projects/kiyris-games-logo-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/kiyris-games-logo-tasarimi/thumbnail.webp",
      width: 130,
      height: 95,
      scale: 1,
      altTR: "KIYRIS GAMES için mavi ve mor neon geçişlere sahip K monogram logo ve oyun odaklı görsel kimlik sunumu.",
      altEN: "KIYRIS GAMES gaming visual identity presentation featuring a K monogram with blue and purple neon gradients."
    },
    thumbnail: "/projects/kiyris-games-logo-tasarimi/thumbnail.webp",
    cover: "/projects/kiyris-games-logo-tasarimi/cover.webp",
    initials: "KG",
    servicesTR: [
      "Logo Tasarımı",
      "Marka Kimliği",
      "Monogram Tasarımı",
      "Grafik Tasarım",
      "Oyun Görsel Tasarımı",
      "Dijital Görsel Kimlik"
    ],
    servicesEN: [
      "Logo Design",
      "Brand Identity",
      "Monogram Design",
      "Graphic Design",
      "Game Visual Design",
      "Digital Visual Identity"
    ],
    services: [
      "Logo Design",
      "Brand Identity",
      "Monogram Design",
      "Graphic Design",
      "Game Visual Design",
      "Digital Visual Identity"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/kiyris-games-logo-tasarimi/media/01-kiyris-games-logo-identity.webp",
        altTR: "KIYRIS GAMES için mavi ve mor neon geçişlere sahip K monogram logo ve oyun odaklı görsel kimlik sunumu.",
        altEN: "KIYRIS GAMES gaming visual identity presentation featuring a K monogram with blue and purple neon gradients.",
        captionTR: "KIYRIS GAMES logo ve oyun odaklı görsel kimlik sunumu",
        captionEN: "KIYRIS GAMES logo and gaming-focused visual identity presentation",
        layout: "full",
        width: 1024,
        height: 746
      }
    ],
    summaryTR: "KIYRIS GAMES için oyun dünyasının dinamik, teknolojik ve futuristik karakterini yansıtan modern bir logo tasarımı hazırlandı. Keskin geometrik formlardan oluşan “K” monogramı, mavi-mor neon geçişleri ve güçlü tipografik yapı ile markanın dijital ortamda akılda kalıcı, enerjik ve profesyonel bir görsel kimlik temeli oluşturuldu.",
    summaryEN: "A modern logo was designed for KIYRIS GAMES to reflect the dynamic, technological, and futuristic character of the gaming world. A sharp geometric “K” monogram, blue-purple neon transitions, and a strong typographic structure establish a memorable, energetic, and professional visual identity foundation for the brand.",
    descriptionTR: "KIYRIS GAMES için oyun dünyasının dinamik, teknolojik ve futuristik karakterini yansıtan modern bir logo tasarımı hazırlandı. Keskin geometrik formlardan oluşan “K” monogramı, mavi-mor neon geçişleri ve güçlü tipografik yapı ile markanın dijital ortamda akılda kalıcı, enerjik ve profesyonel bir görsel kimlik temeli oluşturuldu.",
    descriptionEN: "A modern logo was designed for KIYRIS GAMES to reflect the dynamic, technological, and futuristic character of the gaming world. A sharp geometric “K” monogram, blue-purple neon transitions, and a strong typographic structure establish a memorable, energetic, and professional visual identity foundation for the brand.",
    challengeTR: "KIYRIS GAMES için oyun ve dijital eğlence sektörüne uygun, güçlü ve kolay hatırlanabilir bir marka logosuna ihtiyaç vardı. Kimliğin hem teknolojik hem de enerjik görünmesi; sosyal medya, oyun tanıtımları, dijital platformlar ve farklı ekran kullanım senaryolarında net, ayırt edici ve ölçeklenebilir kalması temel tasarım gereksinimlerini oluşturdu.",
    challengeEN: "KIYRIS GAMES needed a strong and memorable brand logo suited to the gaming and digital-entertainment sector. The identity had to feel both technological and energetic while remaining clear, distinctive, and scalable across social media, game promotions, digital platforms, and different screen contexts.",
    solutionTR: "Marka için merkezinde “K” harfi bulunan, keskin köşeli ve hareket hissi taşıyan güçlü bir monogram geliştirildi. Ana formda açık tonlar kullanılırken mavi ve mor neon geçişleriyle dijital oyun estetiği desteklendi. Alt kısımda yer alan modern sans-serif tipografi, monogramın futuristik karakterini tamamlayacak ve markanın farklı dijital yüzeylerde okunabilirliğini koruyacak şekilde kurgulandı.",
    solutionEN: "A strong monogram centered on the letter “K” was developed using sharp angles and a sense of motion. Light-toned primary forms were combined with blue and purple neon transitions to support a digital gaming aesthetic. The modern sans-serif typography placed below the symbol complements its futuristic character while maintaining readability across different digital surfaces.",
    resultTR: "KIYRIS GAMES için dikkat çekici, güçlü ve oyun sektörüyle uyumlu bir logo kimliği oluşturuldu. Geliştirilen monogram, renk geçişleri ve tipografik yapı markanın dijital görünürlüğünü güçlendirirken sosyal medya, tanıtım görselleri, dijital yayınlar ve ileride genişletilebilecek marka uygulamaları için sağlam bir görsel temel sundu.",
    resultEN: "A distinctive and powerful logo identity was created for KIYRIS GAMES. The resulting monogram, color transitions, and typographic structure strengthen the brand’s digital presence while providing a solid visual foundation for social media, promotional graphics, digital publications, and future brand applications.",
    seo: {
      titleTR: "KIYRIS GAMES Logo Tasarımı — Kerem Mıhçı",
      titleEN: "KIYRIS GAMES Logo Design — Kerem Mıhçı",
      descriptionTR: "KIYRIS GAMES oyun markası için modern logo tasarımı, geometrik K monogramı ve neon görsel kimlik temeli vaka çalışması.",
      descriptionEN: "Case study of the modern logo design, geometric K monogram, and neon visual identity foundation for KIYRIS GAMES.",
      ogImage: "/projects/kiyris-games-logo-tasarimi/cover.webp"
    }
  },

  {
    id: "alchemia-ocak-2025-dergi-tasarimi",
    slug: "alchemia-ocak-2025-dergi-tasarimi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "graphic-design"
    ],
    titleTR: "Alchemia Ocak 2025 Dergi Tasarımı",
    titleEN: "Alchemia January 2025 Magazine Design",
    desktopLabelTR: "Alchemia Ocak",
    desktopLabelEN: "Alchemia Jan",
    client: "Alchemia",
    categoryTR: "Grafik Tasarım > Editoryal Tasarım",
    categoryEN: "Graphic Design > Editorial Design",
    projectTypeTR: "Editoryal Tasarım & Dergi Tasarımı",
    projectTypeEN: "Editorial Design & Magazine Design",
    year: "2025",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 25,
    roleTR: "Editoryal Tasarım & Grafik Tasarım",
    roleEN: "Editorial Design & Graphic Design",
    desktopIcon: "/projects/alchemia-ocak-2025-dergi-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/alchemia-ocak-2025-dergi-tasarimi/thumbnail.webp",
      width: 130,
      height: 87,
      scale: 1,
      altTR: "Alchemia Ocak 2025 bilim ve akademik içerik temalı dergi kapak tasarımı ve fiziksel dergi sunumu.",
      altEN: "January 2025 Alchemia magazine cover design and physical presentation featuring a science and academic theme."
    },
    thumbnail: "/projects/alchemia-ocak-2025-dergi-tasarimi/thumbnail.webp",
    cover: "/projects/alchemia-ocak-2025-dergi-tasarimi/cover.webp",
    initials: "AL",
    servicesTR: [
      "Dergi Tasarımı",
      "Editoryal Tasarım",
      "Kapak Tasarımı",
      "İç Sayfa Tasarımı",
      "Mizanpaj",
      "Tipografi",
      "Grafik Tasarım"
    ],
    servicesEN: [
      "Magazine Design",
      "Editorial Design",
      "Cover Design",
      "Interior Page Design",
      "Editorial Layout",
      "Typography",
      "Graphic Design"
    ],
    services: [
      "Magazine Design",
      "Editorial Design",
      "Cover Design",
      "Interior Page Design",
      "Editorial Layout",
      "Typography",
      "Graphic Design"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/alchemia-ocak-2025-dergi-tasarimi/media/01-alchemia-ocak-2025-cover.webp",
        altTR: "Alchemia Ocak 2025 bilim ve akademik içerik temalı dergi kapak tasarımı ve fiziksel dergi sunumu.",
        altEN: "January 2025 Alchemia magazine cover design and physical presentation featuring a science and academic theme.",
        captionTR: "Alchemia Ocak 2025 sayısı kapak tasarımı ve dergi sunumu",
        captionEN: "Cover design and magazine presentation for the January 2025 issue of Alchemia",
        layout: "full",
        width: 1024,
        height: 682
      }
    ],
    summaryTR: "Alchemia Ocak 2025 sayısı için kapak ve iç sayfa düzenlerini kapsayan modern bir dergi tasarımı hazırlandı. Bilim, kültür ve akademik içeriklerin daha düzenli, okunabilir ve görsel olarak güçlü biçimde sunulabilmesi için editoryal hiyerarşi, tipografi ve görsel kompozisyon bütüncül bir yayın dili içerisinde kurgulandı.",
    summaryEN: "A modern magazine design was created for the January 2025 issue of Alchemia, covering both the cover and interior page layouts. Editorial hierarchy, typography, and visual composition were structured as a cohesive publication system to present scientific, cultural, and academic content in a clear, readable, and visually engaging way.",
    descriptionTR: "Alchemia Ocak 2025 sayısı için kapak ve iç sayfa düzenlerini kapsayan modern bir dergi tasarımı hazırlandı. Bilim, kültür ve akademik içeriklerin daha düzenli, okunabilir ve görsel olarak güçlü biçimde sunulabilmesi için editoryal hiyerarşi, tipografi ve görsel kompozisyon bütüncül bir yayın dili içerisinde kurgulandı.",
    descriptionEN: "A modern magazine design was created for the January 2025 issue of Alchemia, covering both the cover and interior page layouts. Editorial hierarchy, typography, and visual composition were structured as a cohesive publication system to present scientific, cultural, and academic content in a clear, readable, and visually engaging way.",
    challengeTR: "Alchemia’nın Ocak 2025 sayısında bilimsel, kültürel ve akademik içeriklerin farklı yoğunluk ve konu başlıklarına rağmen tek bir yayın kimliği içerisinde düzenli ve okunabilir biçimde sunulması gerekiyordu. Kapak tasarımının ilk bakışta dikkat çekmesi kadar iç sayfalarda uzun metinler, görseller ve farklı içerik türleri arasında güçlü bir editoryal hiyerarşi kurulması da projenin temel tasarım ihtiyacını oluşturdu.",
    challengeEN: "The January 2025 issue of Alchemia needed to present scientific, cultural, and academic content of varying density and subject matter within a consistent publication identity. The cover had to create a strong first impression while the interior pages required a clear editorial hierarchy capable of balancing long-form text, imagery, and different content types.",
    solutionTR: "Derginin kapak tasarımı, iç sayfa yerleşimleri, tipografi sistemi ve görsel hiyerarşisi editoryal bütünlük sağlayacak şekilde geliştirildi. Ocak sayısının bilim ve teknoloji odağını destekleyen güçlü kapak kompozisyonu oluşturulurken içerik alanlarında başlık, metin ve görsel ilişkileri okunabilirliği artıracak biçimde düzenlendi. Böylece farklı içerik türlerinin aynı yayın kimliği altında tutarlı ve profesyonel görünmesi sağlandı.",
    solutionEN: "The cover design, interior page layouts, typography system, and visual hierarchy were developed to create a consistent editorial structure. A strong cover composition was created to support the issue’s science and technology focus, while relationships between headlines, body text, and imagery were organized to improve readability throughout the publication. This allowed different types of content to remain visually consistent within the same magazine identity.",
    resultTR: "Alchemia Ocak 2025 sayısı için profesyonel, düzenli ve görsel etkisi yüksek bir yayın tasarımı ortaya çıkarıldı. Oluşturulan editoryal sistem içeriklerin daha güçlü bir hiyerarşiyle sunulmasını sağlarken derginin bilim, kültür ve akademik yayın kimliğini görsel olarak daha bütünlüklü hale getirdi.",
    resultEN: "The January 2025 issue of Alchemia received a professional, structured, and visually engaging publication design. The resulting editorial system strengthened content hierarchy while creating a more cohesive visual expression of the magazine’s scientific, cultural, and academic identity.",
    seo: {
      titleTR: "Alchemia Ocak 2025 Dergi Tasarımı — Kerem Mıhçı",
      titleEN: "Alchemia January 2025 Magazine Design — Kerem Mıhçı",
      descriptionTR: "Alchemia Ocak 2025 sayısı için editoryal dergi tasarımı, kapak tasarımı ve yayın hiyerarşisi vaka çalışması.",
      descriptionEN: "Case study of the editorial magazine design, cover design, and publication layout for Alchemia January 2025 issue.",
      ogImage: "/projects/alchemia-ocak-2025-dergi-tasarimi/cover.webp"
    }
  },

  {
    id: "alchemia-aralik-2024-dergi-tasarimi",
    slug: "alchemia-aralik-2024-dergi-tasarimi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "graphic-design"
    ],
    titleTR: "Alchemia Aralık 2024 Dergi Tasarımı",
    titleEN: "Alchemia December 2024 Magazine Design",
    desktopLabelTR: "Alchemia Aralık",
    desktopLabelEN: "Alchemia Dec",
    client: "Alchemia",
    categoryTR: "Grafik Tasarım > Editoryal Tasarım",
    categoryEN: "Graphic Design > Editorial Design",
    projectTypeTR: "Editoryal Tasarım & Dergi Tasarımı",
    projectTypeEN: "Editorial Design & Magazine Design",
    year: "2024",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 26,
    roleTR: "Editoryal Tasarım & Grafik Tasarım",
    roleEN: "Editorial Design & Graphic Design",
    desktopIcon: "/projects/alchemia-aralik-2024-dergi-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/alchemia-aralik-2024-dergi-tasarimi/thumbnail.webp",
      width: 130,
      height: 87,
      scale: 1,
      altTR: "Alchemia Aralık 2024 bilim, kültür ve akademik içerik temalı dergi kapak tasarımı ve fiziksel dergi sunumu.",
      altEN: "December 2024 Alchemia magazine cover design and physical presentation featuring scientific, cultural, and academic content."
    },
    thumbnail: "/projects/alchemia-aralik-2024-dergi-tasarimi/thumbnail.webp",
    cover: "/projects/alchemia-aralik-2024-dergi-tasarimi/cover.webp",
    initials: "AL",
    servicesTR: [
      "Dergi Tasarımı",
      "Editoryal Tasarım",
      "Kapak Tasarımı",
      "İç Sayfa Tasarımı",
      "Mizanpaj",
      "Tipografi",
      "Grafik Tasarım"
    ],
    servicesEN: [
      "Magazine Design",
      "Editorial Design",
      "Cover Design",
      "Interior Page Design",
      "Editorial Layout",
      "Typography",
      "Graphic Design"
    ],
    services: [
      "Magazine Design",
      "Editorial Design",
      "Cover Design",
      "Interior Page Design",
      "Editorial Layout",
      "Typography",
      "Graphic Design"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/alchemia-aralik-2024-dergi-tasarimi/media/01-alchemia-aralik-2024-cover.webp",
        altTR: "Alchemia Aralık 2024 bilim, kültür ve akademik içerik temalı dergi kapak tasarımı ve fiziksel dergi sunumu.",
        altEN: "December 2024 Alchemia magazine cover design and physical presentation featuring scientific, cultural, and academic content.",
        captionTR: "Alchemia Aralık 2024 sayısı kapak tasarımı ve dergi sunumu",
        captionEN: "Cover design and magazine presentation for the December 2024 issue of Alchemia",
        layout: "full",
        width: 1024,
        height: 682
      }
    ],
    summaryTR: "Alchemia Aralık 2024 sayısı için kapak ve iç sayfa düzenlerini kapsayan profesyonel bir dergi tasarımı hazırlandı. Bilim, kültür ve akademik içeriklerin modern bir editoryal sistem içerisinde düzenli, okunabilir ve görsel olarak etkileyici biçimde sunulabilmesi için tipografi, sayfa yerleşimi ve görsel hiyerarşi bütüncül bir yayın diliyle kurgulandı.",
    summaryEN: "A professional magazine design was created for the December 2024 issue of Alchemia, covering both the cover and interior page layouts. Typography, page composition, and visual hierarchy were developed as a cohesive editorial system to present scientific, cultural, and academic content in a clear, readable, and visually engaging publication format.",
    descriptionTR: "Alchemia Aralık 2024 sayısı için kapak ve iç sayfa düzenlerini kapsayan profesyonel bir dergi tasarımı hazırlandı. Bilim, kültür ve akademik içeriklerin modern bir editoryal sistem içerisinde düzenli, okunabilir ve görsel olarak etkileyici biçimde sunulabilmesi için tipografi, sayfa yerleşimi ve görsel hiyerarşi bütüncül bir yayın diliyle kurgulandı.",
    descriptionEN: "A professional magazine design was created for the December 2024 issue of Alchemia, covering both the cover and interior page layouts. Typography, page composition, and visual hierarchy were developed as a cohesive editorial system to present scientific, cultural, and academic content in a clear, readable, and visually engaging publication format.",
    challengeTR: "Alchemia’nın Aralık 2024 sayısında bilim, kültür ve akademik içeriklerin farklı konu ve metin yoğunluklarına rağmen ortak bir yayın kimliği içerisinde sunulması gerekiyordu. Kapakta güçlü bir ilk izlenim oluşturulurken iç sayfalarda uzun metinler, başlıklar, görseller ve farklı içerik türleri arasında okunabilirliği koruyan profesyonel bir editoryal hiyerarşi kurulması projenin temel tasarım ihtiyacını oluşturdu.",
    challengeEN: "The December 2024 issue of Alchemia needed to present scientific, cultural, and academic content with varying topics and levels of text density within one consistent publication identity. The cover required a strong first impression, while the interior pages needed a professional editorial hierarchy capable of balancing long-form text, headlines, imagery, and multiple content types without sacrificing readability.",
    solutionTR: "Derginin kapak tasarımı, iç sayfa düzenleri, tipografi yapısı ve görsel hiyerarşisi editoryal bütünlük sağlayacak şekilde geliştirildi. Aralık sayısında yer alan bilimsel ve kültürel içerikler için başlık, metin ve görseller arasında net bir hiyerarşi oluşturulurken kapakta dikkat çekici görsel kompozisyon ve güçlü yayın tipografisi kullanıldı. Böylece farklı içeriklerin aynı dergi kimliği içerisinde tutarlı ve profesyonel görünmesi sağlandı.",
    solutionEN: "The magazine cover, interior page layouts, typography system, and visual hierarchy were developed to establish editorial consistency throughout the issue. Clear relationships between headlines, body copy, and imagery were created for the scientific and cultural content, while the cover used a distinctive visual composition and strong publication typography. This allowed different types of content to remain coherent within the same magazine identity.",
    resultTR: "Alchemia Aralık 2024 sayısı için profesyonel, düzenli ve görsel kalitesi yüksek bir yayın tasarımı ortaya çıkarıldı. Geliştirilen editoryal sistem içeriklerin daha etkili ve okunabilir biçimde sunulmasını sağlarken derginin bilim, kültür ve akademik yayın kimliğini daha güçlü ve tutarlı bir görsel yapıya taşıdı.",
    resultEN: "The December 2024 issue of Alchemia received a professional, structured, and visually refined publication design. The resulting editorial system improved the presentation and readability of the content while giving the magazine’s scientific, cultural, and academic identity a stronger and more consistent visual structure.",
    seo: {
      titleTR: "Alchemia Aralık 2024 Dergi Tasarımı — Kerem Mıhçı",
      titleEN: "Alchemia December 2024 Magazine Design — Kerem Mıhçı",
      descriptionTR: "Alchemia Aralık 2024 sayısı için editoryal dergi tasarımı, kapak tasarımı ve yayın hiyerarşisi vaka çalışması.",
      descriptionEN: "Case study of the editorial magazine design, cover design, and publication layout for Alchemia December 2024 issue.",
      ogImage: "/projects/alchemia-aralik-2024-dergi-tasarimi/cover.webp"
    }
  },

  {
    id: "alchemia-kasim-2024-dergi-tasarimi",
    slug: "alchemia-kasim-2024-dergi-tasarimi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "graphic-design"
    ],
    titleTR: "Alchemia Kasım 2024 Dergi Tasarımı",
    titleEN: "Alchemia November 2024 Magazine Design",
    desktopLabelTR: "Alchemia Kasım",
    desktopLabelEN: "Alchemia Nov",
    client: "Alchemia",
    categoryTR: "Grafik Tasarım > Editoryal Tasarım",
    categoryEN: "Graphic Design > Editorial Design",
    projectTypeTR: "Editoryal Tasarım & Dergi Tasarımı",
    projectTypeEN: "Editorial Design & Magazine Design",
    year: "2024",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 27,
    roleTR: "Editoryal Tasarım & Grafik Tasarım",
    roleEN: "Editorial Design & Graphic Design",
    desktopIcon: "/projects/alchemia-kasim-2024-dergi-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/alchemia-kasim-2024-dergi-tasarimi/thumbnail.webp",
      width: 130,
      height: 87,
      scale: 1,
      altTR: "Alchemia Kasım 2024 sayısında koku ve parfüm tarihini konu alan iki sayfalık editoryal dergi tasarımı.",
      altEN: "Two-page editorial spread from the November 2024 issue of Alchemia exploring the history of scent and perfume."
    },
    thumbnail: "/projects/alchemia-kasim-2024-dergi-tasarimi/thumbnail.webp",
    cover: "/projects/alchemia-kasim-2024-dergi-tasarimi/cover.webp",
    initials: "AL",
    servicesTR: [
      "Dergi Tasarımı",
      "Editoryal Tasarım",
      "Kapak Tasarımı",
      "İç Sayfa Tasarımı",
      "Mizanpaj",
      "Tipografi",
      "Görsel Hikâye Anlatımı",
      "Grafik Tasarım"
    ],
    servicesEN: [
      "Magazine Design",
      "Editorial Design",
      "Cover Design",
      "Interior Page Design",
      "Editorial Layout",
      "Typography",
      "Visual Storytelling",
      "Graphic Design"
    ],
    services: [
      "Magazine Design",
      "Editorial Design",
      "Cover Design",
      "Interior Page Design",
      "Editorial Layout",
      "Typography",
      "Visual Storytelling",
      "Graphic Design"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/alchemia-kasim-2024-dergi-tasarimi/media/01-alchemia-kasim-2024-editorial-spread.webp",
        altTR: "Alchemia Kasım 2024 sayısında koku ve parfüm tarihini konu alan iki sayfalık editoryal dergi tasarımı.",
        altEN: "Two-page editorial spread from the November 2024 issue of Alchemia exploring the history of scent and perfume.",
        captionTR: "Alchemia Kasım 2024 sayısı “Koku ve Parfümün Ortaya Çıkışı” iç sayfa tasarımı",
        captionEN: "“Origins of Scent and Perfume” interior spread from the November 2024 issue of Alchemia",
        layout: "full",
        width: 1024,
        height: 682
      }
    ],
    summaryTR: "Alchemia Kasım 2024 sayısı için kapak ve iç sayfa düzenlerini kapsayan yaratıcı bir dergi tasarımı hazırlandı. Bilim, kültür ve akademik içerikler; görsel hikâye anlatımı, güçlü editoryal hiyerarşi, tipografi ve sayfa kompozisyonu aracılığıyla bütünlüklü ve profesyonel bir yayın dili içerisinde sunuldu.",
    summaryEN: "A creative magazine design was developed for the November 2024 issue of Alchemia, covering both the cover and interior page layouts. Scientific, cultural, and academic content was presented through visual storytelling, strong editorial hierarchy, typography, and page composition within a cohesive and professional publication language.",
    descriptionTR: "Alchemia Kasım 2024 sayısı için kapak ve iç sayfa düzenlerini kapsayan yaratıcı bir dergi tasarımı hazırlandı. Bilim, kültür ve akademik içerikler; görsel hikâye anlatımı, güçlü editoryal hiyerarşi, tipografi ve sayfa kompozisyonu aracılığıyla bütünlüklü ve profesyonel bir yayın dili içerisinde sunuldu.",
    descriptionEN: "A creative magazine design was developed for the November 2024 issue of Alchemia, covering both the cover and interior page layouts. Scientific, cultural, and academic content was presented through visual storytelling, strong editorial hierarchy, typography, and page composition within a cohesive and professional publication language.",
    challengeTR: "Alchemia’nın Kasım 2024 sayısında bilimsel, kültürel ve akademik içeriklerin yalnızca okunabilir değil, aynı zamanda görsel olarak güçlü ve hikâye anlatımı yüksek bir yayın formatında sunulması gerekiyordu. Farklı konu başlıkları, uzun metinler ve yoğun görsel içerikler arasında tutarlı bir editoryal sistem kurulması; derginin yaratıcı kimliğini korurken akademik yayın niteliğinin de desteklenmesi projenin temel tasarım ihtiyacını oluşturdu.",
    challengeEN: "The November 2024 issue of Alchemia needed to present scientific, cultural, and academic content in a publication format that was not only readable but also visually compelling and rich in storytelling. A consistent editorial system was required to balance different topics, long-form text, and visually dense content while preserving the magazine’s creative identity and academic character.",
    solutionTR: "Derginin kapak tasarımı, iç sayfa düzenleri, tipografi sistemi ve görsel hiyerarşisi bütüncül bir editoryal anlayışla geliştirildi. İçeriklerin konusuna göre farklı görsel atmosferler kullanılırken sayfa yapısı ve tipografik düzen derginin genel kimliğini koruyacak şekilde tutarlı tutuldu. Görsel hikâye anlatımı, büyük sahne kompozisyonları ve içerikle ilişkili grafik öğeler kullanılarak akademik konular daha dikkat çekici ve akıcı bir yayın deneyimine dönüştürüldü.",
    solutionEN: "The cover, interior page layouts, typography system, and visual hierarchy were developed through a cohesive editorial approach. Different visual atmospheres were used to support individual topics, while page structure and typography remained consistent with the magazine’s overall identity. Visual storytelling, large-scale compositions, and topic-related graphic elements transformed academic subjects into a more engaging and fluid publication experience.",
    resultTR: "Alchemia Kasım 2024 sayısı için profesyonel, dikkat çekici ve görsel hikâye anlatımı güçlü bir dergi tasarımı ortaya çıkarıldı. Geliştirilen editoryal sistem içeriklerin daha etkili sunulmasını sağlarken derginin bilim, kültür ve akademik yayın kimliğini yaratıcı ve bütünlüklü bir görsel yapıyla güçlendirdi.",
    resultEN: "The November 2024 issue of Alchemia received a professional and visually distinctive magazine design with a strong emphasis on visual storytelling. The resulting editorial system improved the presentation of the content while strengthening the publication’s scientific, cultural, and academic identity through a creative and cohesive visual structure.",
    seo: {
      titleTR: "Alchemia Kasım 2024 Dergi Tasarımı — Kerem Mıhçı",
      titleEN: "Alchemia November 2024 Magazine Design — Kerem Mıhçı",
      descriptionTR: "Alchemia Kasım 2024 sayısı için editoryal dergi tasarımı, görsel hikâye anlatımı ve iç sayfa mizanpajı vaka çalışması.",
      descriptionEN: "Case study of the editorial magazine design, visual storytelling, and interior page layout for Alchemia November 2024 issue.",
      ogImage: "/projects/alchemia-kasim-2024-dergi-tasarimi/cover.webp"
    }
  },

  {
    id: "alchemia-nisan-2025-dergi-tasarimi",
    slug: "alchemia-nisan-2025-dergi-tasarimi",
    workspace: "design",
    workspaceId: "design",
    categoryIds: [
      "graphic-design"
    ],
    titleTR: "Alchemia Nisan 2025 Dergi Tasarımı",
    titleEN: "Alchemia April 2025 Magazine Design",
    desktopLabelTR: "Alchemia Nisan",
    desktopLabelEN: "Alchemia Apr",
    client: "Alchemia",
    categoryTR: "Grafik Tasarım > Editoryal Tasarım",
    categoryEN: "Graphic Design > Editorial Design",
    projectTypeTR: "Editoryal Tasarım & Dergi Tasarımı",
    projectTypeEN: "Editorial Design & Magazine Design",
    year: "2025",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 28,
    roleTR: "Editoryal Tasarım & Grafik Tasarım",
    roleEN: "Editorial Design & Graphic Design",
    desktopIcon: "/projects/alchemia-nisan-2025-dergi-tasarimi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/alchemia-nisan-2025-dergi-tasarimi/thumbnail.webp",
      width: 130,
      height: 83,
      scale: 1,
      altTR: "Alchemia Nisan 2025 bilim, teknoloji ve akademik içerik temalı yeşil dergi kapak tasarımı ve fiziksel dergi sunumu.",
      altEN: "April 2025 Alchemia magazine cover design and physical presentation featuring a green science, technology, and academic theme."
    },
    thumbnail: "/projects/alchemia-nisan-2025-dergi-tasarimi/thumbnail.webp",
    cover: "/projects/alchemia-nisan-2025-dergi-tasarimi/cover.webp",
    initials: "AL",
    servicesTR: [
      "Dergi Tasarımı",
      "Editoryal Tasarım",
      "Kapak Tasarımı",
      "İç Sayfa Tasarımı",
      "Mizanpaj",
      "Tipografi",
      "Grafik Tasarım"
    ],
    servicesEN: [
      "Magazine Design",
      "Editorial Design",
      "Cover Design",
      "Interior Page Design",
      "Editorial Layout",
      "Typography",
      "Graphic Design"
    ],
    services: [
      "Magazine Design",
      "Editorial Design",
      "Cover Design",
      "Interior Page Design",
      "Editorial Layout",
      "Typography",
      "Graphic Design"
    ],
    tools: [],
    externalLinks: [],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/alchemia-nisan-2025-dergi-tasarimi/media/01-alchemia-nisan-2025-cover.webp",
        altTR: "Alchemia Nisan 2025 bilim, teknoloji ve akademik içerik temalı yeşil dergi kapak tasarımı ve fiziksel dergi sunumu.",
        altEN: "April 2025 Alchemia magazine cover design and physical presentation featuring a green science, technology, and academic theme.",
        captionTR: "Alchemia Nisan 2025 sayısı kapak tasarımı ve dergi sunumu",
        captionEN: "Cover design and magazine presentation for the April 2025 issue of Alchemia",
        layout: "full",
        width: 1024,
        height: 650
      }
    ],
    summaryTR: "Alchemia Nisan 2025 sayısı için kapak ve iç sayfa düzenlerini kapsayan profesyonel bir dergi tasarımı hazırlandı. Bilim, teknoloji, kültür ve akademik içeriklerin modern bir editoryal sistem içerisinde düzenli, okunabilir ve görsel olarak etkileyici biçimde sunulabilmesi için tipografi, sayfa kompozisyonu ve görsel hiyerarşi bütüncül bir yayın diliyle kurgulandı.",
    summaryEN: "A professional magazine design was created for the April 2025 issue of Alchemia, covering both the cover and interior page layouts. Typography, page composition, and visual hierarchy were developed as a cohesive editorial system to present scientific, technological, cultural, and academic content in a clear, readable, and visually engaging publication format.",
    descriptionTR: "Alchemia Nisan 2025 sayısı için kapak ve iç sayfa düzenlerini kapsayan profesyonel bir dergi tasarımı hazırlandı. Bilim, teknoloji, kültür ve akademik içeriklerin modern bir editoryal sistem içerisinde düzenli, okunabilir ve görsel olarak etkileyici biçimde sunulabilmesi için tipografi, sayfa kompozisyonu ve görsel hiyerarşi bütüncül bir yayın diliyle kurgulandı.",
    descriptionEN: "A professional magazine design was created for the April 2025 issue of Alchemia, covering both the cover and interior page layouts. Typography, page composition, and visual hierarchy were developed as a cohesive editorial system to present scientific, technological, cultural, and academic content in a clear, readable, and visually engaging publication format.",
    challengeTR: "Alchemia’nın Nisan 2025 sayısında bilim, teknoloji ve akademik içeriklerin farklı konu ve yoğunluklarına rağmen ortak bir yayın kimliği içerisinde sunulması gerekiyordu. Kapak tasarımının ilk bakışta dikkat çekmesi, iç sayfalarda ise uzun metinler, görseller ve farklı içerik tipleri arasında okunabilirliği koruyan güçlü bir editoryal hiyerarşi kurulması projenin temel tasarım ihtiyacını oluşturdu.",
    challengeEN: "The April 2025 issue of Alchemia needed to present scientific, technological, and academic content with varying topics and levels of complexity within one consistent publication identity. The cover needed to create a strong first impression, while the interior pages required a clear editorial hierarchy capable of balancing long-form text, imagery, and different content types without sacrificing readability.",
    solutionTR: "Derginin kapak tasarımı, iç sayfa düzenleri, tipografi sistemi ve görsel hiyerarşisi editoryal bütünlük sağlayacak şekilde geliştirildi. Nisan sayısının bilim, teknoloji ve doğa eksenli görsel atmosferini desteklemek için yeşil tonlar, laboratuvar ve araştırma çağrışımları taşıyan görsel öğeler ile güçlü yayın tipografisi bir araya getirildi. İçerik alanlarında başlık, metin ve görsel ilişkileri okunabilirliği artıracak şekilde düzenlenerek farklı içerik türlerinin aynı yayın kimliği içerisinde tutarlı görünmesi sağlandı.",
    solutionEN: "The cover design, interior page layouts, typography system, and visual hierarchy were developed to establish editorial consistency throughout the issue. Green tones, laboratory and research-inspired visual elements, and strong publication typography were combined to support the April issue’s science, technology, and nature-oriented atmosphere. Relationships between headlines, body text, and imagery were structured to improve readability while keeping different content types visually consistent within the same publication identity.",
    resultTR: "Alchemia Nisan 2025 sayısı için profesyonel, düzenli ve görsel kalitesi yüksek bir yayın tasarımı ortaya çıkarıldı. Geliştirilen editoryal sistem içeriklerin daha etkili ve okunabilir biçimde sunulmasını sağlarken derginin bilim, teknoloji, kültür ve akademik yayın kimliğini daha güçlü ve bütünlüklü bir görsel yapıya taşıdı.",
    resultEN: "The April 2025 issue of Alchemia received a professional, structured, and visually refined publication design. The resulting editorial system improved the presentation and readability of the content while giving the magazine’s scientific, technological, cultural, and academic identity a stronger and more cohesive visual structure.",
    seo: {
      titleTR: "Alchemia Nisan 2025 Dergi Tasarımı — Kerem Mıhçı",
      titleEN: "Alchemia April 2025 Magazine Design — Kerem Mıhçı",
      descriptionTR: "Alchemia Nisan 2025 sayısı için editoryal dergi tasarımı, kapak tasarımı ve yayın hiyerarşisi vaka çalışması.",
      descriptionEN: "Case study of the editorial magazine design, cover design, and publication layout for Alchemia April 2025 issue.",
      ogImage: "/projects/alchemia-nisan-2025-dergi-tasarimi/cover.webp"
    }
  },

  {
    id: "planfiq-website-web-uygulamasi",
    slug: "planfiq-website-web-uygulamasi",
    workspace: "web",
    workspaceId: "web",
    categoryIds: [
      "website"
    ],
    titleTR: "PlanFIQ Website & Web Uygulaması",
    titleEN: "PlanFIQ Website & Web Application",
    desktopLabelTR: "PLANFIQ",
    desktopLabelEN: "PLANFIQ",
    client: "PlanFIQ",
    categoryTR: "Web Tasarım & Web Uygulaması",
    categoryEN: "Web Design & Web Application",
    projectTypeTR: "Website & Web Uygulaması",
    projectTypeEN: "Website & Web Application",
    year: "2026",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 29,
    roleTR: "Web Tasarım, UI/UX & Geliştirme",
    roleEN: "Web Design, UI/UX & Development",
    desktopIcon: "/projects/planfiq-website-web-uygulamasi/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/planfiq-website-web-uygulamasi/thumbnail.webp",
      width: 130,
      height: 81,
      scale: 1,
      altTR: "PlanFIQ web uygulaması kontrol paneli; alışkanlık, hedef, planlama ve kullanıcı istatistiklerini gösteren dashboard arayüzü.",
      altEN: "PlanFIQ web application control panel showing habits, goals, planning actions, and user statistics."
    },
    thumbnail: "/projects/planfiq-website-web-uygulamasi/thumbnail.webp",
    cover: "/projects/planfiq-website-web-uygulamasi/cover.webp",
    initials: "PF",
    servicesTR: [
      "Website Tasarımı",
      "Web Uygulaması",
      "UI/UX Tasarımı",
      "Dashboard Tasarımı",
      "Frontend Geliştirme",
      "Web Geliştirme",
      "Responsive Tasarım",
      "Ürün Arayüzü Tasarımı"
    ],
    servicesEN: [
      "Website Design",
      "Web Application",
      "UI/UX Design",
      "Dashboard Design",
      "Frontend Development",
      "Web Development",
      "Responsive Design",
      "Product Interface Design"
    ],
    services: [
      "Website Design",
      "Web Application",
      "UI/UX Design",
      "Dashboard Design",
      "Frontend Development",
      "Web Development",
      "Responsive Design",
      "Product Interface Design"
    ],
    tools: [],
    externalLinks: [
      {
        id: "live-site",
        type: "live",
        labelTR: "Siteyi Canlı Gör",
        labelEN: "View Live Site",
        href: "https://planfiq.com"
      }
    ],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/planfiq-website-web-uygulamasi/media/01-planfiq-control-panel.webp",
        altTR: "PlanFIQ web uygulaması kontrol paneli; alışkanlık, hedef, planlama ve kullanıcı istatistiklerini gösteren dashboard arayüzü.",
        altEN: "PlanFIQ web application control panel showing habits, goals, planning actions, and user statistics.",
        captionTR: "PlanFIQ kontrol paneli ve günlük kullanıcı özeti",
        captionEN: "PlanFIQ control panel and daily user overview",
        layout: "full",
        width: 1024,
        height: 639
      },
      {
        id: "media-2",
        type: "image",
        src: "/projects/planfiq-website-web-uygulamasi/media/02-planfiq-finans.webp",
        altTR: "PlanFIQ web uygulamasında gelir, gider, bütçe, abonelik ve borç yönetimini gösteren finans paneli.",
        altEN: "PlanFIQ finance dashboard for managing income, expenses, budgets, subscriptions, and debt.",
        captionTR: "PlanFIQ finans yönetimi modülü",
        captionEN: "PlanFIQ finance management module",
        layout: "full",
        width: 1024,
        height: 639
      }
    ],
    summaryTR: "PlanFIQ için kişisel planlama, alışkanlık takibi, hedef yönetimi ve finans süreçlerini tek bir dijital platformda bir araya getiren kapsamlı bir website ve web uygulaması tasarlanıp geliştirildi. Kontrol paneli, finans yönetimi, planlayıcı, takvim, raporlama ve kullanıcı istatistikleri gibi modüller; sade, modern ve veri odaklı bir arayüz sistemi içerisinde kurgulandı.",
    summaryEN: "A comprehensive website and web application was designed and developed for PlanFIQ, bringing personal planning, habit tracking, goal management, and financial management together within a single digital platform. Modules including the main dashboard, finance management, planner, calendar, reporting, and user statistics were structured within a clean, modern, and data-oriented interface system.",
    descriptionTR: "PlanFIQ için kişisel planlama, alışkanlık takibi, hedef yönetimi ve finans süreçlerini tek bir dijital platformda bir araya getiren kapsamlı bir website ve web uygulaması tasarlanıp geliştirildi. Kontrol paneli, finans yönetimi, planlayıcı, takvim, raporlama ve kullanıcı istatistikleri gibi modüller; sade, modern ve veri odaklı bir arayüz sistemi içerisinde kurgulandı.",
    descriptionEN: "A comprehensive website and web application was designed and developed for PlanFIQ, bringing personal planning, habit tracking, goal management, and financial management together within a single digital platform. Modules including the main dashboard, finance management, planner, calendar, reporting, and user statistics were structured within a clean, modern, and data-oriented interface system.",
    challengeTR: "PlanFIQ’da alışkanlık, hedef, zaman planlama ve kişisel finans gibi birbirinden farklı veri yoğunluklarına sahip süreçlerin tek bir uygulama içerisinde kolay anlaşılır ve yönetilebilir biçimde bir araya getirilmesi gerekiyordu. Kullanıcının günlük işlemlerini hızlı şekilde gerçekleştirebilmesi, önemli verileri tek bakışta okuyabilmesi ve daha detaylı modüller arasında kaybolmadan ilerleyebilmesi projenin temel kullanıcı deneyimi gereksinimlerini oluşturdu.",
    challengeEN: "PlanFIQ needed to bring together multiple data-heavy processes—including habits, goals, personal planning, and finance—within a single application while keeping the experience clear and manageable. Users needed to perform daily actions quickly, understand important information at a glance, and navigate more detailed modules without becoming overwhelmed by the amount of data available.",
    solutionTR: "Uygulama için modüler ve tekrar kullanılabilir bir dashboard sistemi oluşturuldu. Sol navigasyon yapısı üzerinden ana ürün modüllerine hızlı erişim sağlanırken kontrol panelinde önemli kullanıcı verileri kart tabanlı bir hiyerarşiyle öne çıkarıldı. Finans modülünde gelir, gider, abonelik, bütçe ve borç yönetimi ayrı aksiyon ve sekme yapılarıyla düzenlendi. Turkuaz-yeşil marka rengi, açık yüzeyler, sade ikonografi ve kontrollü boşluk kullanımıyla hem veri yoğunluğunu dengeleyen hem de uzun süreli kullanımda rahat bir ürün arayüzü oluşturuldu.",
    solutionEN: "A modular and reusable dashboard system was created for the application. Primary product modules were made easily accessible through a persistent side navigation, while important user information was prioritized through a card-based hierarchy on the main dashboard. The finance module organized income, expenses, subscriptions, budgets, and debt management through dedicated actions and tab structures. A teal-green brand accent, light surfaces, restrained iconography, and controlled spacing created a product interface capable of handling dense information while remaining comfortable for long-term use.",
    resultTR: "PlanFIQ için farklı kişisel yönetim süreçlerini tek platformda bir araya getiren, modern ve ölçeklenebilir bir dijital ürün deneyimi oluşturuldu. Dashboard ve modüler uygulama yapısı sayesinde kullanıcıların günlük planlama, hedef, alışkanlık ve finans verilerine daha hızlı erişebilmesi sağlanırken ürünün yeni modüllerle genişletilebilmesine uygun tutarlı bir arayüz sistemi ortaya çıkarıldı.",
    resultEN: "PlanFIQ received a modern and scalable digital product experience that brings multiple personal-management processes together within one platform. The dashboard and modular application structure make daily planning, goals, habits, and financial information easier to access while providing a consistent interface system that can accommodate future product modules.",
    seo: {
      titleTR: "PlanFIQ Website & Web Uygulaması — Kerem Mıhçı",
      titleEN: "PlanFIQ Website & Web Application — Kerem Mıhçı",
      descriptionTR: "PlanFIQ için tasarlanıp geliştirilen kontrol paneli, finans yönetimi ve kişisel planlama web uygulaması vaka çalışması.",
      descriptionEN: "Case study of the dashboard UI, finance management, and personal planning web application designed and developed for PlanFIQ.",
      ogImage: "/projects/planfiq-website-web-uygulamasi/cover.webp"
    }
  },

  {
    id: "solo-leveling-manga-website",
    slug: "solo-leveling-manga-website",
    workspace: "web",
    workspaceId: "web",
    categoryIds: [
      "website"
    ],
    titleTR: "Solo Leveling Manga Website Tasarımı & Geliştirme",
    titleEN: "Solo Leveling Manga Website Design & Development",
    desktopLabelTR: "SOLO LEVELING",
    desktopLabelEN: "SOLO LEVELING",
    client: "Kişisel Proje",
    categoryTR: "Web Tasarım & Web Geliştirme",
    categoryEN: "Web Design & Web Development",
    projectTypeTR: "Kişisel Proje / Resmî Olmayan Fan Projesi",
    projectTypeEN: "Personal Project / Unofficial Fan Project",
    status: "completed",
    featured: false,
    desktop: {
      x: 50,
      y: 50
    },
    initialWindow: {
      width: 760,
      height: 600
    },
    desktopWeight: "normal",
    sortOrder: 30,
    roleTR: "Web Tasarım & Geliştirme",
    roleEN: "Web Design & Development",
    desktopIcon: "/projects/solo-leveling-manga-website/thumbnail.webp",
    desktopThumbnail: {
      src: "/projects/solo-leveling-manga-website/thumbnail.webp",
      width: 130,
      height: 81,
      scale: 1,
      altTR: "Solo Leveling manga bölümleri, duvar kâğıtları ve seri içeriklerini sunan koyu temalı fan website ana sayfası.",
      altEN: "Dark-themed unofficial Solo Leveling fan website homepage featuring manga chapters, wallpapers, and series content."
    },
    thumbnail: "/projects/solo-leveling-manga-website/thumbnail.webp",
    cover: "/projects/solo-leveling-manga-website/cover.webp",
    initials: "SL",
    servicesTR: [
      "Website Tasarımı",
      "Web Geliştirme",
      "UI/UX Tasarımı",
      "Responsive Tasarım",
      "İçerik Mimarisi",
      "Web Arayüz Tasarımı"
    ],
    servicesEN: [
      "Website Design",
      "Web Development",
      "UI/UX Design",
      "Responsive Design",
      "Content Architecture",
      "Web Interface Design"
    ],
    services: [
      "Website Design",
      "Web Development",
      "UI/UX Design",
      "Responsive Design",
      "Content Architecture",
      "Web Interface Design"
    ],
    tools: [],
    externalLinks: [
      {
        id: "live-site",
        type: "live",
        labelTR: "Siteyi Canlı Gör",
        labelEN: "View Live Site",
        href: "https://sololevelingmangafreeonline.com"
      }
    ],
    media: [
      {
        id: "media-1",
        type: "image",
        src: "/projects/solo-leveling-manga-website/media/01-solo-leveling-homepage.webp",
        altTR: "Solo Leveling manga bölümleri, duvar kâğıtları ve seri içeriklerini sunan koyu temalı fan website ana sayfası.",
        altEN: "Dark-themed unofficial Solo Leveling fan website homepage featuring manga chapters, wallpapers, and series content.",
        captionTR: "Solo Leveling manga ve içerik platformu ana sayfa tasarımı",
        captionEN: "Homepage design for the Solo Leveling manga and content platform",
        layout: "full",
        width: 1024,
        height: 639
      }
    ],
    summaryTR: "Solo Leveling evrenine yönelik hazırlanan bu kişisel fan projesinde manga bölümleri, duvar kâğıtları ve seri hakkında içerikleri tek bir dijital merkezde bir araya getiren kapsamlı bir website tasarlanıp geliştirildi. Koyu tema, güçlü görsel kullanım, içerik odaklı navigasyon ve dikkat çekici aksiyon alanlarıyla serinin atmosferine uyum sağlayan sürükleyici bir web deneyimi oluşturuldu.",
    summaryEN: "This personal fan project was designed and developed as a digital hub for the Solo Leveling universe, bringing manga chapters, wallpapers, and series-related content together within one website. A dark visual theme, strong imagery, content-focused navigation, and prominent calls to action create an immersive web experience aligned with the atmosphere of the series.",
    descriptionTR: "Solo Leveling evrenine yönelik hazırlanan bu kişisel fan projesinde manga bölümleri, duvar kâğıtları ve seri hakkında içerikleri tek bir dijital merkezde bir araya getiren kapsamlı bir website tasarlanıp geliştirildi. Koyu tema, güçlü görsel kullanım, içerik odaklı navigasyon ve dikkat çekici aksiyon alanlarıyla serinin atmosferine uyum sağlayan sürükleyici bir web deneyimi oluşturuldu.",
    descriptionEN: "This personal fan project was designed and developed as a digital hub for the Solo Leveling universe, bringing manga chapters, wallpapers, and series-related content together within one website. A dark visual theme, strong imagery, content-focused navigation, and prominent calls to action create an immersive web experience aligned with the atmosphere of the series.",
    challengeTR: "Solo Leveling gibi güçlü ve görsel kimliği belirgin bir içerik evrenini web ortamına taşırken çok sayıda manga bölümü ve farklı içerik türünün kullanıcıyı yormadan erişilebilir olması gerekiyordu. Tasarımın serinin karanlık ve yüksek kontrastlı atmosferini koruması, aynı zamanda bölüm keşfi, duvar kâğıtları ve bilgilendirici içerikler arasında net bir kullanıcı akışı oluşturması projenin temel deneyim ihtiyacını oluşturdu.",
    challengeEN: "Translating a visually distinctive universe such as Solo Leveling into a website required a structure capable of handling numerous manga chapters and different content types without overwhelming the visitor. The experience needed to preserve the series’ dark, high-contrast atmosphere while creating a clear flow between chapter discovery, wallpapers, and informational content.",
    solutionTR: "Website için koyu zemin, beyaz tipografi ve mor vurgu renginden oluşan güçlü bir görsel sistem oluşturuldu. Ana sayfada manga bölümleri ve duvar kâğıtları temel keşif aksiyonları olarak öne çıkarılırken büyük hero alanı serinin atmosferini ilk ekranda hissettirecek biçimde kurgulandı. İçerik yapısı; bölüm keşfi, görsel içerikler ve seri hakkında bilgilendirici alanlar arasında sade ve anlaşılır bir navigasyon sağlayacak şekilde düzenlendi.",
    solutionEN: "A strong visual system based on dark surfaces, white typography, and purple accents was created for the website. Manga chapters and wallpapers were positioned as the primary discovery actions on the homepage, while the large hero section was structured to communicate the atmosphere of the series immediately. The content architecture provides clear navigation between chapter discovery, visual content, and informational sections about the series.",
    resultTR: "Solo Leveling içeriklerini tek merkezde sunan, serinin görsel atmosferiyle uyumlu ve içerik keşfini kolaylaştıran kapsamlı bir fan website deneyimi oluşturuldu. Proje; yoğun içerik yapısını sade navigasyon, güçlü görsel hiyerarşi ve responsive web yaklaşımıyla bir araya getirerek farklı ekranlarda kullanılabilir bir dijital içerik platformuna dönüştürüldü. (Kişisel ve resmî olmayan fan projesidir. Solo Leveling markası ve ilgili görsel içeriklerin hakları kendi hak sahiplerine aittir.)",
    resultEN: "A comprehensive fan website experience was created to bring Solo Leveling content together within a single destination while maintaining the visual atmosphere of the series and simplifying content discovery. The project combines a content-heavy structure with clear navigation, strong visual hierarchy, and responsive web principles to create a usable digital content platform across different screen sizes. (Personal and unofficial fan project. Solo Leveling and related visual properties belong to their respective rights holders.)",
    seo: {
      titleTR: "Solo Leveling Manga Website Tasarımı & Geliştirme — Kerem Mıhçı",
      titleEN: "Solo Leveling Manga Website Design & Development — Kerem Mıhçı",
      descriptionTR: "Solo Leveling evrenine yönelik hazırlanan kişisel ve resmî olmayan manga ve içerik platformu website vaka çalışması.",
      descriptionEN: "Case study of the unofficial Solo Leveling fan website project featuring manga chapters, wallpapers, and series content.",
      ogImage: "/projects/solo-leveling-manga-website/cover.webp"
    }
  }
];

export const projectsItemsByWorkspace = {
  design: projectsData.filter((p) => (p.workspaceId || p.workspace) === "design"),
  web: projectsData.filter((p) => (p.workspaceId || p.workspace) === "web"),
  "motion-ai": projectsData.filter((p) => (p.workspaceId || p.workspace) === "motion-ai")
};
