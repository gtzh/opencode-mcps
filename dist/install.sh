#!/bin/bash
# MCP Servers 安装脚本 - 适用于 Linux/macOS
# 使用方法: bash install.sh

set -e

echo "========================================"
echo "  MCP Servers 安装脚本"
echo "========================================"

# 检测操作系统
OS="$(uname -s)"
case "$OS" in
    Linux*)     MACHINE="linux";;
    Darwin*)    MACHINE="mac";;
    *)          MACHINE="unknown";;
esac

echo "检测到操作系统: $MACHINE"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js，请先安装 Node.js v18 或更高版本"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "错误: Node.js 版本过低，需要 v18 或更高版本"
    exit 1
fi

echo "Node.js 版本: $(node -v)"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 设置安装目录
INSTALL_DIR="$HOME/.opencode/mcp-servers"

echo "安装目录: $INSTALL_DIR"

# 创建目录
mkdir -p "$INSTALL_DIR/pdf-reader"
mkdir -p "$INSTALL_DIR/pdf-writer"
mkdir -p "$INSTALL_DIR/epub-reader"
mkdir -p "$INSTALL_DIR/office-suite"

# 复制文件
echo ""
echo "复制 PDF Reader..."
cp "$SCRIPT_DIR/pdf-reader/package.json" "$INSTALL_DIR/pdf-reader/"
cp "$SCRIPT_DIR/pdf-reader/index.js" "$INSTALL_DIR/pdf-reader/"

echo "复制 PDF Writer..."
cp "$SCRIPT_DIR/pdf-writer/package.json" "$INSTALL_DIR/pdf-writer/"
cp "$SCRIPT_DIR/pdf-writer/index.js" "$INSTALL_DIR/pdf-writer/"

echo "复制 EPUB Reader..."
cp "$SCRIPT_DIR/epub-reader/package.json" "$INSTALL_DIR/epub-reader/"
cp "$SCRIPT_DIR/epub-reader/index.js" "$INSTALL_DIR/epub-reader/"

echo "复制 Office Suite..."
cp "$SCRIPT_DIR/office-suite/package.json" "$INSTALL_DIR/office-suite/"
cp "$SCRIPT_DIR/office-suite/index.js" "$INSTALL_DIR/office-suite/"

# 安装依赖
echo ""
echo "安装 PDF Reader 依赖..."
cd "$INSTALL_DIR/pdf-reader"
npm install --silent

echo "安装 PDF Writer 依赖..."
cd "$INSTALL_DIR/pdf-writer"
npm install --silent

echo "安装 EPUB Reader 依赖..."
cd "$INSTALL_DIR/epub-reader"
npm install --silent

echo "安装 Office Suite 依赖..."
cd "$INSTALL_DIR/office-suite"
npm install --silent

# 生成配置
echo ""
echo "========================================"
echo "  安装完成！"
echo "========================================"
echo ""
echo "请将以下配置添加到你的 opencode 配置文件中："
echo ""
echo '配置文件位置: ~/.opencode/mcp.json'
echo ""
echo '{'
echo '  "mcpServers": {'
echo '    "pdf-reader": {'
echo '      "command": "node",'
echo "      \"args\": [\"$INSTALL_DIR/pdf-reader/index.js\"]"
echo '    },'
echo '    "pdf-writer": {'
echo '      "command": "node",'
echo "      \"args\": [\"$INSTALL_DIR/pdf-writer/index.js\"]"
echo '    },'
echo '    "epub-reader": {'
echo '      "command": "node",'
echo "      \"args\": [\"$INSTALL_DIR/epub-reader/index.js\"]"
echo '    },'
echo '    "office-suite": {'
echo '      "command": "node",'
echo "      \"args\": [\"$INSTALL_DIR/office-suite/index.js\"]"
echo '    }'
echo '  }'
echo '}'
echo ""
echo "或者运行以下命令自动配置："
echo "  bash $SCRIPT_DIR/configure.sh"
