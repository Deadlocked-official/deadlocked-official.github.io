# Deadlocked Discord bot

Slash commands that answer from the Deadlocked website's data, so the bot updates itself whenever the site does.

| Command | What it does |
|---|---|
| `/build hero` | The hero's build: style, skill order, items per phase, what to sell |
| `/counter hero` | Hardest and easiest matchups, plus counter items |
| `/guide hero` | Role, playstyle, skill tier and abilities |
| `/tier [hero]` | How much practice a hero takes, or the whole tier list |
| `/item name` | Grade, stats, upgrades and who buys it |
| `/meta` | Heroes winning most in the last 7 days |
| `/patch` | What changed in the latest game patch |
| `/player steam_name` | Rank and most-played heroes |
| `/quiz` | Today's hero quiz and aim challenge |
| `/weekly-here` | Post "What changed this week" in this channel every Monday (server managers only) |
| `/weekly-stop` | Stop the Monday posts in this channel |

## Set it up (about 10 minutes)

1. Go to <https://discord.com/developers/applications>, click **New Application**, name it **Deadlocked**.
2. Open **Bot** on the left, click **Reset Token**, and copy the token.
3. In this folder, copy `.env.example` to `.env` and paste the token after `DISCORD_TOKEN=`.
   Never share the token or upload `.env` anywhere.
4. Open **OAuth2 → URL Generator**: tick **bot** and **applications.commands**, then under bot permissions tick
   **Send Messages** and **Embed Links**. Open the link it makes and add the bot to your server.
5. Double-click **run.bat**. The first start sets things up, then the bot comes online.
   Slash commands can take a few minutes to show up the first time.

The bot is online while that window is open. To keep it running all the time, it needs to run on a computer or
server that stays on.
