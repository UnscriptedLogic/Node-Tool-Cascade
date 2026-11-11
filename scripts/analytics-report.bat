@echo off
setlocal
rem Prints how Cascade is being used, from the anonymous counts in Cloudflare Workers Analytics Engine.
rem
rem   Double-click it, or run:  scripts\analytics-report.bat [prod|dev] [days]
rem
rem It needs your Cloudflare account id and an API token with "Account > Account Analytics > Read".
rem It looks for them in scripts\analytics.local.env (never committed). If they are missing it asks, and
rem the token is typed hidden. You can choose to save them to that file for next time.

cd /d "%~dp0.."
set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=prod"
set "DAYS=%~2"
if "%DAYS%"=="" set "DAYS=7"
set "SAVED=%~dp0analytics.local.env"

if exist "%SAVED%" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%SAVED%") do (
    if /i "%%A"=="CLOUDFLARE_ACCOUNT_ID" set "CLOUDFLARE_ACCOUNT_ID=%%B"
    if /i "%%A"=="CLOUDFLARE_API_TOKEN" set "CLOUDFLARE_API_TOKEN=%%B"
  )
)

set "ASKED="
if "%CLOUDFLARE_ACCOUNT_ID%"=="" (
  set "CLOUDFLARE_ACCOUNT_ID=e86a4c5eb0682ac2e9544d53ab287600"
)
if "%CLOUDFLARE_API_TOKEN%"=="" (
  set "ASKED=1"
  echo No saved API token. Paste a token with "Account Analytics: Read" and press Enter. It will not be shown.
  for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "$s = Read-Host 'API token' -AsSecureString; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))"`) do set "CLOUDFLARE_API_TOKEN=%%T"
)
if "%CLOUDFLARE_API_TOKEN%"=="" (
  echo No token given, so there is nothing to read.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install it from https://nodejs.org and try again.
  pause
  exit /b 1
)

echo.
node scripts\analytics-report.js --env %TARGET% --days %DAYS%
echo.

if defined ASKED call :offer_save
pause
exit /b 0

:offer_save
set "SAVEIT="
set /p "SAVEIT=Save the account id and token for next time in scripts\analytics.local.env? (y/N) "
if /i not "%SAVEIT%"=="y" exit /b 0
> "%SAVED%" echo # Local only. Ignored by git. Delete this file to forget the token.
>> "%SAVED%" echo CLOUDFLARE_ACCOUNT_ID=%CLOUDFLARE_ACCOUNT_ID%
>> "%SAVED%" echo CLOUDFLARE_API_TOKEN=%CLOUDFLARE_API_TOKEN%
echo Saved.
exit /b 0
