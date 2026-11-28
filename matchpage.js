(function () {
  "use strict";
  var D = window.DL, esc = D.esc, B = (window.BUILDS || {}).builds || {};
  var form = document.getElementById("m-form"), q = document.getElementById("m-q"), status = document.getElementById("m-status");
  var board = document.getElementById("m-board"), review = document.getElementById("m-review");
  var match = null, metricsCache = {}, curveCache = {};
  var TEAM = ["Amber", "Sapphire"];

  function since(days) { return Math.floor(Date.now() / 1000) - days * 86400; }
  function metrics(hero) {
    if (!metricsCache[hero]) metricsCache[hero] = D.getJSON(D.API + "analytics/player-stats/metrics?min_average_badge=81&min_unix_timestamp=" + since(14) + "&hero_ids=" + hero).catch(function () { return null; });
    return metricsCache[hero];
  }
  function curve(hero) {
    if (!curveCache[hero]) curveCache[hero] = D.getJSON(D.API + "analytics/player-performance-curve?min_average_badge=81&min_unix_timestamp=" + since(14) + "&hero_ids=" + hero + "&resolution=5").catch(function () { return null; });
    return curveCache[hero];
  }
  // Where a value falls among high-rank players, 0–100, from the percentile table the API gives.
  function pct(m, v) {
    var pts = [[1, m.percentile1], [5, m.percentile5], [10, m.percentile10], [25, m.percentile25], [50, m.percentile50], [75, m.percentile75], [90, m.percentile90], [95, m.percentile95], [99, m.percentile99]];
    if (v <= pts[0][1]) return 1;
    if (v >= pts[8][1]) return 99;
    for (var i = 1; i < pts.length; i++) {
      if (v <= pts[i][1]) {
        var a = pts[i - 1], b = pts[i], span = b[1] - a[1];
        return span > 0 ? a[0] + (b[0] - a[0]) * (v - a[1]) / span : b[0];
      }
    }
    return 50;
  }

  function parseId(text) { var m = String(text).match(/(\d{6,12})/); return m ? m[1] : null; }

  function load(id, account) {
    review.innerHTML = ""; board.innerHTML = "";
    if (match && String(match.match_id) === id) { showBoard(account); return; }
    status.textContent = "Loading match " + id + "… (the first look at a match can take a few seconds)";
    D.getJSON(D.API + "matches/" + id + "/metadata").then(function (d) {
      match = d.match_info || d;
      if (!match.players || !match.players.length) throw new Error("empty");
      status.textContent = "";
      showBoard(account);
    }).catch(function (e) {
      status.textContent = /404/.test(e.message) ? "No match found with ID " + id + ". Check the number, or pick a match from your Players page." : "That match couldn't be loaded right now. It may be too new or too old to have data. Try again in a minute.";
    });
  }

  function showBoard(account) {
    var m = match, min = m.duration_s / 60;
    var started = new Date(m.start_time * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
    var html = '<div class="block-head"><h2>Match ' + m.match_id + '</h2><p class="note">' + started + " · " + D.mins(m.duration_s) + " · " + TEAM[m.winning_team] + " won. Pick a player to review.</p></div>";
    [0, 1].forEach(function (t) {
      var ps = m.players.filter(function (p) { return p.team === t; }).sort(function (a, b) { return b.net_worth - a.net_worth; });
      html += '<h3 class="sub-h">' + TEAM[t] + (m.winning_team === t ? " · Won" : " · Lost") + '</h3><div class="table-scroll"><table class="ledger m-table"><thead><tr><th>Hero</th><th class="num">K / D / A</th><th class="num">Souls</th><th class="num">Souls / min</th><th class="num">Last hits</th><th class="num">Hero damage</th><th></th></tr></thead><tbody>' +
        ps.map(function (p) {
          var last = (p.stats || [])[p.stats.length - 1] || {};
          return '<tr class="' + (String(p.account_id) === String(account) ? "on" : "") + '"><td><span class="who">' + D.heroImg(p.hero_id) + esc((D.byId[p.hero_id] || {}).name || "Hero") + '</span></td><td class="num">' + p.kills + " / " + p.deaths + " / " + p.assists + '</td><td class="num">' + p.net_worth.toLocaleString("en-US") + '</td><td class="num">' + Math.round(p.net_worth / min) + '</td><td class="num">' + p.last_hits + '</td><td class="num">' + (last.player_damage || 0).toLocaleString("en-US") + '</td><td><a class="btn ghost small" href="#' + m.match_id + "/" + p.account_id + '">Review</a></td></tr>';
        }).join("") + "</tbody></table></div>";
    });
    board.innerHTML = html;
    var me = m.players.filter(function (p) { return String(p.account_id) === String(account); })[0];
    if (me) showReview(me);
  }

  function showReview(p) {
    var m = match, min = m.duration_s / 60, hero = D.byId[p.hero_id] || { name: "Hero" }, won = p.team === m.winning_team;
    var last = (p.stats || [])[p.stats.length - 1] || {};
    var shots = (last.shots_hit || 0) + (last.shots_missed || 0);
    var mine = {
      net_worth_per_min: p.net_worth / min, player_damage_per_min: (last.player_damage || 0) / min, last_hits: p.last_hits,
      deaths: p.deaths, kills_plus_assists: p.kills + p.assists, accuracy: shots ? last.shots_hit / shots : null
    };
    review.innerHTML = '<div class="build-head">' + D.heroImg(p.hero_id, "build-pic") + '<div><p class="kicker">Match review</p><h2>' + esc(hero.name) + '</h2><p class="tags"><span class="tag-style">' + (won ? "Win" : "Loss") + "</span><span>" + p.kills + " / " + p.deaths + " / " + p.assists + "</span><span>" + p.net_worth.toLocaleString("en-US") + " souls</span><span>" + D.mins(m.duration_s) + '</span><a href="player.html#' + p.account_id + '">Player profile</a><a href="builds.html#' + D.slug(hero.name) + '">' + esc(hero.name) + ' build</a></p></div></div><p class="note" id="m-loading">Comparing with high-rank ' + esc(hero.name) + " players…</p>";
    review.scrollIntoView({ behavior: "smooth", block: "start" });
    Promise.all([metrics(p.hero_id), curve(p.hero_id)]).then(function (r) {
      var mt = r[0], cv = r[1], html = "", tips = [];
      var ROWS = [
        ["net_worth_per_min", "Souls per minute", function (v) { return Math.round(v); }, false],
        ["player_damage_per_min", "Hero damage per minute", function (v) { return Math.round(v); }, false],
        ["last_hits", "Last hits", function (v) { return Math.round(v); }, false],
        ["kills_plus_assists", "Kills + assists", function (v) { return Math.round(v); }, false],
        ["deaths", "Deaths", function (v) { return Math.round(v); }, true],
        ["accuracy", "Gun accuracy", function (v) { return (100 * v).toFixed(0) + "%"; }, false]
      ];
      var scored = {};
      if (mt) {
        html += '<h3 class="sub-h">Compared with Oracle+ ' + esc(hero.name) + ' players</h3><div class="m-bench">' + ROWS.filter(function (row) { return mine[row[0]] != null && mt[row[0]]; }).map(function (row) {
          var s = mt[row[0]], v = mine[row[0]], P = pct(s, v), good = row[3] ? 100 - P : P;
          scored[row[0]] = good;
          return '<div class="m-stat"><span>' + row[1] + '</span><b>' + row[2](v) + '<i>avg ' + row[2](s.avg) + '</i></b><div class="m-meter"><i style="width:' + good.toFixed(0) + '%" class="' + (good >= 60 ? "g" : good >= 35 ? "m" : "b") + '"></i></div><small>Better than ' + good.toFixed(0) + "% of them</small></div>";
        }).join("") + '</div><p class="fine">Averages are from Oracle-and-up matches on this hero over the last 14 days. Deaths count the other way: fewer is better.</p>';
      }
      if (scored.net_worth_per_min != null && scored.net_worth_per_min < 35) tips.push("Your farm was behind: <b>" + Math.round(mine.net_worth_per_min) + " souls a minute</b> against " + Math.round(mt.net_worth_per_min.avg) + " for top players. Clear jungle camps between fights and hit the souls orbs out of last hits.");
      if (scored.deaths != null && scored.deaths < 35) tips.push("<b>" + p.deaths + " deaths</b> is a lot for " + esc(hero.name) + ". Each death hands the enemy souls and costs you farm time. Check when you died below.");
      if (scored.player_damage_per_min != null && scored.player_damage_per_min < 35 && scored.net_worth_per_min >= 50) tips.push("You had the souls but not the damage. Join more fights once your core items are done.");
      if (scored.accuracy != null && scored.accuracy < 30) tips.push("Accuracy was low (" + (100 * mine.accuracy).toFixed(0) + "%). The <a href=\"./#drills\">tracking drills</a> help with this.");
      if (scored.last_hits != null && scored.last_hits >= 70 && scored.net_worth_per_min >= 60) tips.push("Strong farming game. Keep that up.");
      if (scored.kills_plus_assists != null && scored.kills_plus_assists >= 70) tips.push("You were in a lot of kills. Good fight presence.");

      // Souls over time against the high-rank average, with deaths marked.
      if (cv && cv.length && p.stats && p.stats.length) {
        var W = 900, Hh = 260, L = 56, R = 16, T = 14, Bt = 30, dur = m.duration_s;
        var avg = cv.map(function (c) { return [c.game_time / 100 * dur, c.net_worth_avg]; });
        var you = [[0, 0]].concat(p.stats.map(function (s) { return [s.time_stamp_s, s.net_worth]; }));
        if (you[you.length - 1][0] < dur) you.push([dur, p.net_worth]);
        var hi = Math.max.apply(null, avg.map(function (a) { return a[1]; }).concat(you.map(function (a) { return a[1]; }))) * 1.05;
        var x = function (t) { return L + (W - L - R) * t / dur; }, y = function (v) { return T + (Hh - T - Bt) * (1 - v / hi); };
        var path = function (pts) { return pts.map(function (a, i) { return (i ? "L" : "M") + x(a[0]).toFixed(1) + " " + y(a[1]).toFixed(1); }).join(""); };
        var g = "", stepV = hi > 40000 ? 10000 : 5000;
        for (var v = 0; v <= hi; v += stepV) g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + (v / 1000) + "k</text>";
        for (var t = 0; t <= dur; t += 300) g += '<text x="' + x(t) + '" y="' + (Hh - 8) + '" text-anchor="middle">' + t / 60 + " min</text>";
        (p.death_details || []).forEach(function (d) { g += '<line class="death" x1="' + x(d.game_time_s) + '" x2="' + x(d.game_time_s) + '" y1="' + T + '" y2="' + (Hh - Bt) + '"><title>Died at ' + D.mins(d.game_time_s) + "</title></line>"; });
        g += '<path class="line avg" d="' + path(avg) + '"/><path class="line" stroke="#c9a45c" d="' + path(you) + '"/>';
        var behind10 = null;
        var at = function (pts, t) { for (var i = 1; i < pts.length; i++) if (pts[i][0] >= t) { var a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (t - a[0]) / Math.max(1, b[0] - a[0]); } return pts[pts.length - 1][1]; };
        if (dur > 600) behind10 = at(you, 600) - at(avg, 600);
        html += '<h3 class="sub-h">Souls over the match</h3><div class="t-chart m-chart"><svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Your souls over time compared with the high-rank average">' + g + '</svg></div><ul class="t-key"><li><i style="background:#c9a45c"></i>You</li><li><i class="avg"></i>Oracle+ average on ' + esc(hero.name) + '</li><li><i class="death"></i>Your deaths</li></ul>';
        if (behind10 != null && behind10 < -1500) tips.unshift("At 10 minutes you were <b>" + Math.round(-behind10).toLocaleString("en-US") + " souls behind</b> the high-rank average. The laning phase is where this came from.");
        else if (behind10 != null && behind10 > 1500) tips.unshift("You won your lane: <b>" + Math.round(behind10).toLocaleString("en-US") + " souls ahead</b> of the high-rank average at 10 minutes.");
        var early = (p.death_details || []).filter(function (d) { return d.game_time_s < 600; }).length;
        if (early >= 3) tips.push(early + " of your deaths came in the first 10 minutes. Play your lane a bit safer until your first items.");
      }

      // Items: what you bought, when, and how that lines up with the site's build.
      var bought = (p.items || []).filter(function (it) { return D.item(it.item_id) && it.game_time_s > 0; });
      var build = B[p.hero_id], planned = {};
      if (build) build.phases.forEach(function (ph) { if (ph.name !== "Situational") ph.items.forEach(function (it) { planned[it[0]] = { min: it[3], phase: ph.name }; }); });
      var late = [], match_n = 0;
      html += '<h3 class="sub-h">Your items</h3><ol class="m-items">' + bought.map(function (it) {
        var info = D.item(it.item_id), pl = planned[it.item_id], when = it.game_time_s / 60, note = "";
        if (pl) {
          match_n++;
          var diff = when - pl.min;
          note = '<small class="' + (diff > 3 ? "down" : diff < -1 ? "up" : "") + '">' + (Math.abs(diff) < 1 ? "on time with top players" : Math.abs(diff).toFixed(0) + " min " + (diff > 0 ? "later" : "earlier") + " than top players") + "</small>";
          if (diff > 4 && info.tier >= 3) late.push(info.name);
        } else if (build) note = "<small>not in the site build</small>";
        // An item that left the inventory when one of its upgrades was bought was upgraded, not sold.
        var upg = it.sold_time_s ? bought.filter(function (b) { return ((window.ITEMDB || {}).items[b.item_id] || {}).from && window.ITEMDB.items[b.item_id].from.indexOf(it.item_id) >= 0 && Math.abs(b.game_time_s - it.sold_time_s) <= 3; })[0] : null;
        var gone = it.sold_time_s ? (upg ? "<small>upgraded " + D.mins(it.sold_time_s) + "</small>" : "<small>sold " + D.mins(it.sold_time_s) + "</small>") : "";
        return '<li class="item' + (it.sold_time_s && !upg ? " sold" : "") + '">' + D.itemImg(it.item_id) + '<span class="nm"><a href="items.html#' + D.slug(info.name) + '">' + esc(info.name) + "</a>" + note + '</span><span class="val">' + D.mins(it.game_time_s) + gone + "</span></li>";
      }).join("") + "</ol>";
      if (build) {
        var missing = [];
        build.phases.forEach(function (ph) { if (ph.name === "Core" || ph.name === "Mid") ph.items.forEach(function (it) { if (!bought.some(function (b) { return b.item_id === it[0]; }) && it[3] < min) missing.push(it[0]); }); });
        if (late.length) tips.push("Your " + late.slice(0, 3).join(", ") + " came several minutes later than top players get them. More farm early fixes that.");
        if (missing.length) html += '<p class="note">From the site build, you skipped: ' + missing.slice(0, 6).map(function (id) { var i = D.item(id); return '<a href="items.html#' + D.slug(i.name) + '">' + esc(i.name) + "</a>"; }).join(", ") + '. <a href="builds.html#' + D.slug(hero.name) + '">See the full build →</a></p>';
      }
      if (!tips.length) tips.push("A solid all-round game for " + esc(hero.name) + ". Nothing stands out as a big problem.");
      document.getElementById("m-loading").outerHTML = '<h3 class="sub-h">What to work on</h3><ol class="g-tips">' + tips.slice(0, 5).map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ol>" + html;
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = parseId(q.value);
    if (!id) { status.textContent = "Enter a match ID: the number shown in the game's match history, or pick one on the Players page."; return; }
    location.hash = id;
  });
  function fromHash() {
    var parts = location.hash.slice(1).split("/");
    if (/^\d+$/.test(parts[0])) { q.value = parts[0]; load(parts[0], parts[1]); }
  }
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
