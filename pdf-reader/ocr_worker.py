#!/usr/bin/env python3
"""
OCR Worker Script for PDF Reader MCP Server
使用EasyOCR对PDF进行文字识别，优化性能：
1. 模型只加载一次
2. 支持分页处理
3. 支持自定义DPI和语言
"""

import sys
import os
import argparse

def main():
    parser = argparse.ArgumentParser(description='OCR for PDF files')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--dpi', type=int, default=150, help='Render DPI (default: 150)')
    parser.add_argument('--lang', default='ch_sim+en', help='OCR languages (default: ch_sim+en)')
    parser.add_argument('--start-page', type=int, default=0, help='Start page (0-indexed)')
    parser.add_argument('--end-page', type=int, default=-1, help='End page (exclusive, -1 for all)')
    parser.add_argument('--chunk-height', type=int, default=2000, help='Height of chunks for OCR')
    args = parser.parse_args()

    if not os.path.exists(args.pdf_path):
        print(f"Error: File not found: {args.pdf_path}", file=sys.stderr)
        sys.exit(1)

    try:
        import fitz  # PyMuPDF
    except ImportError:
        print("Error: PyMuPDF not installed. Run: pip install pymupdf", file=sys.stderr)
        sys.exit(1)

    try:
        from easyocr import Reader
    except ImportError:
        print("Error: EasyOCR not installed. Run: pip install easyocr", file=sys.stderr)
        sys.exit(1)

    # 解析语言
    langs = args.lang.split('+')
    
    # 初始化OCR reader（模型只加载一次）
    reader = Reader(langs, gpu=False)

    # 打开PDF
    doc = fitz.open(args.pdf_path)
    total_pages = len(doc)
    
    start = args.start_page
    end = args.end_page if args.end_page > 0 else total_pages
    end = min(end, total_pages)

    all_text = []

    for page_idx in range(start, end):
        page = doc[page_idx]
        
        # 渲染页面为图片
        mat = fitz.Matrix(args.dpi / 72, args.dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        
        # 保存为临时文件
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            tmp_path = tmp.name
            pix.save(tmp_path)
        
        try:
            # OCR识别
            results = reader.readtext(tmp_path)
            
            # 按位置排序并提取文本
            text_lines = []
            for detection in results:
                if detection and len(detection) >= 2:
                    text_lines.append(detection[1])
            
            page_text = '\n'.join(text_lines)
            all_text.append(f"--- 第{page_idx + 1}页 ---\n{page_text}")
        finally:
            # 清理临时文件
            try:
                os.unlink(tmp_path)
            except:
                pass

    doc.close()
    print('\n\n'.join(all_text))

if __name__ == '__main__':
    main()
