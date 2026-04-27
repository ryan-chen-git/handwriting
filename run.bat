@echo off
REM Handwriting Test Compile — Windows launcher (no visible console).
REM Uses pythonw.exe so the server runs in the background; errors show
REM up in the browser as a preflight page or as a Windows message box.

cd /d "%~dp0"

set "PYW="
if exist "venv\Scripts\pythonw.exe" (
    set "PYW=venv\Scripts\pythonw.exe"
) else (
    where pythonw >nul 2>nul && set "PYW=pythonw"
)

if "%PYW%"=="" (
    echo Could not find pythonw.exe. Install Python 3.10+ from https://python.org
    echo and make sure "Add Python to PATH" is checked during install.
    pause
    exit /b 1
)

start "" /B "%PYW%" scripts\compile_server.py
