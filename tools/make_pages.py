"""One-off page generator for the newer pages (Trends, Match, Tools and its tools). Also rewrites every page's nav.

Usage: python tools/make_pages.py <site_dir>
"""
import os, re, sys

SITE = "https://deadlocked-official.github.io/"
NAV = [("./", "Home"), ("guide.html", "Guides"), ("builds.html", "Builds"), ("stats.html", "Stats"), ("trends.html", "Trends"),
       ("items.html", "Items"), ("patches.html", "Patches"), ("player.html", "Players"), ("match.html", "Match"),
       ("tools.html", "Tools"), ("quiz.html", "Quiz"), ("./#drills", "Drills")]
TOOLS = {"tools.html", "draft.html", "buildmaker.html", "calc.html", "compare.html", "tiermaker.html"}


def nav(page):
    out = []
    for href, label in NAV:
        here = href == page or (page == "index.html" and href == "./") or (label == "Tools" and page in TOOLS and page != "tools.html")
        h = "#drills" if (page == "index.html" and label == "Drills") else href
        out.append(f'<a href="{h}"' + (' aria-current="page"' if here and label != "Drills" else "") + f">{label}</a>")
    out.append('<a href="discord.html" class="nav-discord"' + (' aria-current="page"' if page == "discord.html" else "") + ">Discord bot</a>")
    return '<nav aria-label="Site">' + "".join(out) + "</nav>"


HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{og}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{site}og.png">
<link rel="canonical" href="{url}">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0e1513">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="sitebar"><div class="wrap">
  <a class="brand" href="./">Deadlocked</a>
  {nav}
</div></div>
<header class="masthead compact">
  <div class="wrap">
    <p class="kicker">{kicker}</p>
    <h1>{h1}</h1>
    <p class="lede">{lede}</p>
  </div>
</header>
"""
FOOT = """
<footer class="wrap foot">
  <p>Unofficial fan site. Not made by or affiliated with Valve. Deadlock and all hero and item art are © Valve Corporation. Data from <a href="https://deadlock-api.com">deadlock-api.com</a>.</p>
</footer>
{scripts}
</body>
</html>
"""

PAGES = {
    "trends.html": dict(
        title="Deadlock Hero Trends: win rate and pick rate by week", og="Deadlock Hero Trends",
        desc="How every Deadlock hero's win rate and pick rate changed week by week, with patches marked and the biggest risers and fallers.",
        kicker="Trends", h1="Hero trends", lede="Win rate and pick rate for every hero, week by week. Pick up to five heroes to compare. New game patches show as dashed lines.",
        scripts=["snapshot.js", "history.js", "patches.js", "common.js", "trendspage.js"],
        body="""<main class="wrap block">
  <div class="controls">
    <label>Show
      <select id="t-metric"><option value="wr">Win rate</option><option value="pick">Pick rate</option></select>
    </label>
    <label>Ranks
      <select id="t-rank"><option value="all">All ranks</option><option value="high">Oracle and up</option></select>
    </label>
  </div>
  <p class="note" id="t-range"></p>
  <div class="t-chart" id="t-chart"></div>
  <ul class="t-legend" id="t-legend"></ul>
  <div class="duo-cols t-movers" id="t-movers"></div>
  <h3 class="sub-h">Pick heroes</h3>
  <div class="picker" id="t-picker"></div>
  <p class="fine">Rebuilt every Monday from api.deadlock-api.com. Weeks with fewer than 50 games on a hero are left out.</p>
</main>"""),
    "match.html": dict(
        title="Deadlocked Match Review: see what went right and wrong", og="Deadlocked Match Review",
        desc="Paste a Deadlock match ID and compare your souls, damage, deaths and item timings with high-rank players on the same hero.",
        kicker="Match review", h1="Review a match", lede="Paste a match ID to see how your farm, damage, deaths and item timings compare with Oracle-and-up players on the same hero.",
        scripts=["snapshot.js", "items.js", "itemdb.js", "builds.js", "common.js", "matchpage.js"],
        body="""<main class="wrap block">
  <form class="controls" id="m-form" autocomplete="off">
    <label class="grow">Match ID
      <input id="m-q" type="search" inputmode="numeric" placeholder="For example 142461300" required>
    </label>
    <button class="btn" type="submit">Review</button>
  </form>
  <p class="note" id="m-status">The match ID is in the game under Match history, or open <a href="player.html">your player page</a> and press Review on any recent match.</p>
  <section id="m-board"></section>
  <section id="m-review" class="m-review"></section>
</main>"""),
    "tools.html": dict(
        title="Deadlocked Tools: build maker, damage calculator, hero compare, tier list maker", og="Deadlocked Tools",
        desc="Free Deadlock tools: make and share a build, calculate gun damage and time to kill, compare two heroes, draft helper and a tier list maker.",
        kicker="Tools", h1="Tools", lede="Plan builds, check the numbers, and argue about tier lists.",
        scripts=[],
        body="""<main class="wrap block">
  <div class="feature-grid">
    <a class="feature" href="buildmaker.html"><b>Build maker</b><span>Make your own 12-slot build, see its total cost and stats, and share it with a link.</span></a>
    <a class="feature" href="calc.html"><b>Damage calculator</b><span>Gun DPS and time to kill for any hero and items, against any health and bullet resist.</span></a>
    <a class="feature" href="compare.html"><b>Hero compare</b><span>Two heroes side by side: stats, guns, abilities, win rates and how they do against each other.</span></a>
    <a class="feature" href="tiermaker.html"><b>Tier list maker</b><span>Drag heroes into S to F, then share the link or save it as a picture.</span></a>
    <a class="feature" href="draft.html"><b>Draft helper</b><span>Pick both teams. Get the best pick, lane partner and what to buy.</span></a>
    <a class="feature" href="match.html"><b>Match review</b><span>See how a match went against high-rank players on the same hero.</span></a>
    <a class="feature" href="./#drills"><b>Aim drills</b><span>Twelve drills, a daily challenge and a sensitivity converter.</span></a>
  </div>
</main>"""),
    "buildmaker.html": dict(
        title="Deadlock Build Maker: make and share your own build", og="Deadlock Build Maker",
        desc="Make your own Deadlock build: pick up to 12 items, see the total soul cost, stats and gun DPS, and share it with a link.",
        kicker='<a href="tools.html">Tools</a> · Build maker', h1="Build maker", lede="Pick a hero and up to 12 items. Upgrades replace the item they're built from, like in the game. The link updates as you go, so you can share it.",
        scripts=["snapshot.js", "items.js", "itemdb.js", "guides.js", "builds.js", "common.js", "buildmakerpage.js"],
        body="""<main class="wrap block">
  <div class="controls">
    <label>Hero <select id="bm-hero"></select></label>
    <button type="button" class="btn ghost" id="bm-site">Start from the site build</button>
    <button type="button" class="btn ghost" id="bm-clear">Clear</button>
  </div>
  <p class="note" id="bm-msg" aria-live="polite"></p>
  <div class="bm-grid">
    <section>
      <h3>Your build</h3>
      <ol class="bm-list" id="bm-list"></ol>
      <div class="bm-share"><input id="bm-link" readonly aria-label="Link to this build"><button type="button" class="btn" id="bm-copy">Copy link</button></div>
      <p><a id="bm-calc" href="calc.html">Check its damage in the calculator →</a></p>
      <div id="bm-sum"></div>
    </section>
    <section>
      <h3>Shop</h3>
      <div class="controls">
        <div class="q-modes" id="bm-tabs"><button type="button" class="side on" data-slot="weapon">Weapon</button><button type="button" class="side" data-slot="vitality">Vitality</button><button type="button" class="side" data-slot="spirit">Spirit</button></div>
        <label class="grow">Search <input id="bm-find" type="search" placeholder="Item name"></label>
      </div>
      <div class="bm-cat" id="bm-cat"></div>
      <p class="fine">Letters are the grades from the <a href="items.html">item tier list</a>.</p>
    </section>
  </div>
</main>"""),
    "calc.html": dict(
        title="Deadlock Damage Calculator: gun DPS and time to kill", og="Deadlock Damage Calculator",
        desc="Work out a Deadlock hero's gun DPS, magazine damage and time to kill with any weapon items, against any health and bullet resist.",
        kicker='<a href="tools.html">Tools</a> · Damage calculator', h1="Damage calculator", lede="Gun DPS and time to kill for any hero. Tick the items you have, set the target, and see the difference.",
        scripts=["snapshot.js", "items.js", "itemdb.js", "guides.js", "common.js", "calcpage.js"],
        body="""<main class="wrap block">
  <div class="controls">
    <label>Your hero <select id="c-hero"></select></label>
    <label>Both heroes at
      <select id="c-lvl"><option value="0">Start of the game</option><option value="10">Level 10 (about 8 min)</option><option value="20" selected>Level 20 (about 20 min)</option><option value="30">Level 30 (late game)</option><option value="35">Max level</option></select>
    </label>
    <label>Target <select id="c-target"></select></label>
    <label>Target health <input id="c-hp" type="number" min="1" step="50" value="1500"></label>
    <label>Target bullet resist % <input id="c-res" type="number" min="-50" max="90" step="1" value="0"></label>
  </div>
  <div id="c-out"></div>
  <div class="block-head c-head"><h3>Weapon items</h3><button type="button" class="btn ghost" id="c-clear">Clear items</button></div>
  <div class="c-items" id="c-items"></div>
</main>"""),
    "compare.html": dict(
        title="Deadlock Hero Compare: two heroes side by side", og="Deadlock Hero Compare",
        desc="Compare two Deadlock heroes: health, speed, gun, abilities, win rate, skill tier and how they do against each other.",
        kicker='<a href="tools.html">Tools</a> · Hero compare', h1="Hero compare", lede="Two heroes side by side, with the head-to-head from real matches.",
        scripts=["snapshot.js", "guides.js", "tiers.js", "roles.js", "history.js", "common.js", "comparepage.js"],
        body="""<main class="wrap block">
  <div class="controls">
    <label>Hero <select id="c-a"></select></label>
    <button type="button" class="btn ghost swap" id="c-swap" aria-label="Swap heroes">⇄</button>
    <label>Against <select id="c-b"></select></label>
  </div>
  <div id="c-out"></div>
</main>"""),
    "tiermaker.html": dict(
        title="Deadlock Tier List Maker: rank the heroes yourself", og="Deadlock Tier List Maker",
        desc="Make your own Deadlock hero tier list from S to F. Drag heroes into rows, then share the link or save it as a picture.",
        kicker='<a href="tools.html">Tools</a> · Tier list maker', h1="Tier list maker", lede="Drag heroes into the rows (on a phone, tap a hero, then tap a row). It saves in this browser, and the link always shows your current list.",
        scripts=["snapshot.js", "common.js", "tiermakerpage.js"],
        body="""<main class="wrap block">
  <div class="controls">
    <label class="grow">Title <input id="tm-title" type="search" maxlength="60" placeholder="My Deadlock tier list"></label>
    <button type="button" class="btn" id="tm-png">Save picture</button>
    <button type="button" class="btn ghost" id="tm-copy">Copy link</button>
    <button type="button" class="btn ghost" id="tm-site">Fill by win rate</button>
    <button type="button" class="btn ghost" id="tm-reset">Start over</button>
  </div>
  <p class="note" id="tm-msg" aria-live="polite"></p>
  <div class="tm-board" id="tm-board"></div>
  <h3 class="sub-h">Heroes not placed yet</h3>
  <div class="tm-pool tm-drop" id="tm-pool"></div>
</main>"""),
}


def main():
    site = sys.argv[1]
    for name, p in PAGES.items():
        html = HEAD.format(site=SITE, url=SITE + name, nav=nav(name), **{k: p[k] for k in ("title", "desc", "og", "kicker", "h1", "lede")})
        html += "\n" + p["body"] + "\n" + FOOT.format(scripts="\n".join(f'<script src="{s}"></script>' for s in p["scripts"]))
        open(os.path.join(site, name), "w", encoding="utf-8", newline="\n").write(html)
    # New nav on every page.
    for f in os.listdir(site):
        if f.endswith(".html") and f not in ("404.html", "aim.html"):
            path = os.path.join(site, f)
            s = open(path, encoding="utf-8").read()
            s2 = re.sub(r'<nav aria-label="Site">.*?</nav>', nav(f), s, count=1, flags=re.S)
            if s2 != s:
                open(path, "w", encoding="utf-8", newline="\n").write(s2)
    print("pages written")


if __name__ == "__main__":
    main()
