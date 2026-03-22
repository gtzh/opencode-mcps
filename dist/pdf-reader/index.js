#!/usr/bin/env node

/**
 * PDF Reader MCP Server
 * 提供 PDF 文件解析功能
 * 
 * 工具列表：
 * - read_pdf: 读取PDF文件内容
 * - get_pdf_info: 获取PDF文件信息（页数、作者等）
 * - extract_pdf_pages: 提取指定页面内容
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

// 创建MCP服务器
const server = new Server(
  {
    name: 'pdf-reader',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 列出所有可用工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'read_pdf',
        description: '读取PDF文件的完整文本内容。支持读取本地PDF文件，返回提取的文本。',
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
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'read_pdf': {
        const { file_path, max_pages } = args;
        
        // 验证文件存在
        try {
          await fs.access(file_path);
        } catch {
          return {
            content: [{ type: 'text', text: `错误：文件不存在: ${file_path}` }],
            isError: true,
          };
        }

        // 读取PDF文件
        const dataBuffer = await fs.readFile(file_path);
        const data = await pdf(dataBuffer);
        
        let text = data.text;
        let pagesRead = data.numpages;
        
        // 如果设置了最大页数限制
        if (max_pages && max_pages < data.numpages) {
          pagesRead = max_pages;
          text = text.split('\n').slice(0, max_pages * 50).join('\n'); // 粗略估算
        }

        return {
          content: [
            {
              type: 'text',
              text: `PDF文件: ${path.basename(file_path)}\n总页数: ${data.numpages}${max_pages ? ` (读取: ${pagesRead}页)` : ''}\n\n${text}`,
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

        const info = {
          文件名: path.basename(file_path),
          文件大小: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          页数: data.numpages,
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

        // 简单的页面分割（基于换行符估算）
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
        
        const lines = data.text.split('\n');
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
          .slice(0, 10) // 最多返回10个结果
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
  console.error('PDF Reader MCP Server 已启动');
}

main().catch(console.error);
