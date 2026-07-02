@echo off
REM ============================================================
REM  Start je Coach-app en houdt 'm draaiend.
REM  Sluit dit venster om de app te stoppen.
REM ============================================================
cd /d "%~dp0"

REM Open de app in je browser (na een paar seconden opstarttijd).
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"

:loop
echo ============================================
echo   Coach-app wordt gestart...
echo   Straks opent je browser vanzelf.
echo   Laat dit venster open (minimaliseren mag).
echo ============================================
call npm start
echo.
echo De app is gestopt. Ik herstart over 5 seconden...
echo (Sluit dit venster om definitief te stoppen.)
timeout /t 5 /nobreak >nul
goto loop
