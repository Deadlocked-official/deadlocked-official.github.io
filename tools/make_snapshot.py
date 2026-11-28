"""Write snapshot.js: the hero list (names, pictures) plus a saved copy of the live stats every page falls back to.

Contains: every playable hero with its card picture and last-14-day win/match totals, lane-duo pairs,
hero-vs-hero matchups, and the top 100 of each regional leaderboard. Rebuilt weekly so new heroes appear.

Usage: python tools/make_snapshot.py <site_dir>
"""
import json, os, sys, time, urllib.request

API = "https://api.deadlock-api.com"
UA = {"User-Agent": "deadlocked-site-snapshot/1.0"}


def get(path):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(API + path, headers=UA), timeout=180) as r:
                return json.load(r)
        except Exception:
            if i == 2:
                raise
            time.sleep(5)


def main():
    site = sys.argv[1]
    since = int(time.time()) - 14 * 86400
    heroes = [h for h in get("/v1/assets/heroes") if h.get("player_selectable") and not h.get("disabled")]
    stats = {int(s["hero_id"]): s for s in get(f"/v1/analytics/hero-stats?min_unix_timestamp={since}")}
    out = []
    for h in heroes:
        s = stats.get(int(h["id"]), {})
        im = h.get("images") or {}
        out.append({"id": int(h["id"]), "name": h["name"], "img": im.get("icon_hero_card_webp") or im.get("icon_hero_card"),
                    "wins": s.get("wins", 0), "matches": s.get("matches", 0),
                    "k": s.get("total_kills", 0), "d": s.get("total_deaths", 0), "a": s.get("total_assists", 0)})
    out.sort(key=lambda o: o["name"])
    pairs = [[p["hero_id1"], p["hero_id2"], p["wins"], p["matches_played"]]
             for p in get(f"/v1/analytics/hero-synergy-stats?min_unix_timestamp={since}&same_lane_filter=true&min_matches=500")]
    counters = [[c["hero_id"], c["enemy_hero_id"], c["wins"], c["matches_played"]]
                for c in get(f"/v1/analytics/hero-counter-stats?min_unix_timestamp={since}&same_lane_filter=false&min_matches=500")]
    lb = {}
    for region in ("Europe", "NAmerica", "SAmerica", "Asia", "Oceania"):
        try:
            lb[region] = [[e["rank"], e["account_name"], e.get("top_hero_ids") or []] for e in get(f"/v1/leaderboard/{region}")["entries"][:100]]
        except Exception as e:
            print("leaderboard", region, "failed:", e)
    if len(out) < 20:
        raise SystemExit(f"Only {len(out)} heroes came back; keeping the old snapshot.js")
    data = {"taken": time.strftime("%Y-%m-%d"), "days": 14, "rank": "All ranks", "heroes": out}
    with open(os.path.join(site, "snapshot.js"), "w", encoding="utf-8") as f:
        f.write("// Saved copy of api.deadlock-api.com data: the hero list and a fallback for the live stats. Rebuilt weekly.\n")
        f.write("window.SNAPSHOT = " + json.dumps(data, separators=(",", ":"), ensure_ascii=False) + ";\n")
        f.write("window.SNAPSHOT.pairs = " + json.dumps(pairs, separators=(",", ":")) + ";\n")
        f.write("window.SNAPSHOT.counters = " + json.dumps(counters, separators=(",", ":")) + ";\n")
        f.write("window.SNAPSHOT.leaderboard = " + json.dumps(lb, separators=(",", ":"), ensure_ascii=False) + ";\n")
    print(len(out), "heroes,", len(pairs), "duos,", len(counters), "matchups,", sum(len(v) for v in lb.values()), "leaderboard rows")


if __name__ == "__main__":
    main()
