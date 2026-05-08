@echo off
REM Handwriting Test Compile — Windows launcher (no visible console).
REM Uses pythonw.exe so the server runs in the background; errors show
REM up in the browser as a preflight page or as a Windows message box.
REM
REM On first run, creates venv\ and installs requirements.txt. Subsequent
REM runs reuse the existing venv. To force a clean rebuild, delete venv\.

cd /d "%~dp0"

REM Find a system python to bootstrap the venv with.
set "PY="
where py >nul 2>nul && set "PY=py -3"
if "%PY%"=="" (
    where python >nul 2>nul && set "PY=python"
)

if not exist "venv\Scripts\pythonw.exe" (
    if "%PY%"=="" (
        echo Could not find Python 3. Install Python 3.10+ from https://python.org
        echo and check "Add Python to PATH" during install.
        pause
        exit /b 1
    )
    echo Setting up Python venv (first run only)...
    %PY% -m venv venv
    venv\Scripts\python.exe -m pip install --upgrade pip --quiet
    venv\Scripts\python.exe -m pip install -r requirements.txt --quiet
)

start "" /B "venv\Scripts\pythonw.exe" scripts\compile_server.py
