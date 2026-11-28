"""Deadlocked Discord bot: slash commands that answer from the Deadlocked website's data.

Commands: /build /counter /guide /tier /item /meta /patch /player /quiz
          /weekly-here (post "What changed" in this channel every Monday) and /weekly-stop

Setup: see README.md. The bot token goes in a file called .env next to this file:  DISCORD_TOKEN=...
"""
import asyncio, datetime, json, os, pathlib

import discord
from discord import app_commands
from discord.ext import tasks

import botdata

HERE = pathlib.Path(__file__).parent
STATE = HERE / "state.json"
BRASS = 0xC9A45C


def read_env():
    env = HERE / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


def load_state():
    try:
        return json.loads(STATE.read_text(encoding="utf-8"))
    except Exception:
        return {"channels": [], "last_week": None}


def save_state(s):
    STATE.write_text(json.dumps(s), encoding="utf-8")


def embed(d):
    e = discord.Embed(title=d["title"][:256], url=d.get("url"), description=(d.get("description") or "")[:4000], color=BRASS)
    for name, value in d.get("fields", []):
        e.add_field(name=name[:256], value=(value or "–")[:1024], inline=False)
    if d.get("thumb"):
        e.set_thumbnail(url=d["thumb"])
    e.set_footer(text=d.get("footer") or "Deadlocked · deadlocked-official.github.io")
    return e


class Bot(discord.Client):
    def __init__(self):
        super().__init__(intents=discord.Intents.default())
        self.tree = app_commands.CommandTree(self)
        self.data = None

    async def setup_hook(self):
        self.data = await asyncio.to_thread(botdata.Data)
        await self.tree.sync()
        self.refresh.start()
        self.weekly.start()

    @tasks.loop(hours=6)
    async def refresh(self):
        try:
            self.data = await asyncio.to_thread(botdata.Data)
        except Exception as e:
            print("data refresh failed:", e)

    @tasks.loop(minutes=30)
    async def weekly(self):
        now = datetime.datetime.now(datetime.timezone.utc)
        week = now.strftime("%G-W%V")
        state = load_state()
        # The website rebuilds Monday 06:00 UTC; post from 08:00 to give it time.
        if now.weekday() != 0 or now.hour < 8 or state.get("last_week") == week or not state["channels"]:
            return
        await asyncio.to_thread(self.data.load)
        d = self.data.weekly()
        if d:
            for cid in state["channels"]:
                ch = self.get_channel(cid)
                if ch:
                    try:
                        await ch.send(embed=embed(d))
                    except discord.HTTPException as e:
                        print("couldn't post to", cid, e)
        state["last_week"] = week
        save_state(state)

    @weekly.before_loop
    @refresh.before_loop
    async def ready_first(self):
        await self.wait_until_ready()


bot = Bot()


async def hero_names(_: discord.Interaction, current: str):
    names = bot.data.hero_names() if bot.data else []
    cur = current.lower()
    return [app_commands.Choice(name=n, value=n) for n in names if cur in n.lower()][:25]


async def item_names(_: discord.Interaction, current: str):
    names = sorted(v[0] for v in bot.data.items.values()) if bot.data else []
    cur = current.lower()
    return [app_commands.Choice(name=n, value=n) for n in names if cur in n.lower()][:25]


async def hero_answer(inter, name, fn):
    h = bot.data.find_hero(name)
    if not h:
        await inter.response.send_message(f"I don't know a hero called **{name}**. Start typing and pick from the list.", ephemeral=True)
        return
    d = fn(h)
    if not d:
        await inter.response.send_message(f"No data for {h['name']} yet.", ephemeral=True)
        return
    await inter.response.send_message(embed=embed(d))


@bot.tree.command(name="build", description="The data-made build for a hero, with skill order and what to sell")
@app_commands.autocomplete(hero=hero_names)
async def build_cmd(inter: discord.Interaction, hero: str):
    await hero_answer(inter, hero, bot.data.build)


@bot.tree.command(name="counter", description="A hero's hardest and easiest matchups, plus counter items")
@app_commands.autocomplete(hero=hero_names)
async def counter_cmd(inter: discord.Interaction, hero: str):
    await hero_answer(inter, hero, bot.data.counters_for)


@bot.tree.command(name="guide", description="How to play a hero: role, playstyle and abilities")
@app_commands.autocomplete(hero=hero_names)
async def guide_cmd(inter: discord.Interaction, hero: str):
    await hero_answer(inter, hero, bot.data.guide)


@bot.tree.command(name="tier", description="How much practice a hero takes (leave empty for the full list)")
@app_commands.autocomplete(hero=hero_names)
async def tier_cmd(inter: discord.Interaction, hero: str = None):
    if hero:
        await hero_answer(inter, hero, bot.data.tier)
    else:
        await inter.response.send_message(embed=embed(bot.data.tier()))


@bot.tree.command(name="item", description="An item's grade, stats and who buys it")
@app_commands.autocomplete(name=item_names)
async def item_cmd(inter: discord.Interaction, name: str):
    iid = bot.data.find_item(name)
    if not iid:
        await inter.response.send_message(f"I don't know an item called **{name}**.", ephemeral=True)
        return
    await inter.response.send_message(embed=embed(bot.data.item(iid)))


@bot.tree.command(name="meta", description="The heroes winning most right now")
async def meta_cmd(inter: discord.Interaction):
    await inter.response.defer()
    try:
        await inter.followup.send(embed=embed(await asyncio.to_thread(bot.data.meta)))
    except Exception:
        await inter.followup.send("The live stats couldn't be reached. Try again in a minute.")


@bot.tree.command(name="patch", description="What changed in the latest game patch")
async def patch_cmd(inter: discord.Interaction):
    await inter.response.send_message(embed=embed(bot.data.patch()))


@bot.tree.command(name="player", description="Look up a player by Steam name")
async def player_cmd(inter: discord.Interaction, steam_name: str):
    await inter.response.defer()
    try:
        d = await asyncio.to_thread(bot.data.player, steam_name)
    except Exception:
        d = None
    if d:
        await inter.followup.send(embed=embed(d))
    else:
        await inter.followup.send(f"No player found for **{steam_name}**, or their match history is private.")


@bot.tree.command(name="quiz", description="Today's hero quiz and aim challenge")
async def quiz_cmd(inter: discord.Interaction):
    await inter.response.send_message(embed=embed(bot.data.quiz()))


@bot.tree.command(name="weekly-here", description="Post 'What changed this week' in this channel every Monday")
@app_commands.default_permissions(manage_guild=True)
async def weekly_here(inter: discord.Interaction):
    s = load_state()
    if inter.channel_id not in s["channels"]:
        s["channels"].append(inter.channel_id)
        save_state(s)
    await inter.response.send_message("Done. Every Monday I'll post what changed this week in this channel.", ephemeral=True)


@bot.tree.command(name="weekly-stop", description="Stop the Monday posts in this channel")
@app_commands.default_permissions(manage_guild=True)
async def weekly_stop(inter: discord.Interaction):
    s = load_state()
    s["channels"] = [c for c in s["channels"] if c != inter.channel_id]
    save_state(s)
    await inter.response.send_message("Stopped the Monday posts here.", ephemeral=True)


if __name__ == "__main__":
    read_env()
    token = os.environ.get("DISCORD_TOKEN")
    if not token:
        raise SystemExit("No DISCORD_TOKEN found. Put it in a file called .env next to bot.py (see README.md).")
    bot.run(token)
