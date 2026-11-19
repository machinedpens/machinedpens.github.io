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
  var COUNTRY_NAMES = { US: "United States", CA: "Canada" };
  var COUNTRY_ORDER = ["US", "CA"];
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

  var state = { makers: [], features: null, topo: null, year: MAX_YEAR, active: null, playing: null, minYear: 2008, favorites: {}, favOnly: false, mapMode: "timeline", priceFilter: null, shared: false, listSort: "state", listQuery: "" };

  Promise.all([d3.json("makers.json?v=20261119i"), d3.json("data/us-canada.topo.json?v=20261119i")])
    .then(function (res) { init(res[0].makers, res[1]); })
    .catch(function (err) {
      console.error(err);
      wrap.insertAdjacentHTML("beforeend", '<p class="noscript">The map could not load. Please refresh.</p>');
    });

  function init(makers, topo) {
    makers.forEach(function (m, i) {
      m.id = "m" + i;
      if (!m.slug) m.slug = slugify(m.name);
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
    else applyMapMode();

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
    // Frame: the lower 48 plus southern Canada, where makers are. Wider screens show more around it.
    var pts = [];
    for (var lon = -127; lon <= -64; lon += 1) { pts.push([lon, 24.5], [lon, 57.5]); }
    for (var lat = 24.5; lat <= 57.5; lat += 1) { pts.push([-127, lat], [-64, lat]); }
    return { type: "MultiPoint", coordinates: pts };
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
    var el = svg.node();
    var W = el.clientWidth;
    if (!W) return;
    var mobileInsetBand = 0;
    if (mqMobile.matches && !STILL) {
      // On phones the map takes the frame's natural shape, plus a bottom band for Hawaii.
      var probe = d3.geoConicConformal().rotate([96, 0]).parallels([33, 58]).fitWidth(W - 24, frame());
      var b = d3.geoPath(probe).bounds(frame());
      mobileInsetBand = 98;
      el.style.height = Math.round(b[1][1] - b[0][1] + 28 + mobileInsetBand) + "px";
    } else {
      el.style.height = "";
    }
    var H = el.clientHeight;
    if (!H) return;
    var S = sizes();
    svg.attr("viewBox", "0 0 " + W + " " + H).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    var pad = STILL ? { t: 110, r: 40, b: 40, l: 40 } : (W < 500 ? { t: 14, r: 12, b: 14 + mobileInsetBand, l: 12 } : { t: 24, r: 24, b: 24, l: 24 });
    var projection = d3.geoConicConformal()
      .rotate([96, 0]).parallels([33, 58])
      .fitExtent([[pad.l, pad.t], [W - pad.r, H - pad.b]], frame());
    var path = d3.geoPath(projection);
    state.projection = projection;

    var gLand = svg.append("g").attr("class", "land-layer");
    gLand.selectAll("path").data(state.features.features).join("path")
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
    var hiBox = state.hawaii ? hawaiiBox(W, H) : null;
    var hiProj = hiBox ? hawaiiProjection(hiBox) : null;
    if (hiBox && hiProj) drawHawaiiInset(hiBox, hiProj);
    else state.hawaiiBox = null;

    // Pin layout: project, then nudge apart pins that would overlap, with a short leader line to the true spot.
    // Hawaii makers use the inset projection and are kept out of the mainland collision sim.
    var mainland = [];
    var insetNodes = [];
    state.makers.forEach(function (m) {
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
    // Shown as a pair or not at all.
    var cl = ["CA", "US"].map(function (c) {
      var p = projection(COUNTRY_AT[c]);
      return p ? put("country-name-label", c === "US" ? "UNITED STATES" : "CANADA", p, cfs, mobile ? "0.22em" : "0.3em") : null;
    });
    if (!cl[0] || !cl[1]) cl.forEach(function (r) { if (r) { r.t.remove(); placed.splice(placed.indexOf(r.box), 1); } });
    // Then regions, largest first; skip any that would not sit comfortably inside its own shape.
    var feats = state.features.features.filter(function (f) { return !SKIP_NAMES[f.properties.code]; })
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
      var line = m.city + ", " + (REGION_ABBR[m.region] || m.region);
      if (m.city_unconfirmed) line += " (city unconfirmed)";
      return line;
    }
    return m.region_name || "";
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
  function priceTintTier(m) {
    if (!hasPrice(m)) return "none";
    if (m.priceLow < 100) return "under-100";
    if (m.priceLow <= 250) return "100-250";
    return "over-250";
  }
  function isPriceHidden(m) {
    return !STILL && state.mapMode === "price" && !!state.priceFilter && !matchesPriceTier(m, state.priceFilter);
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
    var pool = state.makers.filter(function (m) {
      if (state.favOnly && !isFav(m)) return false;
      if (isPriceHidden(m)) return false;
      return true;
    });
    if (state.mapMode === "price") {
      var priceCount = document.getElementById("price-count");
      if (priceCount) priceCount.textContent = pool.length + (pool.length === 1 ? " maker" : " makers");
    } else {
      var known = pool.filter(function (m) { return m.est_year && m.est_year <= y; }).length;
      var unknown = pool.filter(function (m) { return !m.est_year; }).length;
      var el = document.getElementById("year-count");
      el.textContent = known + (known === 1 ? " maker" : " makers");
      if (unknown) {
        var ex = document.createElement("span");
        ex.className = "extra"; ex.textContent = " + " + unknown + " year unknown";
        el.appendChild(ex);
      }
    }
    applyYear();
  }

  function isYearHidden(m) {
    if (state.mapMode === "price") return false;
    return !!m.est_year && m.est_year > state.year;
  }
  function isFavHidden(m) { return !STILL && state.favOnly && !isFav(m); }
  function isFilterHidden(m) { return isFavHidden(m) || isPriceHidden(m); }
  function isHidden(m) { return isYearHidden(m) || isFilterHidden(m); }

  function applyYear() {
    var full = state.year >= MAX_YEAR;
    svg.selectAll("g.pin")
      .classed("hidden", function (d) { return isHidden(d.m); })
      .classed("faded", function (d) { return state.mapMode !== "price" && !isHidden(d.m) && !d.m.est_year && !full; })
      .attr("data-tier", function (d) { return priceTintTier(d.m); })
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
    var filtering = state.favOnly || (state.mapMode === "price" && !!state.priceFilter);
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
      if (m.city) parts.push(m.city + ", " + (REGION_ABBR[m.region] || m.region));
      else if (m.region_name) parts.push(m.region_name);
    } else if (m.city) {
      parts.push(m.city);
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
    var q = (state.listQuery || "").trim().toLowerCase();
    if (!q) return true;
    return (m.name || "").toLowerCase().indexOf(q) !== -1;
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
    var filtering = !!(q || state.favOnly || (state.mapMode === "price" && state.priceFilter));
    empty.hidden = !filtering || visible.length > 0;
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
    var byCountry = d3.group(makers, function (m) { return m.country; }, function (m) { return m.region_name; });
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
            li.appendChild(makerRow(m));
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
      if (ev.key === "Escape") closeManage();
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
    bindMapMode();
  }

  function syncPriceChips() {
    document.querySelectorAll(".price-chip").forEach(function (btn) {
      var on = btn.getAttribute("data-price") === state.priceFilter;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  function setPriceFilter(tier) {
    if (STILL || PRINT || state.mapMode !== "price") return;
    var next = (tier && tier === state.priceFilter) ? null : (tier || null);
    var turningOn = !!next && next !== state.priceFilter;
    state.priceFilter = next;
    syncPriceChips();
    if (state.active && isHidden(state.active)) closeCard(true);
    setYear(state.year);
    if (turningOn) track("filter-price/" + next, "Filter price");
  }
  function applyMapMode() {
    var price = state.mapMode === "price";
    if (!STILL && !PRINT) document.body.setAttribute("data-map-mode", state.mapMode);
    else document.body.removeAttribute("data-map-mode");
    var timeline = document.getElementById("timeline");
    var priceControls = document.getElementById("price-controls");
    var priceReadout = document.getElementById("price-readout");
    var modeBar = document.getElementById("map-mode-bar");
    var legendTime = document.getElementById("legend-timeline");
    var legendPrice = document.getElementById("legend-price");
    if (STILL || PRINT) {
      if (modeBar) modeBar.hidden = true;
      if (priceControls) priceControls.hidden = true;
      if (priceReadout) priceReadout.hidden = true;
      if (timeline) timeline.hidden = !!PRINT;
      if (legendTime) legendTime.hidden = false;
      if (legendPrice) legendPrice.hidden = true;
      return;
    }
    if (modeBar) modeBar.hidden = false;
    if (timeline) timeline.hidden = price;
    if (priceControls) priceControls.hidden = !price;
    if (priceReadout) priceReadout.hidden = !price;
    if (legendTime) legendTime.hidden = price;
    if (legendPrice) legendPrice.hidden = !price;
    document.querySelectorAll(".map-mode-btn").forEach(function (btn) {
      var on = btn.getAttribute("data-mode") === state.mapMode;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    syncPriceChips();
  }
  function setMapMode(mode) {
    if (STILL || PRINT) return;
    if (mode !== "price") mode = "timeline";
    if (state.mapMode === mode) return;
    state.mapMode = mode;
    if (mode === "price" && state.playing) stopPlay();
    applyMapMode();
    if (state.active && isHidden(state.active)) closeCard(true);
    setYear(state.year);
    track("mode/" + mode, mode === "price" ? "Price mode" : "Timeline mode");
  }
  function bindMapMode() {
    applyMapMode();
    if (STILL || PRINT) return;
    var mode = document.getElementById("map-mode");
    if (mode) {
      mode.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-mode]");
        if (!btn) return;
        setMapMode(btn.getAttribute("data-mode"));
      });
    }
    var wrap = document.getElementById("price-filters");
    if (wrap) {
      wrap.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-price]");
        if (!btn) return;
        setPriceFilter(btn.getAttribute("data-price"));
      });
    }
  }

  /* ---------- Wiring ---------- */

  function bindUI() {
    bindListControls();
    slider.addEventListener("input", function () { if (state.playing) stopPlay(); setYear(+slider.value); });
    playBtn.addEventListener("click", togglePlay);
    document.getElementById("card-close").addEventListener("click", function () { closeCard(); });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeCard(); });
    document.addEventListener("click", function (ev) {
      if (card.hidden) return;
      if (card.contains(ev.target) || ev.target.closest(".pin") || ev.target.closest(".maker-btn")) return;
      if (wrap.contains(ev.target)) return; // handled by the svg handler
      closeCard(true);
    });
    var onMq = function () { if (state.active) positionCard(state.active); };
    if (mqMobile.addEventListener) mqMobile.addEventListener("change", onMq); else mqMobile.addListener(onMq);
  }

  function byId(id) { return state.makers.find(function (m) { return m.id === id; }); }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
})();
