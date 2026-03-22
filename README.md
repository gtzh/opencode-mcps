# MCP Servers - PDF & Office Suite

为 OpenCode 提供 PDF、EPUB 和 Office 文档处理功能的 MCP 服务器。

## 包含服务

| 服务 | 功能 |
|------|------|
| **pdf-reader** | 读取PDF、提取文本、搜索关键词 |
| **pdf-writer** | 创建/编辑PDF、合并、拆分、水印 |
| **epub-reader** | 读取EPUB电子书、章节管理 |
| **office-suite** | Word/Excel/PowerPoint 读写 |

## 快速安装

### Windows

1. 双击运行 `install.bat`
2. 安装完成后运行 `configure.bat` 进行配置
3. 重启 OpenCode

### Linux/macOS

```bash
# 安装
bash install.sh

# 配置
bash configure.sh

# 重启 opencode
```

## 工具列表

### PDF Reader

| 工具 | 描述 |
|------|------|
| `read_pdf` | 读取PDF完整内容 |
| `get_pdf_info` | 获取PDF元数据 |
| `extract_pdf_pages` | 提取指定页面 |
| `search_pdf_text` | 搜索关键词 |

### PDF Writer

| 工具 | 描述 |
|------|------|
| `create_pdf` | 创建新PDF文件 |
| `add_text_to_pdf` | 添加文本到PDF |
| `merge_pdfs` | 合并多个PDF |
| `split_pdf` | 拆分PDF文件 |
| `add_image_to_pdf` | 添加图片到PDF |
| `create_pdf_from_images` | 图片转PDF |
| `add_watermark` | 添加水印 |
| `delete_pages` | 删除指定页面 |
| `rotate_pages` | 旋转页面 |

### EPUB Reader

| 工具 | 描述 |
|------|------|
| `read_epub` | 读取EPUB完整内容 |
| `get_epub_info` | 获取EPUB元数据 |
| `list_epub_chapters` | 列出所有章节 |
| `read_epub_chapter` | 读取指定章节 |
| `search_epub` | 搜索关键词 |

### Office Suite

#### Word

| 工具 | 描述 |
|------|------|
| `read_docx` | 读取Word文档 |
| `create_docx` | 创建Word文档 |

#### Excel

| 工具 | 描述 |
|------|------|
| `read_xlsx` | 读取Excel文件 |
| `get_xlsx_sheets` | 获取工作表列表 |
| `create_xlsx` | 创建Excel文件 |
| `add_sheet_to_xlsx` | 添加工作表 |
| `append_data_to_xlsx` | 追加数据 |
| `xlsx_to_csv` | 导出为CSV |
| `csv_to_xlsx` | CSV转Excel |

#### PowerPoint

| 工具 | 描述 |
|------|------|
| `read_pptx` | 读取PPT文件 |
| `create_pptx` | 创建PPT文件 |

## 使用示例

```
# PDF 操作
请使用 create_pdf 创建一个新PDF，内容为"Hello World"
请使用 merge_pdfs 合并 file1.pdf 和 file2.pdf

# Word 操作
请使用 create_docx 创建一个报告，标题为"项目报告"

# Excel 操作
请使用 read_xlsx 读取 data.xlsx 的内容
请使用 create_xlsx 创建一个包含姓名、年龄列的表格

# PowerPoint 操作
请使用 create_pptx 创建一个演示文稿，包含3张幻灯片
```

## 系统要求

- Node.js v18 或更高版本
- npm 或 bun

## 打包内容

```
mcp-servers-dist/
├── install.sh / install.bat
├── configure.sh / configure.bat
├── README.md
├── pdf-reader/
├── pdf-writer/
├── epub-reader/
└── office-suite/
```

## 故障排除

### 依赖安装失败
```bash
# 清除缓存重新安装
npm cache clean --force
npm install
```

### 路径问题
- Windows: 使用 `\\` 或 `/` 作为路径分隔符
- Linux/macOS: 使用 `/` 作为路径分隔符
