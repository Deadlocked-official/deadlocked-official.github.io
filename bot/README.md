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
| `/patch-alerts-here` | Post here as soon as a new game patch comes out (server managers only) |
| `/patch-alerts-stop` | Stop the patch posts in this channel |

## Set it up (about 10 minutes)

1. Go to <https://discord.com/developers/applications>, click **New Application**, name it **Deadlocked**.
2. Open **Bot** on the left, click **Reset Token**, and copy the token.
3. In this folder, copy `.env.example` to `.env` and paste the token after `DISCORD_TOKEN=`.
   Never share the token or upload `.env` anywhere.
4. Open **OAuth2 → URL Generator**: tick **bot** and **applications.commands**, then under bot permissions tick
   **Send Messages** and **Embed Links**. Open the link it makes and add the bot to your server.
5. Double-click **run.bat**. The first start sets things up, then the bot comes online.
   Slash commands can take a few minutes to show up the first time.

The bot is online while that window is open. On this PC, `autostart.bat` (in your Startup folder as
"Deadlocked bot") starts it when you log in and restarts it if it stops.

## Keep it online all the time (free cloud server)

Oracle Cloud's "Always Free" plan gives you a small Linux server that never costs anything. Signing up asks for a
card to check you're a real person, but Always Free servers aren't charged.

1. Sign up at <https://www.oracle.com/cloud/free/> and choose the home region closest to you.
2. **Create a VM instance**: keep the default name, pick **Ubuntu** as the image and the **Always Free eligible**
   shape (VM.Standard.E2.1.Micro or Ampere A1). Under SSH keys, choose **Generate a key pair** and download the private key.
3. When it's running, copy its **Public IP address** and connect from PowerShell:
   `ssh -i C:\Users\you\Downloads\the-key.key ubuntu@PUBLIC_IP`
4. On the server, get the bot and run the setup (it asks for your bot token once):
   ```
   git clone https://github.com/Deadlocked-official/deadlocked-official.github.io.git
   cd deadlocked-official.github.io/bot
   bash linux-setup.sh
   ```
5. Once it says Done, turn the bot off on your PC (two copies would answer every command twice): close its window
   and delete "Deadlocked bot" from your Startup folder (Win+R, `shell:startup`).

To update the bot later: `cd deadlocked-official.github.io && git pull && sudo systemctl restart deadlocked-bot`.
