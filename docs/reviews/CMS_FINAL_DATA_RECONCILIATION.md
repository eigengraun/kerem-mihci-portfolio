# CMS Final Data Reconciliation Report (Programmatically Generated)

> [!IMPORTANT]
> This document is generated **100% programmatically** by `scripts/reconcile-and-generate-report.mjs` directly from `docs/reviews/cms-reconciliation-verified.json`. No table cells or project metadata values were manually typed in prose.

## 1. Executive Summary & Root Cause of Previous Report Discrepancy

- **Canonical Source**: `src/data/projects.ts` (`origin/main` parity verified: `0` diff lines)
- **Source Total Projects**: `30`
- **Local D1 Total Projects**: `30`
- **Worker D1 Total Projects**: `30`
- **Workspace Distribution (Source / Local D1 / Worker D1)**: `design: 18`, `web: 12`, `motion-ai: 0`
- **Featured Published Projects**: `10` (`design: 4`, `web: 6`, `motion-ai: 0`)
- **Total Gallery Media Items**: `70`
- **Source vs Local D1 Field Mismatches**: `0`
- **Source vs Worker D1 Field Mismatches**: `0`
- **Local D1 vs Worker D1 Field Mismatches**: `0`

### Root-Cause Diagnosis of Previous Report Discrepancies

1. **Option A Confirmed (Manual Prose Reconstruction in Previous Markdown Table)**: In the previous engineering report, the 30-row Markdown table in prose was manually typed rather than programmatically rendered from the database/JSON output. As a result, human/model transcription errors appeared in the prose table for `fling-arena` (`Kiyris Games` / `2025` instead of `KIXOGAMES` / `2026`), `iuckmk-website-tasarimi` (`2025` instead of `IUCKMK` / `2024`), `goobzy-logo-tasarimi` (`2025` instead of `2024`), `ceylanlar-site-yonetimi-marka-kimligi` (`2025` instead of `2024`), and `alchemia-subat-2025-dergi-tasarimi` (`Alchemia Magazine` instead of `Alchemia`), even though the underlying SQLite D1 rows already held the canonical `client_name` and `year` strings.
2. **Option D Also Identified & Fixed (Serializer Edge Cases for `undefined` Optional Fields)**: Independent inspection of the serializer in `src/lib/portfolio/d1Engine.ts`, `cloudflare/portfolio-api/src/index.ts`, and `scripts/migrate-d1.mjs` uncovered three subtle hydration differences that had been masked by conditional checks:
   - **`featuredOrder` on `ceylanlar-site-yonetimi-marka-kimligi`**: In `src/data/projects.ts`, `ceylanlar-site-yonetimi-marka-kimligi` has `featured: true` and `featuredOrder: undefined` (`sortOrder: 18`). Previously, `migrate-d1.mjs` synthesized `featured_order = 1` when `featuredOrder` was `undefined`, and hydration returned `0` instead of `undefined` when `featured_order` was `0`. Both `d1Engine.ts` and Worker `index.ts` now preserve `featuredOrder: undefined` when `featured_order === 0`.
   - **`externalLinks` on `alchemia-subat-2025-dergi-tasarimi`**: In `src/data/projects.ts`, `externalLinks` is `undefined` (whereas other projects without links have `externalLinks: []`). `hasExplicitExternalLinks` is now persisted in `tags_json` so hydration preserves `undefined` vs `[]`.
   - **Top-level `ogImage` vs `seo.ogImage`**: In `src/data/projects.ts`, top-level `ogImage` is `undefined` while `seo.ogImage` is populated on 20 projects. `hasExplicitOgImage` is now persisted so top-level `ogImage` remains `undefined` unless explicitly set.

## 2. Complete 30-Project Reconciliation Table (Generated from Verified JSON)

| # | ID | Slug | Workspace | Client | Year | Featured | FeaturedOrder | SortOrder | MediaCount | TitleTR | TitleEN | LocalD1 | WorkerD1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `yanarsan-yangin-website-tasarimi` | `yanarsan-yangin-website-tasarimi` | `web` | Yanarsan Yangın | 2024 | `true` | `1` | `1` | `5` | Yanarsan Yangın Website Tasarımı | Yanarsan Fire & Safety Website Design | `MATCH` | `MATCH` |
| 2 | `eigestore-website-tasarimi` | `eigestore-website-tasarimi` | `web` | EigeStore | 2024 | `true` | `2` | `2` | `5` | EigeStore Website Tasarımı | EigeStore E-Commerce Website Design | `MATCH` | `MATCH` |
| 3 | `kagestudio-website-tasarimi` | `kagestudio-website-tasarimi` | `web` | KAGESTUDIO | 2026 | `true` | `3` | `3` | `4` | KAGESTUDIO Website Tasarımı | KAGESTUDIO Website Design | `MATCH` | `MATCH` |
| 4 | `deva-yangin-website-tasarimi` | `deva-yangin-website-tasarimi` | `web` | Deva Yangın | 2026 | `true` | `4` | `4` | `5` | Deva Yangın Website Tasarımı | Deva Fire & Safety Website Design | `MATCH` | `MATCH` |
| 5 | `emix-creative-website-tasarimi` | `emix-creative-website-tasarimi` | `web` | eMix Creative | 2024 | `true` | `5` | `5` | `5` | eMix Creative Website Tasarımı | eMix Creative Agency Website Design | `MATCH` | `MATCH` |
| 6 | `iuckmk-website-tasarimi` | `iuckmk-website-tasarimi` | `web` | IUCKMK | 2024 | `true` | `6` | `6` | `5` | IUCKMK Website Tasarımı | IUCKMK Student Club Website Design | `MATCH` | `MATCH` |
| 7 | `engin-perde-website-optimizasyonu` | `engin-perde-website-optimizasyonu` | `web` | Engin Perde | 2026 | `false` | `undefined` | `7` | `4` | Engin Perde Website Optimizasyonu | Engin Perde Website Optimization | `MATCH` | `MATCH` |
| 8 | `sanda-yachting-website-ceviri-calismasi` | `sanda-yachting-website-ceviri-calismasi` | `web` | Sanda Yachting | 2026 | `false` | `undefined` | `8` | `4` | Sanda Yachting Website Çeviri Çalışması | Sanda Yachting Website Translation Work | `MATCH` | `MATCH` |
| 9 | `ceylanlar-site-yonetimi-website-tasarimi` | `ceylanlar-site-yonetimi-website-tasarimi` | `web` | Ceylanlar Site Yönetimi | 2024 | `false` | `undefined` | `9` | `5` | Ceylanlar Site Yönetimi Website Tasarımı | Ceylanlar Site Management Website Design | `MATCH` | `MATCH` |
| 10 | `alchemia-subat-2025-dergi-tasarimi` | `alchemia-subat-2025-dergi-tasarimi` | `design` | Alchemia | 2025 | `false` | `undefined` | `10` | `4` | Alchemia Şubat 2025 Dergi Tasarımı | Alchemia February 2025 Magazine Design | `MATCH` | `MATCH` |
| 11 | `kmz-2025` | `kmz-2025` | `design` | KMZ 2025 | 2025 | `true` | `1` | `11` | `1` | KMZ 2025 | KMZ 2025 | `MATCH` | `MATCH` |
| 12 | `fling-arena` | `fling-arena` | `design` | KIXOGAMES | 2026 | `true` | `2` | `12` | `1` | Fling Arena | Fling Arena | `MATCH` | `MATCH` |
| 13 | `kagestudio-marka-kimligi` | `kagestudio-marka-kimligi` | `design` | KAGESTUDIO | 2025 | `true` | `3` | `13` | `1` | KAGESTUDIO Marka Kimliği | KAGESTUDIO Brand Identity | `MATCH` | `MATCH` |
| 14 | `eigestore-marka-kimligi` | `eigestore-marka-kimligi` | `design` | EigeStore | 2024 | `false` | `undefined` | `14` | `2` | EigeStore Marka Kimliği | EigeStore Brand Identity | `MATCH` | `MATCH` |
| 15 | `hizir-yangin-marka-kimligi` | `hizir-yangin-marka-kimligi` | `design` | Hızır Yangın | 2024 | `false` | `undefined` | `15` | `2` | Hızır Yangın Marka Kimliği | Hızır Yangın Brand Identity | `MATCH` | `MATCH` |
| 16 | `emix-qr-menu` | `emix-qr-menu` | `web` | eMix QR Menü | `undefined` | `false` | `undefined` | `16` | `2` | eMix QR Menü Website & Yönetim Sistemi | eMix QR Menu Website & Management System | `MATCH` | `MATCH` |
| 17 | `planfiq-logo-tasarimi` | `planfiq-logo-tasarimi` | `design` | PlanFIQ | 2026 | `false` | `undefined` | `17` | `1` | PlanFIQ Logo Tasarımı | PlanFIQ Logo Design | `MATCH` | `MATCH` |
| 18 | `ceylanlar-site-yonetimi-marka-kimligi` | `ceylanlar-site-yonetimi-marka-kimligi` | `design` | Ceylanlar Site Yönetimi | 2024 | `true` | `undefined` | `18` | `1` | Ceylanlar Site Yönetimi Marka Kimliği | Ceylanlar Site Yönetimi Brand Identity | `MATCH` | `MATCH` |
| 19 | `deva-yangin-marka-kimligi` | `deva-yangin-marka-kimligi` | `design` | Deva Yangın | 2025 | `false` | `undefined` | `19` | `1` | Deva Yangın Marka Kimliği | Deva Yangın Brand Identity | `MATCH` | `MATCH` |
| 20 | `goobzy-logo-tasarimi` | `goobzy-logo-tasarimi` | `design` | Goobzy | 2024 | `false` | `undefined` | `20` | `1` | Goobzy Logo Tasarımı | Goobzy Logo Design | `MATCH` | `MATCH` |
| 21 | `yanarsan-yangin-logo-tasarimi` | `yanarsan-yangin-logo-tasarimi` | `design` | Yanarsan Yangın | 2025 | `false` | `undefined` | `21` | `1` | Yanarsan Yangın Logo Tasarımı | Yanarsan Yangın Logo Design | `MATCH` | `MATCH` |
| 22 | `emix-creative-logo-tasarimi` | `emix-creative-logo-tasarimi` | `design` | eMix Creative | 2024 | `false` | `undefined` | `22` | `1` | eMix Creative Logo Tasarımı | eMix Creative Logo Design | `MATCH` | `MATCH` |
| 23 | `kixogames-logo-tasarimi` | `kixogames-logo-tasarimi` | `design` | KIXOGAMES | 2026 | `false` | `undefined` | `23` | `1` | KIXOGAMES Logo Tasarımı | KIXOGAMES Logo Design | `MATCH` | `MATCH` |
| 24 | `kiyris-games-logo-tasarimi` | `kiyris-games-logo-tasarimi` | `design` | KIYRIS GAMES | 2026 | `false` | `undefined` | `24` | `1` | KIYRIS GAMES Logo Tasarımı | KIYRIS GAMES Logo Design | `MATCH` | `MATCH` |
| 25 | `alchemia-ocak-2025-dergi-tasarimi` | `alchemia-ocak-2025-dergi-tasarimi` | `design` | Alchemia | 2025 | `false` | `undefined` | `25` | `1` | Alchemia Ocak 2025 Dergi Tasarımı | Alchemia January 2025 Magazine Design | `MATCH` | `MATCH` |
| 26 | `alchemia-aralik-2024-dergi-tasarimi` | `alchemia-aralik-2024-dergi-tasarimi` | `design` | Alchemia | 2024 | `false` | `undefined` | `26` | `1` | Alchemia Aralık 2024 Dergi Tasarımı | Alchemia December 2024 Magazine Design | `MATCH` | `MATCH` |
| 27 | `alchemia-kasim-2024-dergi-tasarimi` | `alchemia-kasim-2024-dergi-tasarimi` | `design` | Alchemia | 2024 | `false` | `undefined` | `27` | `1` | Alchemia Kasım 2024 Dergi Tasarımı | Alchemia November 2024 Magazine Design | `MATCH` | `MATCH` |
| 28 | `alchemia-nisan-2025-dergi-tasarimi` | `alchemia-nisan-2025-dergi-tasarimi` | `design` | Alchemia | 2025 | `false` | `undefined` | `28` | `1` | Alchemia Nisan 2025 Dergi Tasarımı | Alchemia April 2025 Magazine Design | `MATCH` | `MATCH` |
| 29 | `planfiq-website-web-uygulamasi` | `planfiq-website-web-uygulamasi` | `web` | PlanFIQ | 2026 | `false` | `undefined` | `29` | `2` | PlanFIQ Website & Web Uygulaması | PlanFIQ Website & Web Application | `MATCH` | `MATCH` |
| 30 | `solo-leveling-manga-website` | `solo-leveling-manga-website` | `web` | Kişisel Proje | `undefined` | `false` | `undefined` | `30` | `1` | Solo Leveling Manga Website Tasarımı & Geliştirme | Solo Leveling Manga Website Design & Development | `MATCH` | `MATCH` |

## 3. Verification of Previously Misreported Projects

### `fling-arena`
- **ID**: `fling-arena`
- **Workspace**: `design`
- **Client (Source / Local D1 / Worker D1)**: `KIXOGAMES` / `KIXOGAMES` / `KIXOGAMES`
- **Year (Source / Local D1 / Worker D1)**: `2026` / `2026` / `2026`
- **Featured / FeaturedOrder / SortOrder**: `true` / `2` / `12`
- **Media Count**: `1`
- **Field Diffs**: `0`

### `iuckmk-website-tasarimi`
- **ID**: `iuckmk-website-tasarimi`
- **Workspace**: `web`
- **Client (Source / Local D1 / Worker D1)**: `IUCKMK` / `IUCKMK` / `IUCKMK`
- **Year (Source / Local D1 / Worker D1)**: `2024` / `2024` / `2024`
- **Featured / FeaturedOrder / SortOrder**: `true` / `6` / `6`
- **Media Count**: `5`
- **Field Diffs**: `0`

### `goobzy-logo-tasarimi`
- **ID**: `goobzy-logo-tasarimi`
- **Workspace**: `design`
- **Client (Source / Local D1 / Worker D1)**: `Goobzy` / `Goobzy` / `Goobzy`
- **Year (Source / Local D1 / Worker D1)**: `2024` / `2024` / `2024`
- **Featured / FeaturedOrder / SortOrder**: `false` / `undefined` / `20`
- **Media Count**: `1`
- **Field Diffs**: `0`

### `ceylanlar-site-yonetimi-marka-kimligi`
- **ID**: `ceylanlar-site-yonetimi-marka-kimligi`
- **Workspace**: `design`
- **Client (Source / Local D1 / Worker D1)**: `Ceylanlar Site Yönetimi` / `Ceylanlar Site Yönetimi` / `Ceylanlar Site Yönetimi`
- **Year (Source / Local D1 / Worker D1)**: `2024` / `2024` / `2024`
- **Featured / FeaturedOrder / SortOrder**: `true` / `undefined` / `18`
- **Media Count**: `1`
- **Field Diffs**: `0`

### `alchemia-subat-2025-dergi-tasarimi`
- **ID**: `alchemia-subat-2025-dergi-tasarimi`
- **Workspace**: `design`
- **Client (Source / Local D1 / Worker D1)**: `Alchemia` / `Alchemia` / `Alchemia`
- **Year (Source / Local D1 / Worker D1)**: `2025` / `2025` / `2025`
- **Featured / FeaturedOrder / SortOrder**: `false` / `undefined` / `10`
- **Media Count**: `4`
- **Field Diffs**: `0`

