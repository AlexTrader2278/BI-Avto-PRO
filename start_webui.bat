@echo off
title Browser-Use Web UI
color 0A

echo.
echo  ==========================================
echo    Browser-Use Web UI  -  Запуск...
echo  ==========================================
echo.

REM Проверяем что WSL доступен
wsl --status >nul 2>&1
if errorlevel 1 (
    echo  [ОШИБКА] WSL не найден. Установите WSL2 из Microsoft Store.
    pause
    exit /b 1
)

REM Запускаем сервер в отдельном окне WSL (не блокирует этот скрипт)
start "Browser-Use Server" wsl -- bash -c "cd /home/user/web-ui && source .venv/bin/activate && python webui.py --ip 0.0.0.0 --port 7788 2>&1 | tee /tmp/webui.log"

echo  Сервер запускается, ждём 10 секунд...
echo  (первый запуск может занять до 30 секунд)
echo.

REM Ждём пока сервер поднимется
timeout /t 10 /nobreak > nul

REM Открываем браузер
echo  Открываем браузер на http://localhost:7788
start http://localhost:7788

echo.
echo  ==========================================
echo    Browser-Use Web UI запущен!
echo    Адрес: http://localhost:7788
echo  ==========================================
echo.
echo  Чтобы ОСТАНОВИТЬ сервер:
echo    - Закройте окно "Browser-Use Server"
echo    - Или нажмите Ctrl+C в том окне
echo.
echo  Это окно можно закрыть.
timeout /t 5 /nobreak > nul
exit /b 0
