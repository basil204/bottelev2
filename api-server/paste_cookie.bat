@echo off
chcp 65001 >nul
title CANVA - SET COOKIE
cd /d "%~dp0"
node set_cookie.js
pause
