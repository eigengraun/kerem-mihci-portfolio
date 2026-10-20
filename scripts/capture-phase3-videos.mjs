#!/usr/bin/env node
/**
 * Kerem Mıhçı Portfolio OS — Phase 3 & 3.1 Videos & Reels Admin Visual Preview Capture
 *
 * Captures loaded desktop and mobile screenshots with exact 21 video records present,
 * ensuring no blank/loading state screenshots.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const requireFromDisk = createRequire(import.meta.url);
const playwrightPath =
  "/Volumes/EMIX_WORK/02_DEV/GEMINI/MyPlace/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core";
const { chromium } = requireFromDisk(playwrightPath);

const executablePath =
  "/Users/keremmihci/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const rootDir = process.cwd();
const screenshotsDir = path.join(rootDir, "docs", "staging-preview-screenshots", "phase3");
const artifactDir = "/Users/keremmihci/.gemini/antigravity/brain/bd30031d-6647-4acb-9e39-1add5e789838/screenshots/phase3";

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

async function run() {
  console.log("=== Kerem Mıhçı Portfolio OS: Phase 3.1 Videos & Reels High-Quality Visual Capture ===");

  const browser = await chromium.launch({ executablePath, headless: true });

  // -------------------------------------------------------------
  // 1. Desktop Viewport 1440x900
  // -------------------------------------------------------------
  console.log("\n[1/5] Capturing Desktop Videos Tab (1440x900)...");
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

  // Navigate to Videos tab
  const videosNavBtn = desktopPage.getByTestId("admin-tab-videos");
  await videosNavBtn.click();

  // Wait until videos catalog is populated with 21 video cards
  await desktopPage.waitForSelector('[data-testid^="edit-video-"]', { state: "visible", timeout: 15000 });
  const desktopCardsCount = await desktopPage.locator('[data-testid^="edit-video-"]').count();
  console.log(`  Desktop video cards rendered: ${desktopCardsCount}`);
  assert.ok(desktopCardsCount >= 21, `Expected at least 21 video cards, got ${desktopCardsCount}`);

  await desktopPage.waitForTimeout(1000);
  await saveScreenshot(desktopPage, "admin_videos_desktop_1440x900.png");

  // -------------------------------------------------------------
  // 2. Desktop Video Editor (Portrait 9:16 Video)
  // -------------------------------------------------------------
  console.log("\n[2/5] Capturing Desktop Video Editor (Portrait 9:16)...");
  const editPortraitBtn = desktopPage.locator('[data-testid="edit-video-ai-moda-kombin-reels"]').first();
  await editPortraitBtn.waitFor({ state: "visible", timeout: 10000 });
  await editPortraitBtn.click();
  await desktopPage.waitForSelector('[data-testid="admin-video-editor-section"]', { timeout: 10000 });
  await desktopPage.waitForTimeout(1000);
  await saveScreenshot(desktopPage, "admin_video_editor_1440x900.png");
  await saveScreenshot(desktopPage, "admin_video_portrait_1440x900.png");

  // -------------------------------------------------------------
  // 3. Desktop Video Editor (Landscape 16:9 Video)
  // -------------------------------------------------------------
  console.log("\n[3/5] Capturing Desktop Video Editor (Landscape 16:9)...");
  await desktopPage.getByTestId("admin-tab-videos").click();
  await desktopPage.waitForSelector('[data-testid^="edit-video-"]', { state: "visible", timeout: 10000 });
  const editLandscapeBtn = desktopPage.locator('[data-testid="edit-video-elara-skincare-ai-urun-reels"]').first();
  await editLandscapeBtn.waitFor({ state: "visible", timeout: 10000 });
  await editLandscapeBtn.click();
  await desktopPage.waitForSelector('[data-testid="admin-video-editor-section"]', { timeout: 10000 });
  await desktopPage.waitForTimeout(1000);
  await saveScreenshot(desktopPage, "admin_video_landscape_1440x900.png");

  // -------------------------------------------------------------
  // 4. Mobile Viewport 390x844 (Catalog with 21 Loaded Records)
  // -------------------------------------------------------------
  console.log("\n[4/5] Capturing Mobile Videos Tab with Loaded Records (390x844)...");
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

  // On mobile, click the videos tab
  await mobilePage.getByTestId("admin-tab-videos").click();

  // Crucial: Wait for the video cards to be fully loaded and visible, not empty loading state!
  await mobilePage.waitForSelector('[data-testid^="edit-video-"]', { state: "visible", timeout: 15000 });
  const mobileCardsCount = await mobilePage.locator('[data-testid^="edit-video-"]').count();
  console.log(`  Mobile video cards rendered: ${mobileCardsCount}`);
  assert.ok(mobileCardsCount >= 21, `Expected at least 21 video cards on mobile, got ${mobileCardsCount}`);

  await mobilePage.waitForTimeout(1000);
  await saveScreenshot(mobilePage, "admin_videos_mobile_390x844.png");

  // -------------------------------------------------------------
  // 5. Mobile Video Editor (390x844)
  // -------------------------------------------------------------
  console.log("\n[5/5] Capturing Mobile Video Editor (390x844)...");
  const mobileEditBtn = mobilePage.locator('[data-testid^="edit-video-"]').first();
  await mobileEditBtn.click();
  await mobilePage.waitForSelector('[data-testid="admin-video-editor-section"]', { timeout: 10000 });
  await mobilePage.waitForTimeout(1000);
  await saveScreenshot(mobilePage, "admin_video_editor_mobile_390x844.png");

  await browser.close();
  console.log("\nAll Phase 3.1 screenshots captured successfully with full data population!");
}

run().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
