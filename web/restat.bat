@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "PORT=3000"
set "CLEAR_CACHE=1"

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="-h" goto usage
if /I "%~1"=="--help" goto usage
if /I "%~1"=="--no-clean" (
  set "CLEAR_CACHE=0"
  shift
  goto parse_args
)
set "PORT=%~1"
shift
goto parse_args

:args_done
where node >nul 2>nul
if errorlevel 1 (
  echo [restat] ERROR: node is not installed or not in PATH.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [restat] ERROR: npm is not installed or not in PATH.
  exit /b 1
)

echo [restat] Project: %CD%
echo [restat] Port: %PORT%

echo [restat] Stopping existing process on port %PORT%...
set "FOUND_PID=0"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /I ":%PORT% " ^| findstr /I "LISTENING"') do (
  set "FOUND_PID=1"
  echo [restat] Killing PID %%P
  taskkill /F /T /PID %%P >nul 2>nul
)
if "%FOUND_PID%"=="0" (
  echo [restat] No LISTENING process found on port %PORT%.
)

if "%CLEAR_CACHE%"=="1" (
  if exist ".next" (
    echo [restat] Cleaning .next cache...
    rmdir /s /q ".next"
  ) else (
    echo [restat] .next cache not found, skip.
  )
) else (
  echo [restat] Skip cache cleaning with --no-clean.
)

echo [restat] Starting dev server...
call npm run dev -- --port %PORT%
set "EXIT_CODE=%ERRORLEVEL%"
echo [restat] Dev server exited with code %EXIT_CODE%.
exit /b %EXIT_CODE%

:usage
echo Usage:
echo   restat.bat [port] [--no-clean]
echo.
echo Examples:
echo   restat.bat
echo   restat.bat 3001
echo   restat.bat 3000 --no-clean
exit /b 0
