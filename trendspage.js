(function () {
  "use strict";
  var D = window.DL, H = window.HISTORY || { weeks: [] }, P = (window.PATCHES || {}).patches || [];
  var weeks = H.weeks, COLORS = ["#c9a45c", "#4fb3a5", "#e07a5f", "#9b8cf0", "#6aa9e9"];
  var chartEl = document.getElementById("t-chart"), legend = document.getElementById("t-legend"), picker = document.getElementById("t-picker");
  var movers = document.getElementById("t-movers"), rankSel = document.getElementById("t-rank"), metricSel = document.getElementById("t-metric");
  var chosen = [];

  function val(w, id) { var r = w[rankSel.value][id]; return r ? r[metricSel.value === "wr" ? 0 : 1] : null; }
  function series(id) { return weeks.map(function (w) { return val(w, id); }); }
  function fmtDate(s) { var d = new Date(s + "T00:00:00Z"); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }); }

  // Change over the last 4 weeks vs the 4 before, so one odd week doesn't top the list.
  function change(id) {
    var s = series(id).filter(function (v) { return v != null; });
    if (s.length < 8) return null;
    var a = s.slice(-4), b = s.slice(-8, -4);
    return a.reduce(function (x, y) { return x + y; }, 0) / 4 - b.reduce(function (x, y) { return x + y; }, 0) / 4;
  }

  function draw() {
    var W = 900, Hh = 360, L = 48, R = 16, T = 16, B = 34;
    var all = [];
    chosen.forEach(function (id) { series(id).forEach(function (v) { if (v != null) all.push(v); }); });
    if (!all.length) { chartEl.innerHTML = '<p class="note">Pick a hero below.</p>'; legend.innerHTML = ""; return; }
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (metricSel.value === "wr") { lo = Math.min(lo, 48); hi = Math.max(hi, 52); }
    var pad = (hi - lo) * 0.1 || 1; lo = Math.max(0, lo - pad); hi += pad;
    var step = hi - lo > 12 ? 4 : hi - lo > 6 ? 2 : 1;
    function x(i) { return L + (W - L - R) * (weeks.length > 1 ? i / (weeks.length - 1) : 0.5); }
    function y(v) { return T + (Hh - T - B) * (1 - (v - lo) / (hi - lo)); }
    var g = "";
    for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="grid' + (metricSel.value === "wr" && v === 50 ? " mid" : "") + '"/>' +
        '<text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + "%</text>";
    }
    weeks.forEach(function (w, i) {
      if (i % 2 === 0 || i === weeks.length - 1) g += '<text x="' + x(i) + '" y="' + (Hh - 10) + '" text-anchor="middle">' + fmtDate(w.date) + "</text>";
    });
    // Patches found during a week get a dashed line at that week.
    P.forEach(function (p) {
      if (!p.found) return;
      var t = Date.parse(p.found + "T00:00:00Z") / 1000;
      for (var i = 0; i < weeks.length; i++) if (t >= weeks[i].start && t < weeks[i].start + 604800) {
        g += '<line class="patch" x1="' + x(i) + '" x2="' + x(i) + '" y1="' + T + '" y2="' + (Hh - B) + '"><title>Patch ' + p.version + "</title></line>";
      }
    });
    chosen.forEach(function (id, k) {
      var s = series(id), d = "", c = COLORS[k % COLORS.length];
      s.forEach(function (v, i) { if (v != null) d += (d && s[i - 1] != null ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); });
      g += '<path d="' + d + '" stroke="' + c + '" class="line"/>';
      s.forEach(function (v, i) {
        if (v != null) g += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3.5" fill="' + c + '"><title>' + D.esc(D.byId[id].name) + " · week of " + fmtDate(weeks[i].date) + ": " + v.toFixed(1) + "%</title></circle>";
      });
    });
    chartEl.innerHTML = '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="' + (metricSel.value === "wr" ? "Win rate" : "Pick rate") + ' by week">' + g + "</svg>";
    legend.innerHTML = chosen.map(function (id, k) {
      var s = series(id), last = s[s.length - 1], ch = change(id);
      return '<li><i style="background:' + COLORS[k % COLORS.length] + '"></i>' + D.heroImg(id) + "<b>" + D.esc(D.byId[id].name) + "</b>" +
        '<span class="val">' + (last != null ? last.toFixed(1) + "%" : "–") + (ch != null ? ' <small class="' + (ch >= 0 ? "up" : "down") + '">' + (ch >= 0 ? "+" : "") + ch.toFixed(1) + " in 4 wk</small>" : "") + "</span>" +
        '<button type="button" class="x" data-id="' + id + '" aria-label="Remove ' + D.esc(D.byId[id].name) + '">×</button></li>';
    }).join("");
  }

  function drawMovers() {
    var rows = D.snap.heroes.map(function (h) { return { id: h.id, ch: change(h.id) }; }).filter(function (r) { return r.ch != null; });
    rows.sort(function (a, b) { return b.ch - a.ch; });
    var unit = metricSel.value === "wr" ? "win rate" : "pick rate";
    function list(rs) {
      return rs.map(function (r) {
        return '<li><button type="button" data-id="' + r.id + '">' + D.heroImg(r.id) + '<span class="nm">' + D.esc(D.byId[r.id].name) + '</span><span class="val ' + (r.ch >= 0 ? "up" : "down") + '">' + (r.ch >= 0 ? "+" : "") + r.ch.toFixed(1) + "%</span></button></li>";
      }).join("");
    }
    movers.innerHTML = '<div><h3>Rising</h3><ol class="duo-list">' + list(rows.slice(0, 6)) + '</ol></div><div><h3>Falling</h3><ol class="duo-list">' + list(rows.slice(-6).reverse()) + "</ol></div>" +
      '<p class="fine">Average ' + unit + " over the last 4 weeks compared with the 4 weeks before. Click a hero to add it to the chart.</p>";
  }

  function drawPicker() {
    picker.innerHTML = D.snap.heroes.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (h) {
      return '<button type="button" class="pick' + (chosen.indexOf(h.id) >= 0 ? " on" : "") + '" data-id="' + h.id + '">' + D.heroImg(h.id) + "<span>" + D.esc(h.name) + "</span></button>";
    }).join("");
  }
  function toggle(id) {
    var i = chosen.indexOf(id);
    if (i >= 0) chosen.splice(i, 1); else { chosen.push(id); if (chosen.length > 5) chosen.shift(); }
    history.replaceState(null, "", "#" + chosen.map(function (c) { return D.slug(D.byId[c].name); }).join(","));
    update();
  }
  function update() { draw(); drawMovers(); drawPicker(); }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-id]");
    if (b && (picker.contains(b) || movers.contains(b) || legend.contains(b))) toggle(+b.dataset.id);
  });
  rankSel.addEventListener("change", update);
  metricSel.addEventListener("change", update);

  if (!weeks.length) { chartEl.innerHTML = '<p class="note">No history yet.</p>'; return; }
  document.getElementById("t-range").textContent = weeks.length + " weeks, " + fmtDate(weeks[0].date) + " to " + fmtDate(weeks[weeks.length - 1].date) + " (each point is one Monday-to-Monday week)";
  location.hash.slice(1).split(",").forEach(function (s) { var h = D.bySlug[s]; if (h && chosen.length < 5) chosen.push(h.id); });
  if (!chosen.length) {
    var r = D.snap.heroes.map(function (h) { return { id: h.id, ch: change(h.id) }; }).filter(function (r) { return r.ch != null; }).sort(function (a, b) { return Math.abs(b.ch) - Math.abs(a.ch); });
    chosen = r.slice(0, 3).map(function (x) { return x.id; });
  }
  update();
})();
