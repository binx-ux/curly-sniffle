@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title kyn plugins installer
color 0B

rem enable ANSI colors on modern Windows
for /f %%A in ('echo prompt $E^| cmd') do set "ESC=%%A"
if not defined ESC set "ESC="

set "C0=%ESC%[0m"
set "C1=%ESC%[96m"
set "C2=%ESC%[92m"
set "C3=%ESC%[93m"
set "C4=%ESC%[91m"
set "C5=%ESC%[90m"
set "C6=%ESC%[97m"

cls
echo.
echo %C1%  · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·%C0%
echo.
echo %C6%      ██╗  ██╗██╗   ██╗███╗   ██╗%C0%
echo %C6%      ██║ ██╔╝╚██╗ ██╔╝████╗  ██║%C0%
echo %C6%      █████╔╝  ╚████╔╝ ██╔██╗ ██║%C0%
echo %C6%      ██╔═██╗   ╚██╔╝  ██║╚██╗██║%C0%
echo %C6%      ██║  ██╗   ██║   ██║ ╚████║%C0%
echo %C6%      ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═══╝%C0%
echo.
echo %C1%           p l u g i n   i n s t a l l e r%C0%
echo.
echo %C1%  · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·%C0%
echo.

set "PLUGINS=%~dp0"
set "VENCORD="
set "COPIED=0"
set "FAILED=0"
set "SKIPPED=0"

if not "%~1"=="" (
  set "VENCORD=%~1"
  goto :validate
)

call :find_vencord
if defined VENCORD goto :validate

echo %C3%  [!] could not find Vencord automatically%C0%
echo %C5%      drag your Vencord folder onto this bat%C0%
echo %C5%      or paste the full path below%C0%
echo %C5%      example: C:\Users\%USERNAME%\Vencord%C0%
echo.
set /p "VENCORD=  path ^> "
if "%VENCORD%"=="" (
  echo %C4%  [x] no path given%C0%
  goto :fail
)

:validate
set "VENCORD=%VENCORD:"=%"
if "%VENCORD:~-1%"=="\" set "VENCORD=%VENCORD:~0,-1%"

if not exist "%VENCORD%\src\plugins\" (
  echo.
  echo %C4%  [x] that is not a Vencord source folder%C0%
  echo %C5%      need a folder that contains src\plugins%C0%
  echo %C5%      got: %VENCORD%%C0%
  goto :fail
)

set "DEST=%VENCORD%\src\userplugins"
if not exist "%DEST%\" mkdir "%DEST%" >nul 2>&1
if not exist "%DEST%\" (
  echo %C4%  [x] could not create userplugins folder%C0%
  goto :fail
)

echo %C2%  [+] vencord  %C6%%VENCORD%%C0%
echo %C2%  [+] target   %C6%%DEST%%C0%
echo.
echo %C1%  · copying plugins ·%C0%
echo.

for %%P in (
  profile\friendBadges
  profile\clientBadges
  music\spotBuddy
) do (
  call :install_one "%%P"
)

echo.
echo %C1%  · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·%C0%
echo.
echo %C6%  copied : %COPIED%    failed : %FAILED%    skipped : %SKIPPED%%C0%
echo.

if not "%FAILED%"=="0" (
  echo %C4%  [x] install finished with errors%C0%
  goto :fail
)

if "%COPIED%"=="0" (
  echo %C4%  [x] nothing was installed%C0%
  goto :fail
)

echo %C2%  [ok] plugins are in src\userplugins%C0%
echo.

where pnpm >nul 2>&1
if errorlevel 1 (
  echo %C3%  [!] pnpm not found. rebuild Vencord yourself:%C0%
  echo %C5%      cd /d "%VENCORD%"%C0%
  echo %C5%      pnpm build%C0%
  echo %C5%      pnpm inject%C0%
  echo %C5%      then restart Discord and enable the plugins%C0%
  echo.
  goto :done
)

echo %C3%  rebuild Vencord now?  [Y/N]%C0%
choice /C YN /N /M "  > "
if errorlevel 2 goto :skip_build
if errorlevel 1 goto :do_build
goto :skip_build

:do_build
echo.
echo %C1%  · building ·%C0%
pushd "%VENCORD%"
call pnpm build
set "BUILD_ERR=!errorlevel!"
if not "!BUILD_ERR!"=="0" (
  popd
  echo %C4%  [x] pnpm build failed ^(!BUILD_ERR!^)%C0%
  goto :fail
)
echo %C2%  [ok] build finished%C0%
echo.
echo %C1%  · applying build to Discord ·%C0%
set "ROAM=%APPDATA%\Vencord\dist"
if not exist "%ROAM%\" mkdir "%ROAM%" >nul 2>&1

robocopy "%VENCORD%\dist" "%ROAM%" renderer.js renderer.js.map renderer.js.LEGAL.txt renderer.css renderer.css.map preload.js preload.js.map patcher.js patcher.js.map patcher.js.LEGAL.txt /NFL /NDL /NJH /NJS /nc /ns /np >nul
set "RC=!errorlevel!"
popd

if !RC! GEQ 8 (
  echo %C4%  [x] could not copy dist to %ROAM%%C0%
  goto :fail
)

findstr /C:"FriendBadges" /C:"ClientBadges" /C:"SpotBuddy" "%ROAM%\renderer.js" >nul 2>&1
if errorlevel 1 (
  echo %C3%  [!] build applied, but plugin names were not found in renderer.js%C0%
) else (
  echo %C2%  [ok] plugins are in the live Vencord build%C0%
)

echo.
echo %C2%  fully quit Discord ^(system tray too^), open it again,%C0%
echo %C2%  then Settings -^> Vencord -^> Plugins%C0%
echo %C3%  tip: set the filter to "Show All", not "Show New"%C0%
echo.
goto :done

:skip_build
echo.
echo %C5%  skip build. when ready:%C0%
echo %C5%    cd /d "%VENCORD%"%C0%
echo %C5%    pnpm build%C0%
echo %C5%    then copy dist into %%APPDATA%%\Vencord\dist%C0%
echo %C5%    or run this installer again and choose Y%C0%
echo.

:done
echo %C1%  · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·%C0%
echo %C2%                     a l l   d o n e%C0%
echo %C1%  · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·%C0%
echo.
pause
exit /b 0

:fail
echo.
pause
exit /b 1

:find_vencord
if exist "%USERPROFILE%\Vencord\src\plugins\" set "VENCORD=%USERPROFILE%\Vencord" & exit /b 0
if exist "%USERPROFILE%\Documents\Vencord\src\plugins\" set "VENCORD=%USERPROFILE%\Documents\Vencord" & exit /b 0
if exist "%USERPROFILE%\Downloads\Vencord\src\plugins\" set "VENCORD=%USERPROFILE%\Downloads\Vencord" & exit /b 0
if exist "%USERPROFILE%\Desktop\Vencord\src\plugins\" set "VENCORD=%USERPROFILE%\Desktop\Vencord" & exit /b 0
if exist "%USERPROFILE%\source\Vencord\src\plugins\" set "VENCORD=%USERPROFILE%\source\Vencord" & exit /b 0
if exist "%USERPROFILE%\dev\Vencord\src\plugins\" set "VENCORD=%USERPROFILE%\dev\Vencord" & exit /b 0
if exist "%USERPROFILE%\code\Vencord\src\plugins\" set "VENCORD=%USERPROFILE%\code\Vencord" & exit /b 0
if exist "C:\Vencord\src\plugins\" set "VENCORD=C:\Vencord" & exit /b 0
exit /b 1

:install_one
set "NAME=%~1"
set "SRC=%PLUGINS%%NAME%"
for %%F in ("%NAME%") do set "BASE=%%~nxF"
set "OUT=%DEST%\%BASE%"

if not exist "%SRC%\index.tsx" if not exist "%SRC%\index.ts" if not exist "%SRC%\index.jsx" (
  echo %C5%  [-] %BASE%  missing, skipped%C0%
  set /a SKIPPED+=1
  exit /b 0
)

echo %C6%  [.] %BASE%%C0%

if exist "%OUT%\" (
  rmdir /s /q "%OUT%" >nul 2>&1
)

mkdir "%OUT%" >nul 2>&1
robocopy "%SRC%" "%OUT%" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul
set "RC=!errorlevel!"

rem robocopy: 0-7 = success-ish, 8+ = failure
if !RC! GEQ 8 (
  echo %C4%      fail  robocopy !RC!%C0%
  set /a FAILED+=1
  exit /b 1
)

if not exist "%OUT%\index.tsx" if not exist "%OUT%\index.ts" if not exist "%OUT%\index.jsx" (
  echo %C4%      fail  no index file after copy%C0%
  set /a FAILED+=1
  exit /b 1
)

echo %C2%      ok%C0%
set /a COPIED+=1
exit /b 0
