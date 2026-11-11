@echo off
rem Opens the Cascade admin dashboard (usage charts) in your browser. Double-click it.
rem It runs a small server on this computer only; close this window to stop it.
rem Add --demo to look at made-up numbers without a Cloudflare token:  scripts\admin.bat --demo
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install it from https://nodejs.org and try again.
  pause
  exit /b 1
)
node scripts\admin\server.js --open %*
pause
