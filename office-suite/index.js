#!/usr/bin/env node

/**
 * Office Suite MCP Server
 * 提供 Word、Excel、PowerPoint 文件的读写功能
 *
 * 工具列表：
 * Word: read_docx, create_docx, add_paragraph
 * Excel: read_xlsx, create_xlsx, add_sheet, add_data
 * PowerPoint: read_pptx, create_pptx, add_slide
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import pptxgen from 'pptxgenjs';
import fs from 'fs/promises';
import path from 'path';

const server = new Server(
  { name: 'office-suite', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ========== Word Tools ==========
    {
      name: 'read_docx',
      description: '读取Word文档(.docx)内容，提取文本和结构。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Word文档的绝对路径' },
          extract_images: { type: 'boolean', description: '是否提取图片信息（默认false）' },
        },
        required: ['file_path'],
      },
    },
    {
      name: 'create_docx',
      description: '创建新的Word文档，支持标题、段落、表格等。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: '输出Word文档的路径' },
          title: { type: 'string', description: '文档标题' },
          content: {
            type: 'array',
            description: '文档内容',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['heading', 'paragraph', 'bullet', 'table'], description: '内容类型' },
                text: { type: 'string', description: '文本内容' },
                level: { type: 'number', description: '标题级别(1-6)' },
                rows: { type: 'array', description: '表格行数据' },
              },
            },
          },
        },
        required: ['file_path'],
      },
    },
    {
      name: 'add_paragraph_to_docx',
      description: '向现有Word文档添加段落。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Word文档路径' },
          paragraphs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                bold: { type: 'boolean' },
                italic: { type: 'boolean' },
                size: { type: 'number' },
              },
            },
          },
        },
        required: ['file_path', 'paragraphs'],
      },
    },

    // ========== Excel Tools ==========
    {
      name: 'read_xlsx',
      description: '读取Excel文件(.xlsx)内容，返回工作表名称和数据。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Excel文件的绝对路径' },
          sheet_name: { type: 'string', description: '工作表名称（可选，默认第一个）' },
          max_rows: { type: 'number', description: '最大读取行数（可选）' },
        },
        required: ['file_path'],
      },
    },
    {
      name: 'get_xlsx_sheets',
      description: '获取Excel文件中所有工作表的名称列表。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Excel文件的绝对路径' },
        },
        required: ['file_path'],
      },
    },
    {
      name: 'create_xlsx',
      description: '创建新的Excel文件。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: '输出Excel文件的路径' },
          sheet_name: { type: 'string', description: '工作表名称（默认Sheet1）' },
          headers: {
            type: 'array',
            items: { type: 'string' },
            description: '表头',
          },
          data: {
            type: 'array',
            items: { type: 'array' },
            description: '数据行',
          },
        },
        required: ['file_path'],
      },
    },
    {
      name: 'add_sheet_to_xlsx',
      description: '向现有Excel文件添加新工作表。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Excel文件路径' },
          sheet_name: { type: 'string', description: '新工作表名称' },
          headers: { type: 'array', items: { type: 'string' } },
          data: { type: 'array', items: { type: 'array' } },
        },
        required: ['file_path', 'sheet_name'],
      },
    },
    {
      name: 'append_data_to_xlsx',
      description: '向Excel工作表追加数据行。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Excel文件路径' },
          sheet_name: { type: 'string', description: '工作表名称（默认第一个）' },
          data: { type: 'array', items: { type: 'array' }, description: '要追加的数据行' },
        },
        required: ['file_path', 'data'],
      },
    },
    {
      name: 'xlsx_to_csv',
      description: '将Excel工作表导出为CSV文件。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Excel文件路径' },
          output_path: { type: 'string', description: '输出CSV路径' },
          sheet_name: { type: 'string', description: '工作表名称（可选）' },
        },
        required: ['file_path', 'output_path'],
      },
    },
    {
      name: 'csv_to_xlsx',
      description: '将CSV文件转换为Excel文件。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'CSV文件路径' },
          output_path: { type: 'string', description: '输出Excel路径' },
          sheet_name: { type: 'string', description: '工作表名称（默认Sheet1）' },
          delimiter: { type: 'string', description: '分隔符（默认逗号）' },
        },
        required: ['file_path', 'output_path'],
      },
    },

    // ========== PowerPoint Tools ==========
    {
      name: 'read_pptx',
      description: '读取PowerPoint文件(.pptx)内容，提取每张幻灯片的文本。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'PowerPoint文件的绝对路径' },
        },
        required: ['file_path'],
      },
    },
    {
      name: 'create_pptx',
      description: '创建新的PowerPoint演示文稿。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: '输出PPT文件路径' },
          title: { type: 'string', description: '演示文稿标题' },
          slides: {
            type: 'array',
            description: '幻灯片数组',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: '幻灯片标题' },
                content: { type: 'array', items: { type: 'string' }, description: '内容文本列表' },
                layout: { type: 'string', enum: ['title', 'titleContent', 'twoContent'], description: '布局类型' },
              },
            },
          },
        },
        required: ['file_path'],
      },
    },
    {
      name: 'add_slide_to_pptx',
      description: '向现有PowerPoint文件添加幻灯片。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'PPT文件路径' },
          title: { type: 'string', description: '幻灯片标题' },
          content: { type: 'array', items: { type: 'string' }, description: '内容文本' },
          layout: { type: 'string', description: '布局类型' },
        },
        required: ['file_path', 'title'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ========== Word Tools ==========
      case 'read_docx': {
        const { file_path, extract_images } = args;
        const buffer = await fs.readFile(file_path);
        
        const result = await mammoth.extractRawText({ buffer });
        let text = `Word文档: ${path.basename(file_path)}\n\n${result.value}`;
        
        if (extract_images) {
          const imageResult = await mammoth.convertToHtml({ buffer });
          const imageCount = (imageResult.value.match(/<img/g) || []).length;
          text += `\n\n[包含 ${imageCount} 张图片]`;
        }
        
        return { content: [{ type: 'text', text }] };
      }

      case 'create_docx': {
        const { file_path, title, content = [] } = args;
        
        const children = [];
        
        if (title) {
          children.push(new Paragraph({
            text: title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }));
        }

        for (const item of content) {
          if (item.type === 'heading') {
            children.push(new Paragraph({
              text: item.text,
              heading: HeadingLevel[`HEADING_${item.level || 1}`],
            }));
          } else if (item.type === 'paragraph') {
            children.push(new Paragraph({ text: item.text }));
          } else if (item.type === 'bullet') {
            children.push(new Paragraph({ text: item.text, bullet: { level: 0 } }));
          } else if (item.type === 'table' && item.rows) {
            const rows = item.rows.map(row => new TableRow({
              children: row.map(cell => new TableCell({
                children: [new Paragraph({ text: String(cell) })],
                width: { size: 100 / row.length, type: WidthType.PERCENTAGE },
              })),
            }));
            children.push(new Table({ rows }));
          }
        }

        const doc = new Document({ sections: [{ children }] });
        const buffer = await Packer.toBuffer(doc);
        await fs.writeFile(file_path, buffer);

        return { content: [{ type: 'text', text: `Word文档已创建: ${file_path}` }] };
      }

      case 'add_paragraph_to_docx': {
        return { content: [{ type: 'text', text: '注意: 此功能需要重新创建文档。建议使用 create_docx 创建包含所有内容的文档。' }] };
      }

      // ========== Excel Tools ==========
      case 'read_xlsx': {
        const { file_path, sheet_name, max_rows } = args;
        const buffer = await fs.readFile(file_path);
        const workbook = XLSX.read(buffer);
        
        const sheetName = sheet_name || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        if (!sheet) {
          return { content: [{ type: 'text', text: `错误: 找不到工作表 "${sheetName}"` }], isError: true };
        }

        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const rows = max_rows ? data.slice(0, max_rows) : data;

        let text = `Excel文件: ${path.basename(file_path)}\n`;
        text += `工作表: ${sheetName}\n`;
        text += `总行数: ${data.length}\n\n`;

        const displayRows = rows.map(row => row.join('\t')).join('\n');
        text += displayRows;

        return { content: [{ type: 'text', text }] };
      }

      case 'get_xlsx_sheets': {
        const { file_path } = args;
        const buffer = await fs.readFile(file_path);
        const workbook = XLSX.read(buffer);

        const sheets = workbook.SheetNames.map((name, i) => `${i + 1}. ${name}`).join('\n');
        return { content: [{ type: 'text', text: `工作表列表:\n${sheets}` }] };
      }

      case 'create_xlsx': {
        const { file_path, sheet_name = 'Sheet1', headers, data = [] } = args;
        
        const workbook = XLSX.utils.book_new();
        const sheetData = headers ? [headers, ...data] : data;
        const sheet = XLSX.utils.aoa_to_sheet(sheetData);
        
        XLSX.utils.book_append_sheet(workbook, sheet, sheet_name);
        XLSX.writeFile(workbook, file_path);

        return { content: [{ type: 'text', text: `Excel文件已创建: ${file_path}\n工作表: ${sheet_name}` }] };
      }

      case 'add_sheet_to_xlsx': {
        const { file_path, sheet_name, headers, data = [] } = args;
        
        const workbook = XLSX.readFile(file_path);
        const sheetData = headers ? [headers, ...data] : data;
        const sheet = XLSX.utils.aoa_to_sheet(sheetData);
        
        XLSX.utils.book_append_sheet(workbook, sheet, sheet_name);
        XLSX.writeFile(workbook, file_path);

        return { content: [{ type: 'text', text: `工作表 "${sheet_name}" 已添加` }] };
      }

      case 'append_data_to_xlsx': {
        const { file_path, sheet_name, data } = args;
        
        const workbook = XLSX.readFile(file_path);
        const sheetName = sheet_name || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const existingData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const newData = [...existingData, ...data];
        
        const newSheet = XLSX.utils.aoa_to_sheet(newData);
        workbook.Sheets[sheetName] = newSheet;
        XLSX.writeFile(workbook, file_path);

        return { content: [{ type: 'text', text: `已追加 ${data.length} 行数据` }] };
      }

      case 'xlsx_to_csv': {
        const { file_path, output_path, sheet_name } = args;
        
        const workbook = XLSX.readFile(file_path);
        const sheetName = sheet_name || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const csv = XLSX.utils.sheet_to_csv(sheet);
        await fs.writeFile(output_path, csv, 'utf-8');

        return { content: [{ type: 'text', text: `已导出CSV: ${output_path}` }] };
      }

      case 'csv_to_xlsx': {
        const { file_path, output_path, sheet_name = 'Sheet1', delimiter = ',' } = args;
        
        const csvData = await fs.readFile(file_path, 'utf-8');
        const workbook = XLSX.read(csvData, { type: 'string', raw: false });
        
        XLSX.writeFile(workbook, output_path);

        return { content: [{ type: 'text', text: `已转换为Excel: ${output_path}` }] };
      }

      // ========== PowerPoint Tools ==========
      case 'read_pptx': {
        const { file_path } = args;
        const pptx = new pptxgen();
        
        const AdmZip = (await import('adm-zip')).default;
        const zip = new AdmZip(file_path);
        const entries = zip.getEntries();
        
        let text = `PowerPoint文件: ${path.basename(file_path)}\n\n`;
        let slideNum = 0;

        for (const entry of entries) {
          if (entry.entryName.match(/ppt\/slides\/slide\d+\.xml$/)) {
            slideNum++;
            const content = entry.getData().toString('utf8');
            const texts = content.match(/<a:t>([^<]*)<\/a:t>/g) || [];
            const slideTexts = texts.map(t => t.replace(/<\/?a:t>/g, '')).join(' ');
            
            text += `--- 幻灯片 ${slideNum} ---\n`;
            text += slideTexts || '[无文本内容]';
            text += '\n\n';
          }
        }

        text += `总计: ${slideNum} 张幻灯片`;
        return { content: [{ type: 'text', text }] };
      }

      case 'create_pptx': {
        const { file_path, title, slides = [] } = args;
        
        const pptx = new pptxgen();
        pptx.title = title || 'Presentation';
        pptx.author = 'MCP Office Suite';

        for (const slide of slides) {
          const newSlide = pptx.addSlide();
          
          if (slide.title) {
            newSlide.addText(slide.title, {
              x: 0.5, y: 0.5, w: 9, h: 1,
              fontSize: 32, bold: true,
            });
          }
          
          if (slide.content && slide.content.length > 0) {
            newSlide.addText(slide.content.join('\n'), {
              x: 0.5, y: 1.5, w: 9, h: 5,
              fontSize: 18, bullet: true,
            });
          }
        }

        await pptx.writeFile({ fileName: file_path });
        return { content: [{ type: 'text', text: `PowerPoint已创建: ${file_path}\n幻灯片数: ${slides.length || 1}` }] };
      }

      case 'add_slide_to_pptx': {
        return { content: [{ type: 'text', text: '注意: PPTX库限制，无法直接修改现有PPT。建议使用 create_pptx 重新创建包含所有幻灯片的演示文稿。' }] };
      }

      default:
        return { content: [{ type: 'text', text: `未知工具: ${name}` }], isError: true };
    }
  } catch (error) {
    return { content: [{ type: 'text', text: `错误: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Office Suite MCP Server 已启动');
}

main().catch(console.error);
