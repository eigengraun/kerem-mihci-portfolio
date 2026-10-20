import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playwrightPath = "/Volumes/EMIX_WORK/02_DEV/GEMINI/MyPlace/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core";
const { chromium } = require(playwrightPath);

const chromeExecutable = "/Users/keremmihci/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "docs", "reviews", "screenshots", "phase4_1");
fs.mkdirSync(outputDir, { recursive: true });

// Also write to artifact dir if provided
const artifactDir = "/Users/keremmihci/.gemini/antigravity/brain/bd30031d-6647-4acb-9e39-1add5e789838/screenshots/phase4_1";
fs.mkdirSync(artifactDir, { recursive: true });

async function main() {
  console.log("Launching Chromium for Phase 4.1 Screenshots...");
  const browser = await chromium.launch({
    executablePath: chromeExecutable,
    headless: true
  });

  const baseUrl = "http://127.0.0.1:3099";

  // 1. Authenticate to admin session
  let adminEmail = "staging-admin@local.test";
  let adminPassword = "";
  const credFile = path.join(rootDir, ".staging-admin-credentials.local");
  if (fs.existsSync(credFile)) {
    const lines = fs.readFileSync(credFile, "utf-8").split("\n");
    for (const l of lines) {
      const t = l.trim();
      if (t.startsWith("ADMIN_EMAIL=")) adminEmail = t.slice("ADMIN_EMAIL=".length).trim();
      if (t.startsWith("ADMIN_PASSWORD=")) adminPassword = t.slice("ADMIN_PASSWORD=".length).trim();
    }
  }

  const authRes = await fetch(`${baseUrl}/api/admin/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  const setCookies = typeof authRes.headers.getSetCookie === "function"
    ? authRes.headers.getSetCookie()
    : [authRes.headers.get("set-cookie") || ""];
  
  const cookies = [];
  for (const raw of setCookies) {
    const parts = raw.split(";")[0].split("=");
    if (parts.length >= 2) {
      cookies.push({
        name: parts[0].trim(),
        value: parts.slice(1).join("=").trim(),
        domain: "127.0.0.1",
        path: "/"
      });
    }
  }

  // -------------------------------------------------------------
  // DESKTOP CONTEXT (1440x900)
  // -------------------------------------------------------------
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await desktopContext.addCookies(cookies);
  const desktopPage = await desktopContext.newPage();

  // Desktop Admin Gallery Catalog
  console.log("Navigating to Admin Gallery...");
  await desktopPage.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
  await desktopPage.click('[data-testid="admin-tab-gallery"]');
  await desktopPage.waitForSelector('[data-testid="admin-gallery-section"]', { state: "visible" });
  await desktopPage.waitForTimeout(1000);

  const adminDesktopPath = path.join(outputDir, "admin_gallery_desktop_1440x900.png");
  await desktopPage.screenshot({ path: adminDesktopPath, fullPage: false });
  fs.copyFileSync(adminDesktopPath, path.join(artifactDir, "admin_gallery_desktop_1440x900.png"));
  console.log("Saved:", adminDesktopPath);

  // Desktop Admin Gallery Editor
  console.log("Opening Add Photograph...");
  await desktopPage.click('[data-testid="gallery-add-photo-btn"]');
  await desktopPage.waitForSelector('[data-testid="admin-gallery-editor-section"]', { state: "visible" });
  await desktopPage.waitForTimeout(800);

  const editorDesktopPath = path.join(outputDir, "admin_gallery_editor_desktop_1440x900.png");
  await desktopPage.screenshot({ path: editorDesktopPath, fullPage: false });
  fs.copyFileSync(editorDesktopPath, path.join(artifactDir, "admin_gallery_editor_desktop_1440x900.png"));
  console.log("Saved:", editorDesktopPath);

  // Desktop Public Gallery View
  console.log("Opening Public Gallery Desktop...");
  await desktopPage.goto(`${baseUrl}/tr`, { waitUntil: "networkidle" });
  // Open Gallery window from dock
  const galleryDockBtn = desktopPage.locator('button:has-text("Galeri"), [data-testid="dock-gallery"]');
  if (await galleryDockBtn.count() > 0) {
    await galleryDockBtn.first().click();
    await desktopPage.waitForTimeout(1000);
  }
  const publicDesktopPath = path.join(outputDir, "public_gallery_desktop_1440x900.png");
  await desktopPage.screenshot({ path: publicDesktopPath, fullPage: false });
  fs.copyFileSync(publicDesktopPath, path.join(artifactDir, "public_gallery_desktop_1440x900.png"));
  console.log("Saved:", publicDesktopPath);

  await desktopContext.close();

  // -------------------------------------------------------------
  // MOBILE CONTEXT (390x844 - iPhone 14 / modern mobile)
  // -------------------------------------------------------------
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true
  });
  await mobileContext.addCookies(cookies);
  const mobilePage = await mobileContext.newPage();

  // Mobile Admin Gallery Catalog
  console.log("Navigating to Mobile Admin Gallery...");
  await mobilePage.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
  await mobilePage.click('[data-testid="admin-tab-gallery"]');
  await mobilePage.waitForSelector('[data-testid="admin-gallery-section"]', { state: "visible" });
  await mobilePage.waitForTimeout(800);

  const adminMobilePath = path.join(outputDir, "admin_gallery_mobile_390x844.png");
  await mobilePage.screenshot({ path: adminMobilePath, fullPage: false });
  fs.copyFileSync(adminMobilePath, path.join(artifactDir, "admin_gallery_mobile_390x844.png"));
  console.log("Saved:", adminMobilePath);

  // Mobile Admin Gallery Editor
  console.log("Opening Mobile Add Photograph...");
  await mobilePage.click('[data-testid="gallery-add-photo-btn"]');
  await mobilePage.waitForSelector('[data-testid="admin-gallery-editor-section"]', { state: "visible" });
  await mobilePage.waitForTimeout(800);

  const editorMobilePath = path.join(outputDir, "admin_gallery_editor_mobile_390x844.png");
  await mobilePage.screenshot({ path: editorMobilePath, fullPage: false });
  fs.copyFileSync(editorMobilePath, path.join(artifactDir, "admin_gallery_editor_mobile_390x844.png"));
  console.log("Saved:", editorMobilePath);

  // Mobile Public View
  console.log("Opening Mobile Public View...");
  await mobilePage.goto(`${baseUrl}/tr`, { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(1000);
  const publicMobilePath = path.join(outputDir, "public_gallery_mobile_390x844.png");
  await mobilePage.screenshot({ path: publicMobilePath, fullPage: false });
  fs.copyFileSync(publicMobilePath, path.join(artifactDir, "public_gallery_mobile_390x844.png"));
  console.log("Saved:", publicMobilePath);

  await mobileContext.close();
  await browser.close();

  console.log("\nAll Phase 4.1 Screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
