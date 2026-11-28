#!/usr/bin/env bash
# Runs the Deadlocked bot around the clock on a Linux server (for example a free Oracle Cloud VM).
# Run it once from inside the bot folder:   bash linux-setup.sh
# It installs Python if needed, sets up the bot, and makes it start on boot and restart if it crashes.
set -euo pipefail
cd "$(dirname "$0")"
DIR="$(pwd)"
if [ ! -f .env ]; then
  read -rsp "Paste your Discord bot token (it won't show) and press Enter: " TOKEN; echo
  printf 'DISCORD_TOKEN=%s\n' "$TOKEN" > .env
  chmod 600 .env
fi
if ! command -v python3 >/dev/null || ! python3 -m venv --help >/dev/null 2>&1; then
  sudo apt-get update && sudo apt-get install -y python3 python3-venv
fi
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
sudo tee /etc/systemd/system/deadlocked-bot.service >/dev/null <<EOF
[Unit]
Description=Deadlocked Discord bot
After=network-online.target
Wants=network-online.target

[Service]
User=$(whoami)
WorkingDirectory=$DIR
ExecStart=$DIR/.venv/bin/python bot.py
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now deadlocked-bot
sleep 5
systemctl --no-pager status deadlocked-bot | head -n 12
echo
echo "Done. The bot now runs all the time on this server."
echo "See what it's doing:  journalctl -u deadlocked-bot -f"
echo "Restart it:           sudo systemctl restart deadlocked-bot"
