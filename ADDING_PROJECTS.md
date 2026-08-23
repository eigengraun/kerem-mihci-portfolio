# Developer Guide: Adding Portfolio Projects

This guide documents the single source of truth project data model, media asset structure, and spatial desktop placement system for the Portfolio OS. Follow these conventions to populate and expand your portfolio projects effortlessly.

---

## 1. Directory & Asset Conventions

Store project media in dedicated, slug-based folders inside `public/assets/projects/`:

```
public/
  assets/
    projects/
      [project-slug]/
        thumbnail.webp        (Desktop icon & list view preview: ~256x256 to 512x512)
        cover.webp            (Optional project detail cover/header visual: ~1200x800)
        media/
          01-overview.webp    (Sequential project detail media item)
          02-detail.webp
          03-packaging.webp
        videos/
          01-showreel.mp4     (Web-optimized MP4 video)
          01-poster.webp      (Video poster image for fast loading)
```

### File Naming Rules
- Use lower-case, hyphenated names (e.g. `01-overview.webp`, `cover.webp`).
- Avoid raw camera filenames like `IMG_9281.JPG`.
- Prefer `.webp` for images and `.mp4` (H.264 / AAC) for videos.

---

## 2. Project Data Model (`src/data/projects.ts`)

All projects live in `projectsData` inside [src/data/projects.ts](file:///Users/keremmihci/Documents/CreativePortfolio/src/data/projects.ts).

### Field Reference

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | **Yes** | Unique identifier (e.g., `"engin-perde"`) |
| `slug` | `string` | **Yes** | URL slug for deep links (e.g., `"engin-perde"`) |
| `workspace` / `workspaceId` | `"design" \| "web" \| "motion-ai"` | **Yes** | Active workspace assignment |
| `categoryIds` | `ProjectCategoryId[]` | **Yes** | Multi-category filters (e.g., `["website", "seo"]`) |
| `titleTR` / `titleEN` | `string` | **Yes** | Localized project title |
| `client` | `string` | **Yes** | Client or brand name |
| `year` | `string` | Optional | Release or project year (e.g. `"2025"` or `"2024–2025"`) |
| `status` | `"completed" \| "ongoing" \| "concept"` | Optional | Project status badge |
| `summaryTR` / `summaryEN` | `string` | Optional | 1-sentence concise summary block |
| `descriptionTR` / `descriptionEN` | `string` | Optional | Detailed project description |
| `roleTR` / `roleEN` | `string` | Optional | Specific responsibility (e.g., `"Design & Development"`) |
| `projectTypeTR` / `projectTypeEN` | `string` | Optional | Human-readable hierarchy (e.g., `"Web Design > E-Commerce"`) |
| `thumbnail` | `string` | Optional | Custom thumbnail image path |
| `cover` | `string` | Optional | Header visual path |
| `desktopIcon` | `string` | Optional | App icon asset for desktop canvas |
| `servicesTR` / `servicesEN` | `string[]` | Optional | Deliverable service chips |
| `tools` | `string[]` | Optional | Software & tech stack chips (e.g. `["Figma", "Next.js"]`) |
| `externalLinks` | `ProjectExternalLink[]` | Optional | External URLs (Live Site, GitHub, Instagram, etc.) |
| `media` | `ProjectMediaItem[]` | **Yes** | Sequential image & video array |
| `showOnDesktop` | `boolean` | Optional | Whether to display as a desktop file (defaults to `true`) |
| `desktopPlacement` | `{ x: number, y: number }` | Optional | Manual desktop placement override (0-100%) |
| `desktopClusterId` | `string` | Optional | Group ID to place related projects in loose proximity |
| `desktopWeight` | `"small" \| "normal" \| "large"` | Optional | Desktop icon visual scale weight |
| `initialWindow` | `{ width: number, height: number }` | **Yes** | Initial window dimensions |
| `featured` | `boolean` | **Yes** | Show in featured views |

---

## 3. Desktop Project Spatial Placement

Desktop project files use a **seeded deterministic placement engine** ([src/lib/desktopPlacement.ts](file:///Users/keremmihci/Documents/CreativePortfolio/src/lib/desktopPlacement.ts)).

### Key Behaviors
- **Organic & Irregular:** Projects avoid grid-like alignments to reflect an authentic creative workstation.
- **Deterministic & Jump-Free:** Position seed is calculated from `workspaceId:project.slug`. Positions remain 100% constant across refreshes, theme switches, TR/EN toggles, and window interactions. Adding a new project does NOT shift existing project positions.
- **Safe Zone Collision Protection:** Placement algorithm automatically protects interface regions:
  - Top-Right controls (TR/EN & theme toggle)
  - Left-Middle Workspace Selector
  - Bottom Dock & Dock hover expansion height
  - Bottom-Left controls
- **Clustering:** Projects sharing a `desktopClusterId` (e.g. `"alchemia-series"`) naturally group together with subtle visual thumbnail overlap allowed (labels remain 100% readable).
- **Manual Overrides:** Use `desktopPlacement: { x: 42.5, y: 26.8 }` to manually position a specific project if desired.

---

## 4. Project Configuration Examples

### Example A: Minimal Project
```typescript
{
  id: "minimal-identity",
  slug: "minimal-identity",
  workspace: "design",
  workspaceId: "design",
  categoryIds: ["brand-identity"],
  titleTR: "Minimal Kurumsal Kimlik",
  titleEN: "Minimal Brand Identity",
  client: "Studio Minimal",
  categoryTR: "Kurumsal Kimlik",
  categoryEN: "Brand Identity",
  year: "2025",
  desktopIcon: "/assets/icons/apps/figma.svg",
  initials: "SM",
  servicesTR: ["Logo Tasarımı", "Kurumsal Kimlik"],
  servicesEN: ["Logo Design", "Brand Identity"],
  media: [
    {
      id: "m-1",
      type: "image",
      src: "/assets/projects/minimal-identity/cover.webp",
      altTR: "Logo Sunum Görseli",
      altEN: "Logo Presentation Visual",
      layout: "full"
    }
  ],
  desktop: { x: 8, y: 12 },
  initialWindow: { width: 680, height: 580 },
  featured: true
}
```

### Example B: Website Project with Live URL & Cluster ID
```typescript
{
  id: "engin-perde",
  slug: "engin-perde",
  workspace: "web",
  workspaceId: "web",
  categoryIds: ["website", "seo"],
  titleTR: "Engin Perde — Kurumsal Web Sitesi & SEO",
  titleEN: "Engin Perde — Corporate Website & SEO",
  client: "Engin Perde Ev Tekstili",
  categoryTR: "Web Tasarım & SEO",
  categoryEN: "Web Design & SEO",
  projectTypeTR: "Web Tasarım > Kurumsal Site & SEO",
  projectTypeEN: "Web Design > Corporate Site & SEO",
  year: "2024",
  status: "completed",
  summaryTR: "Engin Perde için yüksek performanslı responsive kurumsal web sitesi.",
  summaryEN: "High-performance responsive corporate website for Engin Perde.",
  descriptionTR: "Mobil uyumluluk, SEO optimizasyonu ve dinamik ürün sergileme hedeflenmiştir.",
  descriptionEN: "Focused on mobile compatibility, SEO optimization, and dynamic product showcase.",
  roleTR: "UI/UX Tasarımı & Full-Stack Geliştirme",
  roleEN: "UI/UX Design & Full-Stack Development",
  desktopIcon: "/assets/icons/apps/wordpress.svg",
  thumbnail: "/assets/projects/engin-perde/thumbnail.webp",
  servicesTR: ["UI/UX Tasarımı", "Next.js Geliştirme", "Teknik SEO"],
  servicesEN: ["UI/UX Design", "Next.js Development", "Technical SEO"],
  tools: ["Figma", "Next.js", "WordPress", "Tailwind CSS"],
  externalLinks: [
    {
      id: "live-site",
      type: "live",
      labelTR: "Canlı Siteyi Gör",
      labelEN: "Visit Live Website",
      href: "https://enginperde.com"
    }
  ],
  media: [
    {
      id: "media-1",
      type: "image",
      src: "/assets/projects/engin-perde/desktop-mockup.webp",
      altTR: "Masaüstü Web Görünümü",
      altEN: "Desktop Web View",
      layout: "full"
    }
  ],
  desktopPlacement: { x: 24, y: 22 },
  initialWindow: { width: 740, height: 600 },
  featured: true
}
```

---

## 6. Automatic SEO, Sitemap & Social Metadata

Every project added to `projectsData` automatically receives complete SEO metadata, Open Graph social cards, Twitter cards, localized canonical URLs, and sitemap entries.

### Environment & Domain Setup
Set `NEXT_PUBLIC_SITE_URL` in `.env` (or environment settings):
```bash
NEXT_PUBLIC_SITE_URL=https://keremmihci.com
```

### Site Icons & Branding Locations
- **`src/app/favicon.ico`** (Browser tab icon)
- **`src/app/icon.png`** (App icon / PWA tile / 512x512)
- **`src/app/apple-icon.png`** (Apple iOS home screen touch icon / 180x180)
- **`public/branding/og-default.png`** (Global default social sharing card)

### Automatic SEO Fallback Hierarchy
1. **Title:** `{titleTR | titleEN} — Kerem Mıhçı`
2. **Description:** `summary` → `description` (truncated) → Generated client/category fallback
3. **OG Image:** `seo.ogImage` → `ogImage` → `cover` → `thumbnail` → `public/branding/og-default.png`
4. **Sitemap:** Automatically included at `/sitemap.xml` for both `/tr/project/[slug]` and `/en/project/[slug]` (for both `featured: true` and `featured: false` projects).

### Optional Custom SEO Overrides
For exceptional cases, add the optional `seo` property to your project object:

```typescript
seo: {
  titleTR: "Fling Arena Özel Logo & Tipografi Tasarımı",
  titleEN: "Fling Arena Custom Logo & Typography Design",
  descriptionTR: "Fling Arena projesine özel detaylı marka kimliği ve tipografi kılavuzu.",
  descriptionEN: "Custom brand identity and typography guide for Fling Arena.",
  ogImage: "/assets/projects/fling-arena/cover.webp"
}
```

---

## 7. Editing Profile, CV & Notes Content

All information rendered inside the global **Notlar / Notes** application (About, Experience, Education, Skills, CV links, Working Notes) is driven by a single data source:

**[src/data/profile.ts](file:///Users/keremmihci/Documents/CreativePortfolio/src/data/profile.ts)**

To update your CV, experience, or skills, modify `profileData` in `src/data/profile.ts`:

- **Headline & Bio:** Update `headlineTR`, `headlineEN`, `summaryTR`, and `summaryEN`.
- **Quick Stats:** Edit `stats` array (`value`, `labelTR`, `labelEN`).
- **Experience:** Add or modify `experience` items (`roleTR`, `roleEN`, `organization`, `startDate`, `endDateTR`, `endDateEN`, `descriptionTR`, `descriptionEN`, `skills`).
- **Education:** Add or modify `education` items (`institutionTR`, `programTR`, `descriptionTR`, etc.).
- **Skills:** Add items to `skills.design`, `skills.web`, `skills.production`, `skills.ai`, `skills.strategy`, or `skills.tools`.
- **CV PDF Links:** Place PDF files under `public/cv/kerem-mihci-cv-tr.pdf` and `public/cv/kerem-mihci-cv-en.pdf`, then set `cv.trAvailable: true` / `cv.enAvailable: true` in `profileData`.

---

## 8. Summary Checklist for Adding Projects & Profile Data

1. **Create Asset Folder:** Create `public/assets/projects/[slug]/`.
2. **Add Media Assets:** Add web-optimized `.webp` images and `.mp4` videos.
3. **Add Data Object:** Add the project entry to `projectsData` in [src/data/projects.ts](file:///Users/keremmihci/Documents/CreativePortfolio/src/data/projects.ts).
4. **Update Profile / CV Data:** Update `profileData` in [src/data/profile.ts](file:///Users/keremmihci/Documents/CreativePortfolio/src/data/profile.ts).
5. **Validate:** Run `npx tsc --noEmit` and `npm run build` to verify correctness.


