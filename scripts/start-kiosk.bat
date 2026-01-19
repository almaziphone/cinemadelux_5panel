@echo off
echo Starting Cinema Board Server...
echo.

cd /d "%~dp0\.."

REM Проверяем, собран ли проект
if not exist "frontend\dist" (
    echo Frontend not built. Building...
    call npm run build
    if errorlevel 1 (
        echo Build failed!
        pause
        exit /b 1
    )
)

REM Запускаем сервер в фоне
echo Starting server...
start "Cinema Board Server" cmd /c "npm run start"

REM Ждём немного, чтобы сервер запустился
timeout /t 3 /nobreak >nul

REM Пытаемся найти Chrome
set CHROME_PATH=
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe
)

REM Открываем браузер
if defined CHROME_PATH (
    echo Opening Chrome in kiosk mode...
    start "" "%CHROME_PATH%" --kiosk --app=http://localhost:8080/board
) else (
    echo Chrome not found. Opening default browser...
    start http://localhost:8080/board
    echo.
    echo Please press F11 for fullscreen mode.
)

echo.
echo Server is running. Press Ctrl+C to stop.
echo.
pause
