#!/usr/bin/env node
/**
 * Kerem Mıhçı Portfolio OS — Phase 4 Personal Gallery Visual Preview Capture
 *
 * Captures high-fidelity desktop and mobile screenshots of:
 * 1. Admin Gallery Catalog (1440x900)
 * 2. Admin Gallery Editor (1440x900)
 * 3. Admin Gallery Catalog Mobile (390x844)
 * 4. Admin Gallery Editor Mobile (390x844)
 * 5. Public Portfolio Gallery App Desktop (1440x900)
 * 6. Public Portfolio Gallery App Mobile (390x844)
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";

const requireFromDisk = createRequire(import.meta.url);
const playwrightPath =
  "/Volumes/EMIX_WORK/02_DEV/GEMINI/MyPlace/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core";
const { chromium } = requireFromDisk(playwrightPath);

const executablePath =
  "/Users/keremmihci/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const rootDir = process.cwd();
const screenshotsDir = path.join(rootDir, "docs", "staging-preview-screenshots", "phase4");
const artifactDir = "/Users/keremmihci/.gemini/antigravity/brain/bd30031d-6647-4acb-9e39-1add5e789838/screenshots/phase4";

fs.mkdirSync(screenshotsDir, { recursive: true });
fs.mkdirSync(artifactDir, { recursive: true });

// Read staging credentials
const credPath = path.join(rootDir, ".staging-admin-credentials.local");
if (!fs.existsSync(credPath)) {
  console.error("FATAL: .staging-admin-credentials.local not found.");
  process.exit(1);
}

const credLines = fs.readFileSync(credPath, "utf-8").split("\n");
let adminEmail = "";
let adminPassword = "";

for (const line of credLines) {
  const trimmed = line.trim();
  if (trimmed.startsWith("ADMIN_EMAIL=")) {
    adminEmail = trimmed.slice("ADMIN_EMAIL=".length).trim();
  } else if (trimmed.startsWith("ADMIN_PASSWORD=")) {
    adminPassword = trimmed.slice("ADMIN_PASSWORD=".length).trim();
  }
}

const BASE_URL = "http://127.0.0.1:3099";

async function saveScreenshot(page, filename) {
  const localTarget = path.join(screenshotsDir, filename);
  const artifactTarget = path.join(artifactDir, filename);
  await page.screenshot({ path: localTarget, fullPage: true });
  fs.copyFileSync(localTarget, artifactTarget);
  console.log(`✓ Screenshot captured: ${filename}`);
}

function seedSampleGalleryItems() {
  const dbPath = path.join(rootDir, ".local-d1", "portfolio.sqlite");
  const db = new DatabaseSync(dbPath);

  // Check if items already exist
  const countRow = db.prepare("SELECT count(*) as cnt FROM portfolio_gallery_items").get();
  if (countRow && countRow.cnt >= 3) {
    console.log(`✓ Database already has ${countRow.cnt} gallery items.`);
    db.close();
    return;
  }

  console.log("Seeding authentic sample gallery items for visual capture...");
  const now = new Date().toISOString();

  const items = [
    {
      id: "gallery-preview-1",
      status: "published",
      sort_order: 1,
      location: "Kadıköy, İstanbul",
      year: "2025",
      public_url: "/projects/alchemia-kasim-2024-dergi-tasarimi/cover.webp",
      alt_tr: "Kadıköy sokak fotoğrafı ve sabah ışığı",
      caption_tr: "Moda Caddesi üzerinde erken saatlerde oluşan mimari gölge geçişleri.",
      alt_en: "Kadikoy street photography and morning light",
      caption_en: "Architectural shadow gradients formed during early hours on Moda Avenue."
    },
    {
      id: "gallery-preview-2",
      status: "published",
      sort_order: 2,
      location: "Ayvalık, Balıkesir",
      year: "2024",
      public_url: "/projects/kagestudio-website-tasarimi/cover.webp",
      alt_tr: "Ege kıyılarında akşamüstü ufuk çizgisi",
      caption_tr: "Doğal renk tonları ve denizin durgun yüzey yansıması.",
      alt_en: "Aegean coastal horizon at dusk",
      caption_en: "Natural color tones and calm surface reflection of the sea."
    },
    {
      id: "gallery-preview-3",
      status: "draft",
      sort_order: 3,
      location: "Stüdyo Maslak",
      year: "2025",
      public_url: "/projects/ceylanlar-site-yonetimi-marka-kimligi/cover.webp",
      alt_tr: "Stüdyo ışık ve kontrast denemesi (Taslak)",
      caption_tr: "Monokrom stüdyo aydınlatma provası ve form araştırması.",
      alt_en: "Studio lighting and contrast test (Draft)",
      caption_en: "Monochrome studio lighting rehearsal and form investigation."
    }
  ];

  for (const item of items) {
    db.prepare(`
      INSERT OR REPLACE INTO portfolio_gallery_items (
        id, status, sort_order, year, location,
        created_at, updated_at, published_at, archived_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      item.status,
      item.sort_order,
      item.year,
      item.location,
      now,
      now,
      item.status === "published" ? now : null,
      null
    );

    // Translations
    db.prepare(`
      INSERT OR REPLACE INTO portfolio_gallery_translations (id, item_id, locale, alt_text, caption, updated_at)
      VALUES (?, ?, 'tr', ?, ?, ?)
    `).run(`${item.id}:tr`, item.id, item.alt_tr, item.caption_tr, now);

    db.prepare(`
      INSERT OR REPLACE INTO portfolio_gallery_translations (id, item_id, locale, alt_text, caption, updated_at)
      VALUES (?, ?, 'en', ?, ?, ?)
    `).run(`${item.id}:en`, item.id, item.alt_en, item.caption_en, now);

    // Asset
    db.prepare(`
      INSERT OR REPLACE INTO portfolio_gallery_assets (
        id, item_id, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, created_at, updated_at
      ) VALUES (?, ?, 'external', ?, ?, 'image/webp', 140768, 1200, 1500, ?, ?)
    `).run(
      `asset-${item.id}`,
      item.id,
      `gallery/${item.id}.webp`,
      item.public_url,
      now,
      now
    );

    // Initial Revision
    const snapshotJson = JSON.stringify({
      id: item.id,
      status: item.status,
      sortOrder: item.sort_order,
      location: item.location,
      year: item.year,
      alt: { tr: item.alt_tr, en: item.alt_en },
      caption: { tr: item.caption_tr, en: item.caption_en },
      asset: { publicUrl: item.public_url, mimeType: "image/webp" }
    });

    db.prepare(`
      INSERT OR REPLACE INTO portfolio_gallery_revisions (
        id, item_id, revision_number, action, snapshot_json, actor_email, created_at
      ) VALUES (?, ?, 1, 'Initial photo creation', ?, ?, ?)
    `).run(
      `rev-${item.id}-1`,
      item.id,
      snapshotJson,
      "staging-admin@local.test",
      now
    );
  }

  db.close();
  console.log("✓ Sample gallery items seeded successfully.");
}

async function run() {
  console.log("=== Kerem Mıhçı Portfolio OS: Phase 4 Personal Gallery Visual Capture ===");

  seedSampleGalleryItems();

  const browser = await chromium.launch({ executablePath, headless: true });

  try {
    // -------------------------------------------------------------
    // 1. Desktop Viewport 1440x900 — Admin Gallery Catalog
    // -------------------------------------------------------------
    console.log("\n[1/6] Capturing Desktop Admin Gallery Catalog (1440x900)...");
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const desktopPage = await desktopContext.newPage();

    await desktopPage.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await desktopPage.waitForSelector('[data-testid="admin-email-input"]', { timeout: 10000 });

    await desktopPage.getByTestId("admin-email-input").fill(adminEmail);
    await desktopPage.getByTestId("admin-password-input").fill(adminPassword);
    await desktopPage.getByTestId("admin-password-login-btn").click();

    await desktopPage.waitForSelector('[data-testid="admin-overview-section"]', { timeout: 15000 });

    // Navigate to Personal Gallery tab
    const galleryNavBtn = desktopPage.getByTestId("admin-tab-gallery");
    await galleryNavBtn.click();

    await desktopPage.waitForSelector('[data-testid="admin-gallery-section"]', { timeout: 15000 });
    await desktopPage.waitForSelector('[data-testid^="gallery-item-card-"]', { state: "visible", timeout: 15000 });

    const cardCount = await desktopPage.locator('[data-testid^="gallery-item-card-"]').count();
    console.log(`  Desktop gallery cards rendered: ${cardCount}`);
    assert.ok(cardCount >= 3, `Expected at least 3 gallery cards, got ${cardCount}`);

    await desktopPage.waitForTimeout(1000);
    await saveScreenshot(desktopPage, "admin_gallery_desktop_1440x900.png");

    // -------------------------------------------------------------
    // 2. Desktop Viewport 1440x900 — Admin Gallery Editor
    // -------------------------------------------------------------
    console.log("\n[2/6] Capturing Desktop Admin Gallery Editor (1440x900)...");
    const editFirstBtn = desktopPage.locator('[data-testid="gallery-edit-btn-gallery-preview-1"]').first();
    await editFirstBtn.waitFor({ state: "visible", timeout: 10000 });
    await editFirstBtn.click();

    await desktopPage.waitForSelector('[data-testid="admin-gallery-editor-section"]', { timeout: 10000 });
    await desktopPage.waitForTimeout(1000);
    await saveScreenshot(desktopPage, "admin_gallery_editor_desktop_1440x900.png");

    // -------------------------------------------------------------
    // 3. Mobile Viewport 390x844 — Admin Gallery Catalog
    // -------------------------------------------------------------
    console.log("\n[3/6] Capturing Mobile Admin Gallery Catalog (390x844)...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 }
    });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await mobilePage.waitForSelector('[data-testid="admin-email-input"]', { timeout: 10000 });

    await mobilePage.getByTestId("admin-email-input").fill(adminEmail);
    await mobilePage.getByTestId("admin-password-input").fill(adminPassword);
    await mobilePage.getByTestId("admin-password-login-btn").click();

    await mobilePage.waitForSelector('[data-testid="admin-overview-section"]', { timeout: 15000 });

    // On mobile, click the gallery tab
    await mobilePage.getByTestId("admin-tab-gallery").click();
    await mobilePage.waitForSelector('[data-testid="admin-gallery-section"]', { timeout: 15000 });
    await mobilePage.waitForSelector('[data-testid^="gallery-item-card-"]', { state: "visible", timeout: 15000 });

    const mobileCardCount = await mobilePage.locator('[data-testid^="gallery-item-card-"]').count();
    console.log(`  Mobile gallery cards rendered: ${mobileCardCount}`);
    assert.ok(mobileCardCount >= 3, `Expected at least 3 cards on mobile, got ${mobileCardCount}`);

    await mobilePage.waitForTimeout(1000);
    await saveScreenshot(mobilePage, "admin_gallery_mobile_390x844.png");

    // -------------------------------------------------------------
    // 4. Mobile Viewport 390x844 — Admin Gallery Editor
    // -------------------------------------------------------------
    console.log("\n[4/6] Capturing Mobile Admin Gallery Editor (390x844)...");
    const mobileEditBtn = mobilePage.locator('[data-testid="gallery-edit-btn-gallery-preview-1"]').first();
    await mobileEditBtn.waitFor({ state: "visible", timeout: 10000 });
    await mobileEditBtn.click();

    await mobilePage.waitForSelector('[data-testid="admin-gallery-editor-section"]', { timeout: 10000 });
    await mobilePage.waitForTimeout(1000);
    await saveScreenshot(mobilePage, "admin_gallery_editor_mobile_390x844.png");

    // -------------------------------------------------------------
    // 5. Desktop Viewport 1440x900 — Public Portfolio Gallery App
    // -------------------------------------------------------------
    console.log("\n[5/6] Capturing Desktop Public Gallery App (1440x900)...");
    const publicDesktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    await publicDesktopContext.addInitScript(() => {
      localStorage.setItem("portfolioOS:entry:v1:lastEnteredAt", String(Date.now()));
    });
    const publicDesktopPage = await publicDesktopContext.newPage();

    await publicDesktopPage.goto(`${BASE_URL}/tr`, { waitUntil: "networkidle" });
    await publicDesktopPage.waitForTimeout(1500);

    // Open Gallery App via dock button (aria-label="Galeri")
    const dockGalleryBtn = publicDesktopPage.locator('button[aria-label="Galeri"]').first();
    await dockGalleryBtn.waitFor({ state: "visible", timeout: 10000 });
    await dockGalleryBtn.click();

    // Wait for the gallery content to be rendered in the window
    await publicDesktopPage.waitForSelector('.flex-col.gap-4 img', { state: "visible", timeout: 15000 });
    await publicDesktopPage.waitForTimeout(1200);

    await saveScreenshot(publicDesktopPage, "public_gallery_desktop_1440x900.png");

    // -------------------------------------------------------------
    // 6. Mobile Viewport 390x844 — Public Portfolio Gallery App
    // -------------------------------------------------------------
    console.log("\n[6/6] Capturing Mobile Public Gallery App (390x844)...");
    const publicMobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 }
    });
    await publicMobileContext.addInitScript(() => {
      localStorage.setItem("portfolioOS:entry:v1:lastEnteredAt", String(Date.now()));
    });
    const publicMobilePage = await publicMobileContext.newPage();

    await publicMobilePage.goto(`${BASE_URL}/tr`, { waitUntil: "networkidle" });
    await publicMobilePage.waitForTimeout(1500);

    // Open Gallery App via mobile dock button (aria-label="Gallery")
    const mobileDockGalleryBtn = publicMobilePage.locator('button[aria-label="Gallery"]').first();
    await mobileDockGalleryBtn.waitFor({ state: "visible", timeout: 10000 });
    await mobileDockGalleryBtn.click();

    // Wait for the gallery stream inside mobile window
    await publicMobilePage.waitForSelector('.flex-col.gap-4 img', { state: "visible", timeout: 15000 });
    await publicMobilePage.waitForTimeout(1200);

    await saveScreenshot(publicMobilePage, "public_gallery_mobile_390x844.png");

    console.log("\n========================================================");
    console.log("All 6 high-fidelity visual screenshots captured successfully!");
    console.log("========================================================");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("FATAL ERROR during visual capture:", err);
  process.exit(1);
});
