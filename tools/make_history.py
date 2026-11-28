"""Write history.js: each hero's win rate and pick rate week by week, for the Trends page.

Weeks run Monday to Monday (UTC). Past weeks are kept in data/history.json and only missing ones are fetched,
so the first run fills in the last WEEKS weeks and later runs add one week each.
pick = % of matches the hero is in. Two rank groups: all ranks, and Oracle and up (badge 81+).

Usage: python tools/make_history.py <site_dir> [weeks]
"""
import json, os, sys, time, urllib.request

API = "https://api.deadlock-api.com"
UA = {"User-Agent": "deadlocked-site-history/1.0"}
WEEK = 7 * 86400


def get(path):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(API + path, headers=UA), timeout=240) as r:
                return json.load(r)
        except Exception as e:
            if i == 2:
                raise
            print("retry", path, e)
            time.sleep(10)


def week_rows(start, badge):
    q = f"/v1/analytics/hero-stats?min_unix_timestamp={start}&max_unix_timestamp={start + WEEK}"
    if badge:
        q += f"&min_average_badge={badge}"
    rows = get(q)
    total = sum(r["matches"] for r in rows) / 12 or 1  # 12 heroes per match
    return {str(r["hero_id"]): [round(100 * r["wins"] / r["matches"], 2), round(100 * r["matches"] / total, 2), r["matches"]]
            for r in rows if r["matches"] >= 50}


def main():
    site = sys.argv[1]
    weeks = int(sys.argv[2]) if len(sys.argv) > 2 else 16
    path = os.path.join(site, "data", "history.json")
    hist = {"weeks": []}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            hist = json.load(f)
    have = {w["start"] for w in hist["weeks"]}
    now = int(time.time())
    # Last finished Monday 00:00 UTC (Jan 5 1970 was a Monday).
    last_monday = now - (now - 4 * 86400) % WEEK
    starts = [last_monday - WEEK * i for i in range(weeks, 0, -1)]
    for s in starts:
        if s in have:
            continue
        try:
            w = {"start": s, "date": time.strftime("%Y-%m-%d", time.gmtime(s)), "all": week_rows(s, 0), "high": week_rows(s, 81)}
        except Exception as e:
            print("week", s, "failed:", e)
            continue
        if len(w["all"]) < 20:
            print("week", w["date"], "has too few heroes, skipped")
            continue
        hist["weeks"].append(w)
        print("added week", w["date"], len(w["all"]), "heroes")
    hist["weeks"].sort(key=lambda w: w["start"])
    hist["weeks"] = hist["weeks"][-52:]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(hist, f, separators=(",", ":"))
    with open(os.path.join(site, "history.js"), "w", encoding="utf-8") as f:
        f.write("// Weekly hero win rate and pick rate, made by tools/make_history.py. hero id -> [win %, pick %, matches]\n")
        f.write("window.HISTORY = " + json.dumps({"updated": time.strftime("%Y-%m-%d"), "weeks": hist["weeks"]}, separators=(",", ":")) + ";\n")
    print(len(hist["weeks"]), "weeks saved")


if __name__ == "__main__":
    main()
