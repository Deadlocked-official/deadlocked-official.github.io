(function () {
  "use strict";
  var D = window.DL, esc = D.esc;
  var ROWS = [["S", "#c2473a"], ["A", "#cf7a38"], ["B", "#c9a45c"], ["C", "#7f9a65"], ["D", "#4f8a84"], ["F", "#64748b"]];
  var board = document.getElementById("tm-board"), pool = document.getElementById("tm-pool"), title = document.getElementById("tm-title"), msg = document.getElementById("tm-msg");
  var KEY = "deadlocked-tiermaker", state = { title: "", rows: {} }, picked = null;

  function empty() { var r = {}; ROWS.forEach(function (x) { r[x[0]] = []; }); return r; }
  function placed() { var s = {}; ROWS.forEach(function (x) { state.rows[x[0]].forEach(function (id) { s[id] = x[0]; }); }); return s; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    history.replaceState(null, "", "#" + encode());
  }
  function encode() {
    return ROWS.map(function (x) { return x[0].toLowerCase() + "=" + state.rows[x[0]].join("."); }).join("&") + (state.title ? "&t=" + encodeURIComponent(state.title) : "");
  }
  function decode(h) {
    var out = { title: "", rows: empty() }, any = false;
    h.split("&").forEach(function (kv) {
      var p = kv.split("="), k = p[0].toUpperCase();
      if (k === "T") out.title = decodeURIComponent(p[1] || "");
      else if (out.rows[k] && p[1]) { out.rows[k] = p[1].split(".").map(Number).filter(function (id) { return D.byId[id]; }); any = true; }
    });
    return any || out.title ? out : null;
  }
  function chip(id) { return '<button type="button" class="tm-hero' + (picked === id ? " on" : "") + '" draggable="true" data-id="' + id + '" title="' + esc(D.byId[id].name) + '">' + D.heroImg(id) + "</button>"; }

  function draw() {
    var p = placed();
    board.innerHTML = ROWS.map(function (x) {
      return '<div class="tm-row"><div class="tm-label" style="background:' + x[1] + '">' + x[0] + '</div><div class="tm-drop" data-row="' + x[0] + '">' + state.rows[x[0]].map(chip).join("") + "</div></div>";
    }).join("");
    pool.innerHTML = D.snap.heroes.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).filter(function (h) { return !p[h.id]; }).map(function (h) { return chip(h.id); }).join("") || '<p class="note">Every hero is placed.</p>';
    title.value = state.title;
  }
  function move(id, row, beforeId) {
    ROWS.forEach(function (x) { state.rows[x[0]] = state.rows[x[0]].filter(function (h) { return h !== id; }); });
    if (row) {
      var r = state.rows[row], i = beforeId ? r.indexOf(beforeId) : -1;
      if (i >= 0) r.splice(i, 0, id); else r.push(id);
    }
    picked = null; save(); draw();
  }

  // Drag and drop on desktop; tap a hero, then tap a row, on phones.
  document.addEventListener("dragstart", function (e) { var c = e.target.closest(".tm-hero"); if (c) { e.dataTransfer.setData("text/plain", c.dataset.id); e.dataTransfer.effectAllowed = "move"; } });
  [board, pool].forEach(function (el) {
    el.addEventListener("dragover", function (e) { if (e.target.closest(".tm-drop, #tm-pool")) { e.preventDefault(); } });
    el.addEventListener("drop", function (e) {
      var zone = e.target.closest(".tm-drop, #tm-pool"); if (!zone) return;
      e.preventDefault();
      var id = +e.dataTransfer.getData("text/plain"), before = e.target.closest(".tm-hero");
      if (id) move(id, zone.dataset.row || null, before && +before.dataset.id !== id ? +before.dataset.id : null);
    });
    el.addEventListener("click", function (e) {
      var c = e.target.closest(".tm-hero"), zone = e.target.closest(".tm-drop, #tm-pool");
      if (c && picked === +c.dataset.id) { picked = null; msg.textContent = ""; draw(); return; }
      if (c && picked !== +c.dataset.id && !(picked && zone && zone.dataset.row)) { picked = +c.dataset.id; msg.textContent = D.byId[picked].name + " picked. Now tap a row (or the hero pool) to put it there."; draw(); return; }
      if (picked && zone) { var id = picked; msg.textContent = ""; move(id, zone.dataset.row || null, c && +c.dataset.id !== id ? +c.dataset.id : null); }
    });
  });
  title.addEventListener("input", function () { state.title = title.value.slice(0, 60); save(); });
  document.getElementById("tm-reset").addEventListener("click", function () { if (confirm("Clear your tier list and start over?")) { state = { title: "", rows: empty() }; save(); draw(); } });
  document.getElementById("tm-site").addEventListener("click", function () {
    // Start from the site's win-rate order: top 6 in S, and so on down.
    var hs = D.snap.heroes.filter(function (h) { return h.matches; }).sort(function (a, b) { return b.wins / b.matches - a.wins / a.matches; }), sizes = [5, 8, 10, 10, 7, 99], k = 0;
    state.rows = empty();
    ROWS.forEach(function (x, i) { state.rows[x[0]] = hs.slice(k, k + sizes[i]).map(function (h) { return h.id; }); k += sizes[i]; });
    state.title = state.title || "Deadlock meta by win rate"; save(); draw();
    msg.textContent = "Filled in by win rate over the last 14 days. Now move heroes to match what you think.";
  });
  document.getElementById("tm-copy").addEventListener("click", function () {
    var link = location.href;
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { msg.textContent = "Link copied. Anyone who opens it sees your tier list."; }, function () { prompt("Copy this link:", link); });
  });

  document.getElementById("tm-png").addEventListener("click", function () {
    msg.textContent = "Making the picture…";
    var size = 72, gap = 4, label = 90, perRow = 12, W = label + perRow * (size + gap) + gap, head = 70;
    var heights = ROWS.map(function (x) { return Math.max(1, Math.ceil(state.rows[x[0]].length / perRow)) * (size + gap) + gap; });
    var H = head + heights.reduce(function (a, b) { return a + b + 2; }, 0) + 34;
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#0e1513"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e8e3d3"; ctx.font = "900 40px 'Big Shoulders Display', Impact, sans-serif"; ctx.textBaseline = "middle";
    ctx.fillText((state.title || "My Deadlock tier list").toUpperCase(), 16, head / 2);
    var ids = [].concat.apply([], ROWS.map(function (x) { return state.rows[x[0]]; }));
    var imgs = {};
    Promise.all(ids.map(function (id) {
      return new Promise(function (res) {
        var im = new Image(); im.crossOrigin = "anonymous"; im.onload = function () { imgs[id] = im; res(); }; im.onerror = res; im.src = D.byId[id].img;
      });
    })).then(function () {
      var y = head;
      ROWS.forEach(function (x, i) {
        ctx.fillStyle = x[1]; ctx.fillRect(0, y, label, heights[i]);
        ctx.fillStyle = "#fff"; ctx.font = "900 44px 'Big Shoulders Display', Impact, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(x[0], label / 2, y + heights[i] / 2); ctx.textAlign = "left";
        ctx.fillStyle = "#151e1b"; ctx.fillRect(label, y, W - label, heights[i]);
        state.rows[x[0]].forEach(function (id, n) {
          var cx = label + gap + (n % perRow) * (size + gap), cy = y + gap + Math.floor(n / perRow) * (size + gap), im = imgs[id];
          if (im) { var s = Math.min(im.width, im.height * 0.78); ctx.drawImage(im, (im.width - s) / 2, 0, s, s, cx, cy, size, size); }
          else { ctx.fillStyle = "#2b3934"; ctx.fillRect(cx, cy, size, size); ctx.fillStyle = "#e8e3d3"; ctx.font = "500 11px sans-serif"; ctx.fillText(D.byId[id].name.slice(0, 10), cx + 4, cy + size / 2); }
        });
        y += heights[i] + 2;
      });
      ctx.fillStyle = "#95a39b"; ctx.font = "500 14px 'IBM Plex Mono', monospace"; ctx.fillText("Made on deadlocked-official.github.io/tiermaker.html", 16, H - 17);
      try {
        var a = document.createElement("a"); a.download = "deadlock-tier-list.png"; a.href = cv.toDataURL("image/png"); a.click();
        msg.textContent = "Picture saved as deadlock-tier-list.png.";
      } catch (e) { msg.textContent = "The picture couldn't be made in this browser. Try a screenshot instead."; }
    });
  });

  var fromLink = decode(location.hash.slice(1));
  if (fromLink) state = fromLink;
  else { try { state = JSON.parse(localStorage.getItem(KEY)) || state; } catch (e) {} }
  if (!state.rows || !state.rows.S) state.rows = empty();
  ROWS.forEach(function (x) { state.rows[x[0]] = (state.rows[x[0]] || []).filter(function (id) { return D.byId[id]; }); });
  draw();
})();
