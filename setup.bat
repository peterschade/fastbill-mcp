@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: ============================================================
::  Fastbill MCP — Installations-Skript (Windows)
::  Dieses Skript richtet den Fastbill MCP Server fuer die
::  Claude Desktop App ein. Einfach ausfuehren und den
::  Anweisungen folgen.
:: ============================================================

echo.
echo ========================================
echo   Fastbill MCP — Installation
echo ========================================
echo.

:: -----------------------------------------------------------
:: 1. Check Node.js
:: -----------------------------------------------------------
echo [1/5] Pruefe ob Node.js installiert ist...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo X  Node.js ist nicht installiert.
    echo.
    echo    Bitte installiere Node.js:
    echo    https://nodejs.org ^(LTS-Version herunterladen^)
    echo.
    echo    Nach der Installation dieses Skript erneut starten.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo OK  Node.js %NODE_VERSION% gefunden
echo.

:: -----------------------------------------------------------
:: 2. Install dependencies
:: -----------------------------------------------------------
echo [2/5] Installiere Abhaengigkeiten...

cd /d "%~dp0"

call npm install --silent >nul 2>&1
if %errorlevel% neq 0 (
    echo X  npm install fehlgeschlagen.
    pause
    exit /b 1
)
echo OK  Abhaengigkeiten installiert
echo.

:: -----------------------------------------------------------
:: 3. Build
:: -----------------------------------------------------------
echo [3/5] Baue den MCP Server...

call npm run build --silent >nul 2>&1
if %errorlevel% neq 0 (
    echo X  Build fehlgeschlagen.
    pause
    exit /b 1
)
echo OK  MCP Server gebaut
echo.

:: -----------------------------------------------------------
:: 4. Fastbill Credentials
:: -----------------------------------------------------------
echo [4/5] Fastbill-Zugangsdaten
echo.
echo   Du findest deinen API-Key in Fastbill unter:
echo   Einstellungen ^> API
echo.

set /p FB_EMAIL="  Fastbill E-Mail-Adresse: "
echo.
set /p FB_API_KEY="  Fastbill API-Key: "
echo.

if "%FB_EMAIL%"=="" (
    echo X  E-Mail ist erforderlich.
    pause
    exit /b 1
)
if "%FB_API_KEY%"=="" (
    echo X  API-Key ist erforderlich.
    pause
    exit /b 1
)

:: -----------------------------------------------------------
:: 5. Claude Desktop Config
:: -----------------------------------------------------------
echo [5/5] Konfiguriere Claude Desktop...

set "CONFIG_DIR=%APPDATA%\Claude"
set "CONFIG_FILE=%CONFIG_DIR%\claude_desktop_config.json"
set "SCRIPT_DIR=%~dp0"

:: Remove trailing backslash and convert to forward slashes for JSON
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "SCRIPT_DIR_JSON=%SCRIPT_DIR:\=/%"

if not exist "%CONFIG_DIR%" (
    echo.
    echo !  Claude Desktop Config-Ordner nicht gefunden.
    echo    Stelle sicher, dass Claude Desktop installiert ist.
    echo.
    echo    Falls du die Konfiguration manuell hinzufuegen moechtest,
    echo    erstelle die Datei:
    echo    %CONFIG_FILE%
    echo.
    pause
    exit /b 1
)

:: Use Node.js to safely create/merge the config
node -e "const fs=require('fs');const path=require('path');const configFile='%CONFIG_FILE:\=\\%';const scriptDir='%SCRIPT_DIR_JSON%';const entry={command:'node',args:[scriptDir+'/dist/index.js'],env:{FASTBILL_EMAIL:'%FB_EMAIL%',FASTBILL_API_KEY:'%FB_API_KEY%'}};let config;try{config=JSON.parse(fs.readFileSync(configFile,'utf8'))}catch(e){config={}}if(!config.mcpServers)config.mcpServers={};config.mcpServers.fastbill=entry;fs.writeFileSync(configFile,JSON.stringify(config,null,2));console.log('OK  Fastbill zur Claude Desktop Konfiguration hinzugefuegt')"

if %errorlevel% neq 0 (
    echo X  Konfiguration konnte nicht geschrieben werden.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Installation abgeschlossen!
echo ========================================
echo.
echo   Naechster Schritt:
echo   Claude Desktop neu starten
echo.
echo   Danach stehen dir 48 Fastbill-Tools zur Verfuegung:
echo   Kunden, Rechnungen, Angebote, Artikel, Projekte,
echo   Zeiterfassung, Ausgaben, Einnahmen, Webhooks u.v.m.
echo.
pause
