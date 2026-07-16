// Captures 1920x1080 screenshots of badgytcg.com pages for the promo stage.
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = new URL("./assets/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

async function shot(url, name, { scrollTo = 0, wait = 2500 } = {}) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  if (scrollTo) { await page.evaluate((y) => window.scrollTo(0, y), scrollTo); }
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log("✓", name);
}

const SITE = "https://badgytcg.com";
await shot(SITE, "home-hero");
// deck showcase section
await page.goto(SITE, { waitUntil: "networkidle" });
const deckY = await page.evaluate(() => {
  const el = [...document.querySelectorAll("section")].find((s) => s.textContent.includes("Pre-Built Decks"));
  return el ? el.getBoundingClientRect().top + window.scrollY - 40 : 1200;
});
await page.evaluate((y) => window.scrollTo(0, y), deckY);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}deck-showcase.png` });
console.log("✓ deck-showcase");

await shot(`${SITE}/vibes`, "browse-grid", { scrollTo: 300, wait: 3000 });
await shot(`${SITE}/vibes/special`, "graded", { wait: 3000 });
await shot(`${SITE}/vibes/deck-import`, "deck-import", { wait: 2500 });

await browser.close();
console.log("done");
