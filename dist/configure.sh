#!/bin/bash
# 自动配置 MCP 服务器到 opencode
# 使用方法: bash configure.sh

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 设置路径
MCP_DIR="$HOME/.opencode"
MCP_SERVERS_DIR="$MCP_DIR/mcp-servers"
MCP_CONFIG="$MCP_DIR/mcp.json"

echo "配置文件路径: $MCP_CONFIG"

# 确保 .opencode 目录存在
mkdir -p "$MCP_DIR"

# 创建配置文件
cat > "$MCP_CONFIG" << EOF
{
  "mcpServers": {
    "pdf-reader": {
      "command": "node",
      "args": ["$MCP_SERVERS_DIR/pdf-reader/index.js"]
    },
    "pdf-writer": {
      "command": "node",
      "args": ["$MCP_SERVERS_DIR/pdf-writer/index.js"]
    },
    "epub-reader": {
      "command": "node",
      "args": ["$MCP_SERVERS_DIR/epub-reader/index.js"]
    },
    "office-suite": {
      "command": "node",
      "args": ["$MCP_SERVERS_DIR/office-suite/index.js"]
    }
  }
}
EOF

echo ""
echo "========================================"
echo "  配置完成！"
echo "========================================"
echo ""
echo "配置文件已创建: $MCP_CONFIG"
echo ""
echo "重启 opencode 以使配置生效"
