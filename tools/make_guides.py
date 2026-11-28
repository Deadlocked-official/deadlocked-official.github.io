"""Write guides.js: each hero's official role and playstyle, base stats, weapon and abilities (with upgrades),
straight from the game data on api.deadlock-api.com.

Usage: python tools/make_guides.py <site_dir>
"""
import html, json, os, re, sys, time, urllib.request

API = "https://api.deadlock-api.com"
UA = {"User-Agent": "deadlocked-site-guides/1.0"}
UNITS_PER_METER = 39.37  # the game measures distance in inches
NOT_DAMAGE = {"AbilityCooldown", "AbilityDuration", "AbilityCastRange", "AbilityChannelTime", "AbilityCastDelay",
              "AbilityCharges", "AbilityCooldownBetweenCharge", "Radius", "AbilityUnitTargetLimit"}


def get(path):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(API + path, headers=UA), timeout=180) as r:
                return json.load(r)
        except Exception:
            if i == 2:
                raise
            time.sleep(5)


def clean(text):
    text = re.sub(r"<svg.*?</svg>", "", text or "", flags=re.S)
    text = re.sub(r"<br\s*/?>", " · ", text)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip(" ·")


def sentences(text, n):
    parts = re.split(r"(?<=[.!?])\s+", clean(text))
    return " ".join(parts[:n])


def stat(ss, key):
    v = (ss or {}).get(key)
    return v.get("value") if isinstance(v, dict) else v


def num(v):
    try:
        return float(re.sub(r"[^\d.\-]", "", str(v)))
    except ValueError:
        return None


def upgrade_text(a, tier):
    """Text for an ability upgrade: the game's own description, or built from the upgrade's real values."""
    desc = (a.get("description") or {}).get(("t1_desc", "t2_desc", "t3_desc")[tier])
    if desc and clean(desc):
        return clean(desc)
    ups = a.get("upgrades") or []
    if tier >= len(ups):
        return ""
    props = a.get("properties") or {}
    parts = []
    for pu in ups[tier].get("property_upgrades") or []:
        p = props.get(pu.get("name")) or {}
        label = p.get("label") or re.sub(r"(?<!^)(?=[A-Z])", " ", pu.get("name", "")).replace("Ability ", "")
        bonus = str(pu.get("bonus", ""))
        post = p.get("postfix") or ""
        if post and bonus.endswith(post):
            post = ""
        sign = "" if bonus.startswith("-") else "+"
        parts.append(f"{sign}{bonus}{post} {label}".strip())
    return " · ".join(parts)


def main():
    site = sys.argv[1]
    heroes = [h for h in get("/v1/assets/heroes") if h.get("player_selectable") and not h.get("disabled")]
    abilities = {a["class_name"]: a for a in get("/v1/assets/items/by-type/ability")}
    weapons = {w["class_name"]: w for w in get("/v1/assets/items/by-type/weapon")}
    out = {}
    for h in heroes:
        d = h.get("description") or {}
        ss = h.get("starting_stats") or {}
        items = h.get("items") or {}
        w = weapons.get(items.get("weapon_primary")) or {}
        wi = w.get("weapon_info") or {}
        weapon = None
        lvl = h.get("standard_level_up_upgrades") or {}
        boons = sum(1 for v in (h.get("level_info") or {}).values() if isinstance(v, dict) and v.get("use_standard_upgrade"))
        if wi:
            weapon = {
                "name": w.get("name"),
                "dps": round(num(wi.get("damage_per_second")) or 0, 1),
                "per_shot": round(num(wi.get("damage_per_shot")) or num(wi.get("bullet_damage")) or 0, 1),
                "pellets": int(num(wi.get("bullets")) or 1),
                "clip": int(num(wi.get("clip_size")) or 0),
                "reload": round(num(wi.get("reload_duration")) or 0, 2),
                "falloff_m": round((num(wi.get("damage_falloff_start_range")) or 0) / UNITS_PER_METER),
                "shots_per_s": round(num(wi.get("shots_per_second")) or 0, 2),
                # Each level-up (boon) adds this much damage per bullet, so per shot it's times the pellets.
                "dmg_lvl": round((num(lvl.get("MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL")) or 0) * int(num(wi.get("bullets")) or 1), 3),
            }
        kit = []
        for n, slot in enumerate(("signature1", "signature2", "signature3", "signature4")):
            a = abilities.get(items.get(slot))
            if not a:
                continue
            desc = a.get("description") or {}
            props = a.get("properties") or {}
            spirit = False
            for pn, p in props.items():
                f = p.get("scale_function") if isinstance(p, dict) else None
                if pn not in NOT_DAMAGE and isinstance(f, dict) and f.get("specific_stat_scale_type") == "ETechPower" and (f.get("stat_scale") or 0) > 0:
                    spirit = True
            cd = props.get("AbilityCooldown", {}).get("value") if isinstance(props.get("AbilityCooldown"), dict) else None
            kit.append({
                "id": a["id"], "name": a["name"], "img": a.get("image_webp") or a.get("image"),
                "ult": n == 3, "quip": clean(desc.get("quip")), "desc": clean(desc.get("desc")),
                "up": [upgrade_text(a, t) for t in range(3)],
                "cd": num(cd), "spirit": spirit,
            })
        role, playstyle, official = clean(d.get("role")), clean(d.get("playstyle")), True
        if not role:
            role, official = " · ".join(h.get("tags") or []), False
        if not playstyle and kit:
            quips = [k["quip"].rstrip(".") for k in kit if k["quip"]]
            if len(quips) < 3:
                quips = [re.split(r"(?<=[.!?])\s", k["desc"])[0].rstrip(".") for k in kit if k["desc"]]
            if quips:
                playstyle, official = f"{h['name']}'s kit in short: " + "; ".join(q[0].lower() + q[1:] for q in quips) + ".", False
        out[h["id"]] = {
            "name": h["name"], "type": h.get("hero_type"), "tags": h.get("tags") or [], "complexity": h.get("complexity"),
            "role": role, "playstyle": playstyle, "official": official, "lore": sentences(d.get("lore"), 2),
            "stats": {"health": stat(ss, "max_health"), "regen": stat(ss, "base_health_regen"), "speed": stat(ss, "max_move_speed"),
                      "sprint": stat(ss, "sprint_speed"), "stamina": stat(ss, "stamina"),
                      "light_melee": stat(ss, "light_melee_damage"), "heavy_melee": stat(ss, "heavy_melee_damage"),
                      "hp_lvl": num(lvl.get("MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL")) or 0, "boons": boons},
            "weapon": weapon, "kit": kit,
        }
    open(os.path.join(site, "guides.js"), "w", encoding="utf-8").write(
        "// Hero guide data made by tools/make_guides.py from api.deadlock-api.com game data.\n"
        "window.GUIDES = " + json.dumps({"taken": time.strftime("%Y-%m-%d"), "heroes": out}, separators=(",", ":"), ensure_ascii=False) + ";\n")
    print(len(out), "guides", os.path.getsize(os.path.join(site, "guides.js")) // 1024, "KB")


if __name__ == "__main__":
    main()
