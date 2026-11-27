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
| `index.html` | Page shell, nav pills, Filters drawer, timeline, list, GoatCounter loader, cache-busted asset tags |
| `map.js` | Map, list, cards, filters, favorites, country grouping |
| `style.css` | Layout and themes (CSS custom properties). Default light look is cream, black text, and burnt-orange pins; dark mode is near-black with orange accents |
| `makers.json` | All maker records (`updated`, optional `lists`, and a `makers` array) |
| `maker-map-still.png` | Home-map still, also used as `og:image` |
| `data/us-canada.topo.json` | Detailed US + Canada land for the home map (object `usca`) |
| `data/world-110m.topo.json` | World land for the World view and regional zooms |
| `vendor/` | `d3.min.js`, `topojson-client.min.js`, `qrcode-generator.js`, `fuse.min.js`, and their licenses |
| `.nojekyll` | Empty. Required on GitHub Pages |
| `README.md` | This handoff guide |

The site currently has **53 makers**. Recent additions: Blackside Customs (Oceanside, NY), Makar Tools (Olsztyn, Poland), and Kasama (Philippines, country-level pin). Ensso already existed (Los Angeles) and now has `fountain` as well as `regular` in `pen_types`. The owner’s list (`lyfls-favs`) has 10 unranked favs, in this order: Matthew Martin Makes, Autmog, MaxMadCo, Melrose Machine Works, Hungoblin, SPP, MachineWise, Karas Pen Co, Spoke Design, and The Right Choice Painting Company (TRCPC).

Light and dark mode are described under Release process (`?mode=`, not `?theme=`). `?print=1` is a print view for favorites. Do not confuse it with `?still=1`.

## `makers.json` schema

Top level: `{ "updated": "YYYY-MM-DD", "lists": [ ... ], "makers": [ ... ] }`. `lists` is optional and may be omitted or `[]`. There is no `id` field on a maker; `map.js` assigns one at load. Slugs are lowercase, punctuation stripped, spaces to hyphens (see `slugify` in `map.js`).

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
| `pen_types` | array of strings | One or more of `regular`, `fountain`, `multi-pen`, `marker`. `regular` is a standard ballpoint/rollerball/gel pen (bolt, click, twist, or capped). A maker can have several types. If the field is missing, the map treats the maker as `regular` only |
| `first_pen` | string, optional | First-pen year when known |
| `in_maker_index` | boolean | `true` gets the Maker Index ring on the pin |
| `maker_index_url` | string or `null` | Set only when `in_maker_index` is true |
| `lat`, `lon` | number | Pin coordinates, usually 4 decimal places |
| `location_precision` | string | `city`, `state`, `region`, or `country` |
| `geocode_source` | string | e.g. `Nominatim (OSM) city centroid` |

Optional, only when they apply: `status` (`inactive` or `closed`), `status_label`, `status_note`, `city_unconfirmed`, `previously`, `shop_founded_short`.

### Lists

Curated filter lists live in the top-level `lists` array (not on each maker). Each list is one chip in a **Lists** group in the Filters drawer. More lists can be added later without changing the schema.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable chip id, e.g. `pp-top-10-budget-2026` or `lyfls-favs` |
| `label` | string | Chip label, e.g. `PP Top 10 Budget 2026` or `lyfl's favs` |
| `short_label` | string, optional | Short chip label on phones, e.g. `PP Budget`. If omitted, the full `label` is used. |
| `credit` | string, optional | Shown on a maker card with the rank or tag, e.g. `Pocket Priorities` or `lyfl` |
| `rank_prefix` | string, optional | Rank or tag prefix. Ranked lists use this as `PP Budget #1`. Unranked lists use it as the card tag with no number, e.g. `lyfl's fav`. |
| `icon` | string, optional | Icon on the Lists chip in the Filters panel: `list` (default) or `heart`. The owner’s list uses `heart`. |
| `url` | string, optional | Credit link (the source video or article). Omit when there is no source; the card then shows the tag as plain text. |
| `search_terms` | array of strings, optional | Phrases that tick this chip in the Filters search, e.g. `pp top 10`, `pocket priorities`, `lyfl`, `favs`. The list `label` and `credit` are also recognized. |
| `makers` | array | `{ "slug": "...", "rank": 1 }` entries, best-first. `rank` is optional. Unranked lists list slugs in the intended order, with no `rank` field. |

The owner’s list (`lyfls-favs`) is first in this array so it leads the **Lists** group in the Filters panel. It is unranked and currently lists 10 slugs: `matthew-martin-makes`, `autmog`, `maxmadco`, `melrose-machine-works`, `hungoblin`, `spp`, `machinewise`, `karas-pen-co`, `spoke-design`, and `the-right-choice-painting-company`. Those chips stay black with an orange icon (a heart on the owner’s list, a list icon on the others), and turn orange when on. Curated lists are not shown on the homepage discovery bar. The bar keeps Search, a row of light quick-filter chips (Fountain, Under $100, $100–250, and Over $250, each with a count; chips with no matches are hidden), and the Filters button. Those chips use the same Price and Pen type facets as the Filters panel (OR within a group, AND across groups) and turn orange when on. An active list still appears as a removable chip in the status line.

When one list chip is on, a matching maker’s card shows that list’s rank or tag and a credit, for example `PP Budget #1 · Pocket Priorities` or `lyfl's fav · lyfl`. When more than one list chip is on, tags are combined on one line, for example `lyfl's fav · PP New #6`. Ranked tags link to their source video when `url` is set.

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
  "pen_types": ["regular"],
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
3. **Geocode.** Look up coordinates for the given city (Nominatim city centroid is the usual method). Round to about 4 decimals. Set `location_precision` to `city` and `geocode_source` to `Nominatim (OSM) city centroid`. If there is no city, a state- or region-level pin is allowed: `city` is `null`, `location_precision` is `state` or `region`, and the pin sits at a state/region centroid (see Tuff Writer in Arizona and Q3D in Illinois). If only the country is known, use a country-level pin: `city`, `region`, and `region_name` are `null`, `location_precision` is `country`, and the pin sits at a Nominatim country centroid (current examples: Hungoblin in Hungary, Kasama in the Philippines). Never use a street address; the site shows cities when known, never addresses.
4. **Country and grouping.** Use the country alpha-2 code. Every maker whose `country` is in `EUROPE_COUNTRIES` in `map.js` automatically joins the single Europe unit: the World-view “Europe” count pin, the Europe zoom map, the Europe list group, and the Europe country filter. Rows and cards still show that maker’s own country and city. Japan (`JP`), the Philippines (`PH`), South Africa (`ZA`), Australia (`AU`), New Zealand (`NZ`), and Hungary (`HU`) stay their own groups, each with a World-view count pin and a country zoom. US and Canada stay on the home map. You should not need to edit grouping code for a new European maker; if you add a European country code that is not already in `EUROPE_COUNTRIES` / `COUNTRY_NAMES`, add it there so it is included.
5. **Prices, in USD.** Convert any foreign price to USD first, then round the USD amounts:
   - Low = cheapest regular pen, rounded **down**
   - High = highest seen regular pen, rounded **up**
   - $10 steps under $200, $50 steps from $200 through $1,000, $500 steps above $1,000
   - If low and high are equal after rounding, store the same number in both (the card shows a single price)
   - No price if the maker is discontinued — leave `priceLow` and `priceHigh` null (current examples: MaxMadCo, inactive; SPP, closed)
   - If the owner gives a range, use it (after applying this rounding, unless they give an already-final range and tell you to use it exactly)

   The Filters drawer has three groups: Price, Pen type, and Lists. Picks inside a group are combined with **or**, picks across groups with **and**. Nothing selected in a group means “any”. Chips show a live count of how many makers you would see if you selected that chip, given the other groups. A chip with a count of 0 is greyed but still tappable. Makers that do not match are hidden on the map and in the list, not faded.

   Price chips are **Under $100**, **$100–250**, and **Over $250**. A maker appears under every chip its range touches, as implemented in `matchesPriceTier`:

   - Under $100: `priceLow < 100`
   - $100–250: `priceLow <= 250` and `priceHigh >= 100`
   - Over $250: `priceHigh > 250`

   Makers with no price appear in none of the price chips. Pen type chips are **Regular**, **Fountain**, **Multi pen**, and **Marker**, from the maker’s `pen_types` array. List chips come from the top-level `lists` array; a maker is on a list when their slug appears in that list’s `makers`.
6. **Append** the new object to the `makers` array (do not rewrite or reorder existing entries). Update the top-level `updated` date if you are changing data.
7. **Bump the cache version** (see Release process) and recapture `maker-map-still.png` if the home map (US + Canada pins) changed.

## Design rules

Preserve these. Keep the site simple. Brand colors are orange and black. The default **light** look is cream (`#f5ecdc`), burnt-orange pins (`#c2410c`), and black text and rings. **Dark** mode (see Release process) uses near-black backgrounds, orange pins and accents (`#ff7a1a`), and light text. A sun/moon toggle in the header switches modes.

- **Home** is the detailed US + Canada map, including the Hawaii inset. It is not the world map.
- A **World** pill sits at the top-right of the home map. It opens the world view (country count pins).
- A **US & Canada** pill, same style, sits in that same top-right spot on the world view and on regional zooms. It returns to home. It is hidden on home.
- **← World** sits at the top-left on regional zooms (Europe, Hungary, Japan, the Philippines, South Africa, Australia, New Zealand) and returns to the world view.
- Tapping US or Canada (pin or land) from the world view also returns home. Tapping the Europe pin (or any European country with visible makers) zooms to the Europe map, which shows every visible European maker.
- **Favorites** are a local star list, max 5, stored in `localStorage` under `machinedpens-maker-map-favorites`. Favorite pins are orange stars, about pin-sized, with a star-shaped border (the circle/ring is hidden). Do not change that shape.
- **Timeline** is the only map view. The year slider (through `MAX_YEAR` in `map.js`, currently 2026) and play button stay. There is no Price mode and no price-colored pins; every pin uses the standard orange.
- **Filters** opens a side drawer on desktop and a bottom sheet on a phone. A search box sits at the top of that drawer/sheet, above the Price, Pen type, and Lists chip groups (it is not a map overlay). A count such as “12 of 44 makers”, a Reset button, and removable chips under the slider show what is active. The `.map-panel` size must stay the same when the drawer opens or filters are applied (the chips row under the slider is a reserved slot; search lives inside the overlay, so it must not grow the panel).

### Search in the Filters drawer

The drawer search is a small parser plus [Fuse.js](https://fusejs.io) fuzzy matching. There is no AI. Typing ticks matching chips live; tapping chips by hand edits the same `priceFilters` / `typeFilters` / `listFilters` state. Clearing the box drops chips the search turned on and leaves chips you picked by hand. **Reset** clears the box, the “Showing:” line, suggestions, and every chip.

How a query is read:

1. Price number patterns are pulled out first. “Under N” / “below N” / “less than N” ticks every price chip whose bucket overlaps `[0, N)`. “Over N” / “above N” / “more than N” / “N+” ticks chips overlapping `(N, ∞)`. “Between A and B” (or “A–B”, “A to B”) ticks chips overlapping `[A, B]`. Examples: `under 250` → Under $100 and $100–250; `over 250` → Over $250; `between 100 and 250` → $100–250.
2. Remaining words are matched to synonyms (exact whole words or phrases, then Fuse.js fuzzy match for tokens of 4+ characters). Stopwords such as `pen`, `pens`, `the`, `and`, `maker` are ignored. A typo like `fountian pens over 250` ticks Fountain and Over $250.
3. Leftover tokens are matched against makers for the suggestion list (up to five hits). A query that matches the **start of the maker name**, or the **start of any word in the name**, always counts and is listed first (for example `Makar` → Makar Tools, `Black` → Blackside Customs, `Kasa` → Kasama, `Karas` → Karas Pen Co and Everyday Karas). Fuse.js still adds typo and location hits (`name`, `city`, `region`, `region_name`, and country code or the display name in `COUNTRY_NAMES`). Picking a suggestion closes the drawer and zooms/highlights that pin (`focusMaker`). Location hits are suggestions only — there is no hidden location filter.

   Fuzzy chip/synonym matching (step 2) does not swallow a token that already prefixes a maker name. This avoids a clash such as `Makar` being treated as a typo for the Marker chip (`marker` / `markers`) and never suggesting Makar Tools. Exact chip terms such as `marker` still tick Marker, and typo queries such as `fountian` still tick Fountain.

A short “Showing: …” line under the box lists the chips parsed from the current query (not chips the user ticked only by hand). If nothing matches, it reads “No matching filters”.

The list panel’s “Find a maker” box is unchanged: it is a simple substring search on name, city, region name, and country. It does not use this parser or Fuse.js.

**Adding a synonym.** In `map.js`, edit the `SEARCH_SYNONYMS` array. Each entry has `group` (`price`, `type`, or `list`), `value` (a chip id from `PRICE_CHIPS`, `TYPE_CHIPS`, or `LIST_CHIPS`, e.g. `fountain`, `under-100`, or `pp-top-10-budget-2026`), and `terms` (the words or phrases to recognize). List search terms can also be stored on the list in `makers.json` as `search_terms`. Unique terms such as `pp new`, `pp top 10 budget`, `lyfl`, or `favs` tick that one list. Shared phrases such as `pp top 10` or `pocket priorities` do not auto-select a list when more than one list matches; the drawer suggests the matching lists instead so the user can pick one or both. Restart is not needed beyond a refresh; bump the cache version if the file will be published. Do not add a CDN copy of Fuse.js — the local `vendor/fuse.min.js` and `vendor/LICENSE-fuse.txt` are the ones to keep.
- **Do not add Share link or Share image buttons.** They were removed from the UI. Incoming shared-favorite links can still open a “Viewing shared favorites” banner; leave that as is unless asked to change it.
- Featured Maker Index pins keep the ring. Inactive/closed pins stay hollow. Cards show location, shop founded, price (when present), first pen (when present), website, and “Update this entry” (opens a GitHub issue). When a Lists chip is on, a matching maker’s card also shows that list’s rank or unranked tag and credit (for example `PP Budget #1 · Pocket Priorities`, or `lyfl's fav · lyfl`). When two list chips are on, a maker on both shows both tags (for example `lyfl's fav · PP New #6`).

## Release process

Owner approval is required before any push. Show preview screenshots first and wait. Do not publish, force-push, or go live unasked.

**Cache bust.** Every asset URL is versioned with `?v=YYYYMMDD` plus a letter. Current version in this folder: `20261125m`. Do not publish until the owner asks. Live remains whatever was last published until then. Same calendar day: increment the letter. New day: start at `a` (e.g. `20261126a`). Update **every** `?v=` reference in `index.html` and `map.js` together:

- `style.css`, `vendor/d3.min.js`, `vendor/topojson-client.min.js`, `vendor/qrcode-generator.js`, `vendor/fuse.min.js`, `map.js` (in `index.html`)
- `makers.json`, `data/us-canada.topo.json`, `data/world-110m.topo.json` (in `map.js`)

**`?still=1`.** Opens a chrome-free home map (no header, list, timeline, mode bar, nav pills, cards, or stars; labels are drawn on the map). Used to recapture `maker-map-still.png` and as the Open Graph image. Recapture it whenever US + Canada pins change (the still is the home view, 1600×1000 in the current file). Confirm the still page actually renders, with no UI chrome.

**Seasonal theme (Thanksgiving 2026).** A small, removable holiday treatment in three marked blocks: two in `index.html` (a head script, plus a slim banner and leaf marks in the body) and one at the end of `style.css`. It turns on by itself in `America/New_York` from Nov 25, 2026 00:00 through Nov 27, 2026 23:59, and stays off any other time. Preview with `?theme=thanksgiving`; force it off with `?theme=off`. (`?theme=` is reserved for this seasonal switch — light/dark mode uses `?mode=` instead.) When it is on, a dismissible “Happy Thanksgiving from Machined Pens” banner appears above the header, a small cranberry maple leaf sits beside the title, a few falling leaves drift in the header area on larger screens only (not across the map, and not on small screens or when `prefers-reduced-motion` is set), and the page and land fill pick up a slight amber tint (a darker warm tint in dark mode, with a readable cream-on-brown banner). Brand orange pins, panel sizes, and features are unchanged. Dismissing the banner is stored in `localStorage` as `maker-map-thanks-2026`. The theme does not run on `?still=1` or the print view. To remove it later, delete the three “Seasonal: Thanksgiving 2026” blocks.

**Light and dark mode.** A sun/moon button in the header toggles light and dark. Before the first paint, an inline head script in `index.html` sets `data-theme` to `light` or `dark` so the cream light theme does not flash on a dark visit. Order of precedence: `?mode=dark` or `?mode=light` (URL override for that load), then the saved choice in `localStorage` under `maker-map-theme`, then `prefers-color-scheme`. Tapping the toggle writes `maker-map-theme` and drops any `?mode=` from the URL so the saved choice wins on reload. Colors live in CSS custom properties in `style.css` (`:root` / `[data-theme="light"]` for the cream light look, `[data-theme="dark"]` for near-black backgrounds, orange accents, and light text). The map is a D3/SVG drawing, not raster tiles, so land, water, borders, and labels follow those variables. Pins and clusters keep the brand orange (`--pin`) and are not CSS-filtered. Native form controls use `color-scheme`. The toggle is hidden on `?still=1` and the print view.


**GoatCounter.** The page loads `https://gc.zgo.at/count.js` for `https://machinedpens.goatcounter.com/count`. That script is **not** injected when the URL contains `?still=1`, and `track()` in `map.js` also no-ops on the still page. To stop a browser from being counted, open the live map once with the GoatCounter exclusion hash: [https://machinedpens.github.io/#toggle-goatcounter](https://machinedpens.github.io/#toggle-goatcounter) (a built-in GoatCounter control; each browser or device needs this once). Custom events (`event: true`) currently fired from `map.js`:

| Event path | When |
| --- | --- |
| `star/{slug}` | A maker is starred |
| `unstar/{slug}` | A maker is unstarred, including Clear favorites |
| `filter-price/{tier}` | A price chip is turned on (`under-100`, `100-250`, `over-250`) |
| `filter-type/{type}` | A pen type chip is turned on (`regular`, `fountain`, `multi-pen`, `marker`) |
| `filter-list/{id}` | A Lists chip is turned on (e.g. `pp-top-10-budget-2026`) |
| `update-entry/{slug}` | “Update this entry” is clicked |
| `suggest-maker` | “Suggest a maker” is clicked |
| `opened-shared-link` | A shared-favorites URL is opened |

(`share-link` and `share-image` still exist in JS but have no buttons in the current HTML, so they should not fire.)

**Test locally.** Serve this folder over HTTP (so `makers.json` and the topo files load), then check home, World (including Australia, New Zealand, Hungary, and Philippines pins; New Zealand must sit comfortably in the frame), a Europe zoom, Japan, the Philippines, South Africa, Australia or New Zealand, a new maker’s card, the list/country filter, the Filters drawer (search at the top, Price, Pen type, and Lists, including a typo query such as `fountian pens over 250`, a unique list query such as `pp new` or `lyfl`, and an ambiguous list query such as `pp top 10` or `pocket priorities` (which should suggest both PP lists, not the owner’s list), a maker-name suggestion such as `shon`, a no-match query, and a zero-count chip), the list “Find a maker” box, the timeline with filters on, light and dark mode (`?mode=light`, `?mode=dark`, the header toggle, and that the choice persists across a reload), a start-of-word name query such as `Makar` or `Kasa`, and `?still=1`. Confirm the map panel does not change size when Filters opens, search suggestions appear, or a filter is applied.

**Publish**, only after the owner approves the previews: commit to `main` in `machinedpens/machinedpens.github.io`, keep `.nojekyll` and this `README.md`, and verify the live site at https://machinedpens.github.io (hard-refresh so the new `?v=` assets load).

## Ideas backlog

Unbuilt ideas — do not start these unless the owner asks:

- Where to buy
- Read my review
- Most starred badge
- Tags
- Compare
