@echo off
REM 自动配置 MCP 服务器到 opencode
REM 使用方法: 双击运行或 cmd /c configure.bat

setlocal enabledelayedexpansion

REM 设置路径
set "MCP_DIR=%USERPROFILE%\.opencode"
set "MCP_SERVERS_DIR=%MCP_DIR%\mcp-servers"
set "MCP_CONFIG=%MCP_DIR%\mcp.json"

echo 配置文件路径: %MCP_CONFIG%

REM 确保 .opencode 目录存在
if not exist "%MCP_DIR%" mkdir "%MCP_DIR%"

REM 转换路径为 JSON 格式（反斜杠需要转义）
set "PDF_READER_PATH=%MCP_SERVERS_DIR:\=\\%\\pdf-reader\\index.js"
set "PDF_WRITER_PATH=%MCP_SERVERS_DIR:\=\\%\\pdf-writer\\index.js"
set "EPUB_READER_PATH=%MCP_SERVERS_DIR:\=\\%\\epub-reader\\index.js"
set "OFFICE_SUITE_PATH=%MCP_SERVERS_DIR:\=\\%\\office-suite\\index.js"

REM 创建配置文件
(
echo {
echo   "mcpServers": {
echo     "pdf-reader": {
echo       "command": "node",
echo       "args": ["!PDF_READER_PATH!"]
echo     },
echo     "pdf-writer": {
echo       "command": "node",
echo       "args": ["!PDF_WRITER_PATH!"]
echo     },
echo     "epub-reader": {
echo       "command": "node",
echo       "args": ["!EPUB_READER_PATH!"]
echo     },
echo     "office-suite": {
echo       "command": "node",
echo       "args": ["!OFFICE_SUITE_PATH!"]
echo     }
echo   }
echo }
) > "%MCP_CONFIG%"

echo.
echo ========================================
echo   配置完成！
echo ========================================
echo.
echo 配置文件已创建: %MCP_CONFIG%
echo.
echo 重启 opencode 以使配置生效
echo.
pause
