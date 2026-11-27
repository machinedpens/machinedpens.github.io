#!/usr/bin/env python3
"""Derive `mechanisms` and `materials` for every maker in makers.json from a product catalog.

Usage:
    python3 tools/derive_attrs.py CATALOG.json            # rewrite makers.json in place
    python3 tools/derive_attrs.py CATALOG.json --dry-run  # print the summary, write nothing
    python3 tools/derive_attrs.py CATALOG.json --in-stock-only   # only count products the shop shows as in stock
    python3 tools/derive_attrs.py CATALOG.json --makers path/to/makers.json

CATALOG.json is a list of product rows with at least: maker_slug, pen_type,
mechanism (string or null), materials (list of strings), checked_date.
It is safe to re-run: the three fields are overwritten each time, nothing else is touched.

Rules (also documented in README.md):
  * Accessory rows (pen_type == "accessory") are skipped. Everything else is a pen
    (regular, fountain, multi, marker).
  * Every row in the catalog is a product the shop currently lists (the catalog is built from
    each shop's live product feed), so sold-out pens still count. Pass --in-stock-only to be stricter.
  * A maker gets a value only if at least one pen product lists it. Makers with no pen rows in
    the catalog keep empty arrays (they show as "not yet tagged" in the map).
  * Values are stored as lowercase-hyphen ids (like pen_types): "bolt-action", "stainless-steel".
    `mechanisms` is in a fixed order; `materials` is ordered by how many of the maker's pens
    use it (most first, ties alphabetical), so the first few are its "main" materials.
"""
import argparse, collections, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MAKERS = os.path.join(HERE, "..", "makers.json")

# --- Mechanisms -------------------------------------------------------------
MECH_ORDER = ["bolt-action", "side-click", "top-click", "twist", "capped", "magnetic", "unique"]
MECH_ALIASES = {
    "bolt action": "bolt-action", "bolt": "bolt-action", "bolt-action": "bolt-action",
    "side click": "side-click", "side-click": "side-click", "side clicker": "side-click",
    "top click": "top-click", "top-click": "top-click", "click": "top-click", "plunger": "top-click",
    "twist": "twist", "twist action": "twist", "twist-action": "twist", "rotary": "twist",
    "capped": "capped", "cap": "capped", "cap-on": "capped",
    "magnetic": "magnetic", "magnet": "magnetic",
    "knock": "top-click",  # "Knock" is not its own mechanism (owner, 2026-11-27): a knock is a top click
}
# Anything else ("post", "other", ...) is not a filter chip and is ignored.
# Owner rules (2026-11-27), applied after the catalog. They win over whatever the catalog says.
#   * Side click and Magnetic are reserved for the listed makers only (added for them, removed for everyone else).
#   * "unique" is for one-of-a-kind actions; UNIQUE_MECHS also writes `unique_mechanisms` (shown on the card).
#   * NO_TOP_CLICK / NO_TWIST drop Top click / Twist for those makers.
#   * MECH_FIXED replaces a maker's whole mechanism list (CW&T has no click pens at all).
SIDE_CLICK_ONLY = {"nottingham-tactical", "autmog", "tactile-turn", "big-idea-design", "q3d", "prometheus-writes"}
NO_TOP_CLICK = {"ensso", "autmog", "magnus-pens", "cwandt"}
NO_TWIST = {"nottingham-tactical", "billetspin"}
MAGNETIC_ONLY = {"cwandt", "spoke-design", "studio-neat"}
UNIQUE_MECHS = {"focusworks": ["Sideswipe"], "magnus-pens": ["ClickShift"], "billetspin": []}  # Billetspin: mechanism name not confirmed yet
STEEL_ONLY = {"inventery", "pencestry", "ajoto", "wingback", "honey-badger-arsenal", "baronfig", "cwandt", "studio-neat", "modern-fuel", "machine-era", "matthew-martin-makes", "q3d"}  # owner, 2026-11-27
DELRIN_ONLY = {"karas-pen-co", "everyday-karas"}  # owner, 2026-11-27
TUNGSTEN_ONLY = {"tactile-turn", "q3d"}  # owner, 2026-11-27
MATERIAL_ADD = {"hungoblin": ["titanium", "heavy-metals", "mokume", "titanium-damascus"]}  # owner, 2026-11-27: add if missing, keep the rest
MATERIALS_FIXED = {"oz-machine-company": ["titanium"], "makar-tools": ["titanium", "mokume", "titanium-damascus", "ultem", "zirconium-damascus", "carbon-fiber"], "kasama": ["aluminum", "titanium", "mokume", "titanium-damascus", "ultem"], "q3d": ["titanium", "heavy-metals", "zirconium", "steel-damascus", "mokume", "zirconium-damascus", "tungsten", "aluminum", "stainless-steel", "titanium-damascus", "ultem", "carbon-fiber", "micarta"], "matthew-martin-makes": ["peek", "titanium", "zirconium", "steel-damascus", "heavy-metals", "stainless-steel", "titanium-damascus", "mokume", "zirconium-damascus", "carbon-fiber", "micarta"]}  # owner, 2026-11-27
MATERIAL_REMOVE = {"studio-neat": ["copper"], "seguin": ["aluminum"], "focusworks": ["aluminum", "ultem"], "mig-shed": ["aluminum"], "prometheus-writes": ["zirconium", "mokume"], "oz-machine-company": ["steel-damascus"], "aerocrafted": ["ultem"], "arno-bernard-pens": ["titanium-damascus"], "cwandt": ["peek"]}  # owner, 2026-11-27
MECH_FIXED = {"spoke-design": ["bolt-action", "top-click", "capped", "magnetic"], "prometheus-writes": ["side-click"], "cwandt": ["magnetic"], "everyday-karas": ["bolt-action"]}

# --- Materials --------------------------------------------------------------
# canonical name -> aliases (matched case-insensitively against the whole value first,
# then as whole words inside longer strings such as "6Al-4V Titanium").
MATERIAL_ALIASES = {
    "Titanium": ["titanium", "ti", "ti-6al-4v", "6al-4v", "6al4v", "ti64", "ti-64", "grade 5", "gr5", "grade 5 titanium", "gr. 5"],
    "Brass": ["brass", "c360", "c360 brass", "c260", "cartridge brass"],
    "Copper": ["copper", "c110", "c101", "ofhc", "oxygen free copper", "oxygen-free copper"],
    "Bronze": ["bronze", "c932", "c954", "c630", "silicon bronze", "aluminum bronze", "aluminium bronze", "phosphor bronze"],
    "Aluminum": ["aluminum", "aluminium", "al", "6061", "7075", "6061-t6", "7075-t6", "anodized aluminum", "aluminum alloy"],
    "Stainless Steel": ["stainless steel", "stainless", "ss", "316", "316l", "304", "17-4", "17-4ph", "303", "440c", "stainless-steel"],
    "Zirconium": ["zirconium", "zirc", "zr", "zr702", "zr 702", "zirconium 702"],
    # Kept as their own names (see README "Normalization"): no 'Exotic' bucket.
    "Zirconium Damascus": ["zirconium damascus", "zircuti", "zircuity", "zirc damascus"],  # was "Zircuti" (renamed 2026-11-27)
    "Steel Damascus": ["steel damascus", "damascus", "damasteel", "damascus steel"],  # was "Damascus" (renamed 2026-11-27)
    "Titanium Damascus": ["titanium damascus", "timascus"],  # was "Timascus" (renamed 2026-11-27)
    "Mokume": ["mokume", "mokume gane", "mokume-gane"],
    "Tungsten": ["tungsten", "tungsten carbide"],
    "Carbon Fiber": ["carbon fiber", "carbon fibre", "carbon-fiber", "carbon", "cf"],
    "Micarta": ["micarta"],
    "PEEK": ["peek"],
    "Ultem": ["ultem"],
    "Delrin": ["delrin", "acetal", "pom"],
}
_ALIAS = {a: canon for canon, al in MATERIAL_ALIASES.items() for a in al}
# Longest aliases first so "stainless steel" wins over "ss"/"al" inside longer strings.
_ALIAS_RES = [(re.compile(r"(?<![a-z0-9])" + re.escape(a) + r"(?![a-z0-9])"), c)
              for a, c in sorted(_ALIAS.items(), key=lambda kv: -len(kv[0])) if len(a) >= 3]
_SPLIT = re.compile(r"\s*(?:,|/|;|\+|&|\band\b)\s*", re.I)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def norm_material(raw):
    """Return the canonical names found in one catalog material string (usually exactly one)."""
    if not raw:
        return []
    s = str(raw).strip().lower()
    if s in _ALIAS:
        return [_ALIAS[s]]
    out = []
    for part in _SPLIT.split(s):
        part = part.strip()
        if not part:
            continue
        if part in _ALIAS:
            hit = [_ALIAS[part]]
        else:
            hit, rest = [], part
            for rx, canon in _ALIAS_RES:
                if rx.search(rest):
                    hit.append(canon)
                    rest = rx.sub(" ", rest)
        out.extend(hit)
    return list(dict.fromkeys(out))


def norm_mechanism(raw):
    if not raw:
        return None
    return MECH_ALIASES.get(str(raw).strip().lower())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("catalog")
    ap.add_argument("--makers", default=DEFAULT_MAKERS)
    ap.add_argument("--in-stock-only", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    catalog = json.load(open(args.catalog, encoding="utf-8"))
    data = json.load(open(args.makers, encoding="utf-8"))
    makers = data["makers"]
    slugs = {m["slug"] for m in makers}

    snapshot = max((p.get("checked_date") or "" for p in catalog), default="") or "unknown date"
    source = "catalog " + snapshot

    mech = collections.defaultdict(set)
    mat = collections.defaultdict(collections.Counter)
    pens = collections.Counter()
    unmapped_mat, unmapped_mech, unknown_slugs = collections.Counter(), collections.Counter(), collections.Counter()
    for p in catalog:
        s = p.get("maker_slug")
        if s not in slugs:
            unknown_slugs[s] += 1
            continue
        if p.get("pen_type") == "accessory":
            continue
        if args.in_stock_only and p.get("in_stock") is not True:
            continue
        pens[s] += 1
        raw_m = p.get("mechanism")
        if raw_m:
            m = norm_mechanism(raw_m)
            if m:
                mech[s].add(m)
            else:
                unmapped_mech[raw_m] += 1
        for raw in p.get("materials") or []:
            found = norm_material(raw)
            if not found:
                unmapped_mat[raw] += 1
            for c in found:
                mat[s][slug(c)] += 1

    for i, m in enumerate(makers):
        s = m["slug"]
        mechs = [x for x in MECH_ORDER if x in mech.get(s, ())]
        ms = set(mechs)
        if s in SIDE_CLICK_ONLY: ms.add("side-click")
        else: ms.discard("side-click")
        if s in MAGNETIC_ONLY: ms.add("magnetic")
        else: ms.discard("magnetic")
        if s in NO_TOP_CLICK: ms.discard("top-click")
        if s in NO_TWIST: ms.discard("twist")
        if s in UNIQUE_MECHS:
            ms.add("unique")
            if UNIQUE_MECHS[s]: m["unique_mechanisms"] = UNIQUE_MECHS[s]
        if s in MECH_FIXED: ms = set(MECH_FIXED[s])
        mechs = [x for x in MECH_ORDER if x in ms]
        mats = [k for k, _ in sorted(mat.get(s, {}).items(), key=lambda kv: (-kv[1], kv[0]))]
        mats = [x for x in mats if x not in MATERIAL_REMOVE.get(s, ())]
        # Brass, Copper and Bronze are one tag, "heavy-metals" (owner, 2026-11-27); applied after the removals above.
        merged = []
        for x in mats:
            y = "heavy-metals" if x in ("brass", "copper", "bronze") else x
            if y not in merged: merged.append(y)
        mats = merged
        if s not in DELRIN_ONLY: mats = [x for x in mats if x != "delrin"]
        if s in TUNGSTEN_ONLY:
            if "tungsten" not in mats: mats.append("tungsten")
        else: mats = [x for x in mats if x != "tungsten"]
        for x in MATERIAL_ADD.get(s, []):
            if x not in mats: mats.append(x)
        if s in MATERIALS_FIXED: mats = list(MATERIALS_FIXED[s])
        if s in STEEL_ONLY:
            if "stainless-steel" not in mats: mats.append("stainless-steel")
        else: mats = [x for x in mats if x != "stainless-steel"]
        new = {}
        for k, v in m.items():
            if k in ("mechanisms", "materials", "attrs_source"):
                continue
            new[k] = v
            if k == "pen_types":
                new["mechanisms"], new["materials"], new["attrs_source"] = mechs, mats, source
        if "mechanisms" not in new:
            new["mechanisms"], new["materials"], new["attrs_source"] = mechs, mats, source
        makers[i] = new
    data["attrs_source"] = source

    # Summary
    mech_n = collections.Counter(x for m in makers for x in m["mechanisms"])
    mat_n = collections.Counter(x for m in makers for x in m["materials"])
    print("source:", source, "| pen products used:", sum(pens.values()), "| makers with pens:", len(pens), "of", len(makers))
    print("mechanism makers:", {k: mech_n[k] for k in MECH_ORDER})
    print("material makers: ", dict(mat_n.most_common()))
    print("no pens in catalog:", [m["name"] for m in makers if m["slug"] not in pens])
    print("no mechanism tag: ", [m["name"] for m in makers if not m["mechanisms"]])
    print("no material tag:  ", [m["name"] for m in makers if not m["materials"]])
    if unmapped_mat: print("UNMAPPED materials (ignored):", dict(unmapped_mat))
    if unmapped_mech: print("Mechanisms with no chip (ignored):", dict(unmapped_mech))
    if unknown_slugs: print("Catalog slugs not in makers.json (ignored):", dict(unknown_slugs))

    if args.dry_run:
        print("dry run: nothing written")
        return
    with open(args.makers, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("wrote", os.path.relpath(args.makers))


if __name__ == "__main__":
    sys.exit(main())
