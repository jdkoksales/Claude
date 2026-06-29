@echo off
REM ============================================================
REM  Start je Claude-coach en houdt 'm draaiend.
REM  Sluit dit venster om de coach te stoppen.
REM ============================================================
cd /d "%~dp0"

:loop
echo ============================================
echo   Claude-coach wordt gestart...
echo   Laat dit venster open (minimaliseren mag).
echo ============================================
call npm start
echo.
echo Coach is gestopt. Ik herstart over 5 seconden...
echo (Sluit dit venster om definitief te stoppen.)
timeout /t 5 /nobreak >nul
goto loop
