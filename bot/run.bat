@echo off
rem Starts the Deadlocked Discord bot. The first run sets up its own Python environment.
cd /d "%~dp0"
if not exist .env (
  echo No .env file yet. Copy .env.example to .env and paste your bot token into it.
  pause
  exit /b 1
)
if not exist .venv (
  echo Setting up the bot for the first time...
  python -m venv .venv || (echo Python wasn't found. Install it from python.org first. & pause & exit /b 1)
  .venv\Scripts\python -m pip install -r requirements.txt
)
echo Starting the Deadlocked bot. Close this window to stop it.
.venv\Scripts\python bot.py
pause
