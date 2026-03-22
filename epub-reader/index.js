#!/usr/bin/env node

/**
 * EPUB Reader MCP Server
 * 提供 EPUB 电子书解析功能
 * 
 * 工具列表：
 * - read_epub: 读取EPUB文件内容
 * - get_epub_info: 获取EPUB元数据（标题、作者、出版信息等）
 * - list_epub_chapters: 列出EPUB所有章节
 * - read_epub_chapter: 读取指定章节内容
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import EPub from 'epub2';
import { parse } from 'node-html-parser';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

// 创建MCP服务器
const server = new Server(
  {
    name: 'epub-reader',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * 从HTML中提取纯文本
 */
function htmlToText(html) {
  const root = parse(html);
  
  // 移除script和style标签
  root.querySelectorAll('script, style').forEach(el => el.remove());
  
  // 获取纯文本，处理换行
  let text = root.textContent || '';
  text = text
    .replace(/\s+/g, ' ')  // 多个空白符替换为单个空格
    .replace(/\n\s*\n/g, '\n\n')  // 多个换行替换为双换行
    .trim();
  
  return text;
}

/**
 * 读取EPUB文件内容
 */
async function readEpubFile(filePath) {
  return new Promise((resolve, reject) => {
    const epub = new EPub(filePath, '', '');
    
    epub.on('end', function() {
      resolve(epub);
    });
    
    epub.on('error', function(err) {
      reject(err);
    });
    
    epub.parse();
  });
}

/**
 * 获取章节内容
 */
async function getChapterContent(epub, chapterId) {
  return new Promise((resolve, reject) => {
    epub.getChapter(chapterId, function(err, text) {
      if (err) reject(err);
      else resolve(text);
    });
  });
}

// 列出所有可用工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'read_epub',
        description: '读取EPUB电子书的完整内容。支持读取本地EPUB文件，返回提取的文本内容。',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'EPUB文件的绝对路径',
            },
            max_chapters: {
              type: 'number',
              description: '最大读取章节数（可选，默认读取全部）',
            },
          },
          required: ['file_path'],
        },
      },
      {
        name: 'get_epub_info',
        description: '获取EPUB电子书的基本信息，包括标题、作者、出版社、简介等元数据。',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'EPUB文件的绝对路径',
            },
          },
          required: ['file_path'],
        },
      },
      {
        name: 'list_epub_chapters',
        description: '列出EPUB电子书的所有章节标题和ID，方便按章节阅读。',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'EPUB文件的绝对路径',
            },
          },
          required: ['file_path'],
        },
      },
      {
        name: 'read_epub_chapter',
        description: '读取EPUB电子书的指定章节内容。需要先通过list_epub_chapters获取章节ID。',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'EPUB文件的绝对路径',
            },
            chapter_id: {
              type: 'string',
              description: '章节ID（从list_epub_chapters获取）',
            },
          },
          required: ['file_path', 'chapter_id'],
        },
      },
      {
        name: 'search_epub',
        description: '在EPUB电子书中搜索指定关键词，返回包含该关键词的章节和上下文。',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'EPUB文件的绝对路径',
            },
            keyword: {
              type: 'string',
              description: '要搜索的关键词',
            },
            max_results: {
              type: 'number',
              description: '最大返回结果数（默认10）',
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
      case 'read_epub': {
        const { file_path, max_chapters } = args;
        
        // 验证文件存在
        try {
          await fs.access(file_path);
        } catch {
          return {
            content: [{ type: 'text', text: `错误：文件不存在: ${file_path}` }],
            isError: true,
          };
        }

        const epub = await readEpubFile(file_path);
        const chapters = epub.spine || [];
        const limit = max_chapters || chapters.length;
        
        let fullText = `书名: ${epub.metadata?.title || '未知'}\n`;
        fullText += `作者: ${epub.metadata?.creator || '未知'}\n`;
        fullText += `总章节: ${chapters.length}\n\n`;
        fullText += `${'='.repeat(40)}\n\n`;

        const chaptersToRead = chapters.slice(0, limit);
        
        for (const chapter of chaptersToRead) {
          try {
            const chapterHtml = await getChapterContent(epub, chapter.id);
            const chapterText = htmlToText(chapterHtml);
            
            fullText += `【${chapter.title || '未命名章节'}】\n\n`;
            fullText += chapterText + '\n\n';
            fullText += `${'─'.repeat(40)}\n\n`;
          } catch (err) {
            fullText += `[章节读取失败: ${err.message}]\n\n`;
          }
        }

        if (limit < chapters.length) {
          fullText += `... 还有 ${chapters.length - limit} 个章节未读取\n`;
        }

        return {
          content: [{ type: 'text', text: fullText }],
        };
      }

      case 'get_epub_info': {
        const { file_path } = args;
        
        try {
          await fs.access(file_path);
        } catch {
          return {
            content: [{ type: 'text', text: `错误：文件不存在: ${file_path}` }],
            isError: true,
          };
        }

        const epub = await readEpubFile(file_path);
        const stats = await fs.stat(file_path);

        const info = {
          文件名: path.basename(file_path),
          文件大小: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          书名: epub.metadata?.title || '未知',
          作者: epub.metadata?.creator || '未知',
          出版社: epub.metadata?.publisher || '未知',
          出版日期: epub.metadata?.date || '未知',
          语言: epub.metadata?.language || '未知',
          简介: epub.metadata?.description || '无',
          标识符: epub.metadata?.identifier || '未知',
          章节数: (epub.spine || []).length,
        };

        const infoText = Object.entries(info)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');

        return {
          content: [{ type: 'text', text: `EPUB电子书信息:\n\n${infoText}` }],
        };
      }

      case 'list_epub_chapters': {
        const { file_path } = args;
        
        try {
          await fs.access(file_path);
        } catch {
          return {
            content: [{ type: 'text', text: `错误：文件不存在: ${file_path}` }],
            isError: true,
          };
        }

        const epub = await readEpubFile(file_path);
        const chapters = epub.spine || [];

        if (chapters.length === 0) {
          return {
            content: [{ type: 'text', text: '该EPUB文件没有章节信息' }],
          };
        }

        const chapterList = chapters
          .map((ch, index) => `${index + 1}. [${ch.id}] ${ch.title || '未命名'}`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `书名: ${epub.metadata?.title || '未知'}\n章节数: ${chapters.length}\n\n章节列表:\n${chapterList}`,
            },
          ],
        };
      }

      case 'read_epub_chapter': {
        const { file_path, chapter_id } = args;
        
        try {
          await fs.access(file_path);
        } catch {
          return {
            content: [{ type: 'text', text: `错误：文件不存在: ${file_path}` }],
            isError: true,
          };
        }

        const epub = await readEpubFile(file_path);
        
        // 查找章节
        const chapter = epub.spine?.find(ch => ch.id === chapter_id);
        if (!chapter) {
          return {
            content: [{ type: 'text', text: `错误：找不到章节ID "${chapter_id}"，请使用list_epub_chapters获取正确的章节ID` }],
            isError: true,
          };
        }

        const chapterHtml = await getChapterContent(epub, chapter_id);
        const chapterText = htmlToText(chapterHtml);

        return {
          content: [
            {
              type: 'text',
              text: `章节: ${chapter.title || '未命名'}\nID: ${chapter_id}\n\n${chapterText}`,
            },
          ],
        };
      }

      case 'search_epub': {
        const { file_path, keyword, max_results = 10 } = args;
        
        try {
          await fs.access(file_path);
        } catch {
          return {
            content: [{ type: 'text', text: `错误：文件不存在: ${file_path}` }],
            isError: true,
          };
        }

        const epub = await readEpubFile(file_path);
        const chapters = epub.spine || [];
        const results = [];
        const lowerKeyword = keyword.toLowerCase();

        for (const chapter of chapters) {
          if (results.length >= max_results) break;
          
          try {
            const chapterHtml = await getChapterContent(epub, chapter.id);
            const chapterText = htmlToText(chapterHtml);
            
            if (chapterText.toLowerCase().includes(lowerKeyword)) {
              // 查找关键词位置，提取上下文
              const lowerText = chapterText.toLowerCase();
              const index = lowerText.indexOf(lowerKeyword);
              
              if (index !== -1) {
                const start = Math.max(0, index - 100);
                const end = Math.min(chapterText.length, index + keyword.length + 100);
                const context = (start > 0 ? '...' : '') + 
                  chapterText.slice(start, end) + 
                  (end < chapterText.length ? '...' : '');
                
                results.push({
                  chapter_id: chapter.id,
                  chapter_title: chapter.title || '未命名',
                  context: context,
                });
              }
            }
          } catch (err) {
            // 忽略读取失败的章节
          }
        }

        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: `未找到关键词 "${keyword}"` }],
          };
        }

        const output = results
          .map((r, i) => `--- 结果 ${i + 1}: ${r.chapter_title} ---\n章节ID: ${r.chapter_id}\n\n${r.context}`)
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `搜索关键词 "${keyword}"，找到 ${results.length} 处匹配:\n\n${output}`,
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
  console.error('EPUB Reader MCP Server 已启动');
}

main().catch(console.error);
