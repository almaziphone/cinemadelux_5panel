@echo off
chcp 65001 >nul
setlocal

REM Куда открываем
set "URL=http://10.80.19.145:8080/board"

echo Ожидание 15 секунд (загрузка сети)...
timeout /t 15 /nobreak >nul

REM 1) Пробуем найти Chrome через PATH
set "CHROME="
for /f "delims=" %%I in ('where chrome.exe 2^>nul') do (
  set "CHROME=%%I"
  goto :found
)

REM 2) Стандартные пути установки
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

:found
if not defined CHROME (
  echo ОШИБКА: Google Chrome не найден.
  echo Установите Chrome или проверьте путь.
  pause
  exit /b 1
)

echo Найден Chrome: "%CHROME%"
echo Запуск в режиме киоска: %URL%

start "" "%CHROME%" --kiosk --start-fullscreen "%URL%" ^
  --disable-infobars --disable-session-crashed-bubble --disable-restore-session-state

exit /b 0
