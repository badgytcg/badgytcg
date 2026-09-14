# BadgyTCG — Project Reference

The complete reference for **badgytcg.com**, a fan storefront for Pudgy Penguins'
**Vibes TCG** — singles, foils, graded slabs, and pre-built decks. Not affiliated
with Orange Cap Games.

> This doc is the "how it all works and where everything lives" reference.
> Companion docs: [`API.md`](./API.md) (public pricing feed) and
> [`MARKETING.md`](./MARKETING.md) (ready-to-post copy).

---

## 1. Stack & hosting

| Piece | What / where |
|---|---|
| **Framework** | Next.js (App Router) + React + TypeScript + Tailwind |
| **Database** | PostgreSQL, via **Prisma** ORM |
| **Hosting** | **Railway** (auto-deploys from the `main` branch on GitHub) |
| **Repo** | `github.com/badgytcg/badgytcg` |
| **Domain** | `badgytcg.com` — bought through Railway, registered on **Name.com** backend; DNS records are managed in **Railway → the service → Settings → Domains** |
| **Auth** | Google OAuth via Auth.js (NextAuth v5), database sessions |
| **Payments** | **Stripe** Checkout (hosted) + webhook |
| **Email** | **Resend** (HTTP API — Railway blocks SMTP) |
| **Market price sources** | **Dyli** (API) and **StarCityGames** (scraped). MinMax was removed (they stopped selling Vibes) |

Deploy = push to `main`. Railway rebuilds and redeploys automatically.

---

## 2. Environment variables

Set in **Railway → Variables** (and mirrored in local `.env` for dev).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (Railway Postgres) |
| `AUTH_SECRET` | Auth.js session/CSRF signing secret |
| `AUTH_GOOGLE_ID` | Google OAuth client ID (auto-detected by Auth.js v5) |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret (auto-detected) |
| `AUTH_URL` | Canonical site URL, `https://badgytcg.com` |
| `AUTH_TRUST_HOST` | `true` — required on Railway (behind a proxy) |
| `ADMIN_EMAILS` | Comma-separated admin emails (e.g. `badgytcg@gmail.com`). Controls all `/admin` access AND is where order alerts + the daily report go |
| `STRIPE_SECRET_KEY` | Stripe API key (payments, refunds) |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook signatures |
| `RESEND_API_KEY` | Resend API key (all outbound email) |
| `FROM_EMAIL` | Sender address, `orders@badgytcg.com` (must be on the Resend-verified domain) |
| `DYLI_API_KEY` | Dyli marketplace API key (market prices) |
| `ANTHROPIC_API_KEY` | (present; for any AI features) |
| `CRON_SECRET` | Guards the manual inventory-backup cron endpoint |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | **Legacy** — Gmail SMTP fallback for local dev only. Ignored in prod once `RESEND_API_KEY` is set. Railway blocks SMTP so these don't work there |

---

## 3. Data model (Prisma)

Auth.js tables: **User, Account, Session, VerificationToken**.

| Model | Holds |
|---|---|
| **User** | Customer/admin accounts (Google sign-in). Relations to orders, wishlist items, bills |
| **Order / OrderItem** | Paid orders + line items. Order stores status, total, Stripe session id, and the **shipping address** (`shipName`, `shipLine1/2`, `shipCity`, `shipState`, `shipPostal`, `shipCountry`, `shipPhone`) |
| **Bill / BillItem** | Admin-created private invoices for a customer (see §6) |
| **WishlistItem** | Wishlist + card/deck requests (distinguished by `note`) |
| **CardOverride** | The live price/stock **and consigner owner** for a base card (source of truth over the static catalog). `ownerSplit` JSON supports splitting one card's stock across multiple consigners |
| **CardVariantOverride** | Foil / alt-foil price+stock per card |
| **SpecialCard** | Graded slabs & promos (one-offs), image can be a URL or uploaded data URL |
| **FeaturedDeck** | Homepage pre-built decks (starter/meta). `heroCard` picks the showcase card; else the rarest card is auto-chosen |
| **Consigner** | People whose cards sell through the shop (slug + name + email) |
| **MarketPrice / MarketPriceHistory** | Latest + historical comparison prices per card+source (dyli/scg) |
| **AdminAuditLog** | Every admin action (price edits, refunds, bills, messages, owner changes) |

Migrations live in `prisma/migrations/`. Apply with `npx prisma migrate deploy`
(prod) / `migrate dev` (local), then `npx prisma generate`.

---

## 4. Storefront (customer-facing)

- **Browse Singles** (`/vibes`) — 5,000+ cards; filters by set/color/type/rarity/attribute/cost/vibe/variant; live market prices (Dyli/SCG) shown per card. Selecting the **Foil/Holo** filter auto-switches every tile to its foil price/art.
- **Card detail** (`/vibes/cards/[id]`) — art, price, stock, foil/alt-foil toggle, market price history chart.
- **Graded Cards & Promos** (`/vibes/special`) — full-slab images, add to cart / wishlist.
- **Market Prices** (`/vibes/market`) — gainers/decliners, best deals, budget picks.
- **Import a Deck** (`/vibes/deck-import`) — paste a deck code (plain text or JSON `{deckName, counts}`); matches to live stock, prices the whole build, buy in-stock or request the rest.
- **Pre-Built Decks** (homepage showcase + `/vibes/decks/[id]`) — starter/meta decks, auto-priced from card prices, rarest card as the hero image, carousel pauses on interaction.
- **Cart / Checkout** (`/cart`) — Stripe Checkout, US shipping address collected, tiered shipping (see §5).
- **Account** (`/account`) — Google sign-in, order history, **bills to pay** ("Cards Ready for You"), wishlist summary.
- **Requests require sign-in** — a guest trying to request a card/deck gets a "Sign in to send your request" prompt; the request is preserved and synced to their account after sign-in (so the admin actually sees it).

---

## 5. Payments, shipping & refunds

**Payments:** Stripe Checkout (hosted). The webhook (`/api/webhooks/stripe`) records the order, decrements stock, snapshots consigner ownership, saves the shipping address, emails an order alert to the admin, and marks any linked bill paid. It's idempotent (ignores duplicate Stripe retries).

**Shipping tiers** (in `src/lib/shipping.ts`, sized by card count — no free tier because orders may ship from multiple consigners):
- **Over 50 cards** → small box, flat **$8.99** tracked
- **13–50 cards, or $20+ subtotal** → bubble mailer, **$4.99** tracked
- **≤12 cards and under $20** → **$1.29** PWE (untracked) **or** $4.99 tracked (buyer's choice)

**Refunds:** On the admin **Orders** page, paid/fulfilled orders show a **Refund** button → full Stripe refund via the payment intent → order marked `refunded`, shown with a green "✓ Refunded $X" confirmation, logged in the Activity Log. Money lands back on the card in 5–10 business days (card-network timing). Stripe also emails the customer automatically.

**Shipping address:** stored on each order and shown as a **"Ship to"** block (with a Copy button) on the admin Orders page. Also always available in the Stripe Dashboard.

---

## 6. Private bills (invoices)

For selling requested cards directly to a customer.

- Admin **Bills** tab (or **"Bill selected"** on the Requests tab) → pick a customer, add cards (auto-priced at current store price), send.
- Customer sees it on their **Account** page under "Cards Ready for You" and can **Pay** (Stripe) or **Add to cart**; they also get an email.
- On payment, the Stripe webhook marks the bill `paid`.
- From **Requests**, each customer's requested cards are grouped with checkboxes — bill **all, some, or one** in a click; "Edit in Bills tab →" carries the selection over pre-filled.

---

## 7. Admin (`/admin`, gated by `ADMIN_EMAILS`)

| Tab | Does |
|---|---|
| **Requests** | Wishlist / card / deck requests, grouped per customer with one-click billing |
| **Inventory** | Edit price/stock, bulk price update (fixed or Dyli/SCG floor by set/rarity/color), bulk-add by text, CSV restore, consigner owner (incl. split ownership), bulk card search |
| **Foils** | Foil / alt-foil stock + prices, bulk price update, Dyli/MinMax/SCG comps + manual SCG entry |
| **Graded & Promos** | One-off slabs/promos; image via URL or file upload |
| **Scan** | (card scanning helper) |
| **Orders** | Status, **shipping address**, **Message customer** (email), **Refund** |
| **Bills** | Create/send private bills; see status |
| **Consigners** | People whose cards sell through the shop |
| **Sales Report** | Itemized consigner sales for payouts/taxes; CSV export |
| **Featured Decks** | Homepage pre-built decks (name/type/description/hero card/discount/card list) |
| **Stats** | Inventory value, tiers, out-of-stock |
| **Activity Log** | Every admin action, audited |

**Security:** every `/admin/*` API route re-checks `isAdminEmail()`. Admin mutations are rate-limited. Auth is Google OAuth — so admin security = the Google account's security (keep 2-Step Verification on for `badgytcg@gmail.com`).

---

## 8. Email (Resend)

All outbound email goes through **Resend** over HTTPS (Railway blocks SMTP, so Gmail/SMTP times out there). `src/lib/email.ts` uses Resend when `RESEND_API_KEY` is set, else falls back to Gmail SMTP (local dev only).

**What sends email:**
- **Order confirmation** (to customer, automatic on payment — "hype" tone, `src/lib/orderEmails.ts`)
- **Shipped notification** with clickable tracking link (to customer, when admin adds a tracking number)
- Order messages (admin → customer, from the Orders tab)
- Bill notifications (customer)
- New-order alerts (to admin)
- Daily inventory report — 6:00 AM Pacific, via the in-app scheduler in `src/instrumentation.ts` (also triggerable via `/api/cron/inventory-backup` with `CRON_SECRET`)

**Setup that's done:** `badgytcg.com` is verified in Resend (DNS records — DKIM `resend._domainkey`, CNAMEs `rsend`/`send`, DMARC `_dmarc` — live in Railway's domain DNS). `FROM_EMAIL=orders@badgytcg.com`.

---

## 9. Market prices

`src/lib/marketPrices.ts`. **Refresh Market Prices** (Inventory page) or the daily job pulls:
- **Dyli** — API. Uses secondary/resale floor price; falls back to the primary/direct listing price when there's no resale floor (recovers ~200 prices, many Holo variants), skipping "Fair Drop Entry" gacha listings.
- **StarCityGames** — scraped with a headless browser (Playwright).
- Runs are serialized (one at a time) so concurrent scrapes can't stack Chromium processes.

Prices are **comparison data only** — stored in `MarketPrice`/`MarketPriceHistory`. They never touch your actual sale prices (`CardOverride`). Sale prices only change when you edit them or use Bulk Price Update.

---

## 10. Public pricing API

`GET /api/public/prices` — read-only, CORS-open, rate-limited, edge-cached. For partner sites to show live pricing and link shoppers back. Full docs in [`API.md`](./API.md).

---

## 11. Promo videos

A full motion-graphics promo pipeline lives in `promo/` with a `/promo-video` skill (`.claude/skills/promo-video/`). Generates a 1080p hype video (site screenshots in browser frames, kinetic type, floating card art, synthesized soundtrack). See the skill's `SKILL.md`. Delivered videos live on the Desktop (`badgytcg-promo.mp4`).

---

## 12. Operations runbook (common issues)

**Sign-in fails with `error=Configuration` (500):** Almost always the Google OAuth secret. The redirect to Google working but the callback 500ing = wrong/stale `AUTH_GOOGLE_SECRET`. Rotate it: Google Cloud Console → Credentials → the "Badgytcg" OAuth client → add a new client secret → paste into Railway `AUTH_GOOGLE_SECRET` → redeploy. Confirm the redirect URI `https://badgytcg.com/api/auth/callback/google` is listed on the client.

**Email "connection timed out" / hangs on send:** Railway blocks outbound SMTP. Must use Resend (set `RESEND_API_KEY` + `FROM_EMAIL`). Never revert to Gmail/SMTP in prod.

**Email "sender not verified":** The Resend domain isn't verified, or `FROM_EMAIL` isn't on `badgytcg.com`. Verify the domain in Resend.

**"Refresh Market Prices" seems stuck:** SCG scrape spins up a headless browser and is the slow part; runs are locked to one at a time. If it fails, Dyli still updates.

**Where are shipping addresses:** admin Orders page ("Ship to" block) and the Stripe Dashboard (Payments → the payment → Shipping details).

---

## 13. What was built (session changelog, most recent first)

- **Order confirmation + shipped emails** — auto-confirmation on payment; shipped email with tracking link when tracking is added.
- **Order tracking numbers** — admin adds tracking + carrier (USPS/UPS/FedEx/Other); customer sees a clickable "track package" link; adding tracking auto-marks fulfilled.
- **Admin orders grouped by customer** — collapsible dropdowns with per-customer order count + total.
- **Shipping addresses on orders** — captured from Stripe, stored, shown with Copy button; existing orders backfilled.
- **Public pricing API** (`/api/public/prices`) — CORS feed for partner sites.
- **In-site Stripe refunds** — Refund button on the Orders page with clear confirmation.
- **Bill from Requests** — check all/some/one of a customer's requests → one-click bill.
- **Private bills** — admin invoices payable via Stripe or add-to-cart, with email + account-page display.
- **Sign-in required for requests** — so guest requests actually reach the admin.
- **Resend email** — replaced Gmail SMTP (Railway blocks it); powers order messages, bill notices, order alerts, daily report.
- **Holo filter auto-pricing + Dyli price gaps filled** — Foil filter switches tiles to foil prices; Dyli primary-listing fallback.
- **MinMax removed** as a market source.
- **Featured decks** polish — bigger hero card, admin-pickable showcase card, slower/pausing carousel, JSON deck lists priced correctly.
- **Deck descriptions** — buyer-facing archetype write-ups.
- **Split consigner ownership** — one card's stock across multiple owners; owner editable in bulk search.
- **Graded card image upload** (URL or file), foil floor pricing + manual SCG entry.
- **Cart page dark-theme fix + card-art backdrop.**
- **TCG shipping rates** (card-count tiers), **daily 6am inventory report**, **security hardening** (email masking, rate limits, refresh serialization).
</content>
