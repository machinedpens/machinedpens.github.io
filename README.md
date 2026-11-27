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
| `style.css` | Layout and themes (CSS custom properties). Default light look is cream, black text, and burnt-orange pins; dark mode is near-black with orange accents; the Terminal fun theme is monospace orange-on-black and the Notebook fun theme is blue ink on notebook paper, with a handwriting and paper choice (see Themes) |
| `makers.json` | All maker records (`updated`, `attrs_source`, optional `lists`, and a `makers` array) |
| `tools/derive_attrs.py` | Rerunnable script that fills each maker’s `mechanisms` and `materials` from a product catalog (see Mechanism and material data). Not loaded by the site |
| `maker-map-still.png` | Home-map still, also used as `og:image` |
| `data/us-canada.topo.json` | Detailed US + Canada land for the home map (object `usca`) |
| `data/world-110m.topo.json` | World land for the World view and regional zooms |
| `vendor/` | `d3.min.js`, `topojson-client.min.js`, `qrcode-generator.js`, `fuse.min.js`, the self-hosted font files used only by the fun themes (IBM Plex Mono for Terminal, `ibm-plex-mono-latin-*.woff2`; Caveat for Notebook, `caveat-latin-500-normal.woff2` and `caveat-latin-700-normal.woff2`; Carattere and Architects Daughter for Notebook's optional Italic and Architect handwriting, `carattere-latin-400-normal.woff2` and `architects-daughter-latin-400-normal.woff2`), and their licenses (SIL OFL 1.1 for the fonts) |
| `.nojekyll` | Empty. Required on GitHub Pages |
| `README.md` | This handoff guide |

The site currently has **53 makers**. Recent additions: Blackside Customs (Oceanside, NY), Makar Tools (Olsztyn, Poland), and Kasama (Philippines, country-level pin). Ensso already existed (Los Angeles) and now has `fountain` as well as `regular` in `pen_types`. The owner’s list (`lyfls-favs`) has 10 unranked favs, in this order: Matthew Martin Makes, Autmog, MaxMadCo, Melrose Machine Works, Hungoblin, SPP, MachineWise, Karas Pen Co, Spoke Design, and The Right Choice Painting Company (TRCPC).

Themes (light, dark, and the fun themes Terminal and Notebook) are described under Themes and Release process (`?mode=`, not `?theme=`). `?print=1` is a print view for favorites. Do not confuse it with `?still=1`.

## `makers.json` schema

Top level: `{ "updated": "YYYY-MM-DD", "attrs_source": "catalog YYYY-MM-DD", "lists": [ ... ], "makers": [ ... ] }`. `lists` is optional and may be omitted or `[]`. There is no `id` field on a maker; `map.js` assigns one at load. Slugs are lowercase, punctuation stripped, spaces to hyphens (see `slugify` in `map.js`).

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
| `mechanisms` | array of strings | Derived, not hand-edited (see below). Any of `bolt-action`, `side-click`, `top-click`, `twist`, `capped`, `magnetic`, `knock`, in that fixed order. Empty = not yet tagged |
| `materials` | array of strings | Derived. Lowercase-hyphen ids such as `titanium`, `stainless-steel`, `damascus`, ordered by how many of the maker’s pens use each (so the first three are its “main” materials, shown on the card). Empty = not yet tagged |
| `attrs_source` | string | Where `mechanisms` / `materials` came from, e.g. `catalog 2026-11-27` |
| `first_pen` | string, optional | First-pen year when known |
| `in_maker_index` | boolean | `true` gets the Maker Index ring on the pin |
| `maker_index_url` | string or `null` | Set only when `in_maker_index` is true |
| `lat`, `lon` | number | Pin coordinates, usually 4 decimal places |
| `location_precision` | string | `city`, `state`, `region`, or `country` |
| `geocode_source` | string | e.g. `Nominatim (OSM) city centroid` |

Optional, only when they apply: `status` (`inactive` or `closed`), `status_label`, `status_note`, `city_unconfirmed`, `previously`, `shop_founded_short`.

### Mechanism and material data

`mechanisms` and `materials` are generated from a product catalog (one row per product, with `maker_slug`, `pen_type`, `mechanism`, `materials`, `checked_date`, among other fields). Do not edit them in `makers.json` by hand: re-run the script so they stay reproducible. The current data comes from the catalog snapshot **2026-11-27** (2,712 products, 44 of 53 makers covered).

**Refresh from a new catalog:**

```
python3 tools/derive_attrs.py /path/to/catalog.json            # rewrites makers.json in place
python3 tools/derive_attrs.py /path/to/catalog.json --dry-run  # summary only, writes nothing
python3 tools/derive_attrs.py /path/to/catalog.json --in-stock-only
```

Then update the top-level `updated` date if you like, bump the cache version, and check the Filters drawer. The script overwrites only `mechanisms`, `materials`, and `attrs_source` (per maker, plus the top-level `attrs_source`, which is set to `catalog <latest checked_date>`). It prints the makers per mechanism and material, makers with no pens in the catalog, makers with no tags, and any material or mechanism it could not map. A slug in the catalog that is not in `makers.json` is ignored, so add new makers to `makers.json` first. The `makers.json` slugs must match the catalog’s `maker_slug`.

**Rules:**

- Only pen products count. Rows with `pen_type: "accessory"` are skipped; `regular`, `fountain`, `multi`, and `marker` rows count.
- A maker gets a value only if at least one of its pen products lists it. The catalog is built from each shop’s live product feed, so every row counts as a current product, including sold-out pens still listed. `--in-stock-only` counts only rows where `in_stock` is true (this drops many makers, because small-batch shops sell out).
- Makers with no pen rows in the catalog (currently MaxMadCo, SPP, Maverick Customs, Koenig, Hypercut MFG, Araki F Machine, That Dutch Pen Guy, Hungoblin, Kasama) keep empty arrays. Makers that are in the catalog but whose products never state a mechanism get an empty `mechanisms` (7 makers today).
- A maker is tagged from any single product. One brass clip or stainless refill makes a maker count as Brass or Stainless Steel, so the Stainless Steel and Brass counts are generous.

**Normalization** (the alias tables are `MECH_ALIASES` and `MATERIAL_ALIASES` in the script; add a row there when a new spelling shows up):

- Mechanisms: `bolt action`/`bolt` → `bolt-action`; `side click` → `side-click`; `top click`/`click` → `top-click`; `twist` → `twist`; `capped`/`cap` → `capped`; `magnetic` → `magnetic`; `knock` → `knock`. Any other value (`post`, `other`) has no chip and is dropped.
- Titanium: Ti, Titanium, 6Al-4V, Ti-6Al-4V, Grade 5, Ti64. Brass: Brass, C360, C260. Copper: Copper, C110, C101, OFHC. Bronze: Bronze, C932, C954, silicon, aluminum, and phosphor bronze. Aluminum: Aluminum, Aluminium, Al, 6061, 7075. Stainless Steel: Stainless Steel, Stainless, SS, 304, 316, 316L, 17-4, 303, 440C. Zirconium: Zirc, Zirconium, Zr, Zr702. Carbon Fiber: carbon fibre/fiber. Delrin: Delrin, acetal, POM. Tungsten: tungsten, tungsten carbide.
- **No “Exotic” bucket.** Damascus, Timascus, Mokume (Mokume-gane), Zircuti, Micarta, PEEK, and Ultem keep their own names, because collectors search for them by name and lumping them hides what they are. Values that contain several materials (`Titanium / Brass`) are split on `/ , ; + & and`. A value that cannot be mapped is ignored and listed in the script output.

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

   The Filters drawer has five groups: Price, Pen type, Mechanism, Material, and Lists. Picks inside a group are combined with **or**, picks across groups with **and**. Nothing selected in a group means “any”. Chips show a live count of how many makers you would see if you selected that chip, given the other groups. A Price or Lists chip with a count of 0 is greyed but still tappable; Pen type, Mechanism, and Material chips with a count of 0 are hidden. Makers that do not match are hidden on the map and in the list, not faded.

   Price chips are **Under $100**, **$100–250**, and **Over $250**. A maker appears under every chip its range touches, as implemented in `matchesPriceTier`:

   - Under $100: `priceLow < 100`
   - $100–250: `priceLow <= 250` and `priceHigh >= 100`
   - Over $250: `priceHigh > 250`

   Makers with no price appear in none of the price chips. Pen type chips are **Regular**, **Fountain**, **Multi pen**, and **Marker**, from the maker’s `pen_types` array; Mechanism and Material chips come from `mechanisms` and `materials`. List chips come from the top-level `lists` array; a maker is on a list when their slug appears in that list’s `makers`.
6. **Append** the new object to the `makers` array (do not rewrite or reorder existing entries). Update the top-level `updated` date if you are changing data.
7. **Bump the cache version** (see Release process) and recapture `maker-map-still.png` if the home map (US + Canada pins) changed.

## Design rules

Preserve these. Keep the site simple. Brand colors are orange and black. The default **light** look is cream (`#f5ecdc`), burnt-orange pins (`#c2410c`), and black text and rings. **Dark** mode (see Release process) uses near-black backgrounds, orange pins and accents (`#ff7a1a`), and light text. A small theme picker in the header (Light, Dark, Terminal, Notebook, Auto) switches looks; while Notebook is on, the same menu also shows its Handwriting and Paper choices; see Themes.

- **Home** is the detailed US + Canada map, including the Hawaii inset. It is not the world map.
- A **World** pill sits at the top-right of the home map. It opens the world view (country count pins).
- A **US & Canada** pill, same style, sits in that same top-right spot on the world view and on regional zooms. It returns to home. It is hidden on home.
- **← World** sits at the top-left on regional zooms (Europe, Hungary, Japan, the Philippines, South Africa, Australia, New Zealand) and returns to the world view.
- Tapping US or Canada (pin or land) from the world view also returns home. Tapping the Europe pin (or any European country with visible makers) zooms to the Europe map, which shows every visible European maker.
- **Favorites** are a local star list, max 5, stored in `localStorage` under `machinedpens-maker-map-favorites`. Favorite pins are orange stars, about pin-sized, with a star-shaped border (the circle/ring is hidden). Do not change that shape.
- **Timeline** is the only map view. The year slider (through `MAX_YEAR` in `map.js`, currently 2026) and play button stay. There is no Price mode and no price-colored pins; every pin uses the standard orange.
- **Filters** opens a side drawer on desktop and a bottom sheet on a phone. A search box sits at the top of that drawer/sheet, above the Price, Pen type, Mechanism, Material, and Lists chip groups (it is not a map overlay). A count such as “12 of 44 makers”, a Reset button, and removable chips under the slider show what is active. The `.map-panel` size must stay the same when the drawer opens or filters are applied (the chips row under the slider is a reserved slot; search lives inside the overlay, so it must not grow the panel).

### Search in the Filters drawer

The drawer search is a small parser plus [Fuse.js](https://fusejs.io) fuzzy matching. There is no AI. Typing ticks matching chips live; tapping chips by hand edits the same `priceFilters` / `typeFilters` / `mechFilters` / `materialFilters` / `listFilters` state. Clearing the box drops chips the search turned on and leaves chips you picked by hand. **Reset** clears the box, the “Showing:” line, suggestions, and every chip.

How a query is read:

0. Mechanism and material words are synonyms too: `bolt`, `bolt action`, `click` (ticks Side click and Top click), `twist`, `capped`, `titanium`, `ti`, `zirc`, `brass`, `steel`, `damascus`, and so on. Materials in the “More” row are added to the synonyms automatically from the data. `bolt` and `click` used to tick Regular; they now tick the mechanism chips instead.
1. Price number patterns are pulled out first. “Under N” / “below N” / “less than N” ticks every price chip whose bucket overlaps `[0, N)`. “Over N” / “above N” / “more than N” / “N+” ticks chips overlapping `(N, ∞)`. “Between A and B” (or “A–B”, “A to B”) ticks chips overlapping `[A, B]`. Examples: `under 250` → Under $100 and $100–250; `over 250` → Over $250; `between 100 and 250` → $100–250.
2. Remaining words are matched to synonyms (exact whole words or phrases, then Fuse.js fuzzy match for tokens of 4+ characters). Stopwords such as `pen`, `pens`, `the`, `and`, `maker` are ignored. A typo like `fountian pens over 250` ticks Fountain and Over $250.
3. Leftover tokens are matched against makers for the suggestion list (up to five hits). A query that matches the **start of the maker name**, or the **start of any word in the name**, always counts and is listed first (for example `Makar` → Makar Tools, `Black` → Blackside Customs, `Kasa` → Kasama, `Karas` → Karas Pen Co and Everyday Karas). Fuse.js still adds typo and location hits (`name`, `city`, `region`, `region_name`, and country code or the display name in `COUNTRY_NAMES`). Picking a suggestion closes the drawer and zooms/highlights that pin (`focusMaker`). Location hits are suggestions only — there is no hidden location filter.

   Fuzzy chip/synonym matching (step 2) does not swallow a token that already prefixes a maker name. This avoids a clash such as `Makar` being treated as a typo for the Marker chip (`marker` / `markers`) and never suggesting Makar Tools. Exact chip terms such as `marker` still tick Marker, and typo queries such as `fountian` still tick Fountain.

A short “Showing: …” line under the box lists the chips parsed from the current query (not chips the user ticked only by hand). If nothing matches, it reads “No matching filters”.

The list panel’s “Find a maker” box is unchanged: it is a simple substring search on name, city, region name, and country. It does not use this parser or Fuse.js.

**Mechanism and Material chips.** Mechanism chips are Bolt action, Side click, Top click, Twist, Capped, Magnetic, and Knock (`MECH_CHIPS`). Material chips are Titanium, Brass, Copper, Zirconium, Aluminum, Stainless Steel, and Bronze (`MATERIAL_MAIN`), followed by a “More” row built from the data: every other material used by at least `MORE_MIN_MAKERS` (3) makers, most common first. Same logic as the other groups: **or** inside a group, **and** across groups; counts are live given the other groups. Pen type, Mechanism, and Material chips with a count of 0 are hidden (so Multi pen and Marker disappear until a maker has them), unless the chip is on. While any Mechanism or Material chip is on, a small “N makers not yet tagged” note appears under the count in the drawer and above the list. It counts makers that pass all other filters and are hidden only because they have no mechanism (or material) data. Maker cards show Mechanism tags and up to three Material tags (the maker’s three most common).

**Adding a synonym.** In `map.js`, edit the `SEARCH_SYNONYMS` array. Each entry has `group` (`price`, `type`, `mech`, `material`, or `list`), `value` (a chip id from `PRICE_CHIPS`, `TYPE_CHIPS`, `MECH_CHIPS`, `MATERIAL_CHIPS`, or `LIST_CHIPS`, e.g. `fountain`, `under-100`, `bolt-action`, `titanium`, or `pp-top-10-budget-2026`; or `values: [...]` to tick several chips of one group, as `click` does for Side click and Top click), and `terms` (the words or phrases to recognize). List search terms can also be stored on the list in `makers.json` as `search_terms`. Unique terms such as `pp new`, `pp top 10 budget`, `lyfl`, or `favs` tick that one list. Shared phrases such as `pp top 10` or `pocket priorities` do not auto-select a list when more than one list matches; the drawer suggests the matching lists instead so the user can pick one or both. Restart is not needed beyond a refresh; bump the cache version if the file will be published. Do not add a CDN copy of Fuse.js — the local `vendor/fuse.min.js` and `vendor/LICENSE-fuse.txt` are the ones to keep.
- **Do not add Share link or Share image buttons.** They were removed from the UI. Incoming shared-favorite links can still open a “Viewing shared favorites” banner; leave that as is unless asked to change it.
- Featured Maker Index pins keep the ring. Inactive/closed pins stay hollow. Cards show location, shop founded, price (when present), first pen (when present), mechanism and material tags (when tagged), website, and “Update this entry” (opens a GitHub issue). When a Lists chip is on, a matching maker’s card also shows that list’s rank or unranked tag and credit (for example `PP Budget #1 · Pocket Priorities`, or `lyfl's fav · lyfl`). When two list chips are on, a maker on both shows both tags (for example `lyfl's fav · PP New #6`).

## Themes

Each theme is one `data-theme` value on `<html>` and one block of CSS custom properties. Today: `light`, `dark`, and the fun themes `terminal` and `notebook`. Visitors who have not chosen anything get light or dark from their device. Nobody gets a fun theme unless they pick it (or open a `?mode=terminal` or `?mode=notebook` link). Notebook alone also has `?nbfont=`, `?paper=`, and `?margin=` (see Notebook: Pen & paper).

**Picker.** The header button (`#theme-toggle`) opens a small menu (`#theme-menu`) with one row per theme plus “Auto (device)”. Rows are 48 px tall for phones, the menu is keyboard friendly (arrow keys, Home/End, Escape returns focus to the button, Tab or an outside tap closes it), and the current choice has a check. The menu is generated from the `THEMES` list in the head script in `index.html`, so it is never edited by hand.

**Terminal.** A text-only terminal look inspired by musicforprogramming.net, rebuilt in Machined Pens orange and black (no assets, text, or name copied). It uses the self-hosted IBM Plex Mono (SIL OFL, files and license in `vendor/`, loaded only when Terminal is on) with a system monospace fallback, charcoal `#141414` with orange `#ff8a1f`, dashed rules, bracketed `[chips]` and buttons that invert to a solid block on hover or when selected, a `>` prompt and blinking block cursor in the search box, a blinking cursor after the title, ASCII `----` separators, `//` comment labels, a `$` prompt in the Filters and list headings, a dotted halftone land fill, dashed borders on the map, a green ring for Maker Index pins, and a soft orange glow on pins. Blue is for links, green for primary actions and Maker Index items, yellow for favorites. The blink respects `prefers-reduced-motion`. It also runs together with the Thanksgiving theme (the banner becomes a `//` line).

**Notebook.** A hand-written notebook look: blue ink (`#1b2352`) on cream paper (`#fbf9f1` panels over a `#f1ecdd` page), in the self-hosted Caveat handwriting font (SIL OFL, `caveat-latin-500-normal.woff2` and `caveat-latin-700-normal.woff2` plus `LICENSE-caveat.txt` in `vendor/`, loaded only when Notebook is on, with a system cursive fallback). Highlighter yellow (`--hl`) marks the selected chips, tags, and picker row; links use a wavy underline in `#2540c8`; borders are slightly wobbly (`--blob`) with a small offset shadow; the header carries a tilted “my pen makers notebook” note; land on the map is filled with a faint diagonal hatch (`#t-hatch`, defined once in `index.html`); pins are ink blue with a red ring for Maker Index. Secondary text (`--ink-3`, `#59638a`) and all other text are at least 4.5:1 on the paper and the cream page (WCAG AA); the lightest pairing, `--ink-3` on a tinted row, is about 4.5:1. Handwriting is wide, so a shared block near the end of `style.css` (headed “Fun themes (more)”, which also gives every non-Terminal fun theme the palette icon on the header button) trims name and meta sizes on phones and lets the picker menu scroll; check for horizontal overflow at 390 px after changing sizes. Notebook is a light theme (`scheme: "light"`), so Thanksgiving's page tint is skipped while it is on (the greeting banner still shows, in its normal colors). It does not run on `?still=1` or the print view.

**Notebook: Pen & paper.** Visitors can personalize Notebook (and only Notebook) from the theme picker: while Notebook is the active theme, a “Handwriting” and a “Paper” group appear under the Notebook row (hidden in every other theme; they are 46 px tall buttons and the menu stays open so choices can be compared). Choices are saved in `localStorage` and can be forced with a URL parameter for that load (a picker choice writes the saved value and drops the parameter, like `?mode=`):

| Choice | `localStorage` key | URL | Values (default first) |
| --- | --- | --- | --- |
| Handwriting | `maker-map-nb-font` | `?nbfont=` | `casual` (Caveat), `italic` (Carattere), `architect` (Architects Daughter, all caps) |
| Paper | `maker-map-nb-paper` | `?paper=` | `dots`, `ruled`, `graph`, `plain` |
| Red margin (ruled paper only) | `maker-map-nb-margin` | `?margin=` | `1` (on), `0` (off) |

Example: `?mode=notebook&nbfont=italic&paper=ruled`. Handwriting only changes `--hand`, the variable behind every place Caveat is used (headings, labels, chips, names, legend, map labels); body text, meta lines and form text stay in the system sans-serif. **Italic** is Carattere, a chancery-italic nib hand (OFL; `vendor/carattere-latin-400-normal.woff2` + `LICENSE-carattere.txt`), with a little extra word spacing; the map’s small labels (state codes, country names, the Hawaii inset) stay in Caveat because Carattere’s capitals are too ornate at 15 px. **Architect** is Architects Daughter (OFL; `vendor/architects-daughter-latin-400-normal.woff2` + `LICENSE-architects-daughter.txt`) set in capitals, shrunk with `size-adjust: 80%` so it takes the same space as Caveat. Each font is a normal `@font-face` with `font-display: swap`, so a visitor downloads it only if that handwriting is chosen. Both are single-weight fonts declared as `font-weight: 400 700`, so the browser never fakes bold. **Paper** swaps only variables (`--bg`, `--paper`, `--water`, `--dot-stroke`, `--legend-bg`, `--ink-3`, and `--nb-dots` / `--nb-size` / `--nb-pos`, the pattern layer that the page and every panel share): Dots is the original (`#f1ecdd` page, `#fbf9f1` panels), Ruled is `#f2eee0` / `#fffef9` with blue rules every 28 px and an optional red margin line drawn in the page gutter (beside the content, so it never crosses text), Graph is `#eef3ee` / `#fbfdfa` with a 20 px teal grid, Plain is pure `#ffffff`. Body text is `--ink` on the paper in all four (about 14:1 or better); the small grey `--ink-3` is `#59638a` on Dots and Plain and `#465076` on Ruled and Graph so it still reaches 4.5:1 when it sits on a rule line. The head script in `index.html` sets `data-nbfont`, `data-nbpaper`, and `data-nbmargin` on `<html>` before first paint; all CSS lives in the “Notebook options” block at the very end of `style.css` and is scoped to `:root[data-theme="notebook"]`, so no other theme changes. The options CSS source is `tools/themes/notebook-options.css.tpl` in the working folder (the site folder only ships the built `style.css`).

**Add another fun theme.**
1. In `style.css`, copy the `:root[data-theme="terminal"] { ... }` variable block and rename it (for example `:root[data-theme="paper"]`). Set every variable in it (`--bg`, `--paper`, `--land`, `--ink`, `--accent`, `--pin`, `--line`, `--font`, and so on). That alone re-colors the whole page, because every component reads these variables. For the halftone land look, also set `--land-dot` and add `:root[data-theme="…"] .land, :root[data-theme="…"] .land-ca { fill: url(#t-dots); }` (the pattern is defined once in `index.html`).
2. In the `THEMES` array in the head script of `index.html`, add one entry: `{ id: "paper", label: "Paper", color: "#…", scheme: "light", fun: true, swatch: { bg: "#…", fg: "#…", glyph: "Aa" } }`. `color` is the browser theme color, `scheme` is `light` or `dark` (native controls and scrollbars), and `swatch` is the little preview tile in the menu. `fun: true` shows the `>_` glyph on the header button, sets `data-fun="1"` on `<html>`, and keeps the theme out of `?still=1` and print. That is all the picker needs.
3. Optional flavor (fonts, brackets, borders) goes in its own clearly marked block scoped to `:root[data-theme="paper"]`; use the Terminal block at the end of `style.css` as the model. Do not restyle light or dark. If the theme uses a web font, self-host it in `vendor/` with its license and use `@font-face` with `font-display: swap`.
4. Check the home map, a card, Filters, the picker, a price filter, the World view, and a phone width. Check light and dark still look identical to before. Bump the `?v=` cache letter everywhere (see Release process), including the font URLs inside `style.css`.

Light and dark themes are never changed by a fun theme: a fun theme only adds selectors scoped to its own `data-theme`. The Thanksgiving light tint is excluded from fun themes with `:not([data-fun])`.

## Release process

Owner approval is required before any push. Show preview screenshots first and wait. Do not publish, force-push, or go live unasked.

**Cache bust.** Every asset URL is versioned with `?v=YYYYMMDD` plus a letter. Current version in this folder: `20261127a`. Do not publish until the owner asks. Live remains whatever was last published until then. Same calendar day: increment the letter. New day: start at `a` (e.g. `20261127a`). Update **every** `?v=` reference in `index.html` and `map.js` together:

- `style.css` (this also covers the four `url("vendor/ibm-plex-mono-…")` font references inside it), `vendor/d3.min.js`, `vendor/topojson-client.min.js`, `vendor/qrcode-generator.js`, `vendor/fuse.min.js`, `map.js` (in `index.html`)
- `makers.json`, `data/us-canada.topo.json`, `data/world-110m.topo.json` (in `map.js`)

**`?still=1`.** Opens a chrome-free home map (no header, list, timeline, mode bar, nav pills, cards, or stars; labels are drawn on the map). Used to recapture `maker-map-still.png` and as the Open Graph image. Recapture it whenever US + Canada pins change (the still is the home view, 1600×1000 in the current file). Confirm the still page actually renders, with no UI chrome.

**Seasonal theme (Thanksgiving 2026).** A small, removable holiday treatment in three marked blocks: two in `index.html` (a head script, plus a slim banner and leaf marks in the body) and one at the end of `style.css`. It turns on by itself in `America/New_York` from Nov 25, 2026 00:00 through Nov 27, 2026 23:59, and stays off any other time. Preview with `?theme=thanksgiving`; force it off with `?theme=off`. (`?theme=` is reserved for this seasonal switch — light/dark mode uses `?mode=` instead.) When it is on, a dismissible “Happy Thanksgiving from Machined Pens” banner appears above the header, a small cranberry maple leaf sits beside the title, a few falling leaves drift in the header area on larger screens only (not across the map, and not on small screens or when `prefers-reduced-motion` is set), and the page and land fill pick up a slight amber tint (a darker warm tint in dark mode, with a readable cream-on-brown banner). Brand orange pins, panel sizes, and features are unchanged. Dismissing the banner is stored in `localStorage` as `maker-map-thanks-2026`. The theme does not run on `?still=1` or the print view. To remove it later, delete the three “Seasonal: Thanksgiving 2026” blocks.

**Light and dark mode.** Light and dark are the two built-in themes, and the default. With nothing saved, the map follows the visitor’s device setting (`prefers-color-scheme`). The header button is now a theme picker (see Themes); it keeps the moon in light and the sun in dark, and shows a `>_` glyph in Terminal and a small palette icon in Notebook. Before the first paint, an inline head script in `index.html` sets `data-theme` so the cream light theme does not flash on a dark visit. Order of precedence: `?mode=<theme>` (URL override for that load, e.g. `?mode=dark`, `?mode=light`, `?mode=terminal`, `?mode=notebook`), then the saved choice in `localStorage` under `maker-map-theme`, then `prefers-color-scheme`. Choosing a theme in the picker writes `maker-map-theme` and drops any `?mode=` from the URL so the saved choice wins on reload; choosing Auto removes the saved value so the device setting applies again. Colors live in CSS custom properties in `style.css` (`:root` / `[data-theme="light"]` for the cream light look, `[data-theme="dark"]` for near-black backgrounds, orange accents, and light text). The map is a D3/SVG drawing, not raster tiles, so land, water, borders, and labels follow those variables. In light and dark, pins keep the brand orange (`--pin`) and are not CSS-filtered. Native form controls use `color-scheme`. The picker is hidden on `?still=1` and the print view, and those two views always use the plain light look even if a fun theme is saved.

**Test locally.** Serve this folder over HTTP (so `makers.json` and the topo files load), then check home, World (including Australia, New Zealand, Hungary, and Philippines pins; New Zealand must sit comfortably in the frame), a Europe zoom, Japan, the Philippines, South Africa, Australia or New Zealand, a new maker’s card, the list/country filter, the Filters drawer (search at the top, Price, Pen type, Mechanism, Material, and Lists, plus searches such as `bolt titanium` and `zirc`, including a typo query such as `fountian pens over 250`, a unique list query such as `pp new` or `lyfl`, and an ambiguous list query such as `pp top 10` or `pocket priorities` (which should suggest both PP lists, not the owner’s list), a maker-name suggestion such as `shon`, a no-match query, and a zero-count chip), the list “Find a maker” box, the timeline with filters on, light, dark, Terminal, and Notebook (`?mode=light`, `?mode=dark`, `?mode=terminal`, `?mode=notebook`, the Notebook handwriting and paper choices (all 3 × 4 combinations, `?nbfont=italic&paper=ruled`, no horizontal overflow from 320 to 430 px), the header picker, that the choice persists across a reload, and that Auto returns to the device setting), a start-of-word name query such as `Makar` or `Kasa`, and `?still=1`. Confirm the map panel does not change size when Filters opens, search suggestions appear, or a filter is applied.

**Publish**, only after the owner approves the previews: commit to `main` in `machinedpens/machinedpens.github.io`, keep `.nojekyll` and this `README.md`, and verify the live site at https://machinedpens.github.io (hard-refresh so the new `?v=` assets load).

## Ideas backlog

Unbuilt ideas — do not start these unless the owner asks:

- Where to buy
- Read my review
- Most starred badge
- Tags
- Compare
