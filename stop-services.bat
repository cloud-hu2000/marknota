@echo off
echo 正在终止所有Node.js进程...

REM 终止所有node.exe进程
taskkill /IM node.exe /F 2>nul

if %ERRORLEVEL% EQU 0 (
    echo 所有Node.js进程已成功终止。
) else (
    echo 没有找到正在运行的Node.js进程。
)

echo 按任意键退出...
pause >nul
