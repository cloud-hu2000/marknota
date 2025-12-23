Write-Host "正在终止所有Node.js进程..." -ForegroundColor Yellow

# 获取所有node.exe进程
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    $nodeProcesses | ForEach-Object {
        Write-Host "终止进程: $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Cyan
        Stop-Process -Id $_.Id -Force
    }
    Write-Host "所有Node.js进程已成功终止。" -ForegroundColor Green
} else {
    Write-Host "没有找到正在运行的Node.js进程。" -ForegroundColor Red
}

Read-Host "按Enter键退出"
