@echo off
title Stop CampusSync Servers
echo Stopping any running servers on port 5000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /f /pid %%a >nul 2>&1
)
echo Servers on port 5000 and 5173 stopped successfully.
pause

