(function () {
  "use strict";
  var snap = window.SNAPSHOT || { heroes: [] }, G = (window.GUIDES || {}).heroes || {};
  var MAX = 6, DAY0 = 20781; // #1 = 25 Nov 2026
  var cluesEl = document.getElementById("q-clues"), rowsEl = document.getElementById("q-rows"), endEl = document.getElementById("q-end");
  var form = document.getElementById("q-form"), input = document.getElementById("q-input"), err = document.getElementById("q-err");
  var heroes = snap.heroes.filter(function (h) { return G[h.id] && G[h.id].kit && G[h.id].kit.length >= 4; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  var byName = {};
  heroes.forEach(function (h) { byName[h.name.toLowerCase()] = h; });
  document.getElementById("q-heroes").innerHTML = heroes.map(function (h) { return '<option value="' + esc(h.name) + '">'; }).join("");

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(name) { return name.toLowerCase().replace(/&/g, "and").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function dayNumber() { var d = new Date(); return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000) - DAY0; }
  function seeded(n) { var x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); }

  // Hide the hero's name (and its parts, like "Mo" and "Krill") inside clue text.
  function redact(text, name) {
    var words = name.replace(/^The /, "").split(/\s*&\s*|\s+/).filter(function (w) { return w.length > 1; });
    var out = String(text || "");
    [name].concat(words).forEach(function (w) {
      out = out.replace(new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "('s)?\\b", "gi"), "this hero$1");
    });
    return out;
  }

  var mode = "daily", answer, guesses = [], done = false, n = dayNumber();
  function pickDaily() {
    // Walk the hero list in a shuffled order so the same hero doesn't come back for a long time.
    var order = heroes.map(function (h, i) { return { h: h, k: seeded(i + 1) }; }).sort(function (a, b) { return a.k - b.k; });
    return order[((n - 1) % order.length + order.length) % order.length].h;
  }
  function storeKey() { return "deadlocked-quiz:" + n; }
  function load() { try { return JSON.parse(localStorage.getItem(storeKey()) || "null"); } catch (e) { return null; } }
  function save() { if (mode !== "daily") return; try { localStorage.setItem(storeKey(), JSON.stringify({ g: guesses.map(function (h) { return h.id; }), done: done })); } catch (e) { /* storage blocked */ } }

  function start(m) {
    mode = m; guesses = []; done = false; err.textContent = ""; endEl.innerHTML = "";
    document.querySelectorAll(".q-modes .side").forEach(function (b) { b.classList.toggle("on", b.dataset.mode === m); });
    if (m === "daily") {
      answer = pickDaily();
      document.getElementById("q-kicker").textContent = "Daily hero quiz #" + n;
      var s = load();
      if (s) {
        guesses = (s.g || []).map(function (id) { return heroes.filter(function (h) { return h.id === id; })[0]; }).filter(Boolean);
        done = !!s.done;
      }
    } else {
      var prev = answer;
      do { answer = heroes[Math.floor(Math.random() * heroes.length)]; } while (heroes.length > 1 && answer === prev);
      document.getElementById("q-kicker").textContent = "Practice round";
    }
    render();
  }

  function clues() {
    var g = G[answer.id], kit = g.kit, w = g.weapon || {};
    var list = [
      ["Ability", redact(kit[0].desc, g.name)],
      ["Another ability", redact(kit[1].desc, g.name)],
      ["Third ability", redact(kit[2].desc, g.name)],
      ["Ultimate", redact(kit[3].desc, g.name)],
      ["Role", redact(g.role, g.name) + (w.name ? " · Weapon: " + w.name : "")],
      ["Portrait", null]
    ];
    var shown = done ? list.length : Math.min(list.length, guesses.length + 1);
    return list.slice(0, shown);
  }

  function cmpCell(a, b, unit) {
    if (a == null || b == null) return '<td class="num">–</td>';
    var hint = a === b ? "✓" : b > a ? "▲" : "▼";
    return '<td class="num ' + (a === b ? "q-hit" : "") + '">' + a + (unit || "") + ' <span class="q-hint" title="' + (a === b ? "same" : b > a ? "the answer is higher" : "the answer is lower") + '">' + hint + '</span></td>';
  }

  function render() {
    var g = G[answer.id];
    cluesEl.innerHTML = clues().map(function (c, i) {
      if (c[1] === null) return '<div class="q-clue"><span class="q-n">' + (i + 1) + '</span><div><b>' + c[0] + '</b><div class="q-portrait"><img src="' + esc(answer.img) + '" alt="Blurred portrait of today\'s hero" referrerpolicy="no-referrer" class="' + (done ? "" : "blur") + '"></div></div></div>';
      return '<div class="q-clue"><span class="q-n">' + (i + 1) + '</span><div><b>' + c[0] + '</b><p>' + esc(c[1]) + '</p></div></div>';
    }).join("");
    rowsEl.innerHTML = guesses.map(function (h) {
      var gg = G[h.id], right = h.id === answer.id;
      var cls = gg.type === g.type;
      return '<tr class="' + (right ? "q-win" : "") + '"><td><span class="who"><img src="' + esc(h.img) + '" alt="" referrerpolicy="no-referrer">' + esc(h.name) + '</span></td>' +
        '<td class="' + (cls ? "q-hit" : "") + '">' + esc(gg.type || "–") + (cls ? " ✓" : "") + '</td>' +
        cmpCell(gg.complexity, g.complexity, "/4").replace('class="num', 'class="') +
        cmpCell(gg.stats && gg.stats.health, g.stats && g.stats.health) +
        cmpCell(gg.weapon && gg.weapon.dps, g.weapon && g.weapon.dps) + '</tr>';
    }).join("") || '<tr><td colspan="5" class="note" style="padding:14px">Your guesses show up here, with hints: ✓ matches, ▲ the answer is higher, ▼ it\'s lower.</td></tr>';
    form.hidden = done;
    if (done) {
      var won = guesses.length && guesses[guesses.length - 1].id === answer.id;
      var grid = guesses.map(function (h) { return h.id === answer.id ? "🟩" : (G[h.id].type === g.type ? "🟨" : "🟥"); }).join("");
      var share = mode === "daily" ? "Deadlocked quiz #" + n + " " + (won ? guesses.length : "X") + "/" + MAX + "\n" + grid + "\ndeadlocked-official.github.io/quiz.html" : "";
      endEl.innerHTML = '<div class="q-end"><img src="' + esc(answer.img) + '" alt="" referrerpolicy="no-referrer"><div><p class="kicker">' + (won ? "Got it in " + guesses.length + "!" : "Out of guesses") + '</p><h2>' + esc(answer.name) + '</h2>' +
        '<p><a href="guide.html#' + slug(answer.name) + '">' + esc(answer.name) + ' guide →</a> · <a href="builds.html#' + slug(answer.name) + '">Build →</a></p>' +
        (share ? '<pre class="share" id="q-share">' + esc(share) + '</pre><button class="btn ghost" type="button" id="q-copy">Copy result</button> ' : "") +
        '<button class="btn" type="button" id="q-practice">' + (mode === "daily" ? "Play practice rounds" : "Next hero") + '</button><span class="note" id="q-copied" aria-live="polite"></span>' +
        (mode === "daily" ? '<p class="note">Next daily hero at midnight UTC.</p>' : "") + '</div></div>';
      var copy = document.getElementById("q-copy");
      if (copy) copy.addEventListener("click", function () {
        var ok = function () { document.getElementById("q-copied").textContent = " Copied"; };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(share).then(ok, sel); else sel();
      });
      document.getElementById("q-practice").addEventListener("click", function () { start("practice"); });
    }
  }
  function sel() {
    var el = document.getElementById("q-share"), r = document.createRange();
    r.selectNodeContents(el); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    document.getElementById("q-copied").textContent = " Selected. Press Ctrl+C to copy.";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (done) return;
    var h = byName[input.value.trim().toLowerCase()];
    if (!h) { err.textContent = "Pick a hero from the list."; return; }
    if (guesses.some(function (x) { return x.id === h.id; })) { err.textContent = "You already guessed " + h.name + "."; return; }
    err.textContent = ""; input.value = "";
    guesses.push(h);
    if (h.id === answer.id || guesses.length >= MAX) done = true;
    save(); render();
  });
  input.addEventListener("input", function () { err.textContent = ""; });
  document.querySelector(".q-modes").addEventListener("click", function (e) { var b = e.target.closest(".side"); if (b) start(b.dataset.mode); });
  if (heroes.length) start("daily");
})();
