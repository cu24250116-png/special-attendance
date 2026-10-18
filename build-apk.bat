@echo off
title Build CampusSync Android APK
echo ====================================================
echo Building CampusSync APK with Latest Dataset...
echo ====================================================

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
cd /d "%~dp0"

echo [1/4] Exporting latest SQLite database to bundled JSON...
call node scripts/export-bundled-data.js
if %errorlevel% neq 0 (
    echo Error exporting bundled data!
    pause
    exit /b %errorlevel%
)

echo [2/4] Building Vite React client...
call npm.cmd --prefix client run build
if %errorlevel% neq 0 (
    echo Error building client!
    pause
    exit /b %errorlevel%
)

echo [3/4] Syncing Capacitor Android assets...
cd client
call npx.cmd cap sync android
if %errorlevel% neq 0 (
    echo Error syncing Capacitor!
    cd ..
    pause
    exit /b %errorlevel%
)

echo [4/4] Assembling Android APK with Gradle...
cd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo Error assembling APK!
    cd ../..
    pause
    exit /b %errorlevel%
)
cd ../..

echo Copying newly built APK to apk folder and downloads...
if not exist apk mkdir apk
if not exist server\public\downloads mkdir server\public\downloads
copy /y "client\android\app\build\outputs\apk\debug\app-debug.apk" "apk\SpecialAttendance.apk"
copy /y "client\android\app\build\outputs\apk\debug\app-debug.apk" "server\public\downloads\SpecialAttendance.apk"

echo ====================================================
echo SUCCESS! Fresh APK with latest dataset is ready!
echo Location: apk\SpecialAttendance.apk
echo Download URL: http://localhost:5000/download/SpecialAttendance.apk
echo ====================================================
