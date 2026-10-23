@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 ou superior nao foi encontrado. Instale o Node e abra este arquivo novamente.
  pause
  exit /b 1
)
if not exist ".robot-data\config.json" (
  node scripts\robot-setup.mjs
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
node scripts\robot-start.mjs
if errorlevel 1 pause
