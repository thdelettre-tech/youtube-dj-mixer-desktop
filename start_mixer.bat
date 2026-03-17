@echo off
echo Démarrage du NEOMIXER (Electron)...
set "ELECTRON_RUN_AS_NODE="
cd /d "%~dp0"
call npm start
pause
