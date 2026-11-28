(function () {
  "use strict";
  var D = window.DL, esc = D.esc, G = (window.GUIDES || {}).heroes || {}, T = (window.TIERS || {}).tiers || [], RD = (window.ROLES_DATA || {}).roles || [];
  var HIST = (window.HISTORY || {}).weeks || [], CNT = D.snap.counters || [];
  var aSel = document.getElementById("c-a"), bSel = document.getElementById("c-b"), out = document.getElementById("c-out");
  var tierOf = {}, roleOf = {};
  T.forEach(function (t) { t[2].forEach(function (h) { tierOf[h[0]] = [t[0], t[1], h[1]]; }); });
  RD.forEach(function (r) { r[2].forEach(function (n) { n = n.replace("†", ""); (roleOf[n] = roleOf[n] || []).push(r[0]); }); });

  var sorted = D.snap.heroes.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
  aSel.innerHTML = D.heroOptions(); bSel.innerHTML = D.heroOptions();

  function wr(h) { return h.matches ? 100 * h.wins / h.matches : null; }
  function pick(h) { var tot = D.snap.heroes.reduce(function (s, x) { return s + x.matches; }, 0) / 12; return tot ? 100 * h.matches / tot : null; }
  function highWr(id) { var w = HIST[HIST.length - 1]; return w && w.high[id] ? w.high[id][0] : null; }
  function headToHead(a, b) {
    // Logit-adjusted: how much better a does against b than their overall win rates predict.
    var r = CNT.filter(function (c) { return c[0] === a && c[1] === b; })[0];
    if (!r || !r[3]) return null;
    var lg = function (p) { return Math.log(p / (1 - p)); }, sg = function (x) { return 1 / (1 + Math.exp(-x)); };
    var pa = wr(D.byId[a]) / 100, pb = wr(D.byId[b]) / 100, exp = sg(lg(pa) - lg(pb)), act = r[2] / r[3];
    return { wr: 100 * act, n: r[3], edge: 100 * (act - exp) };
  }

  function line(label, va, vb, fmt, better) {
    var ca = "", cb = "";
    if (va != null && vb != null && va !== vb && better) {
      var aWins = better === "high" ? va > vb : va < vb;
      ca = aWins ? "win" : ""; cb = aWins ? "" : "win";
    }
    return '<tr><td class="num ' + ca + '">' + (va == null ? "–" : fmt(va)) + '</td><th scope="row">' + label + '</th><td class="' + cb + '">' + (vb == null ? "–" : fmt(vb)) + "</td></tr>";
  }

  function draw() {
    var a = +aSel.value, b = +bSel.value, ha = D.byId[a], hb = D.byId[b], ga = G[a] || {}, gb = G[b] || {};
    var sa = ga.stats || {}, sb = gb.stats || {}, wa = ga.weapon || {}, wb = gb.weapon || {};
    var ta = tierOf[ha.name] || [], tb = tierOf[hb.name] || [];
    var n0 = function (v) { return Math.round(v).toLocaleString("en-US"); }, n1 = function (v) { return (+v).toFixed(1); }, pc = function (v) { return v.toFixed(1) + "%"; };
    var hh = a !== b ? headToHead(a, b) : null;
    var head = function (h, g, t) {
      return '<div class="cmp-hero"><a href="guide.html#' + D.slug(h.name) + '">' + D.heroImg(h.id, "build-pic") + "</a><h2>" + esc(h.name) + '</h2><p class="g-role">' + esc((roleOf[h.name] || []).join(" · ") || g.type || "") + "</p>" +
        (t[0] ? '<p class="tags"><span class="tierchip" style="background:var(--t-' + t[0].toLowerCase() + ')">' + t[0] + " · " + esc(t[1]) + "</span></p>" : "") + "</div>";
    };
    out.innerHTML = '<div class="cmp-heads">' + head(ha, ga, ta) + '<span class="cmp-vs">vs</span>' + head(hb, gb, tb) + "</div>" +
      (hh ? '<p class="cmp-h2h">When ' + esc(ha.name) + " and " + esc(hb.name) + " are on opposite teams, <b>" + esc(ha.name) + " wins " + hh.wr.toFixed(1) + "%</b> of " + hh.n.toLocaleString("en-US") + " games (" +
        (Math.abs(hh.edge) < 0.5 ? "about what their overall win rates predict" : (hh.edge > 0 ? "+" : "") + hh.edge.toFixed(1) + "% compared with what their overall win rates predict") + ').</p>' : "") +
      '<div class="table-scroll"><table class="ledger cmp-table"><tbody>' +
      line("Win rate, all ranks", wr(ha), wr(hb), pc, "high") + line("Win rate, Oracle+", highWr(a), highWr(b), pc, "high") + line("Pick rate", pick(ha), pick(hb), pc) +
      line("Skill score (out of 10)", ta[2], tb[2], n1) + line("Valve difficulty", ga.complexity, gb.complexity, function (v) { return v + " / 3"; }) +
      line("Health", sa.health, sb.health, n0, "high") + line("Health regen", sa.regen, sb.regen, n1, "high") + line("Move speed (m/s)", sa.speed, sb.speed, n1, "high") +
      line("Stamina", sa.stamina, sb.stamina, n0, "high") + line("Heavy melee", sa.heavy_melee, sb.heavy_melee, n0, "high") +
      line("Gun DPS", wa.dps, wb.dps, n1, "high") + line("Damage per shot", wa.per_shot, wb.per_shot, n1, "high") +
      line("Magazine", wa.clip, wb.clip, n0, "high") + line("Reload (s)", wa.reload, wb.reload, function (v) { return v.toFixed(2); }, "low") + line("Falloff starts (m)", wa.falloff_m, wb.falloff_m, n0, "high") +
      '</tbody></table></div><div class="cmp-kits">' + [ga, gb].map(function (g, k) {
        return "<section><h3>" + esc([ha, hb][k].name) + " abilities</h3>" + (g.kit || []).map(function (ab) {
          return '<div class="gab"><img class="gab-ic" src="' + esc(ab.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer"><div class="gab-body"><h3>' + esc(ab.name) + (ab.ult ? " · Ultimate" : "") + "</h3><p>" + esc(ab.desc || ab.quip || "") + "</p>" + (ab.cd ? '<p class="fine">' + ab.cd + " s cooldown</p>" : "") + "</div></div>";
        }).join("") + "</section>";
      }).join("") + '</div><p class="fine">Win and pick rates are from the last 14 days (Oracle+ from the latest full week). Highlighted numbers are the better of the two. <a href="draft.html">Draft helper →</a></p>';
    history.replaceState(null, "", "#" + D.slug(ha.name) + "-vs-" + D.slug(hb.name));
  }

  aSel.addEventListener("change", draw); bSel.addEventListener("change", draw);
  document.getElementById("c-swap").addEventListener("click", function () { var t = aSel.value; aSel.value = bSel.value; bSel.value = t; draw(); });
  var m = location.hash.slice(1).split("-vs-");
  if (D.bySlug[m[0]]) aSel.value = D.bySlug[m[0]].id; else aSel.value = sorted[0].id;
  if (D.bySlug[m[1]]) bSel.value = D.bySlug[m[1]].id; else bSel.value = sorted[1].id;
  draw();
})();
