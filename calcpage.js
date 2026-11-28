(function () {
  "use strict";
  var D = window.DL, esc = D.esc, DB = (window.ITEMDB || {}).items || {}, G = (window.GUIDES || {}).heroes || {};
  var lvl = document.getElementById("c-lvl"), heroSel = document.getElementById("c-hero"), hp = document.getElementById("c-hp"), res = document.getElementById("c-res"), tgt = document.getElementById("c-target");
  var picks = document.getElementById("c-items"), out = document.getElementById("c-out");
  var chosen = [];
  // Items that change gun damage: weapon damage, fire rate, ammo, or bullet resist shred.
  var gunItems = Object.keys(DB).filter(function (id) {
    return D.item(id) && (DB[id].stats || []).some(function (s) { return /^[+-][\d.]+% (Weapon Damage|Fire Rate|Max Ammo|enemy Bullet Resist)$/.test(s); });
  }).map(Number).sort(function (a, b) { var x = D.item(a), y = D.item(b); return x.tier - y.tier || x.name.localeCompare(y.name); });

  heroSel.innerHTML = D.heroOptions();
  tgt.innerHTML = '<option value="">Custom</option>' + D.snap.heroes.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (h) {
    return G[h.id] && G[h.id].stats ? '<option value="' + h.id + '">' + esc(h.name) + " (" + G[h.id].stats.health + " health)</option>" : "";
  }).join("");

  function drawPicks() {
    picks.innerHTML = gunItems.map(function (id) {
      var i = D.item(id), s = (DB[id].stats || []).filter(function (x) { return /Weapon Damage|Fire Rate|Max Ammo|enemy Bullet Resist/.test(x) && /^[+-]/.test(x); });
      return '<label class="c-item' + (chosen.indexOf(id) >= 0 ? " on" : "") + '"><input type="checkbox" value="' + id + '"' + (chosen.indexOf(id) >= 0 ? " checked" : "") + ">" + D.itemImg(id) + '<span class="nm">' + esc(i.name) + "<small>" + esc(s.join(" · ")) + "</small></span></label>";
    }).join("");
  }

  function row(label, a, b, fmt, better) {
    var d = b - a, cls = Math.abs(d) < 1e-6 ? "" : (better === "low" ? d < 0 : d > 0) ? "up" : "down";
    return "<tr><td>" + label + '</td><td class="num">' + fmt(a) + '</td><td class="num ' + cls + '">' + fmt(b) + "</td></tr>";
  }

  function calc() {
    var h = G[heroSel.value];
    if (!h || !h.weapon) { out.innerHTML = '<p class="note">No weapon data for this hero.</p>'; return; }
    var w = h.weapon, H = Math.max(1, +hp.value || 1), R = +res.value || 0;
    var L = +lvl.value, a = D.gun(w, [], R, L), b = D.gun(w, chosen, R, L);
    var n0 = function (v) { return v.toFixed(0); }, n1 = function (v) { return v.toFixed(1); }, s2 = function (v) { return v.toFixed(2) + " s"; }, p = function (v) { return (100 * v).toFixed(0) + "%"; };
    out.innerHTML = '<div class="gstats">' +
      '<div class="gstat"><span>Gun DPS</span><b>' + n0(b.burst) + "<i>was " + n0(a.burst) + "</i></b><small>while shooting</small></div>" +
      '<div class="gstat"><span>With reloads</span><b>' + n0(b.sustained) + "<i>was " + n0(a.sustained) + "</i></b><small>over a long fight</small></div>" +
      '<div class="gstat"><span>Time to kill</span><b>' + b.ttk(H).toFixed(2) + "<i>s</i></b><small>" + H + " health, gun only</small></div>" +
      '<div class="gstat"><span>Magazines</span><b>' + Math.ceil(H / b.magDmg - 1e-9) + "</b><small>to kill, " + n0(b.magDmg) + " damage each</small></div></div>" +
      '<div class="table-scroll"><table class="ledger"><thead><tr><th>' + esc(w.name || "Weapon") + '</th><th class="num">No items</th><th class="num">Your items</th></tr></thead><tbody>' +
      row("Damage per shot", a.perShot, b.perShot, n1) + row("Shots per second", a.rate, b.rate, n1) + row("Magazine", a.clip, b.clip, n0) +
      row("Time to empty magazine", a.magTime, b.magTime, s2) + row("Target's bullet resist", a.resist, b.resist, p, "low") +
      row("Time to kill", a.ttk(H), b.ttk(H), s2, "low") + "</tbody></table></div>" +
      '<p class="fine">Base weapon: ' + n1(w.per_shot) + " damage a shot" + (w.pellets > 1 ? " (" + w.pellets + " pellets)" : "") + ", " + w.shots_per_s + " shots a second, " + w.clip + " bullets, " + w.reload + " s reload, +" + (w.dmg_lvl || 0) + " damage a shot per level. Body shots at close range, every shot hitting. A target hero's health includes its level-ups too. Shred from items is counted as always on.</p>";
    history.replaceState(null, "", "#" + D.slug(D.byId[heroSel.value].name) + (chosen.length ? "/" + chosen.join(".") : ""));
  }

  picks.addEventListener("change", function (e) {
    var id = +e.target.value;
    if (e.target.checked) chosen.push(id); else chosen = chosen.filter(function (c) { return c !== id; });
    e.target.closest("label").classList.toggle("on", e.target.checked);
    calc();
  });
  function targetHp() { var g = G[tgt.value]; if (g) hp.value = Math.round(g.stats.health + (g.stats.hp_lvl || 0) * +lvl.value); }
  tgt.addEventListener("change", function () { targetHp(); calc(); });
  lvl.addEventListener("change", function () { targetHp(); calc(); });
  [heroSel, hp, res].forEach(function (el) { el.addEventListener("input", calc); });
  document.getElementById("c-clear").addEventListener("click", function () { chosen = []; drawPicks(); calc(); });

  var parts = location.hash.slice(1).split("/"), h = D.bySlug[parts[0]];
  if (h) heroSel.value = h.id;
  // A link from the build maker brings all its items; only the gun ones matter here.
  if (parts[1]) chosen = parts[1].split(".").map(Number).filter(function (id) { return gunItems.indexOf(id) >= 0; });
  drawPicks(); calc();
})();
