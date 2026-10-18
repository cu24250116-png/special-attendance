@echo off
title CampusSync Attendance & Dashboard Launcher
echo ====================================================
echo Starting CampusSync (Backend + Frontend)...
echo ====================================================
cd /d "%~dp0"
node dev-runner.js
pause
