@echo off
echo 正在启动PDF预览器...

REM 检查是否安装了serve
npx serve --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 正在安装serve...
    npm install -g serve
)

echo 打开浏览器访问: http://localhost:3000
start http://localhost:3000
npx serve

echo PDF预览器已关闭 