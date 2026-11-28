// Small helpers shared by the Trends, Match, Tools pages.
(function () {
  "use strict";
  var snap = window.SNAPSHOT || { heroes: [] };
  var byId = {}, byName = {};
  snap.heroes.forEach(function (h) { byId[h.id] = h; byName[h.name.toLowerCase()] = h; });
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(name) { return String(name).toLowerCase().replace(/&/g, "and").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  var bySlug = {};
  snap.heroes.forEach(function (h) { bySlug[slug(h.name)] = h; });
  function getJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function heroImg(id, cls) {
    var h = byId[id];
    return h ? '<img class="' + (cls || "") + '" src="' + esc(h.img) + '" alt="' + esc(h.name) + '" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ph">?</span>';
  }
  function item(id) { var it = (window.ITEMS || {})[id]; return it ? { id: +id, name: it[0], slot: it[1], tier: it[2], cost: it[3], img: it[4] } : null; }
  function itemImg(id) {
    var it = item(id);
    return it ? '<img class="slot-' + it.slot + '" src="' + esc(it.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ph">?</span>';
  }
  function heroOptions(sel) {
    return snap.heroes.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (h) {
      return '<option value="' + h.id + '"' + (h.id === sel ? " selected" : "") + ">" + esc(h.name) + "</option>";
    }).join("");
  }
  // Adds up item stats like "+8% Weapon Damage". Only signed lines count: unsigned ones are active or conditional effects.
  function sumStats(ids) {
    var db = (window.ITEMDB || {}).items || {}, out = {};
    ids.forEach(function (id) {
      ((db[id] || {}).stats || []).forEach(function (s) {
        var m = s.match(/^([+-]\d+(?:\.\d+)?)(%|m|s)?\s+(.+)$/);
        if (!m) return;
        // Some game strings repeat or space out the unit ("+2.5m m Move Speed", "+2.3 % Max Health Regen").
        var unit = m[2] || "", name = m[3], u;
        while ((u = name.match(/^(m|s|%)\s+/))) { unit = unit || u[1]; name = name.slice(u[0].length); }
        var key = name + (unit ? " " + unit : "");
        out[key] = (out[key] || 0) + parseFloat(m[1]);
      });
    });
    return out;
  }
  // Gun damage from a hero's weapon and a list of items. Body shots, close range. boons = level-ups so far.
  function gun(weapon, ids, targetResist, boons) {
    var s = sumStats(ids), wd = (s["Weapon Damage %"] || 0) / 100, fr = (s["Fire Rate %"] || 0) / 100, am = (s["Max Ammo %"] || 0) / 100;
    var shred = -(s["enemy Bullet Resist %"] || 0); // stored as negative numbers
    var resist = Math.max(-1, Math.min(0.9, (targetResist - shred) / 100));
    var perShot = (weapon.per_shot + (weapon.dmg_lvl || 0) * (boons || 0)) * (1 + wd) * (1 - resist);
    var rate = weapon.shots_per_s * (1 + fr), clip = Math.max(1, Math.round(weapon.clip * (1 + am)));
    var burst = perShot * rate, magTime = clip / rate, magDmg = perShot * clip;
    return { wd: wd, fr: fr, am: am, shred: shred, resist: resist, perShot: perShot, rate: rate, clip: clip, burst: burst,
      sustained: magDmg / (magTime + weapon.reload), magDmg: magDmg, magTime: magTime, reload: weapon.reload,
      ttk: function (hp) { var mags = Math.floor(hp / magDmg), rest = hp - mags * magDmg; if (rest <= 0.001) { mags--; rest = magDmg; } return mags * (magTime + weapon.reload) + rest / burst; } };
  }
  function mins(s) { var m = Math.floor(s / 60), r = Math.round(s % 60); return m + ":" + (r < 10 ? "0" : "") + r; }
  window.DL = { snap: snap, byId: byId, byName: byName, bySlug: bySlug, esc: esc, slug: slug, getJSON: getJSON, heroImg: heroImg,
    item: item, itemImg: itemImg, heroOptions: heroOptions, mins: mins, sumStats: sumStats, gun: gun, API: "https://api.deadlock-api.com/v1/" };
})();
