@echo off
title CampusSync Attendance Server Launcher
echo ====================================================
echo Starting CampusSync Server in Persistent Mode...
echo ====================================================
cd /d "%~dp0server"
if not exist node_modules (
    echo Installing server dependencies...
    call npm install
)
echo Server is starting on http://localhost:5000
echo Even if you close VS Code, running this keeps your server alive!
node index.js
pause
