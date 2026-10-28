@echo off
title OS Multithreading Simulator Prototype - Aryan Phalke
echo ====================================================================
echo  OS MINI PROJECT: MULTITHREADING-BASED APPLICATION
echo  Author: Aryan Shyam Phalke (PRN: RBT25CS111, Roll: CS2240)
echo  JSPM's Rajarshi Shahu College of Engineering, Pune
echo ====================================================================
echo.
echo Starting Python Backend Server on http://localhost:8000...
echo.

cd /d "%~dp0"
start "" http://localhost:8000
python backend\server.py 8000

pause
