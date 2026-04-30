@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo ========================================
echo   Yobomang push reconcile
echo ========================================
echo.
echo Origin has 11 commits ahead. Reconciling so we keep
echo just the new biz-verify changes on top of origin/main.
echo.

REM 1) Fetch latest origin
echo [1/4] Fetching origin/main...
git fetch origin main
if errorlevel 1 (
    echo [X] fetch failed
    pause
    exit /b 1
)

REM 2) Move HEAD to origin/main (keeps working tree intact)
echo.
echo [2/4] Soft-reset HEAD to origin/main (working tree preserved)...
git reset --soft origin/main
if errorlevel 1 (
    echo [X] reset failed
    pause
    exit /b 1
)

REM 3) Commit only the new biz-verify diff on top
echo.
echo [3/4] Committing biz-verify changes...
git add -A
git commit -m "feat: home redesign (3-button bar, scroll-hide ads), edu cert/refresher modes, regional community board (likes/comments/auto-mod), my posts in profile, new app icon"
if errorlevel 1 (
    echo No changes to commit, or commit failed.
)

REM 4) Push
echo.
echo [4/4] Pushing to origin/main...
git push origin main
if errorlevel 1 (
    echo [X] push failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Reconciled and pushed.
echo   GitHub Pages will refresh in 30-60 seconds.
echo ========================================
pause
