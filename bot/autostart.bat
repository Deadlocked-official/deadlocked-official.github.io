@echo off
rem Started by Windows when you log in (shortcut in your Startup folder).
rem Keeps the bot running: if it stops (for example no internet yet), it tries again after 30 seconds.
title Deadlocked bot
cd /d "%~dp0"
if not exist .env exit /b 1
if not exist .venv (
  python -m venv .venv || exit /b 1
  .venv\Scripts\python -m pip install -r requirements.txt
)
:loop
echo Starting the Deadlocked bot. Close this window to stop it.
.venv\Scripts\python bot.py
echo The bot stopped. Trying again in 30 seconds...
timeout /t 30 /nobreak >nul
goto loop
