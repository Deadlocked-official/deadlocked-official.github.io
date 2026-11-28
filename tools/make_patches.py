"""Patch tracker: find which hero, weapon, ability and item numbers changed between game versions.

Keeps a compact copy of the game's values in data/gamestate.json and a list of patches in patches.js.
  * First run (no gamestate yet): walks back through the last --history game versions and records every
    version where a value changed, so the page has past patches straight away.
  * Later runs: compares the newest game version with the saved copy and adds a patch entry if anything changed.

Usage: python tools/make_patches.py <site_dir> [--history 25]
"""
import json, os, re, sys, time, urllib.request

API = "https://api.deadlock-api.com"
UA = {"User-Agent": "deadlocked-site-patches/1.0"}
UNITS_PER_METER = 39.37
KEEP = 40  # patches kept on the page
HERO_STATS = {"max_health": "Health", "base_health_regen": "Health regen", "max_move_speed": "Move speed", "sprint_speed": "Sprint speed",
              "stamina": "Stamina", "light_melee_damage": "Light melee", "heavy_melee_damage": "Heavy melee", "reload_speed": "Reload speed"}
WEAPON = {"bullet_damage": "Bullet damage", "clip_size": "Magazine", "reload_duration": "Reload time", "cycle_time": "Time between shots",
          "bullets": "Pellets", "damage_falloff_start_range": "Falloff start", "damage_falloff_end_range": "Falloff end"}


def get(path):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(API + path, headers=UA), timeout=180) as r:
                return json.load(r)
        except Exception:
            if i == 2:
                raise
            time.sleep(5)


def val(v):
    if isinstance(v, dict):
        v = v.get("value")
    if v is None or isinstance(v, (list, dict)):
        return None
    s = str(v).strip()
    return s if re.search(r"\d", s) else None


def props(obj, abilities=False):
    out = {}
    for name, p in (obj.get("properties") or {}).items():
        if not isinstance(p, dict):
            continue
        label = (p.get("label") or "").strip()
        if not label and not (abilities and name.startswith("Ability") and name in ("AbilityCooldown", "AbilityDuration", "AbilityCastRange", "AbilityCharges")):
            continue
        v = val(p)
        if v is None or v in ("0", "0.0"):
            continue
        out[name] = [label or re.sub(r"(?<!^)(?=[A-Z])", " ", name.replace("Ability", "")).strip(), v]
    for t, up in enumerate(obj.get("upgrades") or []):
        for pu in up.get("property_upgrades") or []:
            label = ((obj.get("properties") or {}).get(pu.get("name")) or {}).get("label") or re.sub(r"(?<!^)(?=[A-Z])", " ", pu.get("name", ""))
            out[f"T{t + 1}:{pu.get('name')}"] = [f"Upgrade {t + 1}: {label}", str(pu.get("bonus"))]
    return out


def snapshot(version):
    heroes = [h for h in get(f"/v1/assets/heroes?client_version={version}&only_active=true") if h.get("player_selectable") and not h.get("disabled")]
    items = get(f"/v1/assets/items?client_version={version}")
    by_class = {i.get("class_name"): i for i in items}
    state = {"version": version, "heroes": {}, "items": {}}
    for h in heroes:
        ss = h.get("starting_stats") or {}
        hs = {}
        for k, label in HERO_STATS.items():
            v = val(ss.get(k))
            if v is not None:
                hs[k] = [label, v]
        w = (by_class.get((h.get("items") or {}).get("weapon_primary")) or {}).get("weapon_info") or {}
        for k, label in WEAPON.items():
            v = w.get(k)
            if v is None:
                continue
            if "range" in k:
                v = round(float(v) / UNITS_PER_METER, 1)
            hs["w:" + k] = [label, str(round(float(v), 3)) if isinstance(v, (int, float)) else str(v)]
        abil = {}
        for slot in ("signature1", "signature2", "signature3", "signature4"):
            a = by_class.get((h.get("items") or {}).get(slot))
            if a:
                abil[a.get("name")] = props(a, abilities=True)
        state["heroes"][h["name"]] = {"stats": hs, "abilities": abil}
    for i in items:
        if i.get("type") == "upgrade" and i.get("shopable") and not i.get("disabled"):
            p = props(i)
            p["cost"] = ["Cost", str(i.get("cost"))]
            state["items"][i["name"]] = p
    return state


def diff_props(a, b):
    out = []
    for k in sorted(set(a) | set(b)):
        if k in a and k in b and a[k][1] != b[k][1]:
            out.append([b[k][0], a[k][1], b[k][1]])
        elif k in b and k not in a:
            out.append([b[k][0], None, b[k][1]])
        elif k in a and k not in b:
            out.append([a[k][0], a[k][1], None])
    return out


def diff(old, new):
    ch = {"version": new["version"], "from": old["version"], "heroes": {}, "items": {}, "new_heroes": [], "new_items": [], "removed_items": []}
    for name, h in new["heroes"].items():
        o = old["heroes"].get(name)
        if not o:
            ch["new_heroes"].append(name)
            continue
        entry = {}
        s = diff_props(o["stats"], h["stats"])
        if s:
            entry["stats"] = s
        for ab, p in h["abilities"].items():
            d = diff_props(o["abilities"].get(ab, {}), p) if ab in o["abilities"] else [["New ability", None, ab]]
            if d:
                entry.setdefault("abilities", {})[ab] = d
        if entry:
            ch["heroes"][name] = entry
    for name, p in new["items"].items():
        o = old["items"].get(name)
        if o is None:
            ch["new_items"].append(name)
        else:
            d = diff_props(o, p)
            if d:
                ch["items"][name] = d
    ch["removed_items"] = [n for n in old["items"] if n not in new["items"]]
    return ch


def empty(ch):
    return not (ch["heroes"] or ch["items"] or ch["new_heroes"] or ch["new_items"] or ch["removed_items"])


def main():
    site = sys.argv[1]
    history = int(sys.argv[sys.argv.index("--history") + 1]) if "--history" in sys.argv else 25
    state_path = os.path.join(site, "data", "gamestate.json")
    os.makedirs(os.path.dirname(state_path), exist_ok=True)
    pfile = os.path.join(site, "patches.js")
    patches = []
    if os.path.exists(pfile):
        patches = json.loads(open(pfile, encoding="utf-8").read().split("window.PATCHES = ", 1)[1].strip().rstrip(";"))["patches"]
    versions = get("/v1/assets/client-versions")
    latest = versions[-1]
    today = time.strftime("%Y-%m-%d")
    if os.path.exists(state_path):
        old = json.load(open(state_path, encoding="utf-8"))
        if old.get("version") == latest:
            print("no new game version (", latest, ")")
            return
        new = snapshot(latest)
        ch = diff(old, new)
        if not empty(ch):
            ch["found"] = today
            patches.insert(0, ch)
        json.dump(new, open(state_path, "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
    else:
        walk = versions[-history:]
        prev = None
        for v in walk:
            try:
                cur = snapshot(v)
            except Exception as e:
                print("skip version", v, e)
                continue
            if prev:
                ch = diff(prev, cur)
                if not empty(ch):
                    ch["found"] = None
                    patches.insert(0, ch)
            prev = cur
            print("version", v, flush=True)
        json.dump(prev, open(state_path, "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
    patches = patches[:KEEP]
    open(pfile, "w", encoding="utf-8").write(
        "// Game value changes between versions, made by tools/make_patches.py from api.deadlock-api.com.\n"
        "window.PATCHES = " + json.dumps({"checked": today, "latest": latest, "patches": patches}, separators=(",", ":"), ensure_ascii=False) + ";\n")
    print(len(patches), "patches recorded; latest version", latest)


if __name__ == "__main__":
    main()
