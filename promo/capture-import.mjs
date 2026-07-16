// Captures the deck-import flow with a real deck code: paste state + result state.
import { chromium } from "playwright";

const DECK_CODE = JSON.stringify({
  deckName: "BigBash",
  counts: {
    BigBen: 4, LilFrosty: 4, SpringaLeak: 4, WonderWeaver: 4, GamingPenguin: 4,
    LavishPenguin: 2, FindersKeepers: 4, GlimmeringCoins: 3, MerchantPenguin: 4,
    BreakawayBalloon: 2, BullishSentiment: 3, TravelersLantern: 4,
    TeleporterPenguin: 2, BirbWhos100FeetTall: 4, BashfulSwordsmanPenguin: 4,
  },
}, null, 2);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("https://badgytcg.com/vibes/deck-import", { waitUntil: "networkidle", timeout: 60000 });

await page.fill("textarea", DECK_CODE);
await page.waitForTimeout(600);
await page.screenshot({ path: "promo/assets/deck-import-paste.png" });
console.log("✓ deck-import-paste");

await page.click('button:has-text("Check Deck")');
await page.waitForTimeout(3000);
// full-page shot so the promo can pan through the entire matched deck —
// stats, card grid, in-stock list, price total, and buy buttons
await page.screenshot({ path: "promo/assets/deck-import-result.png", fullPage: true });
console.log("✓ deck-import-result (full page)");

await browser.close();
