@echo off
REM MCP Servers 安装脚本 - 适用于 Windows
REM 使用方法: 双击运行或 cmd /c install.bat

echo ========================================
echo   MCP Servers 安装脚本
echo ========================================

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 未找到 Node.js，请先安装 Node.js v18 或更高版本
    pause
    exit /b 1
)

for /f "tokens=2 delims=v" %%i in ('node -v') do set NODE_VERSION=%%i
echo Node.js 版本: %NODE_VERSION%

REM 设置安装目录
set "INSTALL_DIR=%USERPROFILE%\.opencode\mcp-servers"
echo 安装目录: %INSTALL_DIR%

REM 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"

REM 创建目录
if not exist "%INSTALL_DIR%\pdf-reader" mkdir "%INSTALL_DIR%\pdf-reader"
if not exist "%INSTALL_DIR%\pdf-writer" mkdir "%INSTALL_DIR%\pdf-writer"
if not exist "%INSTALL_DIR%\epub-reader" mkdir "%INSTALL_DIR%\epub-reader"
if not exist "%INSTALL_DIR%\office-suite" mkdir "%INSTALL_DIR%\office-suite"

REM 复制文件
echo.
echo 复制 PDF Reader...
copy /Y "%SCRIPT_DIR%pdf-reader\package.json" "%INSTALL_DIR%\pdf-reader\" >nul
copy /Y "%SCRIPT_DIR%pdf-reader\index.js" "%INSTALL_DIR%\pdf-reader\" >nul

echo 复制 PDF Writer...
copy /Y "%SCRIPT_DIR%pdf-writer\package.json" "%INSTALL_DIR%\pdf-writer\" >nul
copy /Y "%SCRIPT_DIR%pdf-writer\index.js" "%INSTALL_DIR%\pdf-writer\" >nul

echo 复制 EPUB Reader...
copy /Y "%SCRIPT_DIR%epub-reader\package.json" "%INSTALL_DIR%\epub-reader\" >nul
copy /Y "%SCRIPT_DIR%epub-reader\index.js" "%INSTALL_DIR%\epub-reader\" >nul

echo 复制 Office Suite...
copy /Y "%SCRIPT_DIR%office-suite\package.json" "%INSTALL_DIR%\office-suite\" >nul
copy /Y "%SCRIPT_DIR%office-suite\index.js" "%INSTALL_DIR%\office-suite\" >nul

REM 安装依赖
echo.
echo 安装 PDF Reader 依赖...
cd /d "%INSTALL_DIR%\pdf-reader"
call npm install --silent

echo 安装 PDF Writer 依赖...
cd /d "%INSTALL_DIR%\pdf-writer"
call npm install --silent

echo 安装 EPUB Reader 依赖...
cd /d "%INSTALL_DIR%\epub-reader"
call npm install --silent

echo 安装 Office Suite 依赖...
cd /d "%INSTALL_DIR%\office-suite"
call npm install --silent

cd /d "%SCRIPT_DIR%"

REM 生成配置文件
echo.
echo ========================================
echo   安装完成！
echo ========================================
echo.
echo 请将以下配置添加到你的 opencode 配置文件中：
echo.
echo 配置文件位置: %USERPROFILE%\.opencode\mcp.json
echo.
echo {
echo   "mcpServers": {
echo     "pdf-reader": {
echo       "command": "node",
echo       "args": ["%INSTALL_DIR:\=\\%\\pdf-reader\\index.js"]
echo     },
echo     "pdf-writer": {
echo       "command": "node",
echo       "args": ["%INSTALL_DIR:\=\\%\\pdf-writer\\index.js"]
echo     },
echo     "epub-reader": {
echo       "command": "node",
echo       "args": ["%INSTALL_DIR:\=\\%\\epub-reader\\index.js"]
echo     },
echo     "office-suite": {
echo       "command": "node",
echo       "args": ["%INSTALL_DIR:\=\\%\\office-suite\\index.js"]
echo     }
echo   }
echo }
echo.
echo 或者运行 configure.bat 自动配置
echo.
pause
