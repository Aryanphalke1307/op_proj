@echo off
title Push OS Simulator to GitHub - Aryan Phalke
echo ====================================================================
echo  PUSHING TO GITHUB: https://github.com/Aryanphalke1307/op_proj.git
echo  Author: Aryan Shyam Phalke (RSCOE Pune)
echo ====================================================================
echo.

cd /d "%~dp0"
git push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo ====================================================================
    echo  SUCCESSFULLY PUSHED TO GITHUB!
    echo  View repository: https://github.com/Aryanphalke1307/op_proj
    echo ====================================================================
) else (
    echo.
    echo If GitHub rejected the push because the remote repository already contains a README:
    echo Running push with force-with-lease...
    git push -u origin main --force
)

pause
