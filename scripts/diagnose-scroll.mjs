#!/usr/bin/env node
/**
 * Deep diagnostic script for P0: Vertical Scroll Failure
 * Inspects all ancestor heights, computed overflow, wheel/keyboard scroll responses
 * across all 7 admin screens and viewports.
 */

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
const credPath = path.join(rootDir, ".staging-admin-credentials.local");
const credLines = fs.readFileSync(credPath, "utf-8").split("\n");
let adminEmail = "";
let adminPassword = "";

for (const line of credLines) {
  const trimmed = line.trim();
  if (trimmed.startsWith("ADMIN_EMAIL=")) adminEmail = trimmed.slice("ADMIN_EMAIL=".length).trim();
  if (trimmed.startsWith("ADMIN_PASSWORD=")) adminPassword = trimmed.slice("ADMIN_PASSWORD=".length).trim();
}

const BASE_URL = "http://127.0.0.1:3099";

const viewports = [
  { width: 1920, height: 1080, name: "1920x1080" },
  { width: 1440, height: 900, name: "1440x900" },
  { width: 1280, height: 800, name: "1280x800" },
  { width: 820, height: 1180, name: "820x1180" },
  { width: 390, height: 844, name: "390x844" },
  { width: 375, height: 812, name: "375x812" }
];

const tabs = ["overview", "projects", "editor", "media", "featured", "system", "settings"];

async function run() {
  console.log("=== P0: Vertical Scroll Deep Diagnostic ===");
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="admin-email-input"]');
  await page.getByTestId("admin-email-input").fill(adminEmail);
  await page.getByTestId("admin-password-input").fill(adminPassword);
  await page.getByTestId("admin-password-login-btn").click();
  await page.waitForSelector('[data-testid="admin-overview-section"]');
  await page.waitForTimeout(1000);

  const results = {};

  for (const vp of viewports) {
    console.log(`\n--- Testing Viewport: ${vp.name} ---`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    results[vp.name] = {};

    for (const tab of tabs) {
      await page.getByTestId(`admin-tab-${tab}`).click();
      await page.waitForSelector(`[data-testid="admin-${tab}-section"]`, { timeout: 5000 });
      await page.waitForTimeout(300);

      const diag = await page.evaluate(() => {
        const html = document.documentElement;
        const body = document.body;
        const main = document.querySelector("main");
        const adminRoot = main?.parentElement;
        const layoutRoot = adminRoot?.parentElement;

        const getMetrics = (el, name) => {
          if (!el) return { name, exists: false };
          const cs = window.getComputedStyle(el);
          return {
            name,
            exists: true,
            tagName: el.tagName,
            className: el.className ? el.className.toString().slice(0, 60) : "",
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
            offsetHeight: el.offsetHeight,
            scrollTop: el.scrollTop,
            overflowY: cs.overflowY,
            overflowX: cs.overflowX,
            height: cs.height,
            maxHeight: cs.maxHeight,
            minHeight: cs.minHeight
          };
        };

        return {
          windowInnerHeight: window.innerHeight,
          html: getMetrics(html, "html"),
          body: getMetrics(body, "body"),
          layoutRoot: getMetrics(layoutRoot, "layoutRoot"),
          adminRoot: getMetrics(adminRoot, "adminRoot"),
          main: getMetrics(main, "main")
        };
      });

      // Test real wheel scroll on main and on window
      const initialScroll = await page.evaluate(() => {
        const main = document.querySelector("main");
        return {
          windowScrollY: window.scrollY,
          bodyScrollTop: document.body.scrollTop,
          htmlScrollTop: document.documentElement.scrollTop,
          mainScrollTop: main ? main.scrollTop : -1
        };
      });

      // Attempt wheel scroll
      await page.mouse.move(vp.width / 2, vp.height / 2);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(200);

      const afterWheelScroll = await page.evaluate(() => {
        const main = document.querySelector("main");
        return {
          windowScrollY: window.scrollY,
          bodyScrollTop: document.body.scrollTop,
          htmlScrollTop: document.documentElement.scrollTop,
          mainScrollTop: main ? main.scrollTop : -1
        };
      });

      // Attempt PageDown key scroll
      await page.keyboard.press("PageDown");
      await page.waitForTimeout(200);

      const afterKeyScroll = await page.evaluate(() => {
        const main = document.querySelector("main");
        return {
          windowScrollY: window.scrollY,
          bodyScrollTop: document.body.scrollTop,
          htmlScrollTop: document.documentElement.scrollTop,
          mainScrollTop: main ? main.scrollTop : -1
        };
      });

      // Reset scroll
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
        const main = document.querySelector("main");
        if (main) main.scrollTop = 0;
      });

      const canScrollWheel =
        afterWheelScroll.mainScrollTop > initialScroll.mainScrollTop ||
        afterWheelScroll.windowScrollY > initialScroll.windowScrollY ||
        afterWheelScroll.bodyScrollTop > initialScroll.bodyScrollTop ||
        afterWheelScroll.htmlScrollTop > initialScroll.htmlScrollTop;

      const canScrollKey =
        afterKeyScroll.mainScrollTop > initialScroll.mainScrollTop ||
        afterKeyScroll.windowScrollY > initialScroll.windowScrollY ||
        afterKeyScroll.bodyScrollTop > initialScroll.bodyScrollTop ||
        afterKeyScroll.htmlScrollTop > initialScroll.htmlScrollTop;

      const needsScroll = diag.main.scrollHeight > diag.windowInnerHeight;

      results[vp.name][tab] = {
        diag,
        needsScroll,
        canScrollWheel,
        canScrollKey,
        initialScroll,
        afterWheelScroll,
        afterKeyScroll
      };

      console.log(
        `  Tab: ${tab.padEnd(10)} | windowH=${diag.windowInnerHeight} | mainScrollH=${diag.main.scrollHeight} | mainClientH=${diag.main.clientHeight} | needsScroll=${needsScroll} | canWheel=${canScrollWheel} | canKey=${canScrollKey}`
      );
    }
  }

  fs.writeFileSync(
    path.join(rootDir, "docs", "reviews", "scroll-diagnostic-results.json"),
    JSON.stringify(results, null, 2)
  );

  console.log("\nResults written to docs/reviews/scroll-diagnostic-results.json");
  await browser.close();
}

run().catch((err) => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
