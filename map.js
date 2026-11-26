/* Machined Pens Maker Map
   Pure static: D3 v7 + topojson-client, vendored in ./vendor. Data in ./makers.json and ./data. */
(function () {
  "use strict";

  var STILL = /[?&]still=1\b/.test(location.search);
  var PRINT = /[?&]print=1\b/.test(location.search);
  if (STILL) document.body.classList.add("still");
  if (PRINT && !STILL) document.body.classList.add("print");

  function track(path, title) {
    try {
      if (STILL) return;
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: path, title: title, event: true });
      }
    } catch (e) {}
  }

  var MAX_YEAR = 2026;
  var COUNTRY_NAMES = {
    US: "United States", CA: "Canada", EU: "Europe",
    UK: "United Kingdom", GB: "United Kingdom", JP: "Japan", ZA: "South Africa",
    AU: "Australia", NZ: "New Zealand",
    AL: "Albania", AD: "Andorra", AT: "Austria", BY: "Belarus", BE: "Belgium",
    BA: "Bosnia and Herzegovina", BG: "Bulgaria", HR: "Croatia", CY: "Cyprus",
    CZ: "Czechia", DK: "Denmark", EE: "Estonia", FI: "Finland", FR: "France",
    DE: "Germany", GR: "Greece", HU: "Hungary", IS: "Iceland", IE: "Ireland",
    IT: "Italy", XK: "Kosovo", LV: "Latvia", LI: "Liechtenstein", LT: "Lithuania",
    LU: "Luxembourg", MT: "Malta", MD: "Moldova", MC: "Monaco", ME: "Montenegro",
    NL: "Netherlands", MK: "North Macedonia", NO: "Norway", PL: "Poland",
    PT: "Portugal", RO: "Romania", SM: "San Marino", RS: "Serbia", SK: "Slovakia",
    SI: "Slovenia", ES: "Spain", SE: "Sweden", CH: "Switzerland", UA: "Ukraine",
    VA: "Vatican City",
    unknown: "Location unknown"
  };
  var COUNTRY_ORDER = ["US", "CA", "EU", "HU", "JP", "ZA", "AU", "NZ"];
  var COUNTRY_LABELS = { US: "US", CA: "Canada", EU: "Europe", HU: "Hungary", JP: "Japan", ZA: "South Africa", AU: "Australia", NZ: "New Zealand" };
  // Alpha-2 codes in the Europe unit. Future makers with these country codes
  // automatically join the Europe pin, Europe zoom, and Europe list group.
  var EUROPE_COUNTRIES = {
    AL:1, AD:1, AT:1, BY:1, BE:1, BA:1, BG:1, HR:1, CY:1, CZ:1, DK:1, EE:1, FI:1, FR:1,
    DE:1, GR:1, IS:1, IE:1, IT:1, XK:1, LV:1, LI:1, LT:1, LU:1, MT:1, MD:1, MC:1,
    ME:1, NL:1, MK:1, NO:1, PL:1, PT:1, RO:1, SM:1, RS:1, SK:1, SI:1, ES:1, SE:1, CH:1,
    UA:1, GB:1, UK:1, VA:1, FO:1, GI:1, GG:1, IM:1, JE:1, AX:1
  };
  // world-110m numeric ids for European land. Russia, Turkey, Georgia, Armenia,
  // Azerbaijan, Kazakhstan, and Greenland are left out so the zoom stays a conventional Europe map.
  var EUROPE_ISO = {
    "008":1, "040":1, "056":1, "070":1, "100":1, "112":1, "191":1, "196":1, "203":1, "208":1,
    "233":1, "246":1, "250":1, "276":1, "300":1, "348":1, "352":1, "372":1, "380":1, "428":1,
    "440":1, "442":1, "498":1, "499":1, "528":1, "578":1, "616":1, "620":1, "642":1, "688":1,
    "703":1, "705":1, "724":1, "752":1, "756":1, "804":1, "826":1
  };
  var WORLD_ISO = { "840": "US", "124": "CA", "392": "JP", "710": "ZA", "036": "AU", "554": "NZ" };
  Object.keys(EUROPE_ISO).forEach(function (id) { WORLD_ISO[id] = "EU"; });
  // Hungary has its own World pin and country zoom (same pattern as AU/NZ),
  // so it is not folded into the Europe unit.
  WORLD_ISO["348"] = "HU";
  var SIMPLE_COUNTRIES = { EU: 1, HU: 1, JP: 1, ZA: 1, AU: 1, NZ: 1 };
  function isEuropeCountry(code) { return !!EUROPE_COUNTRIES[code]; }
  function isEuropeMaker(m) { return !!(m && isEuropeCountry(m.country)); }
  function unitCode(m) {
    if (isEuropeMaker(m)) return "EU";
    return (m && m.country) || "unknown";
  }
  var REGION_ABBR = {
    // Used in "City, ST" lines
    AL:"AL",AK:"AK",AZ:"AZ",AR:"AR",CA:"CA",CO:"CO",CT:"CT",DE:"DE",FL:"FL",GA:"GA",HI:"HI",ID:"ID",IL:"IL",IN:"IN",IA:"IA",
    KS:"KS",KY:"KY",LA:"LA",ME:"ME",MD:"MD",MA:"MA",MI:"MI",MN:"MN",MS:"MS",MO:"MO",MT:"MT",NE:"NE",NV:"NV",NH:"NH",NJ:"NJ",
    NM:"NM",NY:"NY",NC:"NC",ND:"ND",OH:"OH",OK:"OK",OR:"OR",PA:"PA",RI:"RI",SC:"SC",SD:"SD",TN:"TN",TX:"TX",UT:"UT",VT:"VT",
    VA:"VA",WA:"WA",WV:"WV",WI:"WI",WY:"WY",DC:"DC",AB:"AB",BC:"BC",MB:"MB",NB:"NB",NL:"NL",NS:"NS",NT:"NT",NU:"NU",ON:"ON",
    PE:"PE",QC:"QC",SK:"SK",YT:"YT"
  };


  var wrap = document.getElementById("map-wrap");
  var svg = d3.select("#map");
  var card = document.getElementById("card");
  var slider = document.getElementById("year");
  var playBtn = document.getElementById("play");
  var mqMobile = window.matchMedia("(max-width: 640px)");

  var state = { makers: [], features: null, topo: null, worldTopo: null, worldFeatures: null, year: MAX_YEAR, active: null, playing: null, minYear: 2008, favorites: {}, favOnly: false, priceFilters: [], typeFilters: [], listFilters: [], lists: [], filtersOpen: false, shared: false, listSort: "state", listQuery: "", listCountry: "", view: "home", focusCountry: null };

  Promise.all([
    d3.json("makers.json?v=20261125g"),
    d3.json("data/us-canada.topo.json?v=20261125g"),
    d3.json("data/world-110m.topo.json?v=20261125g")
  ]).then(function (res) { init(res[0], res[1], res[2]); })
    .catch(function (err) {
      console.error(err);
      wrap.insertAdjacentHTML("beforeend", '<p class="noscript">The map could not load. Please refresh.</p>');
    });

  function init(data, topo, worldTopo) {
    var makers = (data && data.makers) || [];
    loadLists(data && data.lists);
    makers.forEach(function (m, i) {
      m.id = "m" + i;
      if (!m.slug) m.slug = slugify(m.name);
      if (!Array.isArray(m.pen_types) || !m.pen_types.length) m.pen_types = ["regular"];
    });
    state.makers = makers;
    if (!STILL) initFavorites();
    state.topo = topo;
    var obj = topo.objects.usca;
    // Hawaii sits far outside a North America frame, so it is drawn in a lower-left inset.
    var hiGeoms = obj.geometries.filter(function (g) { return g.properties.code === "HI"; });
    state.hawaii = hiGeoms.length ? topojson.feature(topo, hiGeoms[0]) : null;
    obj = Object.assign({}, obj, { geometries: obj.geometries.filter(function (g) { return g.properties.code !== "HI"; }) });
    state.obj = obj;
    state.features = topojson.feature(topo, obj);
    state.innerBorders = topojson.mesh(topo, obj, function (a, b) { return a !== b && a.properties.country === b.properties.country; });
    state.countryBorder = topojson.mesh(topo, obj, function (a, b) { return a !== b && a.properties.country !== b.properties.country; });
    state.lakes = topo.objects.lakes ? topojson.feature(topo, topo.objects.lakes) : null;
    state.worldTopo = worldTopo || null;
    if (worldTopo && worldTopo.objects && worldTopo.objects.countries) {
      state.worldFeatures = topojson.feature(worldTopo, worldTopo.objects.countries);
    }
    state.view = "home";
    state.focusCountry = null;

    var years = makers.map(function (m) { return m.est_year; }).filter(Boolean);
    var minY = years.length ? Math.min(d3.min(years), MAX_YEAR - 1) : MAX_YEAR - 10;
    state.minYear = minY;
    slider.min = minY; slider.max = MAX_YEAR; slider.value = MAX_YEAR;
    document.getElementById("year-min").textContent = minY;
    document.getElementById("year-max").textContent = MAX_YEAR;

    buildList();
    render();
    setYear(MAX_YEAR);
    bindUI();
    setupSuggestLink();
    if (!STILL) bindFavorites();
    bindFilters();

    if (window.ResizeObserver) {
      var el = svg.node();
      var last = el.clientWidth + "x" + el.clientHeight;
      new ResizeObserver(function () {
        var now = el.clientWidth + "x" + el.clientHeight;
        if (now !== last) { last = now; render(); }
      }).observe(el);
    } else {
      window.addEventListener("resize", debounce(render, 150));
    }
    document.body.setAttribute("data-ready", "1");
  }

  /* ---------- Map ---------- */

  function frame() {
    // Original home frame: the lower 48 plus southern Canada, where makers are.
    var pts = [];
    for (var lon = -127; lon <= -64; lon += 1) { pts.push([lon, 24.5], [lon, 57.5]); }
    for (var lat = 24.5; lat <= 57.5; lat += 1) { pts.push([-127, lat], [-64, lat]); }
    return { type: "MultiPoint", coordinates: pts };
  }

  function worldFrame() {
    // Crop the world view to the band that holds every country pin
    // (US, Canada, Europe, Hungary, Japan, South Africa, Australia, New Zealand).
    // Extended east and a little south so New Zealand (and Tasmania) sit
    // comfortably inside; Antarctica and unused ocean stay trimmed. Hawaii
    // is off this crop; the US pin sits in the lower 48.
    var west = -130, east = 182, south = -50, north = 72;
    var pts = [];
    for (var lon = west; lon <= east; lon += 2) { pts.push([lon, south], [lon, north]); }
    for (var lat = south; lat <= north; lat += 2) { pts.push([west, lat], [east, lat]); }
    return { type: "MultiPoint", coordinates: pts };
  }

  // Phone map height for the US home landing view (Hawaii inset band included).
  // World and country zooms reuse this so the enclosing panel does not change size.
  function homeMapMobileHeight(W) {
    var probe = d3.geoConicConformal().rotate([96, 0]).parallels([33, 58]).fitWidth(W - 24, frame());
    var b = d3.geoPath(probe).bounds(frame());
    return Math.round(b[1][1] - b[0][1] + 20 + 98);
  }

  var cachedLegendH = 0;
  function cacheLegendHeight() {
    if (!mqMobile.matches) return;
    var legend = document.getElementById("legend");
    if (legend && legend.offsetHeight) cachedLegendH = legend.offsetHeight;
  }
  function mobileLegendSlotHeight() {
    if (cachedLegendH) return cachedLegendH;
    var legend = document.getElementById("legend");
    if (legend && legend.offsetHeight) {
      cachedLegendH = legend.offsetHeight;
      return cachedLegendH;
    }
    return 69;
  }

  function syncMapButtons() {
    var back = document.getElementById("world-back");
    var world = document.getElementById("world-btn");
    var usca = document.getElementById("usca-btn");
    var hideChrome = STILL || PRINT;
    if (back) back.hidden = hideChrome || state.view !== "country";
    if (world) world.hidden = hideChrome || state.view !== "home";
    // Same top-right spot as the World pill: on the world view and on country zooms.
    if (usca) usca.hidden = hideChrome || state.view === "home";
    if (!hideChrome) syncDiscoverStatus();
  }
  function showHome() {
    state.view = "home";
    state.focusCountry = null;
    document.body.setAttribute("data-view", "home");
    closeCard(true);
    render();
  }
  function showWorld() {
    state.view = "world";
    state.focusCountry = null;
    document.body.setAttribute("data-view", "world");
    closeCard(true);
    render();
  }
  function showCountry(code) {
    if (!code || code === "US" || code === "CA") return showHome();
    if (isEuropeCountry(code)) code = "EU";
    state.view = "country";
    state.focusCountry = code;
    document.body.setAttribute("data-view", "country");
    closeCard(true);
    render();
  }
  function makersOnMap() {
    return state.makers.filter(function (m) {
      if (m.unmapped || m.lat == null || m.lon == null) return false;
      if (state.view === "home" && m.country !== "US" && m.country !== "CA") return false;
      if (state.view === "country" && state.focusCountry === "EU") return isEuropeMaker(m);
      if (state.view === "country" && state.focusCountry && m.country !== state.focusCountry) return false;
      return true;
    });
  }
  function belongsToUnit(m, code) {
    if (code === "EU") return isEuropeMaker(m);
    return m.country === code;
  }
  function countryVisibleCount(code) {
    return state.makers.filter(function (m) {
      return belongsToUnit(m, code) && !isHidden(m) && !m.unmapped && m.lat != null;
    }).length;
  }
  function europeFrame() {
    var pts = [];
    for (var lon = -25; lon <= 40; lon += 2) { pts.push([lon, 34], [lon, 71]); }
    for (var lat = 34; lat <= 71; lat += 2) { pts.push([-25, lat], [40, lat]); }
    return { type: "MultiPoint", coordinates: pts };
  }
  function europeLandFeatures() {
    if (!state.worldFeatures) return [];
    return state.worldFeatures.features.filter(function (f) {
      if (EUROPE_ISO[String(f.id)]) return true;
      var name = f.properties && f.properties.name;
      return name === "Kosovo";
    });
  }
  function worldCountryFeature(code) {
    if (!state.worldFeatures) return null;
    var iso = null;
    Object.keys(WORLD_ISO).forEach(function (k) { if (WORLD_ISO[k] === code) iso = k; });
    return state.worldFeatures.features.find(function (f) { return String(f.id) === String(iso); }) || null;
  }
  function renderWorld() {
    var el = svg.node();
    var W = el.clientWidth;
    if (!W) return;
    if (mqMobile.matches && !STILL) {
      el.style.height = (homeMapMobileHeight(W) + mobileLegendSlotHeight()) + "px";
    } else {
      el.style.height = "";
    }
    var H = el.clientHeight;
    if (!H) return;
    var S = sizes();
    svg.attr("viewBox", "0 0 " + W + " " + H).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    document.body.setAttribute("data-view", "world");
    syncMapButtons();
    if (!state.worldFeatures) return;

    var pad = W < 500 ? { t: 28, r: 22, b: 16, l: 10 } : { t: 28, r: 28, b: 24, l: 28 };
    var land = { type: "FeatureCollection", features: state.worldFeatures.features.filter(function (f) { return String(f.id) !== "010"; }) };
    var projection = d3.geoNaturalEarth1()
      .fitExtent([[pad.l, pad.t], [W - pad.r, H - pad.b]], worldFrame())
      .clipExtent([[0, 0], [W, H]]);
    var path = d3.geoPath(projection);
    state.projection = projection;

    var gLand = svg.append("g").attr("class", "land-layer");
    gLand.selectAll("path").data(land.features).join("path")
      .attr("class", function (d) { return WORLD_ISO[String(d.id)] ? "land land-us" : "land land-ca"; })
      .attr("d", path)
      .style("cursor", function (d) { return WORLD_ISO[String(d.id)] ? "pointer" : "default"; })
      .on("click", function (ev, d) {
        ev.stopPropagation();
        var code = WORLD_ISO[String(d.id)];
        if (code && countryVisibleCount(code)) showCountry(code);
        else closeCard();
      });

    svg.on("click", function (ev) { if (!ev.target.closest(".country-pin") && !ev.target.closest(".land")) closeCard(); });

    var pins = [];
    COUNTRY_ORDER.forEach(function (code) {
      var n = countryVisibleCount(code);
      if (!n) return;
      var c;
      if (code === "EU") {
        c = projection(W < 500 ? [15, 49] : [12, 50]);
      } else {
        var feat = worldCountryFeature(code);
        if (!feat) return;
        c = path.centroid(feat);
        if (!c || isNaN(c[0]) || isNaN(c[1])) return;
        // Keep the US pin in the lower 48 (full-country centroid is pulled north by Alaska).
        // On a narrow world map, nudge the two North American pins apart so they stay tappable.
        if (code === "US") c = projection(W < 500 ? [-98, 36.2] : [-98.3, 39.8]);
        if (code === "CA") c = projection(W < 500 ? [-97, 62] : [-96, 56]);
        // Hungary sits close to the Europe pin; keep the two apart on the world map.
        if (code === "HU") c = projection(W < 500 ? [21.5, 46.2] : [21, 46.5]);
      }
      if (!c || isNaN(c[0]) || isNaN(c[1])) return;
      pins.push({ code: code, n: n, x: c[0], y: c[1] });
    });

    var gPins = svg.append("g").attr("class", "country-pins");
    var groups = gPins.selectAll("g.country-pin").data(pins).join("g")
      .attr("class", "country-pin")
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", function (d) { return COUNTRY_NAMES[d.code] + ", " + d.n + (d.n === 1 ? " maker" : " makers"); })
      .on("click", function (ev, d) { ev.stopPropagation(); showCountry(d.code); })
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); showCountry(d.code); }
      });
    var narrow = W < 500;
    var labelAt = narrow ? {
      US: { x: 0, y: 20, anchor: "middle" },
      CA: { x: 11, y: -8, anchor: "start" },
      EU: { x: 11, y: 4, anchor: "start" },
      JP: { x: -11, y: 4, anchor: "end" },
      ZA: { x: -11, y: 4, anchor: "end" },
      HU: { x: 11, y: 16, anchor: "start" },
      AU: { x: 0, y: -12, anchor: "middle" },
      NZ: { x: -11, y: 16, anchor: "end" }
    } : {
      US: { x: 14, y: 4, anchor: "start" },
      CA: { x: 14, y: 4, anchor: "start" },
      EU: { x: 14, y: 4, anchor: "start" },
      HU: { x: 14, y: 16, anchor: "start" },
      JP: { x: 14, y: 4, anchor: "start" },
      ZA: { x: 14, y: 4, anchor: "start" },
      AU: { x: 14, y: 4, anchor: "start" },
      NZ: { x: -14, y: 4, anchor: "end" }
    };
    groups.append("circle").attr("class", "hit").attr("r", narrow ? 22 : 28);
    groups.append("circle").attr("class", "pin-halo").attr("r", narrow ? 11 : 16);
    groups.append("circle").attr("class", "dot").attr("r", narrow ? 7 : 9);
    groups.append("text").attr("class", "country-pin-label")
      .attr("x", function (d) { return (labelAt[d.code] || labelAt.US).x; })
      .attr("y", function (d) { return (labelAt[d.code] || labelAt.US).y; })
      .attr("text-anchor", function (d) { return (labelAt[d.code] || labelAt.US).anchor; })
      .attr("font-size", narrow ? 12 : 14)
      .text(function (d) { return COUNTRY_LABELS[d.code] + " " + d.n; });
    // Keep labels inside the SVG and off each other (AU/ZA/NZ are tight on a phone).
    (function placeCountryLabels() {
      var pad = 4, gap = 3;
      var alts = narrow ? [
        { x: 11, y: 4, anchor: "start" },
        { x: -11, y: 4, anchor: "end" },
        { x: 0, y: -12, anchor: "middle" },
        { x: 0, y: 18, anchor: "middle" },
        { x: 11, y: -12, anchor: "start" },
        { x: -11, y: -12, anchor: "end" },
        { x: 11, y: 18, anchor: "start" },
        { x: -11, y: 18, anchor: "end" }
      ] : [
        { x: 14, y: 4, anchor: "start" },
        { x: -14, y: 4, anchor: "end" },
        { x: 0, y: -12, anchor: "middle" },
        { x: 0, y: 22, anchor: "middle" }
      ];
      function boxOf(node, d) {
        var bb = node.getBBox();
        return { l: d.x + bb.x, r: d.x + bb.x + bb.width, t: d.y + bb.y, b: d.y + bb.y + bb.height };
      }
      function inBounds(b) {
        return b.l >= pad && b.t >= pad && b.r <= W - pad && b.b <= H - pad;
      }
      function overlap(a, b) {
        return a.l < b.r + gap && a.r > b.l - gap && a.t < b.b + gap && a.b > b.t - gap;
      }
      function apply(el, pos) {
        el.attr("x", pos.x).attr("y", pos.y).attr("text-anchor", pos.anchor);
      }
      var items = [];
      groups.each(function (d) {
        items.push({ d: d, el: d3.select(this).select("text.country-pin-label"), node: this.querySelector("text.country-pin-label") });
      });
      items.sort(function (a, b) { return b.d.x - a.d.x; });
      var placed = [];
      items.forEach(function (it) {
        var preferred = {
          x: +it.el.attr("x"),
          y: +it.el.attr("y"),
          anchor: it.el.attr("text-anchor") || "start"
        };
        var tries = [preferred].concat(alts.filter(function (p) {
          return p.x !== preferred.x || p.y !== preferred.y || p.anchor !== preferred.anchor;
        }));
        var best = null;
        for (var i = 0; i < tries.length; i++) {
          apply(it.el, tries[i]);
          var b = boxOf(it.node, it.d);
          if (!inBounds(b)) continue;
          if (placed.some(function (p) { return overlap(b, p); })) continue;
          best = b;
          break;
        }
        if (!best) {
          apply(it.el, preferred);
          best = boxOf(it.node, it.d);
        }
        placed.push(best);
      });
    })();

    applyYear();
  }
  function renderSimpleCountry() {
    var el = svg.node();
    var W = el.clientWidth;
    if (!W) return;
    if (mqMobile.matches && !STILL) {
      el.style.height = homeMapMobileHeight(W) + "px";
    } else {
      el.style.height = "";
    }
    var H = el.clientHeight;
    if (!H) return;
    var S = sizes();
    svg.attr("viewBox", "0 0 " + W + " " + H).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    document.body.setAttribute("data-view", "country");
    syncMapButtons();
    var isEU = state.focusCountry === "EU";
    var feat, fit;
    if (isEU) {
      var euro = europeLandFeatures();
      if (!euro.length) return;
      feat = { type: "FeatureCollection", features: euro };
      fit = europeFrame();
    } else {
      feat = worldCountryFeature(state.focusCountry);
      if (!feat) return;
      fit = feat;
    }
    var pad = W < 500 ? { t: 52, r: 18, b: 20, l: 18 } : { t: 56, r: 80, b: 40, l: 80 };
    var projection = d3.geoMercator().fitExtent([[pad.l, pad.t], [W - pad.r, H - pad.b]], fit);
    var path = d3.geoPath(projection);
    state.projection = projection;

    var gLand = svg.append("g").attr("class", "land-layer");
    if (isEU) {
      gLand.selectAll("path").data(feat.features).join("path")
        .attr("class", "land land-us").attr("d", path);
    } else {
      gLand.append("path").datum(feat).attr("class", "land land-us").attr("d", path);
    }

    svg.on("click", function (ev) { if (!ev.target.closest(".pin")) closeCard(); });

    var nodes = [];
    makersOnMap().forEach(function (m) {
      var p = projection([m.lon, m.lat]);
      if (!p) return;
      nodes.push({ m: m, ax: p[0], ay: p[1], x: p[0], y: p[1], inset: false });
    });
    var sim = d3.forceSimulation(nodes)
      .force("x", d3.forceX(function (d) { return d.ax; }).strength(0.25))
      .force("y", d3.forceY(function (d) { return d.ay; }).strength(0.25))
      .force("collide", d3.forceCollide(S.ring + S.gap).strength(1).iterations(4))
      .stop();
    for (var i = 0; i < 200; i++) sim.tick();
    nodes.forEach(function (n) {
      n.x = Math.max(S.ring + 2, Math.min(W - S.ring - 2, n.x));
      n.y = Math.max(S.ring + 2, Math.min(H - S.ring - 2, n.y));
      n.m._x = n.x; n.m._y = n.y; n.m._node = n;
      n.moved = Math.hypot(n.x - n.ax, n.y - n.ay) > 2;
    });
    state.nodes = nodes;
    drawMakerPins(nodes, S, W, H, path, projection);
  }
  function drawMakerPins(nodes, S, W, H, path, projection) {
    var gLead = svg.append("g").attr("class", "leaders").attr("aria-hidden", "true");
    var leads = gLead.selectAll("g").data(nodes.filter(function (n) { return n.moved; })).join("g")
      .attr("data-id", function (d) { return d.m.id; });
    leads.append("line").attr("class", "leader")
      .attr("x1", function (d) { return d.ax; }).attr("y1", function (d) { return d.ay; })
      .attr("x2", function (d) { return d.x; }).attr("y2", function (d) { return d.y; });
    leads.append("circle").attr("class", "anchor").attr("r", STILL ? 2.4 : 1.8)
      .attr("cx", function (d) { return d.ax; }).attr("cy", function (d) { return d.ay; });
    var ordered = nodes.slice().sort(function (a, b) { return a.x - b.x; });
    var gPins = svg.append("g").attr("class", "pins");
    var pins = gPins.selectAll("g.pin").data(ordered, function (d) { return d.m.id; }).join("g")
      .attr("class", "pin")
      .attr("data-id", function (d) { return d.m.id; })
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-haspopup", "dialog")
      .attr("aria-label", function (d) { return ariaLabel(d.m); })
      .classed("inactive", function (d) { return !!d.m.status; })
      .classed("fav", function (d) { return !STILL && isFav(d.m); });
    pins.append("circle").attr("class", "hit").attr("r", S.hit);
    var body = pins.append("g").attr("class", "body");
    body.append("circle").attr("class", "focus-ring").attr("r", function (d) { return focusRingRadius(d, S); });
    body.filter(function (d) { return d.m.in_maker_index; })
      .append("circle").attr("class", "ring").attr("r", S.ring);
    body.append("circle").attr("class", "dot").attr("r", S.dot);
    if (!STILL) {
      var mark = body.append("g").attr("class", "star-mark");
      mark.append("path").attr("class", "star-border")
        .attr("d", function (d) { return starPath(favBorderRadius(d, S)); });
      mark.append("path").attr("class", "star").attr("d", starPath(S.star));
    }
    pins.on("click", function (ev, d) { ev.stopPropagation(); openCard(d.m, this); })
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openCard(d.m, this); }
      });
    var gNames = svg.append("g").attr("class", "names").attr("aria-hidden", "true");
    var taken = STILL ? drawLabels(nodes, S, W, H) : [];
    if (path && projection && (state.focusCountry === "US" || state.focusCountry === "CA")) {
      drawNames(gNames, path, projection, nodes, S, W, H, taken);
    } else if (!STILL) {
      // Short city labels next to pins on simple country views.
      var gLab = svg.append("g").attr("class", "labels");
      nodes.forEach(function (n) {
        var lab = gLab.append("text").attr("class", "simple-label")
          .attr("y", n.y + 4)
          .attr("font-size", 12).attr("font-weight", 600)
          .text(n.m.name);
        var tw = lab.node().getBBox().width;
        if (n.x + S.ring + 5 + tw < W - 8) lab.attr("x", n.x + S.ring + 5).attr("text-anchor", "start");
        else lab.attr("x", n.x - S.ring - 5).attr("text-anchor", "end");
      });
    }
    applyYear();
    applyFavMarkers();
    if (state.active) positionCard(state.active);
  }

  function sizes() {
    var w = svg.node().clientWidth;
    // Favorite stars match pin size: outer border ≈ the pin (dot) or, for Index, the ring.
    if (STILL) return { dot: 8, ring: 13.5, hit: 22, gap: 6, star: 5.5, starBorder: 8, starIndex: 13.5 };
    if (w < 500) return { dot: 5.5, ring: 9.5, hit: 22, gap: 3, star: 3.8, starBorder: 5.5, starIndex: 9.5 };
    return { dot: 7, ring: 12, hit: 22, gap: 4, star: 4.8, starBorder: 7, starIndex: 12 };
  }

  // 5-point star centered at the origin, outer radius r. Same plump ratio as the UI star.
  function starPath(r) {
    var inner = r * 0.45, d = [];
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 === 0 ? r : inner;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      d.push((i ? "L" : "M") + (Math.cos(a) * rad).toFixed(3) + "," + (Math.sin(a) * rad).toFixed(3));
    }
    return d.join("") + "Z";
  }
  function favBorderRadius(d, S) {
    return d.m.in_maker_index ? S.starIndex : S.starBorder;
  }
  var STAR_BORDER_STROKE = 1.5;

  // Tight burnt-orange halo just outside the pin, or its Maker Index ring.
  // Stroke (3) lives in CSS; keep the two in sync.
  var FOCUS_STROKE = 3;
  var FOCUS_GAP = 1.5;
  function focusRingRadius(d, S) {
    var fav = !STILL && isFav(d.m);
    var coreR = fav ? favBorderRadius(d, S) : (d.m.in_maker_index ? S.ring : S.dot);
    var coreStroke = fav ? STAR_BORDER_STROKE : (d.m.in_maker_index ? 1.5 : (d.m.status ? 2 : 1.5));
    return coreR + coreStroke / 2 + FOCUS_GAP + FOCUS_STROKE / 2;
  }

  function isHawaii(m) { return m.region === "HI"; }

  function hawaiiBox(W, H) {
    // Classic lower-left inset. On desktop the HTML legend sits to the right of it.
    // On phones the main map is fitted above a reserved bottom band so the inset
    // does not cover California.
    if (STILL) return { x: 40, y: H - 44 - 168, w: 260, h: 168 };
    if (W < 500) return { x: 8, y: H - 8 - 90, w: 136, h: 90 };
    return { x: 16, y: H - 16 - 136, w: 208, h: 136 };
  }

  function hawaiiProjection(box) {
    if (!state.hawaii) return null;
    var compact = box.h < 110;
    var cap = compact ? 14 : 16; // room for the HAWAII caption
    var pad = compact ? 6 : 10;
    return d3.geoMercator().fitExtent(
      [[box.x + pad, box.y + pad], [box.x + box.w - pad, box.y + box.h - pad - cap]],
      state.hawaii
    );
  }

  function drawHawaiiInset(box, hiProj) {
    var g = svg.append("g").attr("class", "hi-inset").attr("aria-hidden", "true");
    g.append("rect")
      .attr("class", "hi-inset-frame")
      .attr("x", box.x).attr("y", box.y)
      .attr("width", box.w).attr("height", box.h)
      .attr("rx", 8).attr("ry", 8);
    var path = d3.geoPath(hiProj);
    g.append("path").attr("class", "hi-inset-land").attr("d", path(state.hawaii));
    g.append("text")
      .attr("class", "hi-inset-label")
      .attr("x", box.x + box.w / 2)
      .attr("y", box.y + box.h - 8)
      .attr("text-anchor", "middle")
      .text("HAWAII");
    state.hawaiiBox = box;
    return g;
  }

  function render() {
    syncMapButtons();
    if (!STILL && !PRINT && state.view === "world") { renderWorld(); return; }
    if (SIMPLE_COUNTRIES[state.focusCountry]) { renderSimpleCountry(); cacheLegendHeight(); return; }
    renderDetailed();
    cacheLegendHeight();
  }
  function renderDetailed() {
    var el = svg.node();
    var W = el.clientWidth;
    if (!W) return;
    var mobileInsetBand = 0;
    var backBand = 0;
    if (mqMobile.matches && !STILL) {
      // On phones the map takes the frame's natural shape, plus a bottom band for Hawaii on the US view.
      var probe = d3.geoConicConformal().rotate([96, 0]).parallels([33, 58]).fitWidth(W - 24, frame());
      var b = d3.geoPath(probe).bounds(frame());
      mobileInsetBand = (!state.focusCountry || state.focusCountry === "US") ? 98 : 0;
      // Extra top room so the back-to-World control doesn't sit on Washington / the Yukon.
      backBand = (!STILL && state.focusCountry) ? 34 : 0;
      el.style.height = Math.round(b[1][1] - b[0][1] + 20 + mobileInsetBand + backBand) + "px";
    } else {
      el.style.height = "";
    }
    var H = el.clientHeight;
    if (!H) return;
    var S = sizes();
    svg.attr("viewBox", "0 0 " + W + " " + H).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    backBand = (!STILL && state.focusCountry) ? 34 : 0;
    var pad = STILL ? { t: 110, r: 40, b: 40, l: 40 } : (W < 500 ? { t: 10 + backBand, r: 12, b: 10 + mobileInsetBand, l: 12 } : { t: 24, r: 24, b: 24, l: 24 });
    var projection = d3.geoConicConformal()
      .rotate([96, 0]).parallels([33, 58])
      .fitExtent([[pad.l, pad.t], [W - pad.r, H - pad.b]], frame());
    var path = d3.geoPath(projection);
    state.projection = projection;

    document.body.setAttribute("data-view", state.focusCountry ? "country" : "home");
    var landFeats = state.features.features;
    if (state.focusCountry === "US") landFeats = landFeats.filter(function (d) { return d.properties.country === "USA"; });
    if (state.focusCountry === "CA") landFeats = landFeats.filter(function (d) { return d.properties.country === "CAN"; });
    var gLand = svg.append("g").attr("class", "land-layer");
    gLand.selectAll("path").data(landFeats).join("path")
      .attr("class", function (d) { return "land " + (d.properties.country === "CAN" ? "land-ca" : "land-us"); })
      .attr("d", path)
      .append("title").text(function (d) { return d.properties.name; });
    gLand.append("path").attr("class", "inner-line").attr("d", path(state.innerBorders))
      .attr("stroke-width", W < 500 ? 0.6 : 0.8);
    if (state.lakes) gLand.append("g").attr("class", "lakes").selectAll("path").data(state.lakes.features).join("path")
      .attr("class", "lake").attr("d", path);
    gLand.append("path").attr("class", "country-border").attr("d", path(state.countryBorder))
      .attr("stroke-width", W < 500 ? 1.2 : 1.5);
    // Region and country names sit under the pins; filled in once pins are placed.
    var gNames = svg.append("g").attr("class", "names").attr("aria-hidden", "true");

    // Click on empty map closes the card.
    svg.on("click", function (ev) { if (!ev.target.closest(".pin")) closeCard(); });

    // Hawaii inset, drawn under the pins so the Ti2 pin sits on Oahu.
    var showHawaii = !state.focusCountry || state.focusCountry === "US";
    var hiBox = (showHawaii && state.hawaii) ? hawaiiBox(W, H) : null;
    var hiProj = hiBox ? hawaiiProjection(hiBox) : null;
    if (hiBox && hiProj) drawHawaiiInset(hiBox, hiProj);
    else state.hawaiiBox = null;

    // Pin layout: project, then nudge apart pins that would overlap, with a short leader line to the true spot.
    // Hawaii makers use the inset projection and are kept out of the mainland collision sim.
    var mainland = [];
    var insetNodes = [];
    makersOnMap().forEach(function (m) {
      if (m.unmapped || m.lat == null || m.lon == null) return;
      if (isHawaii(m) && hiProj) {
        var hp = hiProj([m.lon, m.lat]);
        insetNodes.push({ m: m, ax: hp[0], ay: hp[1], x: hp[0], y: hp[1], inset: true });
      } else {
        var p = projection([m.lon, m.lat]);
        mainland.push({ m: m, ax: p[0], ay: p[1], x: p[0], y: p[1], inset: false });
      }
    });
    var sim = d3.forceSimulation(mainland)
      .force("x", d3.forceX(function (d) { return d.ax; }).strength(0.25))
      .force("y", d3.forceY(function (d) { return d.ay; }).strength(0.25))
      .force("collide", d3.forceCollide(S.ring + S.gap).strength(1).iterations(4))
      .stop();
    for (var i = 0; i < 300; i++) sim.tick();
    // Keep mainland pins on the map. If one lands inside the inset, nudge it up.
    mainland.forEach(function (n) {
      var minX = S.ring + 2, maxX = W - S.ring - 2, minY = S.ring + 2, maxY = H - S.ring - 2;
      n.x = Math.max(minX, Math.min(maxX, n.x));
      n.y = Math.max(minY, Math.min(maxY, n.y));
      if (hiBox) {
        var inside = n.x > hiBox.x - S.ring && n.x < hiBox.x + hiBox.w + S.ring
          && n.y > hiBox.y - S.ring && n.y < hiBox.y + hiBox.h + S.ring;
        if (inside) n.y = hiBox.y - S.ring - 4;
      }
    });
    var nodes = mainland.concat(insetNodes);
    nodes.forEach(function (n) {
      n.m._x = n.x; n.m._y = n.y; n.m._node = n;
      n.moved = Math.hypot(n.x - n.ax, n.y - n.ay) > 2;
    });
    state.nodes = nodes;

    var gLead = svg.append("g").attr("class", "leaders").attr("aria-hidden", "true");
    var leads = gLead.selectAll("g").data(nodes.filter(function (n) { return n.moved; })).join("g")
      .attr("data-id", function (d) { return d.m.id; });
    leads.append("line").attr("class", "leader")
      .attr("x1", function (d) { return d.ax; }).attr("y1", function (d) { return d.ay; })
      .attr("x2", function (d) { return d.x; }).attr("y2", function (d) { return d.y; });
    leads.append("circle").attr("class", "anchor").attr("r", STILL ? 2.4 : 1.8)
      .attr("cx", function (d) { return d.ax; }).attr("cy", function (d) { return d.ay; });

    // Tab order runs west to east.
    var ordered = nodes.slice().sort(function (a, b) { return a.x - b.x; });
    var gPins = svg.append("g").attr("class", "pins");
    var pins = gPins.selectAll("g.pin").data(ordered, function (d) { return d.m.id; }).join("g")
      .attr("class", "pin")
      .attr("data-id", function (d) { return d.m.id; })
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-haspopup", "dialog")
      .attr("aria-label", function (d) { return ariaLabel(d.m); })
      .classed("inactive", function (d) { return !!d.m.status; })
      .classed("fav", function (d) { return !STILL && isFav(d.m); });
    pins.append("circle").attr("class", "hit").attr("r", S.hit);
    var body = pins.append("g").attr("class", "body");
    body.append("circle").attr("class", "focus-ring").attr("r", function (d) { return focusRingRadius(d, S); });
    body.filter(function (d) { return d.m.in_maker_index; })
      .append("circle").attr("class", "ring").attr("r", S.ring);
    body.append("circle").attr("class", "dot").attr("r", S.dot);
    if (!STILL) {
      var mark = body.append("g").attr("class", "star-mark");
      mark.append("path").attr("class", "star-border")
        .attr("d", function (d) { return starPath(favBorderRadius(d, S)); });
      mark.append("path").attr("class", "star").attr("d", starPath(S.star));
    }

    pins.on("click", function (ev, d) { ev.stopPropagation(); openCard(d.m, this); })
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openCard(d.m, this); }
      });

    var taken = STILL ? drawLabels(nodes, S, W, H) : [];
    drawNames(gNames, path, projection, nodes, S, W, H, taken);

    applyYear();
    applyFavMarkers();
    if (state.active) positionCard(state.active);
  }

  function applyFavMarkers() {
    if (STILL) return;
    var S = sizes();
    svg.selectAll("g.pin")
      .classed("fav", function (d) { return isFav(d.m); });
    svg.selectAll("g.pin .focus-ring")
      .attr("r", function (d) { return focusRingRadius(d, S); });
    raiseFavPins();
  }
  function raiseFavPins() {
    var g = svg.select("g.pins").node();
    if (!g) return;
    var favs = [], active = null;
    Array.prototype.forEach.call(g.querySelectorAll("g.pin"), function (node) {
      var d = d3.select(node).datum();
      if (state.active && d && d.m === state.active) active = node;
      else if (d && isFav(d.m)) favs.push(node);
    });
    favs.forEach(function (n) { g.appendChild(n); });
    if (active) g.appendChild(active);
  }

  function drawLabels(nodes, S, W, H) {
    var g = svg.append("g").attr("class", "labels");
    var boxes = nodes.map(function (n) { return { x: n.x - S.ring, y: n.y - S.ring, w: S.ring * 2, h: S.ring * 2 }; });
    // Place labels for the most crowded pins first.
    var order = nodes.slice().sort(function (a, b) { return crowd(b) - crowd(a); });
    function crowd(n) { return d3.sum(nodes, function (o) { return o !== n && Math.hypot(o.x - n.x, o.y - n.y) < 90 ? 1 : 0; }); }
    order.forEach(function (n) {
      var t = g.append("text").attr("class", "pin-label").text(n.m.name);
      var bb = t.node().getBBox();
      var off = S.ring + 7;
      var cands = [
        { x: n.x + off, y: n.y + bb.height * 0.32, a: "start" },
        { x: n.x - off, y: n.y + bb.height * 0.32, a: "end" },
        { x: n.x, y: n.y - off - 4, a: "middle" },
        { x: n.x, y: n.y + off + bb.height * 0.7, a: "middle" },
        { x: n.x + off * 0.8, y: n.y - off * 0.8, a: "start" },
        { x: n.x - off * 0.8, y: n.y - off * 0.8, a: "end" },
        { x: n.x + off * 0.8, y: n.y + off * 0.8 + bb.height * 0.6, a: "start" },
        { x: n.x - off * 0.8, y: n.y + off * 0.8 + bb.height * 0.6, a: "end" }
      ];
      var best = null, bestScore = Infinity;
      cands.forEach(function (c, i) {
        var x0 = c.a === "start" ? c.x : c.a === "end" ? c.x - bb.width : c.x - bb.width / 2;
        var box = { x: x0 - 3, y: c.y - bb.height * 0.8, w: bb.width + 6, h: bb.height };
        var score = i * 0.01;
        boxes.forEach(function (o) { score += overlap(box, o); });
        if (box.x < 4 || box.x + box.w > W - 4 || box.y < 4 || box.y + box.h > H - 4) score += 1e6;
        if (score < bestScore) { bestScore = score; best = { c: c, box: box }; }
      });
      t.attr("x", best.c.x).attr("y", best.c.y).attr("text-anchor", best.c.a);
      boxes.push(best.box);
    });
    return boxes;
  }

  // Label points for regions whose centroid falls in an awkward spot.
  var NAME_AT = {
    FL: [-81.6, 28.4], MI: [-84.8, 43.4], LA: [-92.5, 31.0], ID: [-114.7, 43.9], CA: [-119.8, 36.8],
    KY: [-85.0, 37.6], VA: [-78.6, 37.6], MD: [-76.9, 39.2], NY: [-75.3, 42.9], MN: [-94.4, 46.0],
    TN: [-86.4, 35.85], OK: [-97.4, 35.5], TX: [-98.8, 31.2], NJ: [-74.45, 40.1], MA: [-71.9, 42.35],
    WV: [-80.7, 38.6], NC: [-79.2, 35.55], ME: [-69.2, 45.3], AK: [-150, 63.5],
    BC: [-123.6, 53.9], AB: [-115.4, 55.4], SK: [-105.9, 54.4], MB: [-97.3, 54.4], ON: [-86.0, 50.0],
    QC: [-72.5, 51.5], NL: [-61.5, 53.5], NT: [-118.0, 62.5], NU: [-95.0, 64.5], YT: [-135.5, 63.0],
    NS: [-63.3, 45.1], NB: [-66.3, 46.6]
  };
  var SKIP_NAMES = { DC: 1, HI: 1, PE: 1 };
  var COUNTRY_AT = { US: [-99.2, 39.1], CA: [-101.5, 58.4] };

  function drawNames(g, path, projection, nodes, S, W, H, taken) {
    var mobile = W < 500;
    var fs = STILL ? 13 : mobile ? 8.5 : 10.5;
    var cfs = STILL ? 15 : mobile ? 9 : 12;
    var obstacles = taken.slice();
    // Every pin, its ring, its true spot and any leader line are off limits.
    var pad = mobile ? 4 : 5;
    nodes.forEach(function (n) {
      var r = S.ring + pad;
      obstacles.push({ x: n.x - r, y: n.y - r, w: r * 2, h: r * 2 });
      if (n.moved) {
        obstacles.push({ x: Math.min(n.ax, n.x) - 3, y: Math.min(n.ay, n.y) - 3, w: Math.abs(n.ax - n.x) + 6, h: Math.abs(n.ay - n.y) + 6 });
      }
    });
    if (state.hawaiiBox) {
      var hb = state.hawaiiBox;
      obstacles.push({ x: hb.x - 6, y: hb.y - 6, w: hb.w + 12, h: hb.h + 12 });
    }
    // Overlays on the map: legend and the still-image title.
    var svgRect = svg.node().getBoundingClientRect();
    [".legend", ".still-tag"].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el || el.offsetParent === null) return;
      var r = el.getBoundingClientRect();
      if (!r.width || r.top - svgRect.top > H || r.bottom < svgRect.top) return;
      obstacles.push({ x: r.left - svgRect.left - 6, y: r.top - svgRect.top - 6, w: r.width + 12, h: r.height + 12 });
    });
    var placed = [];
    function fits(box) {
      if (box.x < 4 || box.y < 4 || box.x + box.w > W - 4 || box.y + box.h > H - 4) return false;
      for (var i = 0; i < obstacles.length; i++) if (overlap(box, obstacles[i]) > 0) return false;
      for (var j = 0; j < placed.length; j++) if (overlap(box, placed[j]) > 0) return false;
      return true;
    }
    function put(cls, text, xy, size, spacing) {
      var t = g.append("text").attr("class", cls).attr("x", xy[0]).attr("y", xy[1])
        .attr("text-anchor", "middle").attr("dominant-baseline", "central")
        .style("font-size", size + "px").text(text);
      if (spacing) t.style("letter-spacing", spacing);
      var bb = t.node().getBBox();
      var box = { x: bb.x - 3, y: bb.y - 1, w: bb.width + 6, h: bb.height + 2 };
      if (!fits(box)) { t.remove(); return null; }
      placed.push(box);
      return { t: t, bb: bb, box: box };
    }
    // Country names first so they get the room they need.
    // Shown as a pair on the combined map, or omitted when a single country is in focus.
    if (!state.focusCountry) {
      var cl = ["CA", "US"].map(function (c) {
        var p = projection(COUNTRY_AT[c]);
        return p ? put("country-name-label", c === "US" ? "UNITED STATES" : "CANADA", p, cfs, mobile ? "0.22em" : "0.3em") : null;
      });
      if (!cl[0] || !cl[1]) cl.forEach(function (r) { if (r) { r.t.remove(); placed.splice(placed.indexOf(r.box), 1); } });
    }
    // Then regions, largest first; skip any that would not sit comfortably inside its own shape.
    var feats = state.features.features.filter(function (f) { return !SKIP_NAMES[f.properties.code]; })
    if (state.focusCountry === "US") feats = feats.filter(function (o) { return o.properties.country === "USA"; });
    if (state.focusCountry === "CA") feats = feats.filter(function (o) { return o.properties.country === "CAN"; });
    feats = feats
      .map(function (f) { return { f: f, area: path.area(f) }; })
      .sort(function (a, b) { return b.area - a.area; });
    feats.forEach(function (o) {
      var f = o.f, code = f.properties.code;
      var ll = NAME_AT[code] || d3.geoCentroid(f);
      var p = projection(ll);
      if (!p || !isFinite(p[0])) return;
      var b = path.bounds(f), bw = b[1][0] - b[0][0], bh = b[1][1] - b[0][1];
      var minSide = mobile ? 15 : 18;
      if (bw < minSide || bh < minSide * 0.8) return;
      // Try the label point, then small nudges around it; it must stay inside its own region.
      var k = mobile ? 0.7 : STILL ? 1.3 : 1;
      var offs = [[0, 0], [0, -13], [0, 13], [-18, 0], [18, 0], [-15, -12], [15, -12], [-15, 12], [15, 12], [0, -24], [0, 24], [-30, 0], [30, 0]];
      for (var i = 0; i < offs.length; i++) {
        var q = [p[0] + offs[i][0] * k, p[1] + offs[i][1] * k];
        var res = put("region-label", code, q, fs, "0.04em");
        if (!res) continue;
        var bb = res.bb;
        var corners = [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]];
        var inside = corners.every(function (c) { var g2 = projection.invert(c); return g2 && d3.geoContains(f, g2); });
        if (inside) return;
        res.t.remove(); placed.pop();
      }
    });
  }
  function overlap(a, b) {
    var x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    var y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return x * y;
  }


  function locationLine(m) {
    if (m.city) {
      var place = isEuropeMaker(m) && COUNTRY_NAMES[m.country]
        ? COUNTRY_NAMES[m.country]
        : (REGION_ABBR[m.region] || m.region);
      var line = m.city + ", " + place;
      if (m.city_unconfirmed) line += " (city unconfirmed)";
      return line;
    }
    if (isEuropeMaker(m) && COUNTRY_NAMES[m.country]) return COUNTRY_NAMES[m.country];
    return m.region_name || COUNTRY_NAMES[m.country] || "";
  }
  function foundedDisplay(m) {
    return m.shop_founded || (m.est_year ? String(m.est_year) : null);
  }
  function foundedLine(m) {
    var v = foundedDisplay(m);
    if (!v) return null;
    if (/^by /i.test(v)) return "Shop founded " + v;
    return "Shop founded " + v;
  }
  function listYear(m) {
    return m.shop_founded_short || foundedDisplay(m);
  }
  function hasPrice(m) {
    return !!(m && m.priceLow != null && m.priceHigh != null);
  }
  function formatMoney(n) {
    return "$" + Number(n).toLocaleString("en-US");
  }
  function priceText(m) {
    if (!hasPrice(m)) return null;
    if (m.priceLow === m.priceHigh) return formatMoney(m.priceLow);
    return formatMoney(m.priceLow) + "\u2013" + formatMoney(m.priceHigh).replace("$", "");
  }
  function priceLine(m) {
    var t = priceText(m);
    return t ? "Price " + t : null;
  }
  function matchesPriceTier(m, tier) {
    if (!hasPrice(m)) return false;
    if (tier === "under-100") return m.priceLow < 100;
    if (tier === "100-250") return m.priceLow <= 250 && m.priceHigh >= 100;
    if (tier === "over-250") return m.priceHigh > 250;
    return false;
  }
  var PRICE_CHIPS = [
    { value: "under-100", label: "Under $100" },
    { value: "100-250", label: "$100–250" },
    { value: "over-250", label: "Over $250" }
  ];
  var TYPE_CHIPS = [
    { value: "regular", label: "Regular" },
    { value: "fountain", label: "Fountain" },
    { value: "multi-pen", label: "Multi pen" },
    { value: "marker", label: "Marker" }
  ];
  var LIST_CHIPS = [];
  function loadLists(lists) {
    state.lists = Array.isArray(lists) ? lists : [];
    LIST_CHIPS = state.lists.map(function (l) {
      return { value: l.id, label: l.label, shortLabel: l.short_label || l.label };
    });
    state.lists.forEach(function (l) {
      var terms = (l.search_terms || []).slice();
      if (l.label && terms.indexOf(l.label) < 0) terms.push(l.label);
      if (l.short_label && terms.indexOf(l.short_label) < 0) terms.push(l.short_label);
      // Do not auto-tick from a shared credit such as "Pocket Priorities";
      // ambiguous queries suggest matching lists instead.
      if (!terms.length) return;
      var exists = SEARCH_SYNONYMS.some(function (syn) { return syn.group === "list" && syn.value === l.id; });
      if (!exists) SEARCH_SYNONYMS.push({ group: "list", value: l.id, terms: terms });
    });
    keywordFuse = null;
  }
  function findList(id) {
    return state.lists.find(function (l) { return l.id === id; }) || null;
  }
  function makerTypes(m) {
    return (m && Array.isArray(m.pen_types) && m.pen_types.length) ? m.pen_types : ["regular"];
  }
  function matchesType(m, type) {
    return makerTypes(m).indexOf(type) >= 0;
  }
  function matchesList(m, listId) {
    var list = findList(listId);
    if (!list || !m) return false;
    return (list.makers || []).some(function (e) { return e.slug === m.slug; });
  }
  function listEntry(list, m) {
    if (!list || !m) return null;
    return (list.makers || []).find(function (e) { return e.slug === m.slug; }) || null;
  }
  function filtersFor(group) {
    if (group === "price") return state.priceFilters;
    if (group === "list") return state.listFilters;
    return state.typeFilters;
  }
  function hasFacetFilters() {
    return state.priceFilters.length > 0 || state.typeFilters.length > 0 || state.listFilters.length > 0;
  }
  function activeFilterCount() {
    return state.priceFilters.length + state.typeFilters.length + state.listFilters.length;
  }
  function matchesGroup(m, group, value) {
    if (group === "price") return matchesPriceTier(m, value);
    if (group === "list") return matchesList(m, value);
    return matchesType(m, value);
  }
  function matchesFacets(m, exceptGroup) {
    if (exceptGroup !== "price" && state.priceFilters.length && !state.priceFilters.some(function (tier) { return matchesPriceTier(m, tier); })) return false;
    if (exceptGroup !== "type" && state.typeFilters.length && !state.typeFilters.some(function (type) { return matchesType(m, type); })) return false;
    if (exceptGroup !== "list" && state.listFilters.length && !state.listFilters.some(function (id) { return matchesList(m, id); })) return false;
    return true;
  }
  function isFacetHidden(m) {
    return !STILL && !matchesFacets(m);
  }
  function chipCount(group, value) {
    return state.makers.filter(function (m) {
      if (isFavHidden(m)) return false;
      if (!matchesFacets(m, group)) return false;
      return matchesGroup(m, group, value);
    }).length;
  }
  function filteredMakers() {
    return state.makers.filter(function (m) {
      if (isFavHidden(m)) return false;
      return matchesFacets(m);
    });
  }
  function hasMappedLocation(m) {
    return !!(m && !m.unmapped && m.lat != null && m.lon != null);
  }
  function isOutsideUsCa(m) {
    return hasMappedLocation(m) && m.country !== "US" && m.country !== "CA";
  }
  function offMapMatchingCount() {
    // Only the US & Canada landing view hides these pins; World / country zooms do not need the note.
    if (state.view !== "home") return 0;
    return filteredMakers().filter(isOutsideUsCa).length;
  }
  function filterCountText() {
    var n = filteredMakers().length;
    var total = state.makers.length;
    return n + " of " + total + " maker" + (total === 1 ? "" : "s");
  }
  function chipLabel(group, value) {
    var list = group === "price" ? PRICE_CHIPS : (group === "list" ? LIST_CHIPS : TYPE_CHIPS);
    var hit = list.find(function (c) { return c.value === value; });
    return hit ? hit.label : value;
  }
  function chipShortLabel(group, value) {
    var list = group === "price" ? PRICE_CHIPS : (group === "list" ? LIST_CHIPS : TYPE_CHIPS);
    var hit = list.find(function (c) { return c.value === value; });
    return hit ? (hit.shortLabel || hit.label) : value;
  }

  function ariaLabel(m) {
    var loc = locationLine(m);
    var s = m.name + (loc ? ", " + loc : "");
    var founded = foundedDisplay(m);
    s += founded ? ", shop founded " + founded : ", founding year not confirmed";
    var price = priceText(m);
    if (price) s += ", price " + price;
    if (m.first_pen) s += ", first pen " + m.first_pen;
    if (m.status_label) s += ", " + m.status_label;
    if (m.in_maker_index) s += ", featured in The Maker Index";
    return s;
  }

  /* ---------- Timeline ---------- */

  function setYear(y) {
    state.year = +y;
    slider.value = y;
    var pct = (y - slider.min) / (slider.max - slider.min) * 100;
    slider.style.setProperty("--fill", pct + "%");
    slider.setAttribute("aria-valuetext", "Founded by " + y);
    document.getElementById("year-value").textContent = y;
    var pool = filteredMakers();
    var known = pool.filter(function (m) { return m.est_year && m.est_year <= y; }).length;
    var unknown = pool.filter(function (m) { return !m.est_year; }).length;
    var el = document.getElementById("year-count");
    if (el) {
      el.textContent = known + (known === 1 ? " maker" : " makers");
      if (unknown) {
        var ex = document.createElement("span");
        ex.className = "extra"; ex.textContent = " + " + unknown + " year unknown";
        el.appendChild(ex);
      }
    }
    applyYear();
    if (state.view === "world") render();
  }

  function isYearHidden(m) {
    return !!m.est_year && m.est_year > state.year;
  }
  function isFavHidden(m) { return !STILL && state.favOnly && !isFav(m); }
  function isFilterHidden(m) { return isFavHidden(m) || isFacetHidden(m); }
  function isHidden(m) { return isYearHidden(m) || isFilterHidden(m); }

  function applyYear() {
    var full = state.year >= MAX_YEAR;
    svg.selectAll("g.pin")
      .classed("hidden", function (d) { return isHidden(d.m); })
      .classed("faded", function (d) { return !isHidden(d.m) && !d.m.est_year && !full; })
      .attr("tabindex", function (d) { return isHidden(d.m) ? -1 : 0; })
      .attr("aria-hidden", function (d) { return isHidden(d.m) ? "true" : null; });
    svg.selectAll(".leaders g").classed("hidden", function (d) { return isHidden(d.m); });
    d3.selectAll(".maker-btn").classed("dimmed", function () {
      var m = byId(this.getAttribute("data-id")); return isYearHidden(m);
    });
    d3.selectAll(".maker-row").classed("fav-hidden", function () {
      var btn = this.querySelector(".maker-btn");
      var m = btn && byId(btn.getAttribute("data-id"));
      return !!(m && isFilterHidden(m));
    });
    var filtering = state.favOnly || hasFacetFilters();
    document.querySelectorAll(".region").forEach(function (reg) {
      var any = reg.querySelector(".maker-row:not(.fav-hidden)");
      reg.hidden = filtering && !any;
    });
    document.querySelectorAll(".country").forEach(function (sec) {
      var any = sec.querySelector(".region:not([hidden])");
      sec.hidden = filtering && !any;
    });
    var title = document.getElementById("list-title");
    if (title && !PRINT) title.textContent = state.favOnly ? "Favorite makers" : "All makers";
    if (state.active && isHidden(state.active)) closeCard(true);
    updateListEmpty();
    syncFilterUI();
  }

  function togglePlay() {
    if (state.playing) return stopPlay();
    closeCard(true);
    var y = +slider.value >= MAX_YEAR ? state.minYear : +slider.value;
    setYear(y);
    playBtn.classList.add("playing");
    playBtn.setAttribute("aria-label", "Pause timeline");
    state.playing = setInterval(function () {
      var next = state.year + 1;
      if (next > MAX_YEAR) return stopPlay();
      setYear(next);
      if (next === MAX_YEAR) stopPlay();
    }, 520);
  }
  function stopPlay() {
    clearInterval(state.playing); state.playing = null;
    playBtn.classList.remove("playing");
    playBtn.setAttribute("aria-label", "Play timeline");
  }


  var ISSUE_NEW = "https://github.com/machinedpens/machinedpens.github.io/issues/new";

  function issueValue(v) {
    return (v == null || v === "") ? "—" : String(v);
  }
  function issueUrl(title, body) {
    return ISSUE_NEW + "?title=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(body);
  }
  function updateIssueUrl(m) {
    var body = [
      "Current values",
      "- Name: " + issueValue(m.name),
      "- Location: " + issueValue(locationLine(m)),
      "- Shop founded: " + issueValue(foundedDisplay(m)),
      "- First pen: " + issueValue(m.first_pen),
      "- Status: " + issueValue(m.status_label || (m.status ? m.status : "Active")),
      "- Website: " + issueValue(m.website),
      "",
      "What should change:",
      "",
      "",
      "Source (link):",
      ""
    ].join("\n");
    return issueUrl("Update: " + m.name, body);
  }
  function suggestMakerUrl() {
    var body = [
      "Name: ",
      "Website: ",
      "City/State or Province: ",
      "Shop founded: ",
      "First pen: ",
      "Source: "
    ].join("\n");
    return issueUrl("New maker: ", body);
  }
  function fillUpdateLink(m) {
    var wrap = document.getElementById("card-update");
    wrap.innerHTML = "";
    if (STILL) { wrap.hidden = true; return; }
    var a = document.createElement("a");
    a.href = updateIssueUrl(m);
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Update this entry";
    a.setAttribute("aria-label", "Update this entry for " + m.name + " (opens in a new tab)");
    a.addEventListener("click", function () { track("update-entry/" + m.slug, m.name); });
    wrap.appendChild(a);
    wrap.hidden = false;
  }
  function setupSuggestLink() {
    var a = document.getElementById("suggest-maker");
    if (!a) return;
    if (STILL) { a.parentElement.hidden = true; return; }
    a.href = suggestMakerUrl();
    a.target = "_blank";
    a.rel = "noopener";
    a.addEventListener("click", function () { track("suggest-maker", "Suggest a maker"); });
  }

  /* ---------- Card ---------- */

  var RING_ICON = '<svg class="ring-icon" viewBox="0 0 24 24" role="img" aria-label="Featured in The Maker Index"><title>Featured in The Maker Index</title><circle cx="12" cy="12" r="4.5" fill="var(--pin)"/><circle cx="12" cy="12" r="9" fill="none" stroke="var(--ring)" stroke-width="2"/></svg>';
  var ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11l6-6M6 5h5v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function addListCredits(m, meta) {
    if (!meta || !m || !state.listFilters.length) return;
    var hits = [];
    var order = (state.lists || []).map(function (l) { return l.id; });
    var ids = state.listFilters.slice().sort(function (a, b) {
      var ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    ids.forEach(function (id) {
      var list = findList(id);
      var entry = listEntry(list, m);
      if (!list || !entry || entry.rank == null) return;
      var prefix = list.rank_prefix || "";
      hits.push({
        list: list,
        text: prefix ? (prefix + " #" + entry.rank) : ("#" + entry.rank)
      });
    });
    if (!hits.length) return;
    var p = document.createElement("p");
    p.className = "list-credit";
    hits.forEach(function (hit, i) {
      if (i) p.appendChild(document.createTextNode(" · "));
      if (hit.list.url) {
        var a = document.createElement("a");
        a.href = hit.list.url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = hit.text;
        a.setAttribute("aria-label", hit.text + (hit.list.credit ? ", " + hit.list.credit : "") + " (opens in a new tab)");
        p.appendChild(a);
      } else {
        p.appendChild(document.createTextNode(hit.text));
      }
    });
    if (hits.length === 1 && hits[0].list.credit) {
      p.appendChild(document.createTextNode(" · "));
      var credit = hits[0].list;
      if (credit.url) {
        var ca = document.createElement("a");
        ca.href = credit.url;
        ca.target = "_blank";
        ca.rel = "noopener";
        ca.textContent = credit.credit;
        ca.setAttribute("aria-label", credit.credit + " (opens in a new tab)");
        p.appendChild(ca);
      } else {
        p.appendChild(document.createTextNode(credit.credit));
      }
    }
    meta.appendChild(p);
  }
  function openCard(m, fromEl) {
    if (state.playing) stopPlay();
    state.active = m;
    state.returnFocus = fromEl || null;
    var nameEl = document.getElementById("card-name");
    nameEl.innerHTML = "";
    nameEl.appendChild(document.createTextNode(m.name));
    if (m.in_maker_index) nameEl.insertAdjacentHTML("beforeend", RING_ICON);
    var tag = document.getElementById("card-tag");
    if (m.status_label) { tag.hidden = false; tag.textContent = m.status_label; }
    else { tag.hidden = true; tag.textContent = ""; }
    var meta = document.getElementById("card-meta");
    meta.innerHTML = "";
    function addLine(cls, text) {
      if (!text) return;
      var el = document.createElement("p");
      el.className = cls;
      el.textContent = text;
      meta.appendChild(el);
    }
    addLine("loc", locationLine(m));
    addLine("founded", foundedLine(m));
    addLine("price", priceLine(m));
    addLine("pen", m.first_pen ? "First pen " + m.first_pen : null);
    if (m.previously) {
      var prev = document.createElement("p");
      prev.className = "prev";
      var k = document.createElement("span");
      k.className = "k";
      k.textContent = "Previously: ";
      prev.appendChild(k);
      prev.appendChild(document.createTextNode(m.previously));
      meta.appendChild(prev);
    }
    addListCredits(m, meta);
    var note = document.getElementById("card-note");
    if (m.status_note) { note.hidden = false; note.textContent = m.status_note; }
    else { note.hidden = true; note.textContent = ""; }
    var links = document.getElementById("card-links");
    links.innerHTML = "";
    if (m.website) links.appendChild(link(m.website, "Website", false));
    if (m.maker_index_url) links.appendChild(link(m.maker_index_url, "Read my Maker Index post", true));
    fillUpdateLink(m);
    syncCardStar(m);

    card.hidden = false;
    positionCard(m);
    svg.selectAll("g.pin").classed("active", function (d) { return d.m === m; });
    d3.selectAll(".maker-btn").classed("active", function () { return this.getAttribute("data-id") === m.id; })
      .attr("aria-expanded", function () { return this.getAttribute("data-id") === m.id ? "true" : "false"; });
    d3.selectAll(".maker-row").classed("is-active", function () {
      var btn = this.querySelector(".maker-btn");
      return !!(btn && btn.getAttribute("data-id") === m.id);
    });
    // Bring the active pin to the top.
    var node = svg.select('g.pin[data-id="' + m.id + '"]').node();
    if (node) node.parentNode.appendChild(node);
  }
  function link(href, text, primary) {
    var a = document.createElement("a");
    a.href = href; a.target = "_blank"; a.rel = "noopener";
    a.className = primary ? "primary" : "";
    a.innerHTML = '<span></span>' + ARROW;
    a.firstChild.textContent = text;
    a.setAttribute("aria-label", text + (primary ? "" : " for " + state.active.name) + " (opens in a new tab)");
    return a;
  }
  function positionCard(m) {
    if (mqMobile.matches) { card.style.left = ""; card.style.top = ""; return; }
    var W = svg.node().clientWidth, H = svg.node().clientHeight;
    var cw = card.offsetWidth, ch = card.offsetHeight, gap = 20;
    if (m._x == null || m._y == null) {
      card.style.left = Math.round(Math.max(12, (W - cw) / 2)) + "px";
      card.style.top = Math.round(Math.max(12, (H - ch) / 2)) + "px";
      return;
    }
    var x = m._x + gap, y = m._y - ch / 2;
    if (x + cw > W - 12) x = m._x - gap - cw;
    if (x < 12) { x = Math.min(Math.max(12, m._x - cw / 2), W - cw - 12); y = m._y + gap; if (y + ch > H - 12) y = m._y - gap - ch; }
    y = Math.max(12, Math.min(H - ch - 12, y));
    card.style.left = x + "px"; card.style.top = y + "px";
  }
  function closeCard(silent) {
    if (card.hidden) return;
    card.hidden = true;
    svg.selectAll("g.pin").classed("active", false);
    d3.selectAll(".maker-btn").classed("active", false).attr("aria-expanded", "false");
    d3.selectAll(".maker-row").classed("is-active", false);
    var back = state.returnFocus;
    state.active = null; state.returnFocus = null;
    if (!silent && back && document.activeElement && card.contains(document.activeElement)) back.focus();
  }

  /* ---------- List ---------- */

  function listMeta(m, opts) {
    var parts = [];
    if (opts && opts.includeRegion) {
      if (m.city && isEuropeMaker(m) && COUNTRY_NAMES[m.country]) parts.push(m.city + ", " + COUNTRY_NAMES[m.country]);
      else if (m.city) parts.push(m.city + ", " + (REGION_ABBR[m.region] || m.region));
      else if (isEuropeMaker(m) && COUNTRY_NAMES[m.country]) parts.push(COUNTRY_NAMES[m.country]);
      else if (m.region_name) parts.push(m.region_name);
      else if (COUNTRY_NAMES[m.country]) parts.push(COUNTRY_NAMES[m.country]);
    } else if (m.city) {
      parts.push(m.city);
    } else if (COUNTRY_NAMES[m.country]) {
      parts.push(COUNTRY_NAMES[m.country]);
    }
    var year = listYear(m);
    if (year) parts.push(year);
    if (m.status === "closed") parts.push("Closed");
    else if (m.status === "inactive") parts.push("Inactive");
    return parts.join(" · ");
  }
  var STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.47 5.01 5.53.8-4 3.9.94 5.5L12 16.2l-4.94 2.6.94-5.5-4-3.9 5.53-.8z"/></svg>';

  function makerButton(m, opts) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "maker-btn"; b.setAttribute("data-id", m.id);
    b.setAttribute("data-slug", m.slug);
    b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-label", ariaLabel(m) + ". Show on map");
    b.innerHTML = swatch(m) + '<span class="m-name"></span><span class="m-meta"></span>';
    b.querySelector(".m-name").textContent = m.name;
    b.querySelector(".m-meta").textContent = listMeta(m, opts);
    b.addEventListener("click", function () { focusMaker(m, b); });
    return b;
  }
  function makerStar(m) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "maker-star";
    b.setAttribute("data-slug", m.slug);
    b.innerHTML = STAR_SVG;
    syncStarButton(b, m);
    b.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      toggleFavorite(m);
    });
    return b;
  }
  function makerRow(m, opts) {
    var row = document.createElement("div");
    row.className = "maker-row";
    row.setAttribute("data-slug", m.slug);
    row.appendChild(makerButton(m, opts));
    if (!STILL && !PRINT) row.appendChild(makerStar(m));
    return row;
  }
  function matchesListQuery(m) {
    if (state.listCountry) {
      if (state.listCountry === "EU") { if (!isEuropeMaker(m)) return false; }
      else if (m.country !== state.listCountry) return false;
    }
    var q = (state.listQuery || "").trim().toLowerCase();
    if (!q) return true;
    return (m.name || "").toLowerCase().indexOf(q) !== -1
      || (m.city || "").toLowerCase().indexOf(q) !== -1
      || (m.region_name || "").toLowerCase().indexOf(q) !== -1
      || (COUNTRY_NAMES[m.country] || "").toLowerCase().indexOf(q) !== -1
      || (isEuropeMaker(m) && "europe".indexOf(q) !== -1);
  }
  function compareName(a, b) {
    return d3.ascending((a.name || "").toLowerCase(), (b.name || "").toLowerCase());
  }
  function compareNewest(a, b) {
    var ay = a.est_year || 0, by = b.est_year || 0;
    if (ay !== by) return by - ay;
    return compareName(a, b);
  }
  function comparePrice(a, b) {
    var ap = hasPrice(a), bp = hasPrice(b);
    if (ap && !bp) return -1;
    if (!ap && bp) return 1;
    if (!ap && !bp) return compareName(a, b);
    if (a.priceLow !== b.priceLow) return a.priceLow - b.priceLow;
    if (a.priceHigh !== b.priceHigh) return a.priceHigh - b.priceHigh;
    return compareName(a, b);
  }
  function updateListEmpty() {
    var empty = document.getElementById("list-empty");
    if (!empty) return;
    var q = (state.listQuery || "").trim();
    var visible = document.querySelectorAll("#list .maker-row:not(.fav-hidden)");
    var filtering = !!(q || state.favOnly || hasFacetFilters());
    empty.hidden = !filtering || visible.length > 0;
    var reset = document.getElementById("list-empty-reset");
    if (reset) reset.hidden = !hasFacetFilters();
  }
  function syncListActive() {
    var id = state.active && state.active.id;
    d3.selectAll(".maker-btn").classed("active", function () { return !!id && this.getAttribute("data-id") === id; })
      .attr("aria-expanded", function () { return id && this.getAttribute("data-id") === id ? "true" : "false"; });
    d3.selectAll(".maker-row").classed("is-active", function () {
      var btn = this.querySelector(".maker-btn");
      return !!(id && btn && btn.getAttribute("data-id") === id);
    });
  }
  function appendFlatList(root, makers) {
    var ul = document.createElement("ul");
    ul.className = "maker-flat";
    makers.forEach(function (m) {
      var li = document.createElement("li");
      li.appendChild(makerRow(m, { includeRegion: true }));
      ul.appendChild(li);
    });
    root.appendChild(ul);
  }
  function appendGroupedList(root, makers) {
    var byCountry = d3.group(makers, function (m) { return unitCode(m); }, function (m) {
      if (isEuropeMaker(m)) return COUNTRY_NAMES[m.country] || m.country;
      return m.region_name || COUNTRY_NAMES[m.country] || "Location unknown";
    });
    var countries = Array.from(byCountry.keys()).sort(function (a, b) {
      var ia = COUNTRY_ORDER.indexOf(a), ib = COUNTRY_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    countries.forEach(function (c) {
      var sec = document.createElement("section");
      sec.className = "country";
      var h = document.createElement("h3");
      h.className = "country-name"; h.textContent = COUNTRY_NAMES[c] || c;
      sec.appendChild(h);
      var grid = document.createElement("div"); grid.className = "regions";
      var regions = Array.from(byCountry.get(c).keys()).sort(d3.ascending);
      regions.forEach(function (r) {
        var div = document.createElement("div"); div.className = "region";
        var rh = document.createElement("h4"); rh.className = "region-name"; rh.textContent = r;
        div.appendChild(rh);
        var ul = document.createElement("ul");
        byCountry.get(c).get(r).slice().sort(compareName)
          .forEach(function (m) {
            var li = document.createElement("li");
            li.appendChild(makerRow(m, isEuropeMaker(m) ? { includeRegion: true } : null));
            ul.appendChild(li);
          });
        div.appendChild(ul); grid.appendChild(div);
      });
      sec.appendChild(grid); root.appendChild(sec);
    });
  }
  function buildList() {
    var root = document.getElementById("list");
    if (!root) return;
    root.innerHTML = "";
    var makers = state.makers.filter(matchesListQuery);
    if (state.listSort === "az") appendFlatList(root, makers.slice().sort(compareName));
    else if (state.listSort === "newest") appendFlatList(root, makers.slice().sort(compareNewest));
    else if (state.listSort === "price") appendFlatList(root, makers.slice().sort(comparePrice));
    else appendGroupedList(root, makers);
    applyYear();
    syncListActive();
  }
  function setListSort(mode) {
    if (mode !== "state" && mode !== "az" && mode !== "newest" && mode !== "price") mode = "state";
    state.listSort = mode;
    document.querySelectorAll(".list-sort-btn").forEach(function (btn) {
      var on = btn.getAttribute("data-sort") === mode;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    buildList();
  }
  function bindListControls() {
    var controls = document.getElementById("list-controls");
    var input = document.getElementById("list-search");
    var sort = document.getElementById("list-sort");
    if (STILL || PRINT) {
      if (controls) controls.hidden = true;
      var empty = document.getElementById("list-empty");
      if (empty) empty.hidden = true;
      return;
    }
    if (input) {
      input.value = state.listQuery;
      input.addEventListener("input", function () {
        state.listQuery = input.value;
        buildList();
      });
    }
    if (sort) {
      sort.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-sort]");
        if (!btn) return;
        setListSort(btn.getAttribute("data-sort"));
      });
    }
    var countrySel = document.getElementById("list-country");
    if (countrySel) {
      COUNTRY_ORDER.forEach(function (c) {
        if (!countrySel.querySelector('option[value="' + c + '"]')) {
          var opt = document.createElement("option");
          opt.value = c; opt.textContent = COUNTRY_NAMES[c] || c;
          countrySel.appendChild(opt);
        }
      });
      countrySel.value = state.listCountry || "";
      countrySel.addEventListener("change", function () {
        state.listCountry = countrySel.value || "";
        buildList();
      });
    }
  }
  function swatch(m) {
    var dot = m.status
      ? '<circle cx="10" cy="10" r="4.5" fill="var(--paper)" stroke="var(--pin)" stroke-width="1.8"/>'
      : '<circle cx="10" cy="10" r="4.5" fill="var(--pin)"/>';
    return '<svg viewBox="0 0 20 20" aria-hidden="true">' + dot +
      (m.in_maker_index ? '<circle cx="10" cy="10" r="8" fill="none" stroke="var(--ring)" stroke-width="1.4"/>' : "") + "</svg>";
  }
  function focusMaker(m, btn) {
    if (isHidden(m)) { stopPlay(); setYear(MAX_YEAR); }
    if (!STILL) {
      if (isEuropeMaker(m)) {
        if (state.view !== "country" || state.focusCountry !== "EU") showCountry("EU");
      } else if (SIMPLE_COUNTRIES[m.country]) {
        if (state.view !== "country" || state.focusCountry !== m.country) showCountry(m.country);
      } else if (state.view !== "home") {
        showHome();
      }
    }
    var rect = wrap.getBoundingClientRect();
    var needScroll = rect.top < 0 || rect.bottom > window.innerHeight;
    var go = function () {
      openCard(m, btn);
      var pin = svg.select('g.pin[data-id="' + m.id + '"]');
      if (pin.empty()) return;
      var S = sizes();
      if (isFav(m)) {
        pin.select(".star-mark").interrupt()
          .transition().duration(220).attr("transform", "scale(1.35)")
          .transition().duration(380).attr("transform", "scale(1)");
      } else {
        pin.select(".dot").interrupt()
          .transition().duration(220).attr("r", S.dot * 1.8)
          .transition().duration(380).attr("r", S.dot);
      }
    };
    if (needScroll) {
      var top = window.scrollY + rect.top - (mqMobile.matches ? 8 : 24);
      window.scrollTo({ top: top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      setTimeout(go, 380);
    } else go();
  }


  /* ---------- Favorites ---------- */

  var FAV_KEY = "machinedpens-maker-map-favorites";
  var FAV_MAX = 5;
  var STAR_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.47 5.01 5.53.8-4 3.9.94 5.5L12 16.2l-4.94 2.6.94-5.5-4-3.9 5.53-.8z"/></svg>';

  function slugify(name) {
    return String(name).toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function favSet() { return state.favorites; }
  function isFav(m) { return !!(m && state.favorites[m.slug]); }
  function favSlugs() {
    return state.makers.filter(isFav).map(function (m) { return m.slug; });
  }
  function favMakers() { return state.makers.filter(isFav); }
  function sameSlugList(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var aa = a.slice().sort(), bb = b.slice().sort();
    for (var i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
    return true;
  }
  function knownSlug(slug) {
    return state.makers.some(function (m) { return m.slug === slug; });
  }
  function parseSlugs(raw) {
    if (raw == null || raw === "") return [];
    var out = [], seen = {};
    String(raw).split(",").forEach(function (part) {
      var s;
      try { s = decodeURIComponent(part.trim().toLowerCase()); } catch (e) { s = part.trim().toLowerCase(); }
      if (!s || seen[s] || !knownSlug(s) || out.length >= FAV_MAX) return;
      seen[s] = true;
      out.push(s);
    });
    return out;
  }
  function readFavParam(source) {
    if (!source) return null;
    var m = String(source).match(/(?:^|[?#&])fav=([^&]*)/);
    if (!m) return null;
    return parseSlugs(m[1]);
  }
  function loadStoredFavs() {
    try {
      var raw = localStorage.getItem(FAV_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      var out = [], seen = {};
      arr.forEach(function (item) {
        var s = String(item).toLowerCase();
        if (!s || seen[s] || !knownSlug(s) || out.length >= FAV_MAX) return;
        seen[s] = true;
        out.push(s);
      });
      return out;
    } catch (e) { return []; }
  }
  function saveStoredFavs(slugs) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(slugs)); } catch (e) {}
  }
  function setFavs(slugs) {
    var next = {}, n = 0;
    (slugs || []).forEach(function (s) {
      if (!knownSlug(s) || next[s] || n >= FAV_MAX) return;
      next[s] = true;
      n += 1;
    });
    state.favorites = next;
  }
  function atFavLimit() { return favSlugs().length >= FAV_MAX; }
  function adoptSharedOnEdit() {
    if (!state.shared) return;
    state.shared = false;
    saveStoredFavs(favSlugs());
    hideBanner();
  }

  function initFavorites() {
    var fromQuery = readFavParam(location.search);
    var fromHash = readFavParam(location.hash);
    var incoming = fromQuery || fromHash;
    var stored = loadStoredFavs();
    if ((fromHash && fromHash.length) || (fromQuery && fromQuery.length)) {
      track("opened-shared-link", "Opened shared link");
    }
    if (incoming && incoming.length && !sameSlugList(incoming, stored)) {
      state.shared = true;
      setFavs(incoming);
      state.favOnly = true;
    } else {
      setFavs(stored);
      if (stored.length) saveStoredFavs(favSlugs());
      if (incoming && incoming.length && sameSlugList(incoming, stored)) state.favOnly = true;
    }
    if (PRINT) state.favOnly = favSlugs().length > 0;
  }

  function shareUrl() {
    var url = new URL(location.href);
    url.searchParams.delete("print");
    url.searchParams.delete("fav");
    url.searchParams.delete("still");
    var slugs = favSlugs();
    url.hash = slugs.length ? "fav=" + slugs.join(",") : "";
    return url.toString();
  }
  function printViewUrl() {
    var url = new URL(location.href);
    url.searchParams.delete("still");
    url.searchParams.delete("fav");
    url.searchParams.set("print", "1");
    var slugs = favSlugs();
    url.hash = slugs.length ? "fav=" + slugs.join(",") : "";
    return url.toString();
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", "");
    ta.style.position = "fixed"; ta.style.left = "-9999px";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }
  function copyText(text, then) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(then).catch(function () { fallbackCopy(text); if (then) then(); });
    } else { fallbackCopy(text); if (then) then(); }
  }

  function syncStarButton(btn, m) {
    if (!btn || !m) return;
    var on = isFav(m);
    var muted = !on && atFavLimit();
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.classList.toggle("is-muted", muted);
    if (muted) {
      btn.setAttribute("aria-label", m.name + ". Favorites are full. Remove one to add another.");
    } else {
      btn.setAttribute("aria-label", (on ? "Remove " : "Add ") + m.name + " " + (on ? "from" : "to") + " favorites");
    }
  }
  function syncCardStar(m) {
    var btn = document.getElementById("card-star");
    if (!btn) return;
    if (STILL || PRINT || !m) { btn.hidden = true; return; }
    btn.hidden = false;
    syncStarButton(btn, m);
  }
  function syncAllStars() {
    document.querySelectorAll(".maker-star").forEach(function (btn) {
      var m = state.makers.find(function (x) { return x.slug === btn.getAttribute("data-slug"); });
      if (m) syncStarButton(btn, m);
    });
    if (state.active) syncCardStar(state.active);
    syncFavBar();
    buildPrintList();
    applyFavMarkers();
  }
  function syncFavBar() {
    var n = favSlugs().length;
    var label = document.getElementById("fav-toggle-label");
    var toggle = document.getElementById("fav-toggle");
    if (label) label.textContent = "Favorites (" + n + "/" + FAV_MAX + ")";
    if (toggle) {
      toggle.setAttribute("aria-pressed", state.favOnly && n ? "true" : "false");
      toggle.disabled = n === 0 && !state.favOnly;
    }
    ["fav-share", "fav-image", "fav-image-post", "fav-manage"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.disabled = n === 0;
    });
    var banner = document.getElementById("fav-banner");
    if (banner) banner.hidden = !state.shared;
    if (n < FAV_MAX) hideFavLimitNote();
    syncImageButton();
    buildManageList();
  }
  function hideBanner() {
    state.shared = false;
    var banner = document.getElementById("fav-banner");
    if (banner) banner.hidden = true;
  }

  var favNoteTimer = null;
  function hideFavLimitNote() {
    ["fav-limit-note", "card-fav-limit"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    if (favNoteTimer) { clearTimeout(favNoteTimer); favNoteTimer = null; }
  }
  function showFavLimitNote() {
    var cardNote = document.getElementById("card-fav-limit");
    var barNote = document.getElementById("fav-limit-note");
    var cardOpen = card && !card.hidden;
    if (cardNote) cardNote.hidden = !cardOpen;
    if (barNote) barNote.hidden = false;
    if (favNoteTimer) clearTimeout(favNoteTimer);
    favNoteTimer = setTimeout(hideFavLimitNote, 4000);
  }

  function toggleFavorite(m) {
    if (!m || STILL || PRINT) return;
    if (state.favorites[m.slug]) {
      adoptSharedOnEdit();
      delete state.favorites[m.slug];
      track("unstar/" + m.slug, m.name);
    } else if (atFavLimit()) {
      showFavLimitNote();
      return;
    } else {
      adoptSharedOnEdit();
      state.favorites[m.slug] = true;
      track("star/" + m.slug, m.name);
    }
    hideFavLimitNote();
    saveStoredFavs(favSlugs());
    if (favSlugs().length === 0) state.favOnly = false;
    syncAllStars();
    setYear(state.year);
  }
  function removeFavorite(slug) {
    var m = state.makers.find(function (x) { return x.slug === slug; });
    if (m) toggleFavorite(m);
  }
  function clearFavorites() {
    var cleared = favMakers().slice();
    adoptSharedOnEdit();
    state.favorites = {};
    state.favOnly = false;
    saveStoredFavs([]);
    closeManage();
    syncAllStars();
    setYear(state.year);
    cleared.forEach(function (m) { track("unstar/" + m.slug, m.name); });
  }
  function setFavOnly(on) {
    if (!favSlugs().length && on) return;
    state.favOnly = !!on;
    syncFavBar();
    setYear(state.year);
  }

  function buildManageList() {
    var list = document.getElementById("fav-panel-list");
    var empty = document.getElementById("fav-panel-empty");
    var clear = document.getElementById("fav-clear");
    if (!list) return;
    list.innerHTML = "";
    var items = favMakers().slice().sort(function (a, b) { return d3.ascending(a.name.toLowerCase(), b.name.toLowerCase()); });
    if (empty) empty.hidden = items.length > 0;
    if (clear) clear.hidden = items.length === 0;
    items.forEach(function (m) {
      var li = document.createElement("li");
      var name = document.createElement("button");
      name.type = "button"; name.className = "fav-panel-name"; name.textContent = m.name;
      name.addEventListener("click", function () { closeManage(); focusMaker(m, document.querySelector('.maker-btn[data-id="' + m.id + '"]')); });
      var rm = document.createElement("button");
      rm.type = "button"; rm.className = "fav-panel-remove";
      rm.setAttribute("aria-label", "Remove " + m.name + " from favorites");
      rm.textContent = "×";
      rm.addEventListener("click", function () { removeFavorite(m.slug); });
      li.appendChild(name); li.appendChild(rm); list.appendChild(li);
    });
  }
  function openManage() {
    var panel = document.getElementById("fav-panel");
    var btn = document.getElementById("fav-manage");
    if (!panel) return;
    buildManageList();
    panel.hidden = false;
    if (btn) btn.setAttribute("aria-expanded", "true");
  }
  function closeManage() {
    var panel = document.getElementById("fav-panel");
    var btn = document.getElementById("fav-manage");
    if (panel) panel.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  function toggleManage() {
    var panel = document.getElementById("fav-panel");
    if (!panel || panel.hidden) openManage(); else closeManage();
  }

  function foundedPrint(m) {
    var v = foundedDisplay(m);
    return v ? "Shop founded " + v : "";
  }
  function buildPrintList() {
    var root = document.getElementById("print-list");
    if (!root) return;
    root.innerHTML = "";
    var items = favMakers().slice().sort(function (a, b) { return d3.ascending(a.name.toLowerCase(), b.name.toLowerCase()); });
    items.forEach(function (m) {
      var art = document.createElement("article");
      art.className = "print-item";
      var h = document.createElement("h3"); h.textContent = m.name; art.appendChild(h);
      var loc = document.createElement("p"); loc.textContent = locationLine(m); art.appendChild(loc);
      var found = foundedPrint(m);
      if (found) { var f = document.createElement("p"); f.textContent = found; art.appendChild(f); }
      if (m.website) {
        var w = document.createElement("p"); w.className = "print-url"; w.textContent = m.website; art.appendChild(w);
      }
      root.appendChild(art);
    });
  }

  function setupPrintView() {
    var bar = document.getElementById("print-toolbar");
    var footer = document.getElementById("print-footer");
    var list = document.getElementById("print-list");
    if (bar) bar.hidden = false;
    if (footer) footer.hidden = false;
    if (list) list.hidden = false;
    document.title = "My Machined Pens Makers";
    if (!document.querySelector(".print-sheet")) {
      var sheet = document.createElement("div");
      sheet.className = "print-sheet";
      var header = document.querySelector(".site-header");
      var mainEl = document.querySelector("main");
      header.parentNode.insertBefore(sheet, header);
      sheet.appendChild(header);
      sheet.appendChild(mainEl);
      if (footer) sheet.appendChild(footer);
    }
    if (bar && bar.parentNode !== document.body) document.body.appendChild(bar);
    document.body.insertBefore(bar, document.body.firstChild);
    var back = document.getElementById("print-back");
    if (back) {
      var u = new URL(location.href);
      u.searchParams.delete("print");
      u.searchParams.delete("fav");
      u.hash = favSlugs().length ? "fav=" + favSlugs().join(",") : "";
      back.href = u.pathname + u.search + u.hash;
    }
    var now = document.getElementById("print-now");
    if (now) now.addEventListener("click", function () { window.print(); });
    buildPrintList();
  }

  function shareFavorites() {
    if (!favSlugs().length) return;
    track("share-link", "Share link");
    var url = shareUrl();
    var shareBtn = document.getElementById("fav-share");
    var markCopied = function () {
      if (!shareBtn) return;
      var prev = btnLabel(shareBtn);
      btnLabel(shareBtn, "Link copied");
      shareBtn.classList.add("is-copied");
      setTimeout(function () { btnLabel(shareBtn, prev); shareBtn.classList.remove("is-copied"); }, 1600);
    };
    copyText(url, markCopied);
    if (navigator.share && (mqMobile.matches || /Mobi|Android/i.test(navigator.userAgent))) {
      navigator.share({ title: "My Machined Pens Makers", url: url }).catch(function () {});
    }
  }

  function btnLabel(btn, text) {
    if (!btn) return "";
    var el = btn.querySelector(".fav-btn-label") || btn;
    if (text !== undefined) el.textContent = text;
    return el.textContent;
  }
  function isMobileClient() {
    return mqMobile.matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  }
  function syncImageButton() {
    var btn = document.getElementById("fav-image");
    if (!btn || btn.getAttribute("data-busy") === "1") return;
    btnLabel(btn, isMobileClient() ? "Share image" : "Save image");
  }

  var SHARE_FONT = "Arial, Helvetica, sans-serif";
  var SHARE_THEME = {
    bg: "#120c09",
    bgSoft: "#1a120e",
    land: "#5a4330",
    landCa: "#463628",
    inner: "rgba(245, 236, 220, 0.14)",
    border: "#a1622a",
    ink: "#f5ecdc",
    ink2: "#d4c4ae",
    ink3: "#9a8b7a",
    pin: "#c2410c",
    pinHot: "#e24a0f",
    onPin: "#fff5ea",
    line: "rgba(245, 236, 220, 0.16)",
    stroke: "#120c09"
  };

  function shareImageTitle(n) {
    return n === 1 ? "My Top Machined Pen Maker" : "My Top " + n + " Machined Pen Makers";
  }
  function shareImageFilename(n, kind) {
    var base = n === 1 ? "my-top-machined-pen-maker" : "my-top-" + n + "-machined-pen-makers";
    return base + (kind === "post" ? "-post.png" : ".png");
  }
  function orderedFavorites() {
    return favMakers().slice().sort(function (a, b) {
      var la = a.lon == null ? 999 : a.lon, lb = b.lon == null ? 999 : b.lon;
      if (la !== lb) return la - lb;
      return d3.ascending(a.name.toLowerCase(), b.name.toLowerCase());
    });
  }

  function shareMapExtent(items, includeHi) {
    var pts = items.filter(function (m) {
      return m.lon != null && m.lat != null && !(includeHi && isHawaii(m));
    });
    if (!pts.length) return frame();
    var lons = pts.map(function (m) { return m.lon; });
    var lats = pts.map(function (m) { return m.lat; });
    var minLon = d3.min(lons), maxLon = d3.max(lons);
    var minLat = d3.min(lats), maxLat = d3.max(lats);
    var midLon = (minLon + maxLon) / 2, midLat = (minLat + maxLat) / 2;
    var spanLon = Math.max(maxLon - minLon, 14);
    var spanLat = Math.max(maxLat - minLat, 9);
    spanLon *= 1.55;
    spanLat *= 1.55;
    // If the window is already basically the national frame, use the standard frame.
    if (spanLon > 52 && spanLat > 28) return frame();
    return {
      type: "MultiPoint",
      coordinates: [
        [midLon - spanLon / 2, midLat - spanLat / 2],
        [midLon - spanLon / 2, midLat + spanLat / 2],
        [midLon + spanLon / 2, midLat - spanLat / 2],
        [midLon + spanLon / 2, midLat + spanLat / 2]
      ]
    };
  }

  var SUBSTACK_URL = "https://machinedpens.substack.com";

  function drawShareQr(parent, box, T) {
    if (typeof qrcode !== "function") throw new Error("QR library missing");
    var qr = qrcode(0, "Q");
    qr.addData(SUBSTACK_URL);
    qr.make();
    var n = qr.getModuleCount();
    var quiet = 4;
    var total = n + quiet * 2;
    var cell = Math.floor(box.w / total);
    var render = cell * total;
    var ox = box.x + Math.floor((box.w - render) / 2);
    var oy = box.y + Math.floor((box.h - render) / 2);
    var g = parent.append("g").attr("aria-hidden", "true");
    g.append("rect")
      .attr("x", box.x).attr("y", box.y).attr("width", box.w).attr("height", box.h)
      .attr("rx", 16).attr("fill", T.ink)
      .attr("stroke", T.pin).attr("stroke-width", 1.25).attr("stroke-opacity", 0.55);
    var parts = [];
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) {
          var px = ox + (c + quiet) * cell;
          var py = oy + (r + quiet) * cell;
          parts.push("M" + px + "," + py + "h" + cell + "v" + cell + "h" + (-cell) + "z");
        }
      }
    }
    g.append("path").attr("d", parts.join("")).attr("fill", T.stroke);
  }

  function generateFavoritesImage(kind) {
    var items = orderedFavorites();
    if (!items.length) return Promise.reject(new Error("No favorites"));
    kind = kind === "post" ? "post" : "story";
    var T = SHARE_THEME;
    var W = 1080, H = kind === "story" ? 1920 : 1350;
    var n = items.length;
    var title = shareImageTitle(n);
    var includeHi = items.some(isHawaii);
    var topSafe = kind === "story" ? 250 : 56;
    var bottomSafe = kind === "story" ? 250 : 56;
    var stickerH = kind === "story" ? 220 : 0;

    var holder = document.createElement("div");
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText = "position:fixed;left:-14000px;top:0;width:" + W + "px;height:" + H + "px;pointer-events:none;";
    document.body.appendChild(holder);
    var svg = d3.select(holder).append("svg")
      .attr("xmlns", "http://www.w3.org/2000/svg")
      .attr("width", W).attr("height", H)
      .attr("viewBox", "0 0 " + W + " " + H)
      .attr("role", "img")
      .attr("aria-label", title)
      .style("font-family", SHARE_FONT);
    var node = svg.node();
    var uid = "s" + Math.random().toString(36).slice(2, 9);

    var defs = svg.append("defs");
    var glow = defs.append("radialGradient").attr("id", uid + "-glow")
      .attr("cx", "50%").attr("cy", "40%").attr("r", "58%");
    glow.append("stop").attr("offset", "0%").attr("stop-color", "#c2410c").attr("stop-opacity", 0.32);
    glow.append("stop").attr("offset", "45%").attr("stop-color", "#c2410c").attr("stop-opacity", 0.08);
    glow.append("stop").attr("offset", "100%").attr("stop-color", "#120c09").attr("stop-opacity", 0);
    var vig = defs.append("radialGradient").attr("id", uid + "-vig")
      .attr("cx", "50%").attr("cy", "45%").attr("r", "72%");
    vig.append("stop").attr("offset", "50%").attr("stop-color", "#120c09").attr("stop-opacity", 0);
    vig.append("stop").attr("offset", "100%").attr("stop-color", "#000000").attr("stop-opacity", 0.55);
    var pinGlow = defs.append("filter").attr("id", uid + "-pin")
      .attr("x", "-120%").attr("y", "-120%").attr("width", "340%").attr("height", "340%");
    pinGlow.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", 5).attr("result", "blur");
    var mer = pinGlow.append("feMerge");
    mer.append("feMergeNode").attr("in", "blur");
    mer.append("feMergeNode").attr("in", "SourceGraphic");
    var grain = defs.append("filter").attr("id", uid + "-grain");
    grain.append("feTurbulence").attr("type", "fractalNoise").attr("baseFrequency", 0.85).attr("numOctaves", 2).attr("stitchTiles", "stitch");
    grain.append("feColorMatrix").attr("type", "saturate").attr("values", "0");
    var ct = grain.append("feComponentTransfer");
    ct.append("feFuncA").attr("type", "linear").attr("slope", 0.055);

    var clipId = uid + "-clip";

    svg.append("rect").attr("width", W).attr("height", H).attr("fill", T.bg);
    svg.append("rect").attr("width", W).attr("height", H).attr("fill", "url(#" + uid + "-glow)");
    svg.append("rect").attr("width", W).attr("height", H).attr("fill", T.ink)
      .attr("filter", "url(#" + uid + "-grain)");

    // Headline — starts just under the top safe area
    var headY = kind === "story" ? topSafe + 18 : topSafe + 28;
    var kickerSize = kind === "story" ? 18 : 16;
    var kicker = svg.append("g");
    var kText = kicker.append("text")
      .attr("x", 22).attr("y", 0)
      .attr("fill", T.pin)
      .attr("font-family", SHARE_FONT).attr("font-weight", 700)
      .attr("font-size", kickerSize).attr("letter-spacing", "0.28em")
      .text("MACHINED PENS");
    var kbb = kText.node().getBBox();
    kicker.append("circle").attr("cx", 2).attr("cy", -5).attr("r", 7).attr("fill", T.pin)
      .attr("filter", "url(#" + uid + "-pin)");
    kicker.append("circle").attr("cx", 2).attr("cy", -5).attr("r", 11).attr("fill", "none")
      .attr("stroke", T.ink).attr("stroke-width", 1.6);
    var kMin = -11, kMax = kbb.x + kbb.width;
    kicker.attr("transform", "translate(" + (W / 2 - (kMin + kMax) / 2) + "," + headY + ")");

    var line1 = n === 1 ? "My Top" : "My Top " + n;
    var line2 = n === 1 ? "Machined Pen Maker" : "Machined Pen Makers";
    var titleSize = kind === "story" ? 99 : 64;
    var titleDy = kind === "story" ? 96 : 72;
    var subSize = kind === "story" ? 48 : 34;
    var subDy = kind === "story" ? 160 : 122;
    var t1 = svg.append("text")
      .attr("x", W / 2).attr("y", headY + titleDy)
      .attr("text-anchor", "middle").attr("fill", T.ink)
      .attr("font-family", SHARE_FONT).attr("font-weight", 800)
      .attr("font-size", titleSize)
      .attr("letter-spacing", "-0.035em")
      .text(line1);
    // Paint the number in orange by rewriting as tspans when there is a count
    if (n !== 1) {
      t1.text("");
      t1.append("tspan").text("My Top ");
      t1.append("tspan").attr("fill", T.pinHot).text(String(n));
    }
    svg.append("text")
      .attr("x", W / 2).attr("y", headY + subDy)
      .attr("text-anchor", "middle").attr("fill", T.ink)
      .attr("font-family", SHARE_FONT).attr("font-weight", 700)
      .attr("font-size", subSize)
      .attr("letter-spacing", "0.04em")
      .text(line2);

    var titleBottom = headY + (kind === "story" ? 180 : 148);
    var ctaSpace = kind === "story" ? 92 : 96;
    var mapTop = kind === "story" ? 520 : titleBottom + 18;
    var mapBottom = H - bottomSafe - stickerH - ctaSpace;
    if (kind === "post") mapBottom = H - bottomSafe - ctaSpace;
    var mapX = 48, mapY = mapTop, mapW = W - 96, mapH = mapBottom - mapTop;
    if (mapH < 420) { mapH = 420; mapY = mapBottom - mapH; }

    defs.append("clipPath").attr("id", clipId)
      .append("rect").attr("x", mapX).attr("y", mapY).attr("width", mapW).attr("height", mapH).attr("rx", 28);

    var gMap = svg.append("g");
    gMap.append("rect")
      .attr("x", mapX).attr("y", mapY).attr("width", mapW).attr("height", mapH)
      .attr("rx", 28).attr("fill", T.bgSoft).attr("stroke", T.line).attr("stroke-width", 1.5);
    var g = svg.append("g").attr("clip-path", "url(#" + clipId + ")");

    var hiBox = null, hiProj = null;
    if (includeHi && state.hawaii) {
      var hiW = Math.min(320, mapW * 0.36), hiH = hiW * 0.64;
      hiBox = { x: mapX + 24, y: mapY + mapH - 24 - hiH, w: hiW, h: hiH };
    }

    var qrBox = null; // QR removed per Teja (Nov 18)

    var extent = shareMapExtent(items, includeHi);
    var projection = d3.geoConicConformal()
      .rotate([96, 0]).parallels([33, 58])
      .fitExtent(
        [[mapX + 36, mapY + 32], [mapX + mapW - 36, mapY + mapH - 32 - (includeHi ? 12 : 0)]],
        extent
      );
    var path = d3.geoPath(projection);

    g.selectAll("path.share-land").data(state.features.features).join("path")
      .attr("d", path)
      .attr("fill", function (d) { return d.properties.country === "CAN" ? T.landCa : T.land; })
      .attr("stroke", "none");
    g.append("path").attr("d", path(state.innerBorders))
      .attr("fill", "none").attr("stroke", T.inner).attr("stroke-width", 1.15).attr("stroke-linejoin", "round");
    if (state.lakes) {
      g.append("g").selectAll("path").data(state.lakes.features).join("path")
        .attr("d", path).attr("fill", T.bgSoft).attr("stroke", "none");
    }
    g.append("path").attr("d", path(state.countryBorder))
      .attr("fill", "none").attr("stroke", T.border).attr("stroke-width", 2.2).attr("stroke-linejoin", "round").attr("stroke-linecap", "round");

    if (hiBox) {
      hiProj = d3.geoMercator().fitExtent(
        [[hiBox.x + 16, hiBox.y + 14], [hiBox.x + hiBox.w - 16, hiBox.y + hiBox.h - 30]],
        state.hawaii
      );
      var gHi = g.append("g");
      gHi.append("rect")
        .attr("x", hiBox.x).attr("y", hiBox.y).attr("width", hiBox.w).attr("height", hiBox.h)
        .attr("rx", 14).attr("fill", "#241a14").attr("stroke", T.line).attr("stroke-width", 1.5);
      gHi.append("path").attr("d", d3.geoPath(hiProj)(state.hawaii)).attr("fill", "#6a5138").attr("stroke", "none");
      gHi.append("text")
        .attr("x", hiBox.x + hiBox.w / 2).attr("y", hiBox.y + hiBox.h - 12)
        .attr("text-anchor", "middle").attr("fill", T.ink2)
        .attr("font-family", SHARE_FONT).attr("font-weight", 700)
        .attr("font-size", 13).attr("letter-spacing", "0.18em")
        .text("HAWAII");
    }

    g.append("rect")
      .attr("x", mapX).attr("y", mapY).attr("width", mapW).attr("height", mapH)
      .attr("fill", "url(#" + uid + "-vig)");

    var pinR = 17;
    // Share image stars are identical for every favorite — no Index-specific border.
    var starBorderR = pinR;
    var shareBorderStroke = 2.5;
    var starR = starBorderR - shareBorderStroke / 2 - starBorderR * (1.45 / 7);
    var mainland = [], insetNodes = [];
    items.forEach(function (m) {
      if (m.lat == null || m.lon == null) return;
      var rec = { m: m };
      if (includeHi && isHawaii(m) && hiProj) {
        var hp = hiProj([m.lon, m.lat]);
        rec.ax = hp[0]; rec.ay = hp[1]; rec.x = hp[0]; rec.y = hp[1]; rec.inset = true;
        insetNodes.push(rec);
      } else {
        var p = projection([m.lon, m.lat]);
        rec.ax = p[0]; rec.ay = p[1]; rec.x = p[0]; rec.y = p[1]; rec.inset = false;
        mainland.push(rec);
      }
    });
    var sim = d3.forceSimulation(mainland)
      .force("x", d3.forceX(function (d) { return d.ax; }).strength(0.28))
      .force("y", d3.forceY(function (d) { return d.ay; }).strength(0.28))
      .force("collide", d3.forceCollide(starBorderR + 8).strength(1).iterations(4))
      .stop();
    for (var i = 0; i < 300; i++) sim.tick();
    mainland.forEach(function (nd) {
      var r = starBorderR;
      var minX = mapX + r + 10, maxX = mapX + mapW - r - 10;
      var minY = mapY + r + 10, maxY = mapY + mapH - r - 10;
      nd.x = Math.max(minX, Math.min(maxX, nd.x));
      nd.y = Math.max(minY, Math.min(maxY, nd.y));
      if (hiBox) {
        var inside = nd.x > hiBox.x - r && nd.x < hiBox.x + hiBox.w + r
          && nd.y > hiBox.y - r && nd.y < hiBox.y + hiBox.h + r;
        if (inside) nd.y = hiBox.y - r - 10;
      }
      if (qrBox) {
        var overQr = nd.x > qrBox.x - r && nd.x < qrBox.x + qrBox.w + r
          && nd.y > qrBox.y - r && nd.y < qrBox.y + qrBox.h + r;
        if (overQr) nd.x = qrBox.x - r - 10;
      }
    });
    var nodes = mainland.concat(insetNodes);
    nodes.forEach(function (nd) {
      nd.moved = Math.hypot(nd.x - nd.ax, nd.y - nd.ay) > 2;
    });

    var gLead = g.append("g");
    nodes.filter(function (d) { return d.moved; }).forEach(function (d) {
      gLead.append("line")
        .attr("x1", d.ax).attr("y1", d.ay).attr("x2", d.x).attr("y2", d.y)
        .attr("stroke", T.ink3).attr("stroke-width", 1.2).attr("fill", "none");
      gLead.append("circle").attr("cx", d.ax).attr("cy", d.ay).attr("r", 2.2).attr("fill", T.ink3);
    });

    var gPins = g.append("g");
    nodes.forEach(function (d) {
      var gP = gPins.append("g").attr("transform", "translate(" + d.x + "," + d.y + ")");
      gP.append("circle").attr("r", starBorderR + 6).attr("fill", T.pin).attr("opacity", 0.28)
        .attr("filter", "url(#" + uid + "-pin)");
      gP.append("path").attr("d", starPath(starBorderR)).attr("fill", T.onPin).attr("stroke", T.stroke)
        .attr("stroke-width", shareBorderStroke).attr("stroke-linejoin", "round");
      gP.append("path").attr("d", starPath(starR)).attr("fill", T.pin).attr("stroke", "none")
        .attr("stroke-linejoin", "round");
    });

    placeShareLabels(g, nodes, starBorderR, { x: mapX, y: mapY, w: mapW, h: mapH }, hiBox, qrBox, T, uid);

    svg.append("rect")
      .attr("x", mapX).attr("y", mapY).attr("width", mapW).attr("height", mapH)
      .attr("rx", 28).attr("fill", "none").attr("stroke", T.line).attr("stroke-width", 1.5);

    // QR sits in the map's lower-right corner, above the sticker well.
    if (qrBox) drawShareQr(svg, qrBox, T);

    // Primary CTA is the Substack URL; the map link is the quieter second line.
    var ctaY = kind === "story" ? mapBottom + 36 : mapBottom + 42;
    var subY = kind === "story" ? mapBottom + 70 : mapBottom + 74;
    var primary = svg.append("text")
      .attr("x", W / 2).attr("y", ctaY)
      .attr("text-anchor", "middle")
      .attr("font-family", SHARE_FONT).attr("font-weight", 700)
      .attr("font-size", kind === "story" ? 32 : 26);
    primary.append("tspan").attr("fill", T.ink2).text("Read more at ");
    primary.append("tspan").attr("fill", T.pinHot).text("machinedpens.substack.com");
    var secondary = svg.append("text")
      .attr("x", W / 2).attr("y", subY)
      .attr("text-anchor", "middle")
      .attr("font-family", SHARE_FONT).attr("font-weight", 700)
      .attr("font-size", kind === "story" ? 20 : 18);
    secondary.append("tspan").attr("fill", T.ink3).text("Make yours  →  ");
    secondary.append("tspan").attr("fill", T.ink2).text("machinedpens.github.io");

    // Sticker well (~1080x220 on stories) stays visually quiet for the link sticker.
    // A small footer at the bottom of the well balances the frame without filling it.
    if (kind === "story") {
      svg.append("text")
        .attr("x", W / 2).attr("y", H - bottomSafe - 18)
        .attr("text-anchor", "middle").attr("fill", T.ink3)
        .attr("font-family", SHARE_FONT).attr("font-weight", 700)
        .attr("font-size", 15).attr("letter-spacing", "0.16em")
        .text("Machined Pens Maker Map");
    }

    return svgToPngBlob(node, W, H).then(function (blob) {
      if (holder.parentNode) holder.parentNode.removeChild(holder);
      return blob;
    }, function (err) {
      if (holder.parentNode) holder.parentNode.removeChild(holder);
      throw err;
    });
  }

  function placeShareLabels(g, nodes, pinR, bounds, hiBox, qrBox, T, uid) {
    var boxes = nodes.map(function (n) {
      return { x: n.x - pinR - 6, y: n.y - pinR - 6, w: pinR * 2 + 12, h: pinR * 2 + 12 };
    });
    if (hiBox) boxes.push({ x: hiBox.x - 8, y: hiBox.y - 8, w: hiBox.w + 16, h: hiBox.h + 16 });
    if (qrBox) boxes.push({ x: qrBox.x - 8, y: qrBox.y - 8, w: qrBox.w + 16, h: qrBox.h + 16 });

    function fits(box) {
      if (box.x < bounds.x + 12 || box.y < bounds.y + 12 ||
          box.x + box.w > bounds.x + bounds.w - 12 ||
          box.y + box.h > bounds.y + bounds.h - 12) return false;
      for (var i = 0; i < boxes.length; i++) if (overlap(box, boxes[i]) > 0) return false;
      return true;
    }
    function crowd(n) {
      return d3.sum(nodes, function (o) { return o !== n && Math.hypot(o.x - n.x, o.y - n.y) < 140 ? 1 : 0; });
    }
    var order = nodes.slice().sort(function (a, b) { return crowd(b) - crowd(a); });
    var gLab = g.append("g");

    order.forEach(function (n) {
      var name = n.m.name;
      var fs = name.length > 24 ? 22 : name.length > 16 ? 25 : 28;
      var tmp = gLab.append("text")
        .attr("font-family", SHARE_FONT).attr("font-weight", 700).attr("font-size", fs)
        .text(name);
      var bb = tmp.node().getBBox();
      tmp.remove();
      var off = pinR + 16, far = pinR + 52;
      var cands = [
        { x: n.x + off, y: n.y + bb.height * 0.32, a: "start" },
        { x: n.x - off, y: n.y + bb.height * 0.32, a: "end" },
        { x: n.x, y: n.y - off - 4, a: "middle" },
        { x: n.x, y: n.y + off + bb.height * 0.7, a: "middle" },
        { x: n.x + off * 0.85, y: n.y - off * 0.8, a: "start" },
        { x: n.x - off * 0.85, y: n.y - off * 0.8, a: "end" },
        { x: n.x + off * 0.85, y: n.y + off * 0.8 + bb.height * 0.55, a: "start" },
        { x: n.x - off * 0.85, y: n.y + off * 0.8 + bb.height * 0.55, a: "end" },
        { x: n.x + far, y: n.y + bb.height * 0.32, a: "start", lead: true },
        { x: n.x - far, y: n.y + bb.height * 0.32, a: "end", lead: true },
        { x: n.x + far, y: n.y - far * 0.55, a: "start", lead: true },
        { x: n.x - far, y: n.y - far * 0.55, a: "end", lead: true },
        { x: n.x + far, y: n.y + far * 0.55, a: "start", lead: true },
        { x: n.x - far, y: n.y + far * 0.55, a: "end", lead: true },
        { x: n.x, y: n.y - far - 6, a: "middle", lead: true },
        { x: n.x, y: n.y + far + bb.height, a: "middle", lead: true }
      ];
      var best = null, bestScore = Infinity;
      cands.forEach(function (c, idx) {
        var x0 = c.a === "start" ? c.x : c.a === "end" ? c.x - bb.width : c.x - bb.width / 2;
        var box = { x: x0 - 5, y: c.y - bb.height * 0.82, w: bb.width + 10, h: bb.height + 6 };
        if (!fits(box)) return;
        var score = idx * 0.4 + (c.lead ? 18 : 0);
        boxes.forEach(function (o) { score += overlap(box, o) * 0.02; });
        if (score < bestScore) { bestScore = score; best = { c: c, box: box }; }
      });
      if (!best) {
        // Last resort: place to the right and accept the edge clamp
        var fallback = cands[0];
        var x0 = fallback.x;
        best = { c: fallback, box: { x: x0 - 5, y: fallback.y - bb.height * 0.82, w: bb.width + 10, h: bb.height + 6 } };
      }
      if (best.c.lead) {
        var lx = best.c.a === "start" ? best.box.x : best.c.a === "end" ? best.box.x + best.box.w : n.x;
        var ly = best.box.y + best.box.h / 2;
        var ang = Math.atan2(ly - n.y, lx - n.x);
        gLab.append("line")
          .attr("x1", n.x + Math.cos(ang) * (pinR + 3))
          .attr("y1", n.y + Math.sin(ang) * (pinR + 3))
          .attr("x2", lx).attr("y2", ly)
          .attr("stroke", T.ink2).attr("stroke-width", 1.4).attr("fill", "none");
      }
      gLab.append("text")
        .attr("x", best.c.x).attr("y", best.c.y)
        .attr("text-anchor", best.c.a)
        .attr("fill", T.ink)
        .attr("font-family", SHARE_FONT).attr("font-weight", 700).attr("font-size", fs)
        .attr("stroke", T.stroke).attr("stroke-width", 7).attr("paint-order", "stroke")
        .attr("stroke-linejoin", "round")
        .text(name);
      boxes.push(best.box);
    });
  }

  function svgToPngBlob(svgEl, w, h) {
    return new Promise(function (resolve, reject) {
      var xml = new XMLSerializer().serializeToString(svgEl);
      if (xml.indexOf("xmlns=") < 0) xml = xml.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
      var url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = SHARE_THEME.bg;
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          canvas.toBlob(function (blob) {
            if (!blob) reject(new Error("Could not create image"));
            else resolve(blob);
          }, "image/png");
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Could not render image"));
      };
      img.src = url;
    });
  }

  function downloadBlob(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); if (a.parentNode) a.parentNode.removeChild(a); }, 2000);
  }

  var shareToastTimer = null;
  function showShareToast(msg) {
    var el = document.getElementById("share-toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    if (shareToastTimer) clearTimeout(shareToastTimer);
    shareToastTimer = setTimeout(function () { el.hidden = true; shareToastTimer = null; }, 4200);
  }

  function saveOrShareImage(kind) {
    var items = orderedFavorites();
    if (!items.length) return;
    kind = kind === "post" ? "post" : "story";
    var btn = document.getElementById(kind === "post" ? "fav-image-post" : "fav-image");
    var other = document.getElementById(kind === "post" ? "fav-image" : "fav-image-post");
    var prev = btn ? btnLabel(btn) : "";
    if (btn) {
      btn.setAttribute("data-busy", "1");
      btn.disabled = true;
      btnLabel(btn, kind === "post" ? "Saving…" : (isMobileClient() ? "Preparing…" : "Saving…"));
    }
    var n = items.length;
    generateFavoritesImage(kind).then(function (blob) {
      var file = new File([blob], shareImageFilename(n, kind), { type: "image/png" });
      copyText(SUBSTACK_URL, function () {
        showShareToast("Substack link copied – add it as a link sticker");
      });
      var usedShare = false;
      var finish = function () {
        if (btn) {
          btn.removeAttribute("data-busy");
          btnLabel(btn, prev);
        }
        syncImageButton();
        var postBtn = document.getElementById("fav-image-post");
        var storyBtn = document.getElementById("fav-image");
        var empty = favSlugs().length === 0;
        if (postBtn) postBtn.disabled = empty;
        if (storyBtn) storyBtn.disabled = empty;
      };
      if (kind === "story" && isMobileClient() && navigator.share && navigator.canShare) {
        try {
          if (navigator.canShare({ files: [file] })) {
            usedShare = true;
            navigator.share({ files: [file], title: shareImageTitle(n), text: shareImageTitle(n) + "\n" + SUBSTACK_URL })
              .then(finish)
              .catch(function (err) {
                if (!err || err.name !== "AbortError") downloadBlob(blob, file.name);
                finish();
              });
          }
        } catch (e) { usedShare = false; }
      }
      if (!usedShare) {
        downloadBlob(blob, file.name);
        finish();
      }
    }).catch(function (err) {
      console.error(err);
      if (btn) {
        btn.removeAttribute("data-busy");
        btnLabel(btn, prev);
      }
      syncImageButton();
      var postBtn = document.getElementById("fav-image-post");
      var storyBtn = document.getElementById("fav-image");
      var empty = favSlugs().length === 0;
      if (postBtn) postBtn.disabled = empty;
      if (storyBtn) storyBtn.disabled = empty;
    });
  }

  function bindFavorites() {
    var star = document.getElementById("card-star");
    if (star) star.addEventListener("click", function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      if (state.active) toggleFavorite(state.active);
    });
    var toggle = document.getElementById("fav-toggle");
    if (toggle) toggle.addEventListener("click", function () {
      if (!favSlugs().length) return;
      setFavOnly(!state.favOnly);
    });
    var share = document.getElementById("fav-share");
    if (share) share.addEventListener("click", shareFavorites);
    var imageBtn = document.getElementById("fav-image");
    if (imageBtn) imageBtn.addEventListener("click", function () {
      if (!favSlugs().length) return;
      track("share-image", "Share image");
      saveOrShareImage("story");
    });
    var postBtn = document.getElementById("fav-image-post");
    if (postBtn) postBtn.addEventListener("click", function () {
      if (!favSlugs().length) return;
      saveOrShareImage("post");
    });
    syncImageButton();
    if (mqMobile.addEventListener) mqMobile.addEventListener("change", syncImageButton);
    else if (mqMobile.addListener) mqMobile.addListener(syncImageButton);
    var manage = document.getElementById("fav-manage");
    if (manage) manage.addEventListener("click", function (ev) { ev.stopPropagation(); toggleManage(); });
    var clear = document.getElementById("fav-clear");
    if (clear) clear.addEventListener("click", clearFavorites);
    var save = document.getElementById("fav-save");
    if (save) save.addEventListener("click", function () {
      state.shared = false;
      saveStoredFavs(favSlugs());
      hideBanner();
    });
    var exit = document.getElementById("fav-exit");
    if (exit) exit.addEventListener("click", function () {
      hideBanner();
      setFavs(loadStoredFavs());
      state.favOnly = false;
      var url = new URL(location.href);
      url.searchParams.delete("fav");
      history.replaceState(null, "", url.pathname + url.search);
      syncAllStars();
      setYear(state.year);
    });
    document.addEventListener("click", function (ev) {
      var panel = document.getElementById("fav-panel");
      if (!panel || panel.hidden) return;
      if (panel.contains(ev.target) || ev.target.closest("#fav-manage")) return;
      closeManage();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        if (state.filtersOpen) { setFiltersOpen(false); ev.stopPropagation(); return; }
        closeManage();
      }
    });
    window.addEventListener("hashchange", function () {
      if (STILL || PRINT) return;
      var incoming = readFavParam(location.hash);
      if (!incoming || !incoming.length) return;
      var stored = loadStoredFavs();
      if (sameSlugList(incoming, favSlugs()) && !state.shared) {
        state.favOnly = true;
        setYear(state.year);
        syncFavBar();
        return;
      }
      if (!sameSlugList(incoming, stored)) {
        state.shared = true;
        setFavs(incoming);
        state.favOnly = true;
        syncAllStars();
        setYear(state.year);
      }
    });
    syncFavBar();
    buildPrintList();
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  var LIST_CHIP_ICON = '<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M9 7h11M9 12h11M9 17h11"/><circle cx="5" cy="7" r="1.15" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="5" cy="17" r="1.15" fill="currentColor" stroke="none"/></svg>';
  function quickChipsData() {
    var items = [];
    LIST_CHIPS.forEach(function (c) {
      items.push({ group: "list", value: c.value, label: c.label, shortLabel: c.shortLabel || c.label, curated: true });
    });
    var fountain = TYPE_CHIPS.find(function (c) { return c.value === "fountain"; });
    if (fountain) items.push({ group: "type", value: fountain.value, label: fountain.label, shortLabel: fountain.label, curated: false });
    var under100 = PRICE_CHIPS.find(function (c) { return c.value === "under-100"; });
    if (under100) items.push({ group: "price", value: under100.value, label: under100.label, shortLabel: under100.label, curated: false });
    return items;
  }
  function chipLabelHtml(fullLabel, shortLabel) {
    if (!shortLabel || shortLabel === fullLabel) return escapeHtml(fullLabel);
    return '<span class="chip-label-full">' + escapeHtml(fullLabel) + '</span><span class="chip-label-short">' + escapeHtml(shortLabel) + '</span>';
  }
  function renderDiscoverChips() {
    var wrap = document.getElementById("discover-chips");
    if (!wrap) return;
    wrap.innerHTML = quickChipsData().map(function (c) {
      var on = filtersFor(c.group).indexOf(c.value) >= 0;
      var n = chipCount(c.group, c.value);
      var cls = "filter-chip" + (c.curated ? " chip-curated" : "") + (n === 0 ? " is-zero" : "");
      var ico = c.curated ? LIST_CHIP_ICON + " " : "";
      return '<button type="button" class="' + cls + '" data-filter-group="' + c.group + '" data-filter="' + c.value + '" aria-pressed="' + (on ? "true" : "false") + '">' +
        ico + chipLabelHtml(c.label, c.shortLabel) + ' <span class="chip-n">' + n + "</span></button>";
    }).join("");
  }
  function renderFilterChips() {
    function fill(el, chips, group) {
      if (!el) return;
      el.innerHTML = chips.map(function (c) {
        var on = filtersFor(group).indexOf(c.value) >= 0;
        var n = chipCount(group, c.value);
        var cls = "filter-chip" + (n === 0 ? " is-zero" : "");
        return '<button type="button" class="' + cls + '" data-filter-group="' + group + '" data-filter="' + c.value + '" aria-pressed="' + (on ? "true" : "false") + '">' +
          escapeHtml(c.label) + ' <span class="chip-n">' + n + "</span></button>";
      }).join("");
    }
    fill(document.getElementById("price-chips"), PRICE_CHIPS, "price");
    fill(document.getElementById("type-chips"), TYPE_CHIPS, "type");
    fill(document.getElementById("list-chips"), LIST_CHIPS, "list");
    var listFg = document.getElementById("list-filter");
    if (listFg) listFg.hidden = !LIST_CHIPS.length;
    renderDiscoverChips();
  }
  function renderActiveChips() {
    var wrap = document.getElementById("af-chips");
    if (!wrap) return;
    var xIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
    var items = [];
    state.priceFilters.forEach(function (v) { items.push({ group: "price", value: v, label: chipLabel("price", v), shortLabel: chipShortLabel("price", v) }); });
    state.typeFilters.forEach(function (v) { items.push({ group: "type", value: v, label: chipLabel("type", v), shortLabel: chipShortLabel("type", v) }); });
    state.listFilters.forEach(function (v) { items.push({ group: "list", value: v, label: chipLabel("list", v), shortLabel: chipShortLabel("list", v) }); });
    wrap.innerHTML = items.map(function (it) {
      return '<span class="af-chip">' + chipLabelHtml(it.label, it.shortLabel) +
        ' <button type="button" class="af-x" data-filter-group="' + it.group + '" data-filter="' + it.value + '" aria-label="Remove ' + escapeHtml(it.label) + '">' + xIcon + "</button></span>";
    }).join("");
  }
  var lastSearchStatusMsg = "";
  function syncDiscoverStatus() {
    var hint = document.getElementById("discover-hint");
    var showing = document.getElementById("discover-showing");
    var countEl = document.getElementById("showing-count");
    var dot = document.getElementById("showing-dot");
    var af = document.getElementById("af-chips");
    var dotClear = document.getElementById("showing-dot-clear");
    var clearBtn = document.getElementById("showing-clear");
    if (!hint || !showing) return;
    var hasFacets = hasFacetFilters();
    var hasFav = !!state.favOnly;
    var searchEl = document.getElementById("filter-search");
    var q = searchEl ? searchEl.value.trim() : "";
    if (hasFacets) {
      hint.hidden = true;
      showing.hidden = false;
      if (countEl) countEl.textContent = "Showing " + filteredMakers().length + " of " + state.makers.length;
      if (dot) dot.hidden = false;
      if (af) af.hidden = false;
      if (dotClear) dotClear.hidden = false;
      if (clearBtn) { clearBtn.hidden = false; clearBtn.textContent = "Clear"; }
    } else if (hasFav) {
      hint.hidden = true;
      showing.hidden = false;
      if (countEl) countEl.textContent = "Showing " + filteredMakers().length + " of " + state.makers.length + " favorites";
      if (dot) dot.hidden = true;
      if (af) af.hidden = true;
      if (dotClear) dotClear.hidden = false;
      if (clearBtn) { clearBtn.hidden = false; clearBtn.textContent = "Show all"; }
    } else if (q && lastSearchStatusMsg) {
      hint.hidden = true;
      showing.hidden = false;
      if (countEl) countEl.textContent = lastSearchStatusMsg;
      if (dot) dot.hidden = true;
      if (af) af.hidden = true;
      if (dotClear) dotClear.hidden = false;
      if (clearBtn) { clearBtn.hidden = false; clearBtn.textContent = "Clear"; }
    } else {
      showing.hidden = true;
      hint.hidden = false;
      hint.textContent = state.makers.length + " makers · tap a list to explore";
    }
    var offmap = document.getElementById("showing-offmap");
    if (offmap) {
      // Default / no-facet hint stays an explore prompt (it already fills the slot).
      // The off-map note is for active filters or Favorites, when matching mapped
      // makers sit outside the US & Canada view.
      var nOut = ((hasFacets || hasFav) && !showing.hidden) ? offMapMatchingCount() : 0;
      if (nOut > 0) {
        offmap.hidden = false;
        offmap.querySelectorAll(".offmap-count").forEach(function (el) { el.textContent = String(nOut); });
        offmap.setAttribute("aria-label", nOut + (nOut === 1 ? " maker" : " makers") + " outside US and Canada. See World view");
      } else {
        offmap.hidden = true;
      }
    }
  }
  var lastFilterSig = "";
  function filterSig() {
    return state.priceFilters.join(",") + "|" + state.typeFilters.join(",") + "|" + state.listFilters.join(",") + "|" + (state.favOnly ? "1" : "0");
  }
  function syncFilterUI() {
    var countText = filterCountText();
    var drawerCount = document.getElementById("drawer-count");
    if (drawerCount) drawerCount.textContent = countText;
    var n = activeFilterCount();
    var badge = document.getElementById("filters-badge");
    if (badge) {
      badge.textContent = String(n);
      badge.hidden = n === 0;
    }
    var btn = document.getElementById("filters-btn");
    if (btn) btn.classList.toggle("has-filters", n > 0);
    var searchEl = document.getElementById("filter-search");
    var searchClear = document.getElementById("discover-search-clear");
    if (searchClear) searchClear.hidden = !(searchEl && searchEl.value.length > 0);
    var canReset = n > 0 || !!(searchEl && searchEl.value.trim());
    document.querySelectorAll(".clear-btn").forEach(function (el) {
      if (canReset) el.removeAttribute("disabled");
      else el.setAttribute("disabled", "");
    });
    var mapEmpty = document.getElementById("map-empty");
    if (mapEmpty) {
      var none = hasFacetFilters() && filteredMakers().length === 0;
      mapEmpty.hidden = !none;
    }
    var sig = filterSig();
    if (sig !== lastFilterSig || !document.querySelector("#price-chips .filter-chip")) {
      lastFilterSig = sig;
      renderFilterChips();
      renderActiveChips();
    }
    syncDiscoverStatus();
  }
  function applyFilters() {
    if (state.active && isHidden(state.active)) closeCard(true);
    else if (state.active && card && !card.hidden) openCard(state.active, state.returnFocus);
    setYear(state.year);
  }
  function toggleFilter(group, value) {
    if (STILL || PRINT || !value) return;
    var arr = filtersFor(group);
    var owned = searchOwned[group] || (searchOwned[group] = []);
    var o = owned.indexOf(value);
    if (o >= 0) owned.splice(o, 1);
    var i = arr.indexOf(value);
    if (i >= 0) arr.splice(i, 1);
    else {
      arr.push(value);
      if (group === "price") track("filter-price/" + value, "Filter price");
      else if (group === "list") track("filter-list/" + value, "Filter list");
      else track("filter-type/" + value, "Filter type");
    }
    applyFilters();
  }
  function resetFilters() {
    var searchEl = document.getElementById("filter-search");
    var hadSearch = !!(searchEl && searchEl.value);
    if (!hasFacetFilters() && !hadSearch) return;
    state.priceFilters = [];
    state.typeFilters = [];
    state.listFilters = [];
    searchOwned = { price: [], type: [], list: [] };
    if (searchEl) searchEl.value = "";
    renderSearchFeedback({ showing: [], listSuggestions: [], suggestions: [] });
    applyFilters();
  }
  function setFiltersOpen(open) {
    if (STILL || PRINT) open = false;
    state.filtersOpen = !!open;
    var panel = document.getElementById("filter-panel");
    var scrim = document.getElementById("filter-scrim");
    var btn = document.getElementById("filters-btn");
    if (panel) panel.hidden = !state.filtersOpen;
    if (scrim) scrim.hidden = !state.filtersOpen;
    if (btn) btn.setAttribute("aria-expanded", state.filtersOpen ? "true" : "false");
    document.body.classList.toggle("filters-open", state.filtersOpen);
    if (state.filtersOpen) {
      hideSuggestions();
      var closeBtn = document.getElementById("filters-close");
      if (closeBtn) closeBtn.focus();
    } else if (btn) {
      btn.focus();
    }
  }
  /* ---------- Filter search (Fuse.js, no AI) ---------- */

  // Teach the Filters search a new word or typo by adding a term here.
  // `terms` match as whole words or phrases, and strings of 4+ characters
  // also match fuzzily via Fuse.js. `group` is "price", "type", or "list";
  // `value` must be a chip id from PRICE_CHIPS, TYPE_CHIPS, or LIST_CHIPS.
  var SEARCH_SYNONYMS = [
    { group: "type", value: "fountain", terms: ["fountain", "fountain pen", "fountain pens", "fp"] },
    { group: "type", value: "regular", terms: ["regular", "ballpoint", "ball point", "rollerball", "roller ball", "gel", "bolt", "click"] },
    { group: "type", value: "multi-pen", terms: ["multi pen", "multi pens", "multipen", "multi-pen", "multi"] },
    { group: "type", value: "marker", terms: ["marker", "markers", "sharpie"] },
    { group: "price", value: "under-100", terms: ["cheap", "budget", "inexpensive"] },
    { group: "price", value: "over-250", terms: ["expensive", "premium", "high end", "high-end"] }
  ];
  var SEARCH_STOP = {
    pen: 1, pens: 1, a: 1, an: 1, the: 1, for: 1, and: 1, or: 1, of: 1, with: 1,
    in: 1, at: 1, to: 1, from: 1, maker: 1, makers: 1, looking: 1, want: 1,
    show: 1, me: 1, please: 1, some: 1, any: 1, that: 1
  };
  var keywordFuse = null;
  var makerFuse = null;
  var makerNameFuse = null;
  var makerLocFuse = null;
  var searchSuggestIndex = -1;
  var searchOwned = { price: [], type: [], list: [] };

  function searchTermIndex() {
    var items = [];
    SEARCH_SYNONYMS.forEach(function (syn) {
      syn.terms.forEach(function (term) {
        items.push({ term: term, group: syn.group, value: syn.value, len: term.length });
      });
    });
    items.sort(function (a, b) { return b.len - a.len; });
    return items;
  }
  function ensureSearchIndexes() {
    if (typeof Fuse !== "function") return;
    if (!keywordFuse) {
      keywordFuse = new Fuse(searchTermIndex(), {
        keys: ["term"], includeScore: true, threshold: 0.4,
        ignoreLocation: true, minMatchCharLength: 4
      });
    }
    if (!makerFuse) {
      var docs = state.makers.map(function (m) {
        return {
          m: m,
          name: m.name || "",
          city: m.city || "",
          region: m.region || "",
          region_name: m.region_name || "",
          country: m.country || "",
          countryName: COUNTRY_NAMES[m.country] || ""
        };
      });
      var shared = { includeScore: true, ignoreLocation: true, threshold: 0.5 };
      makerFuse = new Fuse(docs, Object.assign({ keys: ["name", "city", "region", "region_name", "country", "countryName"], minMatchCharLength: 2 }, shared));
      makerNameFuse = new Fuse(docs, Object.assign({ keys: ["name"], minMatchCharLength: 2 }, shared));
      makerLocFuse = new Fuse(docs, Object.assign({ keys: ["city", "region", "region_name", "country", "countryName"], minMatchCharLength: 4 }, shared));
    }
  }
  function uniqPush(arr, v) {
    if (v && arr.indexOf(v) < 0) arr.push(v);
  }
  function bucketsUnder(n) {
    var out = [];
    if (n > 0) out.push("under-100");
    if (n > 100) out.push("100-250");
    if (n > 250) out.push("over-250");
    return out;
  }
  function bucketsOver(n) {
    var out = [];
    if (n < 100) out.push("under-100");
    if (n < 250) out.push("100-250");
    out.push("over-250");
    return out;
  }
  function bucketsBetween(a, b) {
    var lo = Math.min(a, b), hi = Math.max(a, b);
    var out = [];
    if (lo < 100 && hi > 0) out.push("under-100");
    if (lo <= 250 && hi >= 100) out.push("100-250");
    if (hi > 250) out.push("over-250");
    return out;
  }
  function parsePricePatterns(text) {
    var prices = [];
    function take(re, fn) {
      text = text.replace(re, function () {
        var vals = fn.apply(null, arguments);
        if (vals) vals.forEach(function (v) { uniqPush(prices, v); });
        return " ";
      });
    }
    take(/between\s*\$?\s*(\d+)\s*(?:and|-|–|—)\s*\$?\s*(\d+)/gi, function (full, a, b) { return bucketsBetween(+a, +b); });
    take(/\$?\s*(\d+)\s*(?:to|-|–|—)\s*\$?\s*(\d+)/gi, function (full, a, b) { return bucketsBetween(+a, +b); });
    take(/(?:under|below|less\s+than|cheaper\s+than|<)\s*\$?\s*(\d+)/gi, function (full, n) { return bucketsUnder(+n); });
    take(/(?:over|above|more\s+than|greater\s+than|>)\s*\$?\s*(\d+)/gi, function (full, n) { return bucketsOver(+n); });
    take(/\$?\s*(\d+)\s*\+/gi, function (full, n) { return bucketsOver(+n); });
    return { prices: prices, leftover: text };
  }
  function wordRe(term) {
    var esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return new RegExp("(?:^|[^a-z0-9])(" + esc + ")(?=$|[^a-z0-9])", "i");
  }
  function suggestMakers(nameQ) {
    if (!nameQ || nameQ.length < 2) return [];
    function uniqueMakers(list) {
      var seen = {};
      var out = [];
      list.forEach(function (m) {
        if (!m || seen[m.id]) return;
        seen[m.id] = 1;
        out.push(m);
      });
      return out;
    }
    function take(results, maxScore) {
      return (results || []).filter(function (r) { return r.score <= maxScore; }).map(function (r) { return r.item.m; });
    }
    if (makerFuse) {
      var nameHits = take(makerNameFuse ? makerNameFuse.search(nameQ) : makerFuse.search(nameQ), 0.4);
      var locHits = [];
      if (nameQ.length >= 4 && makerLocFuse) locHits = take(makerLocFuse.search(nameQ), 0.3);
      return uniqueMakers(nameHits.concat(locHits)).slice(0, 5);
    }
    var lq = nameQ.toLowerCase();
    return state.makers.filter(function (m) {
      return (m.name || "").toLowerCase().indexOf(lq) !== -1
        || (m.city || "").toLowerCase().indexOf(lq) !== -1
        || (m.region || "").toLowerCase().indexOf(lq) !== -1
        || (m.region_name || "").toLowerCase().indexOf(lq) !== -1
        || (m.country || "").toLowerCase().indexOf(lq) !== -1
        || (COUNTRY_NAMES[m.country] || "").toLowerCase().indexOf(lq) !== -1;
    }).slice(0, 5);
  }
  var SHARED_LIST_TERMS = ["pp top 10", "pp top ten", "pocket priorities"];
  function listQueryTerms(list) {
    var terms = (list.search_terms || []).slice();
    if (list.label) terms.push(list.label);
    if (list.credit) terms.push(list.credit);
    return terms;
  }
  function listQueryScore(q, list) {
    if (!q) return 0;
    var best = 0;
    listQueryTerms(list).forEach(function (term) {
      var t = String(term || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (!t) return;
      if (t === q) best = Math.max(best, 1000 + t.length);
      else if (wordRe(t).test(q)) best = Math.max(best, 500 + t.length);
      else if (q.length >= 4 && t.indexOf(q) === 0) best = Math.max(best, 100 + q.length);
    });
    SHARED_LIST_TERMS.forEach(function (term) {
      if (!(q === term || wordRe(term).test(q))) return;
      var label = (list.label || "").toLowerCase();
      var credit = (list.credit || "").toLowerCase();
      if (label.indexOf(term) === 0 || wordRe(term).test(label) || credit === term || wordRe(term).test(credit)) {
        best = Math.max(best, 50 + term.length);
      }
    });
    return best;
  }
  function resolveListQuery(q) {
    var scored = (state.lists || []).map(function (l) {
      return { list: l, score: listQueryScore(q, l) };
    }).filter(function (x) { return x.score > 0; });
    if (!scored.length) return { lists: [], suggestions: [] };
    var max = 0;
    scored.forEach(function (x) { if (x.score > max) max = x.score; });
    var top = scored.filter(function (x) { return x.score === max; });
    // A unique strong match (exact, term-in-query, or unique label prefix) auto-selects.
    // A tie, or only a shared phrase such as "pp top 10" / "pocket priorities", suggests
    // the matching lists instead of ticking one or both.
    if (top.length === 1 && max >= 100) {
      return { lists: [top[0].list.id], suggestions: [] };
    }
    return { lists: [], suggestions: scored.map(function (x) { return x.list; }) };
  }
  function parseFilterSearch(query) {
    var raw = String(query || "").replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
    var q = raw.trim().toLowerCase().replace(/\s+/g, " ");
    var prices = [];
    var types = [];
    var lists = [];
    var suggestions = [];
    if (!q) return { prices: prices, types: types, lists: lists, listSuggestions: [], suggestions: suggestions, showing: [] };

    var priced = parsePricePatterns(q);
    priced.prices.forEach(function (v) { uniqPush(prices, v); });
    var leftover = priced.leftover.replace(/\s+/g, " ").trim();
    var terms = searchTermIndex();

    terms.forEach(function (it) {
      var re = wordRe(it.term);
      if (re.test(leftover)) {
        leftover = leftover.replace(re, " ").replace(/\s+/g, " ").trim();
        if (it.group === "price") uniqPush(prices, it.value);
        else if (it.group === "list") uniqPush(lists, it.value);
        else uniqPush(types, it.value);
      }
    });

    ensureSearchIndexes();
    var tokens = leftover ? leftover.split(/[^a-z0-9]+/).filter(Boolean) : [];
    var remain = [];
    tokens.forEach(function (tok) {
      if (SEARCH_STOP[tok]) return;
      var hit = null;
      for (var i = 0; i < terms.length; i++) {
        if (terms[i].term === tok) { hit = terms[i]; break; }
      }
      if (!hit && keywordFuse && tok.length >= 4) {
        var res = keywordFuse.search(tok);
        if (res.length && res[0].score <= 0.4) hit = res[0].item;
      }
      if (hit) {
        if (hit.group === "price") uniqPush(prices, hit.value);
        else if (hit.group === "list") uniqPush(lists, hit.value);
        else uniqPush(types, hit.value);
      } else {
        remain.push(tok);
      }
    });

    var listRes = resolveListQuery(q);
    lists = listRes.lists;
    var listSuggestions = listRes.suggestions || [];
    if (listSuggestions.length) {
      SHARED_LIST_TERMS.forEach(function (term) {
        leftover = leftover.replace(wordRe(term), " ").replace(/\s+/g, " ").trim();
      });
      // Recompute remain without the shared list phrase so we don't also
      // treat "pp top 10" as a maker name query.
      remain = leftover ? leftover.split(/[^a-z0-9]+/).filter(function (tok) { return tok && !SEARCH_STOP[tok]; }) : [];
    }

    var nameQ = remain.join(" ").trim();
    if (nameQ.length >= 2) suggestions = suggestMakers(nameQ);

    var showing = [];
    PRICE_CHIPS.forEach(function (c) { if (prices.indexOf(c.value) >= 0) showing.push(c.label); });
    TYPE_CHIPS.forEach(function (c) { if (types.indexOf(c.value) >= 0) showing.push(c.label); });
    LIST_CHIPS.forEach(function (c) { if (lists.indexOf(c.value) >= 0) showing.push(c.label); });
    return { prices: prices, types: types, lists: lists, listSuggestions: listSuggestions, suggestions: suggestions, showing: showing };
  }
  function applyParsedSearch(parsed) {
    var changed = false;
    function syncGroup(arr, owned, wanted, group) {
      owned.slice().forEach(function (v) {
        if (wanted.indexOf(v) < 0) {
          var i = arr.indexOf(v);
          if (i >= 0) { arr.splice(i, 1); changed = true; }
          var o = owned.indexOf(v);
          if (o >= 0) owned.splice(o, 1);
        }
      });
      wanted.forEach(function (v) {
        if (arr.indexOf(v) < 0) {
          arr.push(v);
          changed = true;
          if (owned.indexOf(v) < 0) owned.push(v);
          if (group === "price") track("filter-price/" + v, "Filter price");
          else if (group === "list") track("filter-list/" + v, "Filter list");
          else track("filter-type/" + v, "Filter type");
        }
      });
    }
    syncGroup(state.priceFilters, searchOwned.price, parsed.prices || [], "price");
    syncGroup(state.typeFilters, searchOwned.type, parsed.types || [], "type");
    syncGroup(state.listFilters, searchOwned.list, parsed.lists || [], "list");
    if (changed) applyFilters();
    else syncFilterUI();
    renderSearchFeedback(parsed);
  }
  function renderSearchFeedback(parsed) {
    var input = document.getElementById("filter-search");
    var q = input && input.value.trim();
    if (!q) {
      lastSearchStatusMsg = "";
      hideSuggestions();
      syncDiscoverStatus();
      return;
    }
    var listSuggestions = parsed.listSuggestions || [];
    if (parsed.showing.length) {
      lastSearchStatusMsg = "";
    } else if (listSuggestions.length) {
      lastSearchStatusMsg = listSuggestions.length === 1
        ? "1 matching list — pick below"
        : listSuggestions.length + " lists match — pick below";
    } else if (parsed.suggestions.length) {
      lastSearchStatusMsg = state.makers.length + " makers · pick a match below";
    } else {
      lastSearchStatusMsg = "No matching filters";
    }
    syncDiscoverStatus();
    renderSuggestions(listSuggestions, parsed.suggestions || []);
  }
  function hideSuggestions() {
    var list = document.getElementById("filter-suggest");
    var input = document.getElementById("filter-search");
    searchSuggestIndex = -1;
    if (list) { list.hidden = true; list.innerHTML = ""; }
    if (input) {
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }
  }
  function suggestionItems(listSuggestions, makers) {
    var items = [];
    (listSuggestions || []).forEach(function (l) { items.push({ kind: "list", list: l }); });
    (makers || []).forEach(function (m) { items.push({ kind: "maker", m: m }); });
    return items;
  }
  function renderSuggestions(listSuggestions, makers) {
    var list = document.getElementById("filter-suggest");
    var input = document.getElementById("filter-search");
    if (!list) return;
    searchSuggestIndex = -1;
    list.innerHTML = "";
    var items = suggestionItems(listSuggestions, makers);
    if (!items.length) {
      list.hidden = true;
      if (input) {
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
      }
      return;
    }
    items.forEach(function (item, i) {
      var li = document.createElement("li");
      li.id = "filter-suggest-" + i;
      li.setAttribute("role", "option");
      var name = document.createElement("span");
      name.className = "filter-suggest-name";
      var place = document.createElement("span");
      place.className = "filter-suggest-place";
      if (item.kind === "list") {
        name.textContent = item.list.label;
        place.textContent = "List";
        li.appendChild(name);
        li.appendChild(place);
        li.addEventListener("mousedown", function (ev) {
          ev.preventDefault();
          pickSuggestedList(item.list);
        });
      } else {
        name.textContent = item.m.name;
        li.appendChild(name);
        var loc = locationLine(item.m);
        if (loc) {
          place.textContent = loc;
          li.appendChild(place);
        }
        li.addEventListener("mousedown", function (ev) {
          ev.preventDefault();
          pickSuggestedMaker(item.m);
        });
      }
      list.appendChild(li);
    });
    list.hidden = false;
    if (input) input.setAttribute("aria-expanded", "true");
  }
  function pickSuggestedList(list) {
    if (!list) return;
    if (state.listFilters.indexOf(list.id) < 0) {
      state.listFilters.push(list.id);
      track("filter-list/" + list.id, "Filter list");
      applyFilters();
    } else {
      syncFilterUI();
    }
    var input = document.getElementById("filter-search");
    if (input) {
      input.focus();
      renderSearchFeedback(parseFilterSearch(input.value));
    }
  }
  function pickSuggestedMaker(m) {
    hideSuggestions();
    if (state.filtersOpen) setFiltersOpen(false);
    focusMaker(m);
  }
  function onFilterSearchInput() {
    var input = document.getElementById("filter-search");
    var q = input ? input.value : "";
    // Empty query goes through the same sync as a query change: drop
    // search-applied chips, keep ones the user selected by hand.
    applyParsedSearch(parseFilterSearch(q));
  }
  function moveSuggest(dir) {
    var list = document.getElementById("filter-suggest");
    if (!list || list.hidden) return;
    var items = list.querySelectorAll('[role="option"]');
    if (!items.length) return;
    searchSuggestIndex += dir;
    if (searchSuggestIndex < 0) searchSuggestIndex = items.length - 1;
    if (searchSuggestIndex >= items.length) searchSuggestIndex = 0;
    items.forEach(function (el, i) {
      el.setAttribute("aria-selected", i === searchSuggestIndex ? "true" : "false");
    });
    var input = document.getElementById("filter-search");
    if (input) input.setAttribute("aria-activedescendant", items[searchSuggestIndex].id);
    items[searchSuggestIndex].scrollIntoView({ block: "nearest" });
  }
  function bindFilterSearch() {
    var input = document.getElementById("filter-search");
    if (!input) return;
    ensureSearchIndexes();
    input.addEventListener("input", onFilterSearchInput);
    input.addEventListener("keydown", function (ev) {
      var list = document.getElementById("filter-suggest");
      var open = list && !list.hidden;
      if (ev.key === "ArrowDown") {
        if (open) { ev.preventDefault(); moveSuggest(1); }
      } else if (ev.key === "ArrowUp") {
        if (open) { ev.preventDefault(); moveSuggest(-1); }
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        if (open && searchSuggestIndex >= 0) {
          var parsed = parseFilterSearch(input.value);
          var items = suggestionItems(parsed.listSuggestions, parsed.suggestions);
          var pick = items[searchSuggestIndex];
          if (pick && pick.kind === "list") pickSuggestedList(pick.list);
          else if (pick && pick.m) pickSuggestedMaker(pick.m);
        }
      } else if (ev.key === "Escape") {
        if (open) {
          ev.preventDefault();
          ev.stopPropagation();
          hideSuggestions();
        }
      }
    });
  }

  function bindFilters() {
    if (STILL || PRINT) {
      var discoverBar = document.getElementById("discover-bar");
      var panel = document.getElementById("filter-panel");
      var scrim = document.getElementById("filter-scrim");
      var empty = document.getElementById("map-empty");
      if (discoverBar) discoverBar.hidden = true;
      if (panel) panel.hidden = true;
      if (scrim) scrim.hidden = true;
      if (empty) empty.hidden = true;
      return;
    }
    renderFilterChips();
    syncFilterUI();
    var btn = document.getElementById("filters-btn");
    if (btn) btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      setFiltersOpen(!state.filtersOpen);
    });
    var closeBtn = document.getElementById("filters-close");
    if (closeBtn) closeBtn.addEventListener("click", function () { setFiltersOpen(false); });
    var scrim = document.getElementById("filter-scrim");
    if (scrim) scrim.addEventListener("click", function () { setFiltersOpen(false); });
    var panel = document.getElementById("filter-panel");
    if (panel) {
      panel.addEventListener("click", function (ev) {
        var chip = ev.target.closest("[data-filter]");
        if (!chip || !panel.contains(chip)) return;
        ev.preventDefault();
        toggleFilter(chip.getAttribute("data-filter-group"), chip.getAttribute("data-filter"));
      });
    }
    var discoverChips = document.getElementById("discover-chips");
    if (discoverChips) {
      discoverChips.addEventListener("click", function (ev) {
        var chip = ev.target.closest("[data-filter]");
        if (!chip || !discoverChips.contains(chip)) return;
        ev.preventDefault();
        toggleFilter(chip.getAttribute("data-filter-group"), chip.getAttribute("data-filter"));
      });
    }
    var af = document.getElementById("af-chips");
    if (af) {
      af.addEventListener("click", function (ev) {
        var x = ev.target.closest("[data-filter]");
        if (!x) return;
        ev.preventDefault();
        toggleFilter(x.getAttribute("data-filter-group"), x.getAttribute("data-filter"));
      });
    }
    var showingClear = document.getElementById("showing-clear");
    if (showingClear) {
      showingClear.addEventListener("click", function (ev) {
        ev.preventDefault();
        if (state.favOnly && !hasFacetFilters()) setFavOnly(false);
        else resetFilters();
      });
    }
    var offmapBtn = document.getElementById("showing-offmap");
    if (offmapBtn) {
      offmapBtn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        showWorld();
      });
    }
    var searchClear = document.getElementById("discover-search-clear");
    if (searchClear) {
      searchClear.addEventListener("click", function (ev) {
        ev.preventDefault();
        var input = document.getElementById("filter-search");
        if (input) {
          input.value = "";
          onFilterSearchInput();
          input.focus();
        }
      });
    }
    ["filters-reset", "map-empty-reset", "list-empty-reset"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("click", function (ev) {
        ev.preventDefault();
        resetFilters();
      });
    });
    bindFilterSearch();
  }


  /* ---------- Wiring ---------- */

  function bindUI() {
    var back = document.getElementById("world-back");
    if (back) back.addEventListener("click", function (ev) { ev.preventDefault(); showWorld(); });
    var worldBtn = document.getElementById("world-btn");
    if (worldBtn) worldBtn.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); showWorld(); });
    var uscaBtn = document.getElementById("usca-btn");
    if (uscaBtn) uscaBtn.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); showHome(); });
    bindListControls();
    slider.addEventListener("input", function () { if (state.playing) stopPlay(); setYear(+slider.value); });
    playBtn.addEventListener("click", togglePlay);
    document.getElementById("card-close").addEventListener("click", function () { closeCard(); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Escape") return;
      if (state.filtersOpen) { setFiltersOpen(false); return; }
      closeCard();
    });
    document.addEventListener("click", function (ev) {
      if (!ev.target.closest("#discover-search-box")) hideSuggestions();
      if (card.hidden) return;
      if (card.contains(ev.target) || ev.target.closest(".pin") || ev.target.closest(".maker-btn")) return;
      if (ev.target.closest("#filter-panel") || ev.target.closest("#discover-bar")) return;
      if (wrap.contains(ev.target)) return; // handled by the svg handler
      closeCard(true);
    });
    var onMq = function () { if (state.active) positionCard(state.active); };
    if (mqMobile.addEventListener) mqMobile.addEventListener("change", onMq); else mqMobile.addListener(onMq);
  }

  function byId(id) { return state.makers.find(function (m) { return m.id === id; }); }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
})();
