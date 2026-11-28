(function () {
  "use strict";
  var P = window.PATCHES || { patches: [] }, snap = window.SNAPSHOT || { heroes: [] };
  var list = document.getElementById("pt-list"), search = document.getElementById("pt-search");
  var byName = {};
  snap.heroes.forEach(function (h) { byName[h.name] = h; });
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(name) { return name.toLowerCase().replace(/&/g, "and").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function num(v) { var m = String(v == null ? "" : v).match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; }
  if (P.checked) document.getElementById("pt-date").textContent = "Checked " + new Date(P.checked + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + " · game version " + P.latest;

  function change(c) {
    var o = c[1], n = c[2], a = num(o), b = num(n), dir = "", pct = "";
    if (o == null) return '<li><span class="ch-label">' + esc(c[0]) + '</span><span class="ch-val"><b class="new">new</b> ' + esc(n) + '</span></li>';
    if (n == null) return '<li><span class="ch-label">' + esc(c[0]) + '</span><span class="ch-val">' + esc(o) + ' <b class="gone">removed</b></span></li>';
    if (a !== null && b !== null && a !== b) {
      dir = b > a ? "up" : "down";
      if (a !== 0) pct = " (" + (b > a ? "+" : "") + Math.round(100 * (b - a) / Math.abs(a)) + "%)";
    }
    return '<li><span class="ch-label">' + esc(c[0]) + '</span><span class="ch-val">' + esc(o) + ' <span class="arrow ' + dir + '">' + (dir === "up" ? "▲" : dir === "down" ? "▼" : "→") + '</span> <b>' + esc(n) + '</b><small>' + pct + '</small></span></li>';
  }

  // Changes that hit many heroes the same way (like a health change for everyone) get a summary line.
  function summary(p) {
    var by = {};
    Object.keys(p.heroes).forEach(function (h) {
      (p.heroes[h].stats || []).forEach(function (c) {
        var a = num(c[1]), b = num(c[2]);
        if (a === null || b === null) return;
        var k = c[0] + (b > a ? " up" : " down");
        (by[k] || (by[k] = [])).push(100 * (b - a) / (a || 1));
      });
    });
    return Object.keys(by).filter(function (k) { return by[k].length >= 8; }).map(function (k) {
      var arr = by[k], avg = arr.reduce(function (s, x) { return s + x; }, 0) / arr.length;
      var label = k.replace(/ (up|down)$/, "");
      return "<li><b>" + esc(label) + "</b> " + (/ up$/.test(k) ? "raised" : "lowered") + " for " + arr.length + " heroes, about " + Math.abs(Math.round(avg)) + "% on average.</li>";
    });
  }

  function render() {
    var f = search.value.trim().toLowerCase();
    if (!P.patches.length) { list.innerHTML = '<p class="note draft-empty">No patches recorded yet. The tracker checks the game data every week.</p>'; return; }
    var html = P.patches.map(function (p) {
      var heroes = Object.keys(p.heroes).sort().filter(function (h) { return !f || h.toLowerCase().indexOf(f) > -1; });
      var items = Object.keys(p.items).sort().filter(function (i) { return !f || i.toLowerCase().indexOf(f) > -1; });
      var extras = [];
      if (p.new_heroes.length) extras.push("<li><b>New heroes:</b> " + p.new_heroes.map(esc).join(", ") + "</li>");
      if (p.new_items.length) extras.push("<li><b>New items:</b> " + p.new_items.map(esc).join(", ") + "</li>");
      if (p.removed_items.length) extras.push("<li><b>Removed items:</b> " + p.removed_items.map(esc).join(", ") + "</li>");
      if (f && !heroes.length && !items.length) return "";
      var sum = summary(p).concat(extras);
      var nH = Object.keys(p.heroes).length, nI = Object.keys(p.items).length;
      return '<section class="patch"><div class="patch-head"><h2>Version ' + p.version + '</h2><p class="note">' +
        (p.found ? "Found " + new Date(p.found + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + " · " : "") +
        "changed from version " + p.from + " · " + nH + " hero" + (nH === 1 ? "" : "es") + ", " + nI + " item" + (nI === 1 ? "" : "s") + '</p></div>' +
        (sum.length && !f ? '<ul class="patch-sum">' + sum.join("") + '</ul>' : "") +
        (heroes.length ? '<div class="patch-grid">' + heroes.map(function (h) {
          var e = p.heroes[h], hero = byName[h];
          var abil = Object.keys(e.abilities || {}).map(function (a) { return '<h4>' + esc(a) + '</h4><ul class="chg">' + e.abilities[a].map(change).join("") + '</ul>'; }).join("");
          return '<div class="ctr"><div class="ctr-head">' + (hero ? '<img src="' + esc(hero.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : "") + '<a href="guide.html#' + slug(h) + '"><b>' + esc(h) + '</b></a></div>' +
            (e.stats ? '<ul class="chg">' + e.stats.map(change).join("") + '</ul>' : "") + abil + '</div>';
        }).join("") + '</div>' : "") +
        (items.length ? '<h3 class="sub-h">Items</h3><div class="patch-grid">' + items.map(function (i) {
          return '<div class="ctr"><div class="ctr-head"><a href="items.html#' + slug(i) + '"><b>' + esc(i) + '</b></a></div><ul class="chg">' + p.items[i].map(change).join("") + '</ul></div>';
        }).join("") + '</div>' : "") + '</section>';
    }).join("");
    list.innerHTML = html || '<p class="note">Nothing matches that name in the recorded patches.</p>';
  }
  search.addEventListener("input", render);
  render();
})();
