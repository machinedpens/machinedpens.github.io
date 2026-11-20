# Machined Pens Maker Map

A directory of machined pen makers, shown as a map and a list. It is not a comprehensive catalog — it covers makers Teja follows and ones that come up most in the community. Some are featured in [The Maker Index](https://machinedpens.substack.com/p/the-maker-index-all-makers); many are not.

- Live site: https://machinedpens.github.io
- Repo: [machinedpens/machinedpens.github.io](https://github.com/machinedpens/machinedpens.github.io)
- Static site (D3 v7 + topojson-client, vendored) on GitHub Pages
- Keep the empty `.nojekyll` file in the repo root so Pages does not run Jekyll

The published site is this folder: HTML, CSS, JS, `makers.json`, map data, and the still image. There is no build step and no server-side code.

## File map

| File | Role |
| --- | --- |
| `index.html` | Page shell, nav pills, Timeline/Price controls, list, GoatCounter loader, cache-busted asset tags |
| `map.js` | Map, list, cards, filters, favorites, country grouping |
| `style.css` | Layout and themes. Default theme is Warm (cream, black text, burnt-orange pins) |
| `makers.json` | All maker records (`updated` plus a `makers` array) |
| `maker-map-still.png` | Home-map still, also used as `og:image` |
| `data/us-canada.topo.json` | Detailed US + Canada land for the home map (object `usca`) |
| `data/world-110m.topo.json` | World land for the World view and regional zooms |
| `vendor/` | `d3.min.js`, `topojson-client.min.js`, `qrcode-generator.js`, and their licenses |
| `.nojekyll` | Empty. Required on GitHub Pages |
| `README.md` | This handoff guide |

`?theme=light`, `dark`, `bold`, or `warm` (or `1`–`4`) can restyle the page. There is no on-page theme toggle. Leave the default Warm unless asked to change it.

`?print=1` is a print view for favorites. Do not confuse it with `?still=1`.

## `makers.json` schema

Top level: `{ "updated": "YYYY-MM-DD", "makers": [ ... ] }`. There is no `id` field; `map.js` assigns one at load. Slugs are lowercase, punctuation stripped, spaces to hyphens (see `slugify` in `map.js`).

Typical fields on a current entry:

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Display name |
| `slug` | string | Stable key for favorites and issue links |
| `website` | string | Official site or the URL that was supplied |
| `city` | string or `null` | City when known; `null` for a state/region pin |
| `region` | string | State/province code (e.g. `NC`, `AZ`) or a region name (e.g. `England`) |
| `region_name` | string | Full region name (`North Carolina`, `Arizona`, `Łódzkie`) |
| `country` | string | Alpha-2 code used in data: `US`, `CA`, `UK`, `JP`, `ZA`, `PL`, and other European codes listed in `EUROPE_COUNTRIES` in `map.js`. `UK` is used in the data (not `GB`), though both are treated as Europe |
| `est_year` | number | Numeric year for the timeline slider |
| `shop_founded` | string | What the card shows (`2016`, sometimes `by 2020` or `2014–2015`) |
| `priceLow`, `priceHigh` | number or `null` | USD integers after rounding. Omit both (`null`) when there is no price |
| `first_pen` | string, optional | First-pen year when known |
| `in_maker_index` | boolean | `true` gets the Maker Index ring on the pin |
| `maker_index_url` | string or `null` | Set only when `in_maker_index` is true |
| `lat`, `lon` | number | Pin coordinates, usually 4 decimal places |
| `location_precision` | string | `city`, `state`, or `region` |
| `geocode_source` | string | e.g. `Nominatim (OSM) city centroid` |

Optional, only when they apply: `status` (`inactive` or `closed`), `status_label`, `status_note`, `city_unconfirmed`, `previously`, `shop_founded_short`.

Example (Hypercut MFG, as stored):

```json
{
  "name": "Hypercut MFG",
  "slug": "hypercut-mfg",
  "website": "https://hypercutmfg.com",
  "city": "Hendersonville",
  "region": "NC",
  "region_name": "North Carolina",
  "country": "US",
  "est_year": 2020,
  "shop_founded": "2020",
  "priceLow": 160,
  "priceHigh": 250,
  "first_pen": "2026",
  "in_maker_index": false,
  "maker_index_url": null,
  "lat": 35.3187,
  "lon": -82.461,
  "location_precision": "city",
  "geocode_source": "Nominatim (OSM) city centroid"
}
```

## How to add a maker

Never invent data. If a field is unverified, leave it off or `null`. If the owner supplies values, use them as given (and note the source as per the owner). Official sites, about/contact pages, Kickstarter, and reputable press are the usual sources when research is requested; do not research when the owner says not to.

1. **Check for a duplicate.** If the maker is already in `makers.json`, do not add a second entry. Report the differences and only change existing fields when asked.
2. **Fill the fields above.** `est_year` is the start year as a number. `shop_founded` is the string shown on the card. Set `first_pen` only when you have a value; if the owner says to set it equal to the start year, do that and nothing else. `in_maker_index` is `false` unless they are actually featured.
3. **Geocode.** Look up coordinates for the given city (Nominatim city centroid is the usual method). Round to about 4 decimals. Set `location_precision` to `city` and `geocode_source` to `Nominatim (OSM) city centroid`. If there is no city, a state- or region-level pin is allowed: `city` is `null`, `location_precision` is `state` or `region`, and the pin sits at a state/region centroid (see Tuff Writer in Arizona and Q3D in Illinois). Never use a street address; the site shows cities when known, never addresses.
4. **Country and grouping.** Use the country alpha-2 code. Every maker whose `country` is in `EUROPE_COUNTRIES` in `map.js` automatically joins the single Europe unit: the World-view “Europe” count pin, the Europe zoom map, the Europe list group, and the Europe country filter. Rows and cards still show that maker’s own country and city. Japan (`JP`) and South Africa (`ZA`) stay their own groups. US and Canada stay on the home map. You should not need to edit grouping code for a new European maker; if you add a European country code that is not already in `EUROPE_COUNTRIES` / `COUNTRY_NAMES`, add it there so it is included.
5. **Prices, in USD.** Convert any foreign price to USD first, then round the USD amounts:
   - Low = cheapest regular pen, rounded **down**
   - High = highest seen regular pen, rounded **up**
   - $10 steps under $200, $50 steps from $200 through $1,000, $500 steps above $1,000
   - If low and high are equal after rounding, store the same number in both (the card shows a single price)
   - No price if the maker is discontinued — leave `priceLow` and `priceHigh` null (current examples: MaxMadCo, inactive; SPP, closed)
   - If the owner gives a range, use it (after applying this rounding, unless they give an already-final range and tell you to use it exactly)

   Price filter chips (and the list price filter) are **Under $100**, **$100–250**, and **Over $250**. A maker appears under every chip its range touches, as implemented in `matchesPriceTier`:

   - Under $100: `priceLow < 100`
   - $100–250: `priceLow <= 250` and `priceHigh >= 100`
   - Over $250: `priceHigh > 250`

   Makers with no price appear in none of the chips.
6. **Append** the new object to the `makers` array (do not rewrite or reorder existing entries). Update the top-level `updated` date if you are changing data.
7. **Bump the cache version** (see Release process) and recapture `maker-map-still.png` if the home map (US + Canada pins) changed.

## Design rules

Preserve these. Keep the site simple. Default colors are orange and black (Warm theme: cream background `#f5ecdc`, burnt-orange pins `#c2410c`, black text and rings).

- **Home** is the detailed US + Canada map, including the Hawaii inset. It is not the world map.
- A **World** pill sits at the top-right of the home map. It opens the world view (country count pins).
- A **US & Canada** pill, same style, sits in that same top-right spot on the world view and on regional zooms. It returns to home. It is hidden on home.
- **← World** sits at the top-left on regional zooms (Europe, Japan, South Africa) and returns to the world view.
- Tapping US or Canada (pin or land) from the world view also returns home. Tapping the Europe pin (or any European country with visible makers) zooms to the Europe map, which shows every visible European maker.
- **Favorites** are a local star list, max 5, stored in `localStorage` under `machinedpens-maker-map-favorites`. Favorite pins are orange stars, about pin-sized, with a star-shaped border (the circle/ring is hidden). Do not change that shape.
- **Timeline** (default) and **Price** are the two map modes. Timeline uses the year slider (through `MAX_YEAR` in `map.js`, currently 2026). Price mode uses the chips above and tints pins by cheapest-tier (`priceTintTier`).
- **Do not add Share link or Share image buttons.** They were removed from the UI. Incoming shared-favorite links can still open a “Viewing shared favorites” banner; leave that as is unless asked to change it.
- Featured Maker Index pins keep the ring. Inactive/closed pins stay hollow. Cards show location, shop founded, price (when present), first pen (when present), website, and “Update this entry” (opens a GitHub issue).

## Release process

Owner approval is required before any push. Show preview screenshots first and wait. Do not publish, force-push, or go live unasked.

**Cache bust.** Every asset URL is versioned with `?v=YYYYMMDD` plus a letter. Current live version: `20261120e`. The next change on this date should use `20261120f`. Same calendar day: increment the letter. New day: start at `a` (e.g. `20261121a`). Update **every** `?v=` reference in `index.html` and `map.js` together:

- `style.css`, `vendor/d3.min.js`, `vendor/topojson-client.min.js`, `vendor/qrcode-generator.js`, `map.js` (in `index.html`)
- `makers.json`, `data/us-canada.topo.json`, `data/world-110m.topo.json` (in `map.js`)

**`?still=1`.** Opens a chrome-free home map (no header, list, timeline, mode bar, nav pills, cards, or stars; labels are drawn on the map). Used to recapture `maker-map-still.png` and as the Open Graph image. Recapture it whenever US + Canada pins change (the still is the home view, 1600×1000 in the current file). Confirm the still page actually renders, with no UI chrome.

**GoatCounter.** The page loads `https://gc.zgo.at/count.js` for `https://machinedpens.goatcounter.com/count`. That script is **not** injected when the URL contains `?still=1`, and `track()` in `map.js` also no-ops on the still page. Custom events (`event: true`) currently fired from `map.js`:

| Event path | When |
| --- | --- |
| `star/{slug}` | A maker is starred |
| `unstar/{slug}` | A maker is unstarred, including Clear favorites |
| `mode/price` / `mode/timeline` | Map mode is switched |
| `filter-price/{tier}` | A price chip is turned on (`under-100`, `100-250`, `over-250`) |
| `update-entry/{slug}` | “Update this entry” is clicked |
| `suggest-maker` | “Suggest a maker” is clicked |
| `opened-shared-link` | A shared-favorites URL is opened |

(`share-link` and `share-image` still exist in JS but have no buttons in the current HTML, so they should not fire.)

**Test locally.** Serve this folder over HTTP (so `makers.json` and the topo files load), then check home, World, a Europe zoom, Japan or South Africa, a new maker’s card, the list/country filter, Timeline and Price, and `?still=1`.

**Publish**, only after the owner approves the previews: commit to `main` in `machinedpens/machinedpens.github.io`, keep `.nojekyll` and this `README.md`, and verify the live site at https://machinedpens.github.io (hard-refresh so the new `?v=` assets load).

## Ideas backlog

Unbuilt ideas — do not start these unless the owner asks:

- Where to buy
- Read my review
- Most starred badge
- Tags
- Compare
