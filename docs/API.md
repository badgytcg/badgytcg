# BadgyTCG Public Pricing API

A public, read-only pricing feed for partner sites. No API key needed.
CORS is open, so you can call it directly from a browser or a server.

## Endpoint

```
GET https://badgytcg.com/api/public/prices
```

## Query parameters (all optional)

| Param | Example | Effect |
|---|---|---|
| `q` | `?q=penguin` | Substring search on card name (case-insensitive) |
| `set` | `?set=Enter the Huddle` | Filter by exact set name |
| `inStockOnly` | `?inStockOnly=true` | Only cards with stock > 0 |
| `limit` | `?limit=50` | Cap results (default 1000, max 5000) |

## Response

```json
{
  "source": "badgytcg.com",
  "updatedAt": "2026-09-14T...Z",
  "count": 2,
  "cards": [
    {
      "name": "Contemplation Penguin",
      "set": "Enter the Huddle",
      "rarity": "Common",
      "price": 0.60,
      "inStock": true,
      "stock": 23,
      "image": "https://ocg-card-catalog.s3.../ContemplationPenguin.png",
      "url": "https://badgytcg.com/vibes/cards/eth-contemplationpenguin",
      "market": { "dyli": 0.60, "scg": 0.49 }
    }
  ]
}
```

- `price` — the BadgyTCG store price (USD).
- `url` — deep link to the card's page. **Use this to send shoppers to the shop.**
- `market` — comparison prices (Dyli / StarCityGames) when available; omitted if none.

## Example (JavaScript)

```js
const res = await fetch(
  "https://badgytcg.com/api/public/prices?q=penguin&inStockOnly=true"
);
const { cards } = await res.json();
cards.forEach((c) => {
  console.log(`${c.name} — $${c.price} — ${c.inStock ? "in stock" : "sold out"}`);
  // link buyers over via c.url
});
```

## Notes / limits

- **Cache:** responses are edge-cached ~5 minutes.
- **Rate limit:** 120 requests/min per IP (429 if exceeded).
- **CORS:** `Access-Control-Allow-Origin: *`; `OPTIONS` preflight is handled.
- Covers base singles. Ask BadgyTCG if you need foils/graded, a single-card
  lookup by exact name, or a CSV format — easy to add.

## Implementation

Route: `src/app/api/public/prices/route.ts`.
</content>
