@echo off
REM Запуск Chrome в режиме киоска для Cinema Board
REM Открывает страницу http://10.80.19.145:8080/board

echo Запуск Chrome в режиме киоска...
echo.

REM Пытаемся найти Chrome
set CHROME_PATH=
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe
)

REM Открываем браузер в режиме киоска
if defined CHROME_PATH (
    echo Найден Chrome: %CHROME_PATH%
    echo Открываю страницу http://10.80.19.145:8080/board в режиме киоска...
    echo.
    REM --kiosk - полноэкранный режим киоска
    REM --start-fullscreen - дополнительная гарантия полноэкранного режима
    REM --disable-infobars - отключает информационные панели
    REM --disable-session-crashed-bubble - отключает уведомления о сбоях
    REM --disable-restore-session-state - отключает восстановление сессии
    start "" "%CHROME_PATH%" --kiosk --start-fullscreen "http://10.80.19.145:8080/board" --disable-infobars --disable-session-crashed-bubble --disable-restore-session-state
    echo Chrome запущен в режиме киоска.
    echo Для выхода из режима киоска нажмите Alt+F4 или Alt+Tab
) else (
    echo ОШИБКА: Chrome не найден!
    echo.
    echo Пожалуйста, установите Google Chrome или укажите путь к нему в скрипте.
    echo.
    pause
    exit /b 1
)
