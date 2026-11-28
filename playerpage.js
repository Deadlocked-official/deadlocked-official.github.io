(function () {
  "use strict";
  var API = "https://api.deadlock-api.com/v1/players/";
  var snap = window.SNAPSHOT || { heroes: [] }, TIERS = (window.TIERS || {}).tiers || [];
  var RANKS = ["Obscurus", "Initiate", "Seeker", "Alchemist", "Arcanist", "Ritualist", "Emissary", "Archon", "Oracle", "Phantom", "Ascendant", "Eternus"];
  var form = document.getElementById("p-form"), q = document.getElementById("p-q"), status = document.getElementById("p-status");
  var results = document.getElementById("p-results"), profile = document.getElementById("p-profile");
  var byId = {}, tierOf = {};
  snap.heroes.forEach(function (h) { byId[h.id] = h; });
  TIERS.forEach(function (t) { t[2].forEach(function (h) { tierOf[h[0]] = t[0]; }); });

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(name) { return name.toLowerCase().replace(/&/g, "and").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function getJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function heroImg(id, cls) {
    var h = byId[id];
    return h ? '<img class="' + (cls || "") + '" src="' + esc(h.img) + '" alt="' + esc(h.name) + '" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ph">?</span>';
  }
  function rankName(badge) {
    if (!badge) return "Unranked";
    var tier = Math.floor(badge / 10), sub = badge % 10;
    return (RANKS[tier] || "Rank " + tier) + (sub ? " " + sub : "");
  }
  function ago(ts) {
    var s = Date.now() / 1000 - ts;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return Math.round(s / 86400) + " d ago";
  }
  function heroWr(id) { var h = byId[id]; return h && h.matches ? 100 * h.wins / h.matches : 50; }

  // Steam IDs: a 64-bit ID or profile link becomes the 32-bit account ID the API uses.
  function parseId(text) {
    var m = text.match(/(\d{5,20})/);
    if (!m) return null;
    var n = m[1];
    if (n.length >= 16) {
      try { return String(BigInt(n) - BigInt("76561197960265728")); } catch (e) { return null; }
    }
    return n;
  }

  function search(text) {
    results.innerHTML = ""; profile.innerHTML = "";
    var id = /^\s*\d+\s*$/.test(text) || /steamcommunity\.com\/profiles\//.test(text) ? parseId(text) : null;
    if (id) { location.hash = id; return; }
    status.textContent = "Searching…";
    getJSON(API + "steam-search?limit=10&search_query=" + encodeURIComponent(text)).then(function (list) {
      if (!list.length) { status.textContent = "No players found with that name. Try their exact Steam name, or paste their Steam profile link."; return; }
      status.textContent = list.length + " player" + (list.length > 1 ? "s" : "") + " found. Pick one:";
      results.innerHTML = list.map(function (p) {
        return '<li><a href="#' + p.account_id + '"><img src="' + esc(p.avatarmedium || p.avatar) + '" alt="" referrerpolicy="no-referrer"><span><b>' + esc(p.personaname) + '</b><small>' + (p.countrycode ? esc(p.countrycode) + " · " : "") + "ID " + p.account_id + '</small></span></a></li>';
      }).join("");
    }).catch(function () { status.textContent = "The player search couldn't be reached. Try again in a minute."; });
  }

  function load(id) {
    results.innerHTML = "";
    status.textContent = "Loading player…";
    profile.innerHTML = "";
    Promise.all([
      getJSON(API + "steam?account_ids=" + id).catch(function () { return []; }),
      getJSON(API + id + "/rank").catch(function () { return null; }),
      getJSON(API + "hero-stats?account_ids=" + id).catch(function () { return []; }),
      getJSON(API + id + "/match-history").catch(function () { return []; })
    ]).then(function (r) {
      var steam = (r[0] || [])[0] || {}, rank = r[1], heroes = r[2] || [], matches = r[3] || [];
      if (!heroes.length && !matches.length) {
        status.textContent = "No public matches for this player. Their match history may be private, or they haven't played yet.";
        return;
      }
      status.textContent = "";
      render(id, steam, rank, heroes, matches);
      document.title = (steam.personaname || "Player " + id) + " · Deadlocked";
    });
  }

  function render(id, steam, rank, heroes, matches) {
    matches.sort(function (a, b) { return b.start_time - a.start_time; });
    var normal = matches.filter(function (m) { return m.game_mode === 1; });
    var tot = { m: 0, w: 0, k: 0, d: 0, a: 0 };
    heroes.forEach(function (h) { tot.m += h.matches_played; tot.w += h.wins; tot.k += h.kills; tot.d += h.deaths; tot.a += h.assists; });
    var recent = normal.slice(0, 50), rw = recent.filter(function (m) { return m.match_result === m.player_team; }).length;

    // Heroes: shrink small samples toward 50% so 3 lucky games don't look like a main.
    var rows = heroes.filter(function (h) { return byId[h.hero_id] && h.matches_played > 0; }).map(function (h) {
      var wr = 100 * h.wins / h.matches_played, avg = heroWr(h.hero_id);
      var adj = 100 * (h.wins + 5) / (h.matches_played + 10);
      return { id: h.hero_id, n: h.matches_played, wr: wr, adj: adj, vs: wr - avg, kda: (h.kills + h.assists) / Math.max(1, h.deaths), last: h.last_played };
    }).sort(function (a, b) { return b.n - a.n; });
    var best = rows.filter(function (r) { return r.n >= 10; }).sort(function (a, b) { return b.adj - a.adj; })[0];
    var main = rows[0];
    var played = {}; rows.forEach(function (r) { played[r.id] = r.n; });
    var tryList = snap.heroes.filter(function (h) { return (played[h.id] || 0) < 5 && h.matches && (tierOf[h.name] === "F" || tierOf[h.name] === "D"); })
      .sort(function (a, b) { return heroWr(b.id) - heroWr(a.id); }).slice(0, 4);

    var insights = [];
    if (best) insights.push("Your best hero overall is <b>" + esc(byId[best.id].name) + "</b>: " + best.wr.toFixed(0) + "% win in " + best.n + " games, " + (best.vs >= 0 ? "+" : "") + best.vs.toFixed(1) + "% compared with everyone else on that hero. <a href=\"builds.html#" + slug(byId[best.id].name) + "\">Its build →</a>");
    if (main && (!best || main.id !== best.id)) insights.push("You play <b>" + esc(byId[main.id].name) + "</b> the most (" + main.n + " games) and win " + main.wr.toFixed(0) + "%, " + (main.vs >= 0 ? "above" : "below") + " the " + heroWr(main.id).toFixed(1) + "% average. <a href=\"guide.html#" + slug(byId[main.id].name) + "\">Guide →</a>");
    var weak = rows.filter(function (r) { return r.n >= 15 && r.vs <= -5; })[0];
    if (weak) insights.push("<b>" + esc(byId[weak.id].name) + "</b> is costing you games: " + weak.wr.toFixed(0) + "% win over " + weak.n + " games, " + Math.abs(weak.vs).toFixed(1) + "% below average. Worth a look at <a href=\"guide.html#" + slug(byId[weak.id].name) + "\">its guide</a>.");
    if (recent.length >= 10) insights.push("Last " + recent.length + " games: " + rw + " wins (" + Math.round(100 * rw / recent.length) + "%).");
    if (tryList.length) insights.push("Easy heroes doing well right now that you've barely played: " + tryList.map(function (h) { return '<a href="guide.html#' + slug(h.name) + '">' + esc(h.name) + "</a>"; }).join(", ") + ".");

    var badge = rank && rank.badge;
    profile.innerHTML =
      '<div class="build-head p-head">' + (steam.avatarfull ? '<img class="build-pic" src="' + esc(steam.avatarfull) + '" alt="" referrerpolicy="no-referrer">' : "") +
      '<div><h2>' + esc(steam.personaname || "Player " + id) + '</h2><p class="tags">' +
      (badge ? '<span class="p-rank"><img src="' + API + id + '/rank/image?format=webp" alt="" referrerpolicy="no-referrer">' + rankName(badge) + '</span>' : '<span>Unranked</span>') +
      '<span>' + tot.m.toLocaleString("en-US") + ' games</span><span>' + (tot.m ? (100 * tot.w / tot.m).toFixed(1) : "0") + '% win</span><span>' + ((tot.k + tot.a) / Math.max(1, tot.d)).toFixed(2) + ' KDA</span>' +
      (steam.profileurl ? '<a href="' + esc(steam.profileurl) + '">Steam profile</a>' : "") + '</p></div></div>' +
      (insights.length ? '<h3 class="sub-h">What stands out</h3><ol class="g-tips">' + insights.map(function (x) { return "<li>" + x + "</li>"; }).join("") + '</ol>' : "") +
      '<h3 class="sub-h">Heroes</h3><div class="table-scroll"><table class="ledger"><thead><tr><th>Hero</th><th class="num">Games</th><th class="num">Win</th><th class="num">vs average</th><th class="num">KDA</th><th class="num">Last played</th></tr></thead><tbody>' +
      rows.slice(0, 25).map(function (r) {
        return '<tr><td><a class="who" href="guide.html#' + slug(byId[r.id].name) + '">' + heroImg(r.id) + esc(byId[r.id].name) + '</a></td><td class="num">' + r.n + '</td><td class="num">' + r.wr.toFixed(1) + '%</td>' +
          '<td class="num ' + (r.vs >= 0 ? "up" : "down") + '">' + (r.vs >= 0 ? "+" : "") + r.vs.toFixed(1) + '%</td><td class="num">' + r.kda.toFixed(2) + '</td><td class="num">' + (r.last ? ago(r.last) : "–") + '</td></tr>';
      }).join("") + '</tbody></table></div><p class="fine">"vs average" compares your win rate on the hero with everyone\'s over the last two weeks. Small numbers of games swing a lot.</p>' +
      '<h3 class="sub-h">Recent matches</h3><ul class="p-matches">' +
      normal.slice(0, 20).map(function (m) {
        var win = m.match_result === m.player_team;
        return '<li class="' + (win ? "w" : "l") + '">' + heroImg(m.hero_id) + '<span class="res">' + (win ? "Win" : "Loss") + '</span>' +
          '<span class="nm">' + esc((byId[m.hero_id] || {}).name || "Hero") + '<small>' + ago(m.start_time) + ' · ' + Math.round(m.match_duration_s / 60) + ' min</small></span>' +
          '<span class="val">' + m.player_kills + ' / ' + m.player_deaths + ' / ' + m.player_assists + '<small>' + (m.net_worth || 0).toLocaleString("en-US") + ' souls</small></span><a class="m-link" href="match.html#' + m.match_id + '/' + id + '">Review →</a></li>';
      }).join("") + '</ul>';
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); var t = q.value.trim(); if (t) search(t); });
  function fromHash() { var id = location.hash.slice(1); if (/^\d+$/.test(id)) load(id); }
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
