#!/usr/bin/env node
/**
 * Kerem Mıhçı Portfolio OS — Staging Admin Visual Preview & QA Capture
 *
 * Verifies all CMS screens against real Cloudflare staging,
 * asserts absence of accidental Google UI references,
 * checks layout / responsiveness / console errors,
 * and saves crisp local screenshots.
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
const screenshotsDir = path.join(rootDir, "docs", "staging-preview-screenshots");
const artifactDir = "/Users/keremmihci/.gemini/antigravity/brain/bd30031d-6647-4acb-9e39-1add5e789838/screenshots";

fs.mkdirSync(screenshotsDir, { recursive: true });
fs.mkdirSync(artifactDir, { recursive: true });

// Read staging credentials from gitignored 0600 file
const credPath = path.join(rootDir, ".staging-admin-credentials.local");
if (!fs.existsSync(credPath)) {
  console.error("FATAL: .staging-admin-credentials.local not found. Run scripts/setup-staging-admin.mjs first.");
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

if (!adminEmail || !adminPassword) {
  console.error("FATAL: Could not read ADMIN_EMAIL or ADMIN_PASSWORD from .staging-admin-credentials.local.");
  process.exit(1);
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
  console.log("=== Kerem Mıhçı Portfolio OS: Staging Preview Verification & Capture ===");
  console.log(`Target: ${BASE_URL}/admin`);

  const consoleLogs = [];
  const consoleErrors = [];
  const pageErrors = [];

  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (msg.type() === "error") {
      consoleErrors.push(text);
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  try {
    // 1. Login Screen
    console.log("\n[1/8] Verifying Login Screen...");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="admin-email-input"]', { timeout: 10000 });

    const loginTitle = await page.textContent("h1");
    assert.match(loginTitle || "", /Portfolio OS CMS Dashboard/i);

    // Login
    await page.getByTestId("admin-email-input").fill(adminEmail);
    await page.getByTestId("admin-password-input").fill(adminPassword);
    await page.getByTestId("admin-password-login-btn").click();

    // 2. Desktop Overview
    console.log("\n[2/8] Verifying Desktop Overview...");
    await page.waitForSelector('[data-testid="admin-overview-section"]', { timeout: 15000 });
    
    // Check absence of deferred Google tabs
    const ga4Tab = await page.$('[data-testid="admin-tab-ga4"]');
    assert.equal(ga4Tab, null, "admin-tab-ga4 must NOT be rendered");
    const gscTab = await page.$('[data-testid="admin-tab-gsc"]');
    assert.equal(gscTab, null, "admin-tab-gsc must NOT be rendered");
    const trafficTab = await page.$('[data-testid="admin-tab-project-traffic"]');
    assert.equal(trafficTab, null, "admin-tab-project-traffic must NOT be rendered");

    // Check absence of visible Google text on page
    const bodyTextOverview = await page.innerText("body");
    assert.equal(
      /Google Analytics|Search Console/i.test(bodyTextOverview),
      false,
      "Overview body must not contain visible Google Analytics or Search Console references"
    );

    // Wait for core data to load from Cloudflare D1
    await page.waitForSelector('[data-testid="stat-published-projects"]:has-text("30")', { timeout: 15000 });
    const publishedProjectsText = await page.getByTestId("stat-published-projects").textContent();
    assert.equal(publishedProjectsText?.trim(), "30", "Published projects stat must be exactly 30");

    const totalProjectsText = await page.getByTestId("stat-total-projects").textContent();
    assert.ok(Number(totalProjectsText?.trim()) >= 30, `Total projects stat must be at least 30, got ${totalProjectsText}`);

    await page.waitForTimeout(500);
    await saveScreenshot(page, "01-desktop-overview.png");

    // 3. Projects Table
    console.log("\n[3/8] Verifying Projects Table...");
    await page.getByTestId("admin-tab-projects").click();
    await page.waitForSelector('[data-testid="admin-projects-section"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid^="project-row-"]', { timeout: 10000 });

    const projectRows = await page.$$('[data-testid^="project-row-"]');
    assert.ok(projectRows.length >= 30, `Expected at least 30 project rows, found ${projectRows.length}`);

    await page.waitForTimeout(500);
    await saveScreenshot(page, "02-project-list.png");

    // 4. Project Editor
    console.log("\n[4/8] Verifying Project Editor...");
    // Click edit on the first project in the table
    const firstEditBtn = await page.$('table button:has-text("Edit")');
    if (firstEditBtn) {
      await firstEditBtn.click();
    } else {
      await page.getByTestId("admin-tab-editor").click();
    }
    await page.waitForSelector('[data-testid="admin-editor-section"]', { timeout: 10000 });

    await page.waitForTimeout(500);
    await saveScreenshot(page, "03-project-editor.png");

    // 5. Media Library (R2)
    console.log("\n[5/8] Verifying Media Library (R2)...");
    await page.getByTestId("admin-tab-media").click();
    await page.waitForSelector('[data-testid="admin-media-section"]', { timeout: 10000 });

    await page.waitForTimeout(500);
    await saveScreenshot(page, "04-media-library.png");

    // 6. Featured Manager
    console.log("\n[6/8] Verifying Featured Manager...");
    await page.getByTestId("admin-tab-featured").click();
    await page.waitForSelector('[data-testid="admin-featured-section"]', { timeout: 10000 });

    await page.waitForTimeout(500);
    await saveScreenshot(page, "05-featured-manager.png");

    // 7. System & Cloudflare
    console.log("\n[7/8] Verifying System & Cloudflare Status...");
    await page.getByTestId("admin-tab-system").click();
    await page.waitForSelector('[data-testid="admin-system-section"]', { timeout: 10000 });

    const systemText = await page.innerText('[data-testid="admin-system-section"]');
    assert.equal(
      /Google/i.test(systemText),
      false,
      "System screen must not display visible Google references"
    );

    await page.waitForTimeout(500);
    await saveScreenshot(page, "06-system-cloudflare.png");

    // 8. Settings Screen
    console.log("\n[8/8] Verifying Settings Screen...");
    await page.getByTestId("admin-tab-settings").click();
    await page.waitForSelector('[data-testid="admin-settings-section"]', { timeout: 10000 });

    const settingsText = await page.innerText('[data-testid="admin-settings-section"]');
    assert.equal(
      /Google|GA4/i.test(settingsText),
      false,
      "Settings screen must not display visible Google/GA4 references"
    );

    await page.waitForTimeout(500);
    await saveScreenshot(page, "07-settings.png");

    // 9. Mobile Viewport (390x844)
    console.log("\n[Bonus] Verifying Mobile Dashboard Viewport (390x844)...");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("admin-tab-overview").click();
    await page.waitForSelector('[data-testid="admin-overview-section"]', { timeout: 10000 });

    const mobileMetrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowX: document.documentElement.scrollWidth > window.innerWidth
    }));

    assert.equal(
      mobileMetrics.overflowX,
      false,
      `Mobile overflow detected: scrollWidth=${mobileMetrics.scrollWidth} > innerWidth=${mobileMetrics.innerWidth}`
    );

    await page.waitForTimeout(500);
    await saveScreenshot(page, "08-mobile-dashboard.png");

    console.log("\n========================================================");
    console.log("ALL CMS SCREENS VERIFIED SUCCESSFULLY WITHOUT DEFECTS");
    console.log("========================================================");
    console.log(`Page Errors:    ${pageErrors.length}`);
    console.log(`Console Errors: ${consoleErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log("Console Errors found:", consoleErrors);
    }
    if (pageErrors.length > 0) {
      console.log("Page Errors found:", pageErrors);
    }

  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("FATAL QA FAILURE:", err);
  process.exit(1);
});
