#!/usr/bin/env node

/**
 * PDF Writer MCP Server
 * 提供 PDF 创建和编辑功能
 *
 * 工具列表：
 * - create_pdf: 创建新的PDF文件
 * - add_text_page: 添加文本页面
 * - add_image_page: 添加图片页面
 * - merge_pdfs: 合并多个PDF
 * - split_pdf: 拆分PDF
 * - extract_images: 提取PDF中的图片
 * - add_watermark: 添加水印
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const server = new Server(
  { name: 'pdf-writer', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'create_pdf',
      description: '创建一个新的PDF文件，可以设置页面大小和添加文本内容。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: '输出PDF文件的绝对路径' },
          title: { type: 'string', description: 'PDF标题（可选）' },
          author: { type: 'string', description: '作者（可选）' },
          pages: {
            type: 'array',
            description: '页面内容数组',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string', description: '页面文本内容' },
                font_size: { type: 'number', description: '字体大小（默认12）' },
              },
            },
          },
        },
        required: ['file_path'],
      },
    },
    {
      name: 'add_text_to_pdf',
      description: '向现有PDF添加文本内容，可以指定位置、字体大小和颜色。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'PDF文件的绝对路径' },
          output_path: { type: 'string', description: '输出文件路径（可选，默认覆盖原文件）' },
          page_number: { type: 'number', description: '页码（从1开始）' },
          text: { type: 'string', description: '要添加的文本' },
          x: { type: 'number', description: 'X坐标（默认50）' },
          y: { type: 'number', description: 'Y坐标（默认700）' },
          font_size: { type: 'number', description: '字体大小（默认12）' },
          color: { type: 'string', description: '颜色（十六进制，如#000000，默认黑色）' },
        },
        required: ['file_path', 'page_number', 'text'],
      },
    },
    {
      name: 'merge_pdfs',
      description: '合并多个PDF文件为一个。',
      inputSchema: {
        type: 'object',
        properties: {
          input_files: {
            type: 'array',
            items: { type: 'string' },
            description: '要合并的PDF文件路径数组',
          },
          output_path: { type: 'string', description: '输出PDF文件路径' },
        },
        required: ['input_files', 'output_path'],
      },
    },
    {
      name: 'split_pdf',
      description: '将PDF文件拆分为多个单页PDF或提取指定页面。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'PDF文件路径' },
          output_dir: { type: 'string', description: '输出目录' },
          start_page: { type: 'number', description: '起始页（可选，从1开始）' },
          end_page: { type: 'number', description: '结束页（可选）' },
          single_pages: { type: 'boolean', description: '是否拆分为单页文件' },
        },
        required: ['file_path', 'output_dir'],
      },
    },
    {
      name: 'add_image_to_pdf',
      description: '向PDF添加图片。',
      inputSchema: {
        type: 'object',
        properties: {
          pdf_path: { type: 'string', description: 'PDF文件路径' },
          image_path: { type: 'string', description: '图片文件路径' },
          output_path: { type: 'string', description: '输出PDF路径（可选）' },
          page_number: { type: 'number', description: '页码（从1开始）' },
          x: { type: 'number', description: 'X坐标' },
          y: { type: 'number', description: 'Y坐标' },
          width: { type: 'number', description: '图片宽度（可选）' },
          height: { type: 'number', description: '图片高度（可选）' },
        },
        required: ['pdf_path', 'image_path', 'page_number', 'x', 'y'],
      },
    },
    {
      name: 'create_pdf_from_images',
      description: '从多张图片创建PDF文件。',
      inputSchema: {
        type: 'object',
        properties: {
          image_paths: {
            type: 'array',
            items: { type: 'string' },
            description: '图片文件路径数组',
          },
          output_path: { type: 'string', description: '输出PDF文件路径' },
          page_size: { type: 'string', description: '页面大小：a4/letter（默认a4）' },
        },
        required: ['image_paths', 'output_path'],
      },
    },
    {
      name: 'add_watermark',
      description: '向PDF添加水印文字。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'PDF文件路径' },
          output_path: { type: 'string', description: '输出PDF路径（可选）' },
          watermark_text: { type: 'string', description: '水印文字' },
          font_size: { type: 'number', description: '字体大小（默认50）' },
          opacity: { type: 'number', description: '透明度0-1（默认0.3）' },
          rotation: { type: 'number', description: '旋转角度（默认-45）' },
          color: { type: 'string', description: '颜色（默认#808080灰色）' },
        },
        required: ['file_path', 'watermark_text'],
      },
    },
    {
      name: 'delete_pages',
      description: '删除PDF中的指定页面。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'PDF文件路径' },
          output_path: { type: 'string', description: '输出PDF路径（可选）' },
          pages: {
            type: 'array',
            items: { type: 'number' },
            description: '要删除的页码数组（从1开始）',
          },
        },
        required: ['file_path', 'pages'],
      },
    },
    {
      name: 'rotate_pages',
      description: '旋转PDF中的页面。',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'PDF文件路径' },
          output_path: { type: 'string', description: '输出PDF路径（可选）' },
          pages: {
            type: 'array',
            items: { type: 'number' },
            description: '要旋转的页码数组（从1开始，空则全部）',
          },
          degrees: { type: 'number', description: '旋转角度：90/180/270' },
        },
        required: ['file_path', 'degrees'],
      },
    },
  ],
}));

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000000');
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  } : { r: 0, g: 0, b: 0 };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'create_pdf': {
        const { file_path, title, author, pages } = args;
        const pdfDoc = await PDFDocument.create();

        if (title) pdfDoc.setTitle(title);
        if (author) pdfDoc.setAuthor(author);

        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        if (pages && pages.length > 0) {
          for (const pageContent of pages) {
            const page = pdfDoc.addPage([595.28, 841.89]);
            const fontSize = pageContent.font_size || 12;
            if (pageContent.text) {
              page.drawText(pageContent.text, { x: 50, y: 750, size: fontSize, font });
            }
          }
        } else {
          pdfDoc.addPage([595.28, 841.89]);
        }

        const pdfBytes = await pdfDoc.save();
        await fs.writeFile(file_path, pdfBytes);

        return { content: [{ type: 'text', text: `PDF已创建: ${file_path}\n页数: ${pdfDoc.getPageCount()}` }] };
      }

      case 'add_text_to_pdf': {
        const { file_path, output_path, page_number, text, x = 50, y = 700, font_size = 12, color } = args;
        
        const pdfBytes = await fs.readFile(file_path);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        if (page_number < 1 || page_number > pdfDoc.getPageCount()) {
          return { content: [{ type: 'text', text: `错误: 页码超出范围，PDF共${pdfDoc.getPageCount()}页` }], isError: true };
        }

        const page = pdfDoc.getPages()[page_number - 1];
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const rgbColor = hexToRgb(color);

        page.drawText(text, {
          x, y,
          size: font_size,
          font,
          color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
        });

        const outPath = output_path || file_path;
        await fs.writeFile(outPath, await pdfDoc.save());

        return { content: [{ type: 'text', text: `文本已添加到第${page_number}页` }] };
      }

      case 'merge_pdfs': {
        const { input_files, output_path } = args;
        const mergedPdf = await PDFDocument.create();

        for (const filePath of input_files) {
          const pdfBytes = await fs.readFile(filePath);
          const pdf = await PDFDocument.load(pdfBytes);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach(page => mergedPdf.addPage(page));
        }

        await fs.writeFile(output_path, await mergedPdf.save());

        return { content: [{ type: 'text', text: `已合并${input_files.length}个PDF文件到: ${output_path}\n总页数: ${mergedPdf.getPageCount()}` }] };
      }

      case 'split_pdf': {
        const { file_path, output_dir, start_page, end_page, single_pages } = args;
        
        const pdfBytes = await fs.readFile(file_path);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const totalPages = pdfDoc.getPageCount();

        await fs.mkdir(output_dir, { recursive: true });
        const baseName = path.basename(file_path, '.pdf');

        if (single_pages) {
          for (let i = 0; i < totalPages; i++) {
            const newPdf = await PDFDocument.create();
            const [page] = await newPdf.copyPages(pdfDoc, [i]);
            newPdf.addPage(page);
            await fs.writeFile(path.join(output_dir, `${baseName}_page${i + 1}.pdf`), await newPdf.save());
          }
          return { content: [{ type: 'text', text: `已拆分为${totalPages}个单页PDF文件\n输出目录: ${output_dir}` }] };
        } else {
          const start = (start_page || 1) - 1;
          const end = Math.min(end_page || totalPages, totalPages);
          
          const newPdf = await PDFDocument.create();
          const pages = await newPdf.copyPages(pdfDoc, Array.from({ length: end - start }, (_, i) => start + i));
          pages.forEach(p => newPdf.addPage(p));

          const outPath = path.join(output_dir, `${baseName}_pages${start + 1}-${end}.pdf`);
          await fs.writeFile(outPath, await newPdf.save());

          return { content: [{ type: 'text', text: `已提取第${start + 1}-${end}页\n输出文件: ${outPath}` }] };
        }
      }

      case 'add_image_to_pdf': {
        const { pdf_path, image_path, output_path, page_number, x, y, width, height } = args;
        
        const pdfBytes = await fs.readFile(pdf_path);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        if (page_number < 1 || page_number > pdfDoc.getPageCount()) {
          return { content: [{ type: 'text', text: `错误: 页码超出范围` }], isError: true };
        }

        const imageBytes = await fs.readFile(image_path);
        let image;
        
        try {
          image = await pdfDoc.embedPng(imageBytes);
        } catch {
          image = await pdfDoc.embedJpg(imageBytes);
        }

        const page = pdfDoc.getPages()[page_number - 1];
        const imgWidth = width || image.width;
        const imgHeight = height || image.height;

        page.drawImage(image, { x, y, width: imgWidth, height: imgHeight });

        const outPath = output_path || pdf_path;
        await fs.writeFile(outPath, await pdfDoc.save());

        return { content: [{ type: 'text', text: `图片已添加到第${page_number}页` }] };
      }

      case 'create_pdf_from_images': {
        const { image_paths, output_path, page_size = 'a4' } = args;
        
        const pdfDoc = await PDFDocument.create();
        const pageDims = page_size === 'letter' ? [612, 792] : [595.28, 841.89];

        for (const imgPath of image_paths) {
          const imageBytes = await fs.readFile(imgPath);
          let image;
          try {
            image = await pdfDoc.embedPng(imageBytes);
          } catch {
            image = await pdfDoc.embedJpg(imageBytes);
          }

          const page = pdfDoc.addPage(pageDims);
          const scale = Math.min(pageDims[0] / image.width, pageDims[1] / image.height) * 0.9;
          const width = image.width * scale;
          const height = image.height * scale;
          const x = (pageDims[0] - width) / 2;
          const y = (pageDims[1] - height) / 2;

          page.drawImage(image, { x, y, width, height });
        }

        await fs.writeFile(output_path, await pdfDoc.save());

        return { content: [{ type: 'text', text: `已从${image_paths.length}张图片创建PDF: ${output_path}` }] };
      }

      case 'add_watermark': {
        const { file_path, output_path, watermark_text, font_size = 50, opacity = 0.3, rotation = -45, color = '#808080' } = args;
        
        const pdfBytes = await fs.readFile(file_path);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const rgbColor = hexToRgb(color);

        for (const page of pdfDoc.getPages()) {
          const { width, height } = page.getSize();
          page.drawText(watermark_text, {
            x: width / 2 - 100,
            y: height / 2,
            size: font_size,
            font,
            color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
            opacity,
            rotate: { type: 'degrees', angle: rotation },
          });
        }

        const outPath = output_path || file_path;
        await fs.writeFile(outPath, await pdfDoc.save());

        return { content: [{ type: 'text', text: `水印已添加到${pdfDoc.getPageCount()}页` }] };
      }

      case 'delete_pages': {
        const { file_path, output_path, pages } = args;
        
        const pdfBytes = await fs.readFile(file_path);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        const pagesToDelete = pages.map(p => p - 1).sort((a, b) => b - a);
        for (const pageIndex of pagesToDelete) {
          pdfDoc.removePage(pageIndex);
        }

        const outPath = output_path || file_path;
        await fs.writeFile(outPath, await pdfDoc.save());

        return { content: [{ type: 'text', text: `已删除${pages.length}页，剩余${pdfDoc.getPageCount()}页` }] };
      }

      case 'rotate_pages': {
        const { file_path, output_path, pages, degrees } = args;
        
        const pdfBytes = await fs.readFile(file_path);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        const pagesToRotate = pages || Array.from({ length: pdfDoc.getPageCount() }, (_, i) => i + 1);
        
        for (const pageNum of pagesToRotate) {
          const page = pdfDoc.getPages()[pageNum - 1];
          const currentRotation = page.getRotation().angle;
          page.setRotation({ type: 'degrees', angle: currentRotation + degrees });
        }

        const outPath = output_path || file_path;
        await fs.writeFile(outPath, await pdfDoc.save());

        return { content: [{ type: 'text', text: `已旋转${pagesToRotate.length}页${degrees}度` }] };
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
  console.error('PDF Writer MCP Server 已启动');
}

main().catch(console.error);
