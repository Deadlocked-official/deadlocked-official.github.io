(function () {
  "use strict";
  var D = window.DL, esc = D.esc, DB = (window.ITEMDB || {}).items || {}, G = (window.GUIDES || {}).heroes || {}, B = (window.BUILDS || {}).builds || {};
  var MAX = 12, heroSel = document.getElementById("bm-hero"), cat = document.getElementById("bm-cat"), list = document.getElementById("bm-list");
  var sum = document.getElementById("bm-sum"), find = document.getElementById("bm-find"), msg = document.getElementById("bm-msg");
  var slot = "weapon", build = [];
  var all = Object.keys(window.ITEMS || {}).map(D.item).filter(function (i) { return i && i.cost > 0 && i.tier >= 1 && i.tier <= 4; });

  heroSel.innerHTML = D.heroOptions();
  function heroId() { return +heroSel.value; }

  function add(id) {
    msg.textContent = "";
    if (build.indexOf(id) >= 0) { msg.textContent = "That item is already in the build."; return; }
    var from = (DB[id] || {}).from || [], swapped = build.filter(function (b) { return from.indexOf(b) >= 0; });
    // Buying an upgrade uses up the item it's built from, so it takes that item's slot.
    if (swapped.length) build = build.filter(function (b) { return swapped.indexOf(b) < 0; });
    if (build.length >= MAX) { msg.textContent = "All 12 slots are full. Remove an item first."; return; }
    build.push(id);
    if (swapped.length) msg.textContent = D.item(id).name + " replaced " + swapped.map(function (s) { return D.item(s).name; }).join(", ") + ", which it's built from.";
    update();
  }
  function remove(id) { build = build.filter(function (b) { return b !== id; }); update(); }

  function drawCat() {
    var f = find.value.trim().toLowerCase();
    var items = all.filter(function (i) { return f ? i.name.toLowerCase().indexOf(f) >= 0 : i.slot === slot; }).sort(function (a, b) { return a.tier - b.tier || a.name.localeCompare(b.name); });
    var html = "", tier = 0;
    items.forEach(function (i) {
      if (i.tier !== tier) { tier = i.tier; html += '<h4 class="bm-tier">Tier ' + tier + " · " + (i.cost).toLocaleString("en-US") + " souls</h4>"; }
      var d = DB[i.id] || {};
      html += '<button type="button" class="bm-item' + (build.indexOf(i.id) >= 0 ? " on" : "") + '" data-add="' + i.id + '" title="' + esc((d.stats || []).join(" · ")) + '">' + D.itemImg(i.id) + "<span>" + esc(i.name) + "</span>" + (d.grade ? '<b class="g g-' + d.grade + '">' + d.grade + "</b>" : "") + "</button>";
    });
    cat.innerHTML = html || '<p class="note">No items match.</p>';
  }

  function drawBuild() {
    var cost = 0, slots = { weapon: 0, vitality: 0, spirit: 0 };
    build.forEach(function (id) { var i = D.item(id); cost += i.cost; slots[i.slot]++; });
    var rows = build.map(function (id, n) {
      var i = D.item(id), d = DB[id] || {};
      return '<li class="item">' + D.itemImg(id) + '<span class="nm"><a href="items.html#' + D.slug(i.name) + '">' + esc(i.name) + "</a><small>" + esc((d.stats || []).slice(0, 2).join(" · ")) + '</small></span><span class="val">' + i.cost.toLocaleString("en-US") +
        '</span><span class="bm-move"><button type="button" data-up="' + n + '" aria-label="Move up"' + (n ? "" : " disabled") + '>↑</button><button type="button" data-del="' + id + '" aria-label="Remove ' + esc(i.name) + '">×</button></span></li>';
    }).join("");
    for (var k = build.length; k < MAX; k++) rows += '<li class="item empty"><span class="ph"></span><span class="nm">Empty slot</span></li>';
    list.innerHTML = rows;

    var h = G[heroId()] || {}, st = D.sumStats(build), html = '<div class="gstats">' +
      '<div class="gstat"><span>Total cost</span><b>' + cost.toLocaleString("en-US") + "</b></div>" +
      '<div class="gstat"><span>Slots</span><b>' + build.length + "<i>/ 12</i></b><small>" + slots.weapon + " weapon · " + slots.vitality + " vitality · " + slots.spirit + " spirit</small></div>";
    if (h.weapon) {
      var g0 = D.gun(h.weapon, [], 0, 20), g = D.gun(h.weapon, build, 0, 20);
      html += '<div class="gstat"><span>Gun DPS</span><b>' + g.burst.toFixed(0) + "<i>was " + g0.burst.toFixed(0) + "</i></b><small>" + g.sustained.toFixed(0) + " with reloads, at level 20</small></div>";
    }
    html += "</div>";
    var keys = Object.keys(st).filter(function (k) { return Math.abs(st[k]) > 0; }).sort(function (a, b) { return Math.abs(st[b]) - Math.abs(st[a]); });
    if (keys.length) html += '<h3 class="sub-h">Stats from items</h3><ul class="bm-stats">' + keys.slice(0, 18).map(function (k) {
      var unit = / %$/.test(k) ? "%" : / (m|s)$/.test(k) ? k.slice(-1) : "", name = k.replace(/ (%|m|s)$/, "");
      return "<li><b>" + (st[k] > 0 ? "+" : "") + (+st[k].toFixed(1)) + unit + "</b> " + esc(name) + "</li>";
    }).join("") + '</ul><p class="fine">Adds up each item\'s listed bonuses. Effects that need a hit, a kill or an active aren\'t counted.</p>';
    sum.innerHTML = html;
    var link = location.href.split("#")[0] + "#" + share();
    document.getElementById("bm-link").value = link;
    document.getElementById("bm-calc").href = "calc.html#" + share();
  }

  function share() { return D.slug(D.byId[heroId()].name) + (build.length ? "/" + build.join(".") : ""); }
  function update() { drawBuild(); drawCat(); history.replaceState(null, "", "#" + share()); }

  document.getElementById("bm-tabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-slot]"); if (!b) return;
    slot = b.dataset.slot; find.value = "";
    [].forEach.call(this.children, function (c) { c.classList.toggle("on", c === b); });
    drawCat();
  });
  cat.addEventListener("click", function (e) { var b = e.target.closest("[data-add]"); if (b) add(+b.dataset.add); });
  list.addEventListener("click", function (e) {
    var d = e.target.closest("[data-del]"), u = e.target.closest("[data-up]");
    if (d) remove(+d.dataset.del);
    if (u) { var n = +u.dataset.up, t = build[n - 1]; build[n - 1] = build[n]; build[n] = t; update(); }
  });
  find.addEventListener("input", drawCat);
  heroSel.addEventListener("change", update);
  document.getElementById("bm-clear").addEventListener("click", function () { build = []; msg.textContent = ""; update(); });
  document.getElementById("bm-site").addEventListener("click", function () {
    var b = B[heroId()];
    build = b && b.final ? b.final.slice(0, MAX).filter(function (id) { return D.item(id); }) : [];
    msg.textContent = b ? "Loaded the site's final " + D.byId[heroId()].name + " build. Change anything you like." : "No site build for this hero yet.";
    update();
  });
  document.getElementById("bm-copy").addEventListener("click", function () {
    var inp = document.getElementById("bm-link"); inp.select();
    (navigator.clipboard ? navigator.clipboard.writeText(inp.value) : Promise.reject()).then(function () { msg.textContent = "Link copied. Anyone who opens it sees this build."; }, function () { document.execCommand("copy"); msg.textContent = "Link copied."; });
  });

  var parts = location.hash.slice(1).split("/"), h = D.bySlug[parts[0]];
  if (h) heroSel.value = h.id;
  if (parts[1]) build = parts[1].split(".").map(Number).filter(function (id) { return D.item(id); }).slice(0, MAX);
  update();
})();
