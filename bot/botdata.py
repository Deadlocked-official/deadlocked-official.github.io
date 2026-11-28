"""Data for the Deadlocked Discord bot: reads the same files the website uses, plus a few live API calls.

Everything here is plain Python (no Discord code), so it can be tested on its own:
    python botdata.py haze
"""
import json, math, os, re, sys, time, urllib.parse, urllib.request

SITE = "https://deadlocked-official.github.io/"
DATA_FROM = os.environ.get("DEADLOCKED_DATA_URL", SITE)  # where to read the data files (the live site by default)
API = "https://api.deadlock-api.com"
UA = {"User-Agent": "deadlocked-discord-bot/1.0"}
RANKS = ["Obscurus", "Initiate", "Seeker", "Alchemist", "Arcanist", "Ritualist", "Emissary", "Archon", "Oracle", "Phantom", "Ascendant", "Eternus"]
DAY0 = 20781  # daily quiz/drill #1 = 25 Nov 2026


def fetch(url, timeout=60):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read().decode("utf-8")


def get_json(url, timeout=60):
    return json.loads(fetch(url, timeout))


def read_js(name):
    """Turn the site's data files (window.X = {...}; lines) into a dict of variables. A missing file gives {}."""
    try:
        text, out = fetch(DATA_FROM + name), {}
    except Exception as e:
        print(f"couldn't read {name}: {e}")
        return {}
    for m in re.finditer(r"window\.([A-Z_]+)(?:\.([a-z_]+))?\s*=\s*(.+?);\s*$", text, re.M):
        value = json.loads(m.group(3))
        if m.group(2):
            out.setdefault(m.group(1), {})[m.group(2)] = value
        else:
            out[m.group(1)] = value if not isinstance(value, dict) else {**out.get(m.group(1), {}), **value}
    return out


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", re.sub(r"^the\s+", "", name.lower().replace("&", "and"))).strip("-")


def logit(p):
    p = min(0.99, max(0.01, p))
    return math.log(p / (1 - p))


class Data:
    def __init__(self):
        self.loaded = 0
        self.load()

    def load(self):
        snap = read_js("snapshot.js").get("SNAPSHOT")
        if not snap:
            raise RuntimeError("Couldn't load the hero list from the website")
        self.heroes = {h["id"]: h for h in snap["heroes"]}
        self.pairs, self.counters = snap.get("pairs", []), snap.get("counters", [])
        self.items = {int(k): v for k, v in read_js("items.js").get("ITEMS", {}).items()}
        self.builds = {int(k): v for k, v in read_js("builds.js").get("BUILDS", {}).get("builds", {}).items()}
        self.guides = {int(k): v for k, v in read_js("guides.js").get("GUIDES", {}).get("heroes", {}).items()}
        self.tiers = read_js("tiers.js").get("TIERS", {"tiers": []})
        self.itemdb = {int(k): v for k, v in read_js("itemdb.js").get("ITEMDB", {}).get("items", {}).items()}
        self.changes = read_js("changes.js").get("CHANGES", {"first": True})
        self.patches = read_js("patches.js").get("PATCHES", {"patches": []})
        self.tier_of = {h[0]: (t[0], t[1], h[1]) for t in self.tiers["tiers"] for h in t[2]}
        self.loaded = time.time()

    # ---- lookups ----
    def hero_names(self):
        return sorted(h["name"] for h in self.heroes.values())

    def find_hero(self, text):
        t = slug(text or "")
        for h in self.heroes.values():
            if slug(h["name"]) == t:
                return h
        for test in (lambda s: s.startswith(t), lambda s: t in s):  # names that start with it win
            for h in sorted(self.heroes.values(), key=lambda h: h["name"]):
                if t and test(slug(h["name"])):
                    return h
        return None

    def find_item(self, text):
        t = slug(text or "")
        exact = [i for i, v in self.items.items() if slug(v[0]) == t]
        if exact:
            return exact[0]
        near = [i for i, v in self.items.items() if t and t in slug(v[0])]
        return near[0] if near else None

    def item_name(self, iid):
        return self.items.get(iid, ["?"])[0]

    def ability_name(self, hid, aid):
        for a in self.builds.get(hid, {}).get("kit", []):
            if a["id"] == aid:
                return a["name"]
        return "?"

    # ---- answers (each returns a dict the Discord side turns into an embed) ----
    def build(self, hero):
        b, hid = self.builds.get(hero["id"]), hero["id"]
        if not b:
            return None
        fields = []
        if b.get("skill"):
            s = b["skill"][0]
            fields.append(("Skill order", f"Max **{self.ability_name(hid, s[0])}** first ({round(s[1])}% of high-rank players, {s[2]:.1f}% win)"))
        for p in b["phases"]:
            fields.append((p["name"], ", ".join(self.item_name(i[0]) for i in p["items"])))
        if b.get("sells"):
            fields.append(("Sell", ", then ".join(f"{self.item_name(s[0])} ~min {round(s[2])}" for s in b["sells"][:3])))
        return {"title": f"{hero['name']} build", "url": SITE + "builds.html#" + slug(hero["name"]),
                "description": f"**{b['style']} build.** {b['why']}", "fields": fields, "thumb": hero.get("img")}

    def counters_for(self, hero):
        tot = {}
        for a, b, w, m in self.counters:
            t = tot.setdefault(a, [0, 0]); t[0] += w; t[1] += m
        rows = []
        for a, b, w, m in self.counters:
            if a != hero["id"] or b not in self.heroes or m < 500 or b not in tot:
                continue
            exp = 1 / (1 + math.exp(-(logit(tot[a][0] / tot[a][1]) - logit(tot[b][0] / tot[b][1]))))
            rows.append((100 * (w / m - exp), b))
        rows.sort()
        hard = [f"{self.heroes[b]['name']} ({d:+.1f}%)" for d, b in rows[:4] if d < 0]
        easy = [f"{self.heroes[b]['name']} ({d:+.1f}%)" for d, b in reversed(rows[-4:]) if d > 0]
        items = [f"vs {self.heroes[c['enemy']]['name']}: **{self.item_name(c['items'][0][0])}** (+{c['items'][0][2]:.1f}%)"
                 for c in self.builds.get(hero["id"], {}).get("counters", []) if c["items"] and c["enemy"] in self.heroes]
        fields = [("Hard matchups", ", ".join(hard) or "none stand out"), ("Easy matchups", ", ".join(easy) or "none stand out")]
        if items:
            fields.append(("Counter items (high rank)", "\n".join(items)))
        return {"title": f"{hero['name']} matchups", "url": SITE + "stats.html#lookup", "fields": fields, "thumb": hero.get("img"),
                "footer": "Judged against both heroes' normal win rates, last 2 weeks."}

    def guide(self, hero):
        g = self.guides.get(hero["id"])
        if not g:
            return None
        t = self.tier_of.get(hero["name"])
        abil = "\n".join(f"**{k['name']}**{' (ult)' if k['ult'] else ''}: {k['desc'][:140]}" for k in g["kit"])
        fields = [("Abilities", abil[:1020])]
        if t:
            fields.insert(0, ("Skill tier", f"{t[0]} ({t[1]}), {t[2]}/10"))
        return {"title": f"{hero['name']}: {g['role']}", "url": SITE + "guide.html#" + slug(hero["name"]),
                "description": g["playstyle"][:600], "fields": fields, "thumb": hero.get("img")}

    def tier(self, hero=None):
        if hero:
            t = self.tier_of.get(hero["name"])
            return {"title": f"{hero['name']} skill tier", "url": SITE + "stats.html#skill",
                    "description": f"**{t[0]}** ({t[1]} to learn), {t[2]}/10" if t else "No tier yet.", "thumb": hero.get("img")}
        lines = [f"**{t[0]}** ({t[1]}): " + ", ".join(h[0] for h in t[2]) for t in self.tiers["tiers"] if t[2]]
        return {"title": "Skill tiers: how much practice each hero takes", "url": SITE + "stats.html#skill", "description": "\n".join(lines)[:4000]}

    def item(self, iid):
        it, d = self.items[iid], self.itemdb.get(iid, {})
        fields = [("Tier / cost", f"T{it[2]} {it[1]}, {it[3]:,} souls")]
        if d.get("grade"):
            fields.append(("Grade", f"**{d['grade']}** ({d['delta']:+.1f}% vs its tier, {d['wr']:.1f}% win, bought in {d['share']:.1f}% of games)"))
        if d.get("stats"):
            fields.append(("Stats", " · ".join(d["stats"])))
        if d.get("into"):
            fields.append(("Builds into", ", ".join(self.item_name(i) for i in d["into"])))
        if d.get("heroes"):
            fields.append(("Bought most by", ", ".join(f"{self.heroes[h[0]]['name']} ({round(h[1])}%)" for h in d["heroes"][:5] if h[0] in self.heroes)))
        return {"title": it[0], "url": SITE + "items.html#" + slug(it[0]), "description": d.get("effect") or "", "fields": fields, "thumb": it[4]}

    def meta(self):
        since = int(time.time()) - 7 * 86400
        rows = [r for r in get_json(f"{API}/v1/analytics/hero-stats?min_unix_timestamp={since}") if r["hero_id"] in self.heroes and r["matches"]]
        games = sum(r["matches"] for r in rows) / 12 or 1
        rows.sort(key=lambda r: -r["wins"] / r["matches"])
        top = "\n".join(f"{i + 1}. **{self.heroes[r['hero_id']]['name']}** {100 * r['wins'] / r['matches']:.1f}% win · {100 * r['matches'] / games:.0f}% picked" for i, r in enumerate(rows[:8]))
        low = ", ".join(f"{self.heroes[r['hero_id']]['name']} ({100 * r['wins'] / r['matches']:.1f}%)" for r in rows[-3:])
        return {"title": "Meta right now (last 7 days, all ranks)", "url": SITE + "stats.html#meta", "description": top, "fields": [("Weakest", low)]}

    def patch(self):
        ps = self.patches.get("patches") or []
        if not ps:
            return {"title": "Patch tracker", "url": SITE + "patches.html", "description": "No patches recorded yet."}
        p = ps[0]
        lines = []
        for h, e in list(p["heroes"].items())[:8]:
            n = len(e.get("stats", [])) + sum(len(v) for v in e.get("abilities", {}).values())
            first = (e.get("stats") or [next(iter(e.get("abilities", {}).values()), [[None, None, None]])[0]])[0]
            lines.append(f"**{h}**: {first[0]} {first[1]} → {first[2]}" + (f" (+{n - 1} more)" if n > 1 else ""))
        for name, ch in list(p["items"].items())[:5]:
            lines.append(f"**{name}**: {ch[0][0]} {ch[0][1]} → {ch[0][2]}")
        more = len(p["heroes"]) + len(p["items"]) - min(8, len(p["heroes"])) - min(5, len(p["items"]))
        return {"title": f"Latest patch: version {p['version']}", "url": SITE + "patches.html",
                "description": "\n".join(lines) + (f"\n…and {more} more" if more > 0 else ""),
                "footer": f"{len(p['heroes'])} heroes and {len(p['items'])} items changed since version {p['from']}"}

    def quiz(self):
        n = int(time.time() // 86400) - DAY0  # days since 1 Jan 1970 in UTC, same count as the website
        return {"title": f"Daily hero quiz #{n}", "url": SITE + "quiz.html",
                "description": "Guess today's Deadlock hero from its abilities in 6 tries. Same hero for everyone, new one at midnight UTC.\n"
                               f"Today's aim drill challenge: {SITE}#drills"}

    def player(self, name):
        found = get_json(f"{API}/v1/players/steam-search?limit=1&search_query={urllib.parse.quote(name)}")
        if not found:
            return None
        p = found[0]; pid = p["account_id"]
        rank = None
        try:
            rank = get_json(f"{API}/v1/players/{pid}/rank")
        except Exception:
            pass
        hs = [h for h in get_json(f"{API}/v1/players/hero-stats?account_ids={pid}") if h["hero_id"] in self.heroes]
        hs.sort(key=lambda h: -h["matches_played"])
        games, wins = sum(h["matches_played"] for h in hs), sum(h["wins"] for h in hs)
        badge = (rank or {}).get("badge")
        rname = f"{RANKS[badge // 10] if badge // 10 < len(RANKS) else 'Rank'} {badge % 10}" if badge else "Unranked"
        top = "\n".join(f"**{self.heroes[h['hero_id']]['name']}**: {h['matches_played']} games, {100 * h['wins'] / h['matches_played']:.0f}% win" for h in hs[:5])
        return {"title": p["personaname"], "url": SITE + "player.html#" + str(pid), "thumb": p.get("avatarfull"),
                "description": f"**{rname}** · {games:,} games · {100 * wins / games if games else 0:.1f}% win", "fields": [("Most played", top or "No public games")]}

    def weekly(self):
        c = self.changes
        if c.get("first"):
            return None
        lines = [f"**{t[0]}**: {t[1]} → {t[2]} ({t[5]} to learn)" for t in c.get("tiers", [])[:8]]
        b = [self.heroes[x[0]]["name"] for x in c.get("builds", []) if x[0] in self.heroes]
        fields = [("Skill tier moves", "\n".join(lines) or "none")]
        if b:
            fields.append(("Builds updated", ", ".join(b[:15])))
        return {"title": "What changed this week", "url": SITE + "changes.html", "fields": fields}


if __name__ == "__main__":
    d = Data()
    h = d.find_hero(" ".join(sys.argv[1:]) or "haze")
    for fn in (d.build, d.counters_for, d.guide, d.tier):
        print(json.dumps(fn(h), ensure_ascii=False)[:500], "\n")
    print(json.dumps(d.item(d.find_item("swift striker")), ensure_ascii=False)[:400], "\n")
    print(json.dumps(d.patch(), ensure_ascii=False)[:400], "\n")
    print(json.dumps(d.quiz(), ensure_ascii=False), "\n")
    print(json.dumps(d.meta(), ensure_ascii=False)[:400])
