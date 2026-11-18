/* Machined Pens Maker Map
   Pure static: D3 v7 + topojson-client, vendored in ./vendor. Data in ./makers.json and ./data. */
(function () {
  "use strict";

  var STILL = /[?&]still=1\b/.test(location.search);
  if (STILL) document.body.classList.add("still");

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

  var state = { makers: [], features: null, topo: null, year: MAX_YEAR, active: null, playing: null, minYear: 2008 };

  Promise.all([d3.json("makers.json"), d3.json("data/us-canada.topo.json")])
    .then(function (res) { init(res[0].makers, res[1]); })
    .catch(function (err) {
      console.error(err);
      wrap.insertAdjacentHTML("beforeend", '<p class="noscript">The map could not load. Please refresh.</p>');
    });

  function init(makers, topo) {
    makers.forEach(function (m, i) { m.id = "m" + i; });
    state.makers = makers;
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
    if (STILL) return { dot: 8, ring: 13.5, hit: 22, gap: 6 };
    if (w < 500) return { dot: 5.5, ring: 9.5, hit: 22, gap: 3 };
    return { dot: 7, ring: 12, hit: 22, gap: 4 };
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
      .attr("aria-label", function (d) { return ariaLabel(d.m); });
    pins.append("circle").attr("class", "hit").attr("r", S.hit);
    var body = pins.append("g").attr("class", "body");
    body.append("circle").attr("class", "focus-ring").attr("r", S.ring + 4);
    body.filter(function (d) { return d.m.in_maker_index; })
      .append("circle").attr("class", "ring").attr("r", S.ring);
    body.append("circle").attr("class", "dot").attr("r", S.dot);

    pins.on("click", function (ev, d) { ev.stopPropagation(); openCard(d.m, this); })
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openCard(d.m, this); }
      });

    var taken = STILL ? drawLabels(nodes, S, W, H) : [];
    drawNames(gNames, path, projection, nodes, S, W, H, taken);

    applyYear();
    if (state.active) positionCard(state.active);
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


  function placeLine(m) {
    var where = m.city ? m.city + ", " + (REGION_ABBR[m.region] || m.region) : m.region_name;
    return m.est_year ? where + " · Est. " + m.est_year : where;
  }
  function ariaLabel(m) {
    var s = m.name + ", " + (m.city ? m.city + ", " + m.region_name : m.region_name);
    s += m.est_year ? ", established " + m.est_year : ", founding year not confirmed";
    if (m.in_maker_index) s += ", featured in The Maker Index";
    return s;
  }

  /* ---------- Timeline ---------- */

  function setYear(y) {
    state.year = +y;
    slider.value = y;
    var pct = (y - slider.min) / (slider.max - slider.min) * 100;
    slider.style.setProperty("--fill", pct + "%");
    slider.setAttribute("aria-valuetext", "Established by " + y);
    document.getElementById("year-value").textContent = y;
    var known = state.makers.filter(function (m) { return m.est_year && m.est_year <= y; }).length;
    var unknown = state.makers.filter(function (m) { return !m.est_year; }).length;
    var el = document.getElementById("year-count");
    el.textContent = known + (known === 1 ? " maker" : " makers");
    if (unknown) {
      var ex = document.createElement("span");
      ex.className = "extra"; ex.textContent = " + " + unknown + " year unknown";
      el.appendChild(ex);
    }
    applyYear();
  }

  function isHidden(m) { return !!m.est_year && m.est_year > state.year; }

  function applyYear() {
    var full = state.year >= MAX_YEAR;
    svg.selectAll("g.pin")
      .classed("hidden", function (d) { return isHidden(d.m); })
      .classed("faded", function (d) { return !d.m.est_year && !full; })
      .attr("tabindex", function (d) { return isHidden(d.m) ? -1 : 0; })
      .attr("aria-hidden", function (d) { return isHidden(d.m) ? "true" : null; });
    svg.selectAll(".leaders g").classed("hidden", function (d) { return isHidden(d.m); });
    d3.selectAll(".maker-btn").classed("dimmed", function () {
      var m = byId(this.getAttribute("data-id")); return isHidden(m);
    });
    if (state.active && isHidden(state.active)) closeCard(true);
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
    document.getElementById("card-meta").textContent = placeLine(m);
    var links = document.getElementById("card-links");
    links.innerHTML = "";
    if (m.website) links.appendChild(link(m.website, "Website", false));
    if (m.maker_index_url) links.appendChild(link(m.maker_index_url, "Read my Maker Index post", true));

    card.hidden = false;
    positionCard(m);
    svg.selectAll("g.pin").classed("active", function (d) { return d.m === m; });
    d3.selectAll(".maker-btn").classed("active", function () { return this.getAttribute("data-id") === m.id; })
      .attr("aria-expanded", function () { return this.getAttribute("data-id") === m.id ? "true" : "false"; });
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
    var back = state.returnFocus;
    state.active = null; state.returnFocus = null;
    if (!silent && back && document.activeElement && card.contains(document.activeElement)) back.focus();
  }

  /* ---------- List ---------- */

  function buildList() {
    var root = document.getElementById("list");
    var byCountry = d3.group(state.makers, function (m) { return m.country; }, function (m) { return m.region_name; });
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
        byCountry.get(c).get(r).slice().sort(function (a, b) { return d3.ascending(a.name.toLowerCase(), b.name.toLowerCase()); })
          .forEach(function (m) {
            var li = document.createElement("li");
            var b = document.createElement("button");
            b.type = "button"; b.className = "maker-btn"; b.setAttribute("data-id", m.id);
            b.setAttribute("aria-expanded", "false");
            b.setAttribute("aria-label", ariaLabel(m) + ". Show on map");
            var meta = [m.city, m.est_year ? "Est. " + m.est_year : null].filter(Boolean).join(" · ");
            b.innerHTML = swatch(m) + '<span class="m-name"></span><span class="m-meta"></span>';
            b.querySelector(".m-name").textContent = m.name;
            b.querySelector(".m-meta").textContent = meta;
            b.addEventListener("click", function () { focusMaker(m, b); });
            li.appendChild(b); ul.appendChild(li);
          });
        div.appendChild(ul); grid.appendChild(div);
      });
      sec.appendChild(grid); root.appendChild(sec);
    });
  }
  function swatch(m) {
    return '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="4.5" fill="var(--pin)"/>' +
      (m.in_maker_index ? '<circle cx="10" cy="10" r="8" fill="none" stroke="var(--ring)" stroke-width="1.4"/>' : "") + "</svg>";
  }
  function focusMaker(m, btn) {
    if (isHidden(m)) { stopPlay(); setYear(MAX_YEAR); }
    var rect = wrap.getBoundingClientRect();
    var needScroll = rect.top < 0 || rect.bottom > window.innerHeight;
    var go = function () {
      openCard(m, btn);
      var pin = svg.select('g.pin[data-id="' + m.id + '"]');
      pin.select(".dot").interrupt()
        .transition().duration(220).attr("r", sizes().dot * 1.8)
        .transition().duration(380).attr("r", sizes().dot);
    };
    if (needScroll) {
      var top = window.scrollY + rect.top - (mqMobile.matches ? 8 : 24);
      window.scrollTo({ top: top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      setTimeout(go, 380);
    } else go();
  }

  /* ---------- Wiring ---------- */

  function bindUI() {
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
