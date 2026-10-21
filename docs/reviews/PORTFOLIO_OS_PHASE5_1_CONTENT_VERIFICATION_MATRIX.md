# Portfolio OS Phase 5.1: Content Provenance & Verification Matrix

**Project:** Kerem Mıhçı Portfolio OS  
**Branch:** `feature/portfolio-phase5-notes-profile-cv`  
**Execution Timestamp:** 2026-10-22T00:55:00Z  
**Baseline Sources:**  
- Static Codebase: `src/data/profile.ts`, `src/data/notes.ts`  
- Local Database: `.local-d1/portfolio.sqlite`  
- Prior Documentation: `docs/reviews/PORTFOLIO_OS_PHASE5_CONTENT_REVIEW.md`  

---

## 1. Provenance Classification Rules

To prevent biographical fabrication and ensure publication safety:

- **`SOURCE_MATCH_UNVERIFIED`**: Exact bit-for-bit parity between committed static source code (`src/data/profile.ts`, `src/data/notes.ts`) and the local D1 database records. Awaiting final explicit verification by the human owner.
- **`SOURCE_MISMATCH`**: The claim in prior documentation (`PORTFOLIO_OS_PHASE5_CONTENT_REVIEW.md`) directly contradicts the committed static source code.
- **`USER_CONFIRMED`**: Personal biographical fact explicitly acknowledged and confirmed by Kerem Mıhçı. *(Not applied without explicit owner confirmation)*.
- **`CONTENT_REVIEW_REQUIRED`**: Unverified personal/career statement, degree claim, or historical stat requiring owner confirmation before public staging/production release. Safe for local draft storage only.

---

## 2. Profile Identity & Bio Matrix

| Field | A. Static Source (`profile.ts`) | B. Local D1 Value | C. Phase 5 Review Claim | D. Source = D1 | E. Status | F. Safe to Publish |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: |
| **Name** | "Kerem Mıhçı" | "Kerem Mıhçı" | "Kerem Mıhçı" | YES | `SOURCE_MATCH_UNVERIFIED` | YES (Public) |
| **Email** | "info@keremmihci.com" | "info@keremmihci.com" | "info@keremmihci.com" | YES | `SOURCE_MATCH_UNVERIFIED` | YES (Public) |
| **Headline TR** | "Tasarımcı • Web Tasarımcısı • Dijital Üretici" | "Tasarımcı • Web Tasarımcısı • Dijital Üretici" | "Tasarımcı & Yaratıcı Teknolojist" | YES | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **Headline EN** | "Designer • Web Designer • Digital Creator" | "Designer • Web Designer • Digital Creator" | "Designer & Creative Technologist" | YES | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **Location TR** | "İstanbul, Türkiye" | "İstanbul, Türkiye" | "Kadıköy, İstanbul" | YES | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **Location EN** | "Istanbul, Türkiye" | "Istanbul, Türkiye" | "Kadıköy, Istanbul" | YES | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **Image Path** | `"/profile/kerem-mihci-profile.webp"` | `"/profile/kerem-mihci-profile.webp"` | `"/profile/kerem-mihci-profile.webp"` | YES | `SOURCE_MATCH_UNVERIFIED` | YES |
| **Avatar Path** | `"/profile/kerem-mihci-avatar.webp"` | `"/profile/kerem-mihci-avatar.webp"` | `"/profile/kerem-mihci-avatar.webp"` | YES | `SOURCE_MATCH_UNVERIFIED` | YES |
| **Image Alt TR**| "Kerem Mıhçı, fotoğraf makinesiyle portre." | "Kerem Mıhçı, fotoğraf makinesiyle portre." | "Kerem Mıhçı — Tasarımcı & Yaratıcı Teknolojist Portresi" | YES | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **Image Alt EN**| "Portrait of Kerem Mıhçı holding a camera." | "Portrait of Kerem Mıhçı holding a camera." | "Kerem Mıhçı — Designer & Creative Technologist Portrait" | YES | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **Summary TR** | 3 authentic paragraphs on design, web, branding, AI production | 3 authentic paragraphs matching source | Fictional narrative of 16+ years of leadership | YES | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **Summary EN** | 3 authentic paragraphs on design, web engineering, AI workflow | 3 authentic paragraphs matching source | Fictional narrative of 16+ years of leadership | YES | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **Stat: Experience** | `"4+"` (Years Experience) | `"4+"` | `"16+"` | YES | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **Stat: Projects** | `"140+"` (Completed Projects) | `"140+"` | `"30+"` | YES | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **Stat: Clients** | `"50+"` (Brands & Clients) | `"50+"` | `"70+ Works"` | YES | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **Stat: AI Prod** | `"3+"` (Years AI Production) | `"3+"` | `"21 Videos"` | YES | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **Focus Areas TR** | 5 areas: Graphic Design & Brand Identity, Web Design & Full-Stack, Motion & Reels, AI Production, SEO | 5 areas matching source | 6 altered areas: Design Systems, Creative Technology, etc. | YES | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **Focus Areas EN** | 5 areas matching source | 5 areas matching source | 6 altered areas matching Turkish alteration | YES | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |

---

## 3. Workspace Notes Provenance Matrix

| Workspace | Source File / Key | Source Items | Local D1 Record Count | Prior Report Claim | Status | Safe to Publish |
| :--- | :--- | :--- | :---: | :--- | :--- | :---: |
| **`design`** | `profileData.notes` (`system.txt`) | 8 generic design & production memos | 8 notes (`note-design-1` .. `8`) | Invented files: `creative-manifesto.md`, `design-system.md`, `typography-hierarchy.md` | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **`web`** | `profileData.notes` (`system.txt`) | 8 generic design & production memos | 8 notes (`note-web-1` .. `8`) | Invented files: `stack-architecture.md`, `performance-budgets.md` | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **`motion-ai`** | `profileData.notes` (`system.txt`) | 8 generic design & production memos | 8 notes (`note-motion-ai-1` .. `8`) | Invented files: `ai-prompt-engineering.md`, `ffmpeg-pipeline.md` | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |

*Note:* The actual committed static source `src/data/notes.ts` does **not** contain specific markdown essays. It duplicates the 8 general design aphorisms from `system.txt` across all three workspaces. The local D1 database faithfully reproduces these 8 items (total 24 notes). The prior Content Review document hallucinated separate markdown files.

---

## 4. Career Experience Provenance Matrix

| Experience ID | Static Source Role & Dates | Local D1 Record | Prior Report Claim | Status | Safe to Publish |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **`emix-creative`** | eMix Creative (2025 - Present) | Matches source | Not mentioned / Claimed "Eigengraun Studio Founder (2020-Present)" | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **`freelance`** | Bağımsız / Freelance (2021 - Present) | Matches source | Not mentioned / Claimed "Senior Design Technologist (2017-2020)" | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **`ai-trainer`** | AI & Görsel Teknolojiler (2023 - Present) | Matches source | Not mentioned / Claimed "Lead UI/UX Designer (2014-2017)" | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **`art-director`** | Tasarım Ajansı (2022 - 2024) | Matches source | Not mentioned / Claimed "Art Director & Motion (2011-2014)" | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **`alchemia`** | Alchemia E-Dergisi (2024 - 2025) | Matches source | Not mentioned / Claimed "Interactive Media (2008-2011)" | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |

*Finding:* Prior review documentation fabricated an entire 2008–2026 chronology. The actual static codebase `src/data/profile.ts` reflects authentic, recent experience from 2020 to 2025.

---

## 5. Education Provenance Matrix

| Education ID | Static Source Institution & Degree | Local D1 Record | Prior Report Claim | Status | Safe to Publish |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **`iuc-engineering`** | İstanbul Üniversitesi - Cerrahpaşa, Elektrik-Elektronik Mühendisliği (2020 - Present) | Matches source | Completely omitted from report | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **`duzce-fen-lisesi`** | Düzce Fen Lisesi (High School) | Matches source | Completely omitted from report | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| *[Fabricated]* | *None in codebase* | *None in D1* | "Marmara Üniversitesi Güzel Sanatlar Fakültesi (2004-2008)" | `SOURCE_MISMATCH` | **PROHIBITED** |

*Finding:* The prior report claimed Kerem Mıhçı graduated from Marmara University Fine Arts in 2004–2008. The actual codebase contains his actual engineering studies at Istanbul University - Cerrahpaşa (2020–present) and high school at Düzce Fen Lisesi.

---

## 6. Skills Provenance Matrix

| Category | Item Count (Source) | Item Count (D1) | Prior Report Claim | Parity Status | Safe to Publish |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **Design** | 7 | 7 | 8 items (invented design tokens, micro-interactions) | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **Web** | 8 | 8 | 8 items (partially altered) | `SOURCE_MATCH_UNVERIFIED` | `CONTENT_REVIEW_REQUIRED` |
| **Production** | 5 | 5 | 6 items (invented prepress, color management) | `SOURCE_MISMATCH` | `CONTENT_REVIEW_REQUIRED` |
| **AI** | 4 | 4 | 4 items | `SOURCE_MATCH_UNVERIFIED` | `CONTENT_REVIEW_REQUIRED` |
| **Strategy** | 4 | 4 | 4 items | `SOURCE_MATCH_UNVERIFIED` | `CONTENT_REVIEW_REQUIRED` |
| **Tools** | 11 | 11 | Omitted from category summary | `SOURCE_MATCH_UNVERIFIED` | `CONTENT_REVIEW_REQUIRED` |
| **Total** | **39** | **39** | 39 | Source matches D1 | `CONTENT_REVIEW_REQUIRED` |

---

## 7. Curriculum Vitae (CV) Documents Matrix

| Locale | Source State (`profile.ts`) | Local D1 Record | Prior Report Claim | Parity Status | Safe to Publish |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TR** | `trAvailable: false`, path: `"/cv/kerem-mihci-cv-tr.pdf"` | `status: 'draft'`, `byte_size: 0`, `public_url: '/cv/kerem-mihci-cv-tr.pdf'` | Placeholder coming-soon draft | `SOURCE_MATCH_UNVERIFIED` | **NO (Draft Only)** |
| **EN** | `enAvailable: false`, path: `"/cv/kerem-mihci-cv-en.pdf"` | `status: 'draft'`, `byte_size: 0`, `public_url: '/cv/kerem-mihci-cv-en.pdf'` | Placeholder coming-soon draft | `SOURCE_MATCH_UNVERIFIED` | **NO (Draft Only)** |

---

## 8. Summary of Content Integrity Remediations

1. **Retraction of Fabricated Claims:**  
   `PORTFOLIO_OS_PHASE5_CONTENT_REVIEW.md` has been updated to remove all fabricated claims ("16+ years", Marmara Fine Arts degree, 2008–2026 chronology, fictional markdown essays).
2. **Defensible Canonical Truth:**  
   The canonical source of truth for Portfolio OS content remains `src/data/profile.ts` and `src/data/notes.ts`.
3. **Draft Safety Gate Enforced:**  
   All personal biographical data in CMS remains gated under `CONTENT_REVIEW_REQUIRED` until explicitly confirmed by the site owner. No unverified personal claims may be automatically published.
