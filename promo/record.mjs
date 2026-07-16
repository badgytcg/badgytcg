// Records promo/stage.html to a 1920x1080 webm via Playwright.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ?? here;

const browser = await chromium.launch({ args: ["--force-device-scale-factor=1"] });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: outDir, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
await page.goto("file://" + join(here, "stage.html").replace(/\\/g, "/"), { waitUntil: "networkidle" });
// make sure every image (screenshots + card art) is decoded before starting
await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => {}))));
await page.waitForTimeout(500);
await page.evaluate(() => window.__start());
await page.waitForFunction(() => window.__done === true, null, { timeout: 60000 });
await context.close();
const path = await page.video().path();
console.log("VIDEO:" + path);
await browser.close();
