#!/usr/bin/env node

/**
 * PDF Reader MCP Server
 * 提供 PDF 文件解析功能，支持扫描版PDF的OCR识别
 *
 * 工具列表：
 * - read_pdf: 读取PDF文件内容（自动检测是否需要OCR）
 * - get_pdf_info: 获取PDF文件信息（页数、作者等）
 * - extract_pdf_pages: 提取指定页面内容
 * - ocr_pdf: 强制对PDF进行OCR识别（用于扫描版PDF）
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import pdf from 'pdf-parse';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

// OCR配置
const OCR_CONFIG = {
  pythonPath: 'python',
  scriptPath: null, // 将在启动时设置
  minTextLength: 50, // 少于此字符数视为扫描版PDF
};

// 启动时初始化OCR脚本路径
OCR_CONFIG.scriptPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'ocr_worker.py');

// 创建MCP服务器
const server = new Server(
  {
    name: 'pdf-reader',
    version: '1.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 检测PDF是否为扫描版（缺少文本层）
function isScannedPdf(text, pageCount) {
  const textLength = text.replace(/\s+/g, '').length;
  const avgCharsPerPage = textLength / pageCount;
  return avgCharsPerPage < OCR_CONFIG.minTextLength;
}

// 调用Python OCR脚本
async function callOCRSpec(pdfPath, options = {}) {
  const args = [
    OCR_CONFIG.scriptPath,
    pdfPath,
    '--dpi', String(options.dpi || 150),
    '--lang', options.lang || 'ch_sim+en',
    '--chunk-height', String(options.chunkHeight || 2000),
  ];

  if (options.startPage !== undefined) {
    args.push('--start-page', String(options.startPage));
  }
  if (options.endPage !== undefined) {
    args.push('--end-page', String(options.endPage));
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(OCR_CONFIG.pythonPath, args, {
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`OCR failed: ${stderr || stdout}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start OCR process: ${err.message}`));
    });
  });
}

// 列出所有可用工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'read_pdf',
        description: '读取PDF文件的完整文本内容。自动检测是否为扫描版PDF，如需要会自动启用OCR识别。',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'PDF文件的绝对路径',
            },
            max_pages: {
              type: 'number',
              description: '最大读取页数（可选，默认读取全部）',
            },
            force_ocr: {
              type: 'boolean',
              description: '强制使用OCR（用于已知是扫描版PDF）',
            },
          },
          required: ['file_path'],
        },
      },
      {
        name: 'get_pdf_info',
        description: '获取PDF文件的基本信息，包括页数、标题、作者、创建时间等元数据。',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'PDF文件的绝对路径',
            },
          },
          required: ['file_path'],
        },
      },
      {
        name: 'extract_pdf_pages',
        description: '提取PDF文件指定页面范围的内容。可以只读取部分页面，适合大型PDF文件。',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'PDF文件的绝对路径',
            },
            start_page: {
              type: 'number',
              description: '起始页码（从1开始）',
            },
            end_page: {
              type: 'number',
              description: '结束页码（包含）',
            },
          },
          required: ['file_path', 'start_page', 'end_page'],
        },
      },
      {
        name: 'search_pdf_text',
        description: '在PDF文件中搜索指定关键词，返回包含该关键词的页面和上下文。',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'PDF文件的绝对路径',
            },
            keyword: {
              type: 'string',
              description: '要搜索的关键词',
            },
            context_lines: {
              type: 'number',
              description: '返回关键词前后的上下文行数（默认3行）',
            },
          },
          required: ['file_path', 'keyword'],
        },
      },
      {
        name: 'ocr_pdf',
        description: '对PDF文件执行OCR识别。用于扫描版PDF或图片PDF的文本提取。使用EasyOCR进行识别。',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'PDF文件的绝对路径',
            },
            start_page: {
              type: 'number',
              description: '起始页码（从1开始，可选）',
            },
            end_page: {
              type: 'number',
              description: '结束页码（包含，可选）',
            },
            lang: {
              type: 'string',
              description: 'OCR语言，如ch_sim（简体中文）、en（英文），多个用+连接，默认ch_sim+en',
            },
            dpi: {
              type: 'number',
              description: '渲染DPI，默认150。更高DPI识别更准但更慢',
            },
          },
          required: ['file_path'],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'read_pdf': {
        const { file_path, max_pages, force_ocr } = args;

        try {
          await fs.access(file_path);
        } catch {
          return {
            content: [{ type: 'text', text: `错误：文件不存在: ${file_path}` }],
            isError: true,
          };
        }

        const dataBuffer = await fs.readFile(file_path);
        const data = await pdf(dataBuffer);

        let text = data.text;
        let pagesRead = data.numpages;
        let usedOCR = false;

        // 检测是否需要OCR
        if (force_ocr || isScannedPdf(text, data.numpages)) {
          usedOCR = true;
          try {
            text = await callOCRSpec(file_path, {
              dpi: 150,
            });
          } catch (ocrError) {
            return {
              content: [{
                type: 'text',
                text: `PDF检测为扫描版，但OCR失败: ${ocrError.message}\n\n请确保已安装: pip install easyocr pymupdf\n\n原始文本提取结果:\n${text || '(无文本)'}`
              }],
              isError: true,
            };
          }
        }

        if (max_pages && max_pages < pagesRead) {
          pagesRead = max_pages;
          text = text.split('\n').slice(0, max_pages * 50).join('\n');
        }

        return {
          content: [
            {
              type: 'text',
              text: `PDF文件: ${path.basename(file_path)}\n总页数: ${data.numpages}${max_pages ? ` (读取: ${pagesRead}页)` : ''}${usedOCR ? ' (使用OCR识别)' : ''}\n\n${text}`,
            },
          ],
        };
      }

      case 'get_pdf_info': {
        const { file_path } = args;

        try {
          await fs.access(file_path);
        } catch {
          return {
            content: [{ type: 'text', text: `错误：文件不存在: ${file_path}` }],
            isError: true,
          };
        }

        const dataBuffer = await fs.readFile(file_path);
        const data = await pdf(dataBuffer);
        const stats = await fs.stat(file_path);

        const isScanned = isScannedPdf(data.text, data.numpages);

        const info = {
          文件名: path.basename(file_path),
          文件大小: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          页数: data.numpages,
          'PDF类型': isScanned ? '扫描版（需要OCR）' : '文本版',
          '文本字符数': data.text.replace(/\s+/g, '').length,
          标题: data.info?.Title || '未知',
          作者: data.info?.Author || '未知',
          主题: data.info?.Subject || '未知',
          创建日期: data.info?.CreationDate || '未知',
          修改日期: data.info?.ModDate || '未知',
          创建工具: data.info?.Creator || '未知',
        };

        const infoText = Object.entries(info)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');

        return {
          content: [{ type: 'text', text: `PDF文件信息:\n\n${infoText}` }],
        };
      }

      case 'extract_pdf_pages': {
        const { file_path, start_page, end_page } = args;

        try {
          await fs.access(file_path);
        } catch {
          return {
            content: [{ type: 'text', text: `错误：文件不存在: ${file_path}` }],
            isError: true,
          };
        }

        if (start_page < 1 || end_page < start_page) {
          return {
            content: [{ type: 'text', text: '错误：页码参数无效，start_page必须>=1且<=end_page' }],
            isError: true,
          };
        }

        const dataBuffer = await fs.readFile(file_path);
        const data = await pdf(dataBuffer);

        if (start_page > data.numpages) {
          return {
            content: [{ type: 'text', text: `错误：起始页码超出范围，PDF共${data.numpages}页` }],
            isError: true,
          };
        }

        // 如果是扫描版PDF，使用OCR提取指定页面
        if (isScannedPdf(data.text, data.numpages)) {
          try {
            const ocrText = await callOCRSpec(file_path, {
              startPage: start_page - 1,
              endPage: Math.min(end_page, data.numpages),
            });
            return {
              content: [
                {
                  type: 'text',
                  text: `PDF文件: ${path.basename(file_path)}\n提取页面: ${start_page}-${Math.min(end_page, data.numpages)} (使用OCR)\n总页数: ${data.numpages}\n\n${ocrText}`,
                },
              ],
            };
          } catch (ocrError) {
            return {
              content: [{ type: 'text', text: `OCR失败: ${ocrError.message}` }],
              isError: true,
            };
          }
        }

        const lines = data.text.split('\n');
        const linesPerPage = Math.ceil(lines.length / data.numpages);

        const startLine = (start_page - 1) * linesPerPage;
        const endLine = Math.min(end_page * linesPerPage, lines.length);

        const extractedText = lines.slice(startLine, endLine).join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `PDF文件: ${path.basename(file_path)}\n提取页面: ${start_page}-${Math.min(end_page, data.numpages)}\n总页数: ${data.numpages}\n\n${extractedText}`,
            },
          ],
        };
      }

      case 'search_pdf_text': {
        const { file_path, keyword, context_lines = 3 } = args;

        try {
          await fs.access(file_path);
        } catch {
          return {
            content: [{ type: 'text', text: `错误：文件不存在: ${file_path}` }],
            isError: true,
          };
        }

        const dataBuffer = await fs.readFile(file_path);
        const data = await pdf(dataBuffer);

        let text = data.text;

        // 如果是扫描版，先OCR
        if (isScannedPdf(text, data.numpages)) {
          try {
            text = await callOCRSpec(file_path);
          } catch (ocrError) {
            return {
              content: [{ type: 'text', text: `PDF是扫描版，OCR失败: ${ocrError.message}` }],
              isError: true,
            };
          }
        }

        const lines = text.split('\n');
        const results = [];

        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(keyword.toLowerCase())) {
            const start = Math.max(0, index - context_lines);
            const end = Math.min(lines.length, index + context_lines + 1);
            const context = lines.slice(start, end).join('\n');
            const estimatedPage = Math.floor(index / (lines.length / data.numpages)) + 1;

            results.push({
              line: index + 1,
              page: estimatedPage,
              context: context,
            });
          }
        });

        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: `未找到关键词 "${keyword}"` }],
          };
        }

        const output = results
          .slice(0, 10)
          .map((r, i) => `--- 结果 ${i + 1} (约第${r.page}页) ---\n${r.context}`)
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `搜索关键词 "${keyword}"，找到 ${results.length} 处匹配:\n\n${output}${results.length > 10 ? '\n\n...还有更多结果未显示' : ''}`,
            },
          ],
        };
      }

      case 'ocr_pdf': {
        const { file_path, start_page, end_page, lang = 'ch_sim+en', dpi = 150 } = args;

        try {
          await fs.access(file_path);
        } catch {
          return {
            content: [{ type: 'text', text: `错误：文件不存在: ${file_path}` }],
            isError: true,
          };
        }

        try {
          const text = await callOCRSpec(file_path, {
            startPage: start_page ? start_page - 1 : undefined,
            endPage: end_page,
            lang,
            dpi,
          });
          return {
            content: [
              {
                type: 'text',
                text: `OCR识别结果: ${path.basename(file_path)}\n${start_page ? `页面: ${start_page}-${end_page || '末页'}` : '全部页面'}\n\n${text}`,
              },
            ],
          };
        } catch (ocrError) {
          return {
            content: [{ type: 'text', text: `OCR失败: ${ocrError.message}\n\n请确保已安装依赖:\npip install easyocr pymupdf` }],
            isError: true,
          };
        }
      }

      default:
        return {
          content: [{ type: 'text', text: `未知工具: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `错误: ${error.message}` }],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PDF Reader MCP Server v1.1.0 已启动 (支持OCR)');
}

main().catch(console.error);
