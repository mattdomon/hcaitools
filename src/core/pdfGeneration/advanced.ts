import {
  TextStyle,
  TextElement,
  RectElement,
  PDFImage,
  PDFTable,
  PDFPage,
} from './types';

export interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'table' | 'spacer' | 'group';
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  visible?: boolean;
}

export interface TextBlock extends ContentBlock {
  type: 'text';
  content: string;
  style?: TextStyle;
}

export interface ImageBlock extends ContentBlock {
  type: 'image';
  image: PDFImage;
}

export interface TableBlock extends ContentBlock {
  type: 'table';
  table: PDFTable;
}

export interface SpacerBlock extends ContentBlock {
  type: 'spacer';
  height: number;
}

export interface GroupBlock extends ContentBlock {
  type: 'group';
  blocks: ContentBlock[];
  layout?: 'vertical' | 'horizontal';
}

export type ComposableBlock = TextBlock | ImageBlock | TableBlock | SpacerBlock | GroupBlock;

export class PDFContentBuilder {
  private blocks: ComposableBlock[] = [];
  private defaultStyle: TextStyle = {};
  private currentX: number = 50;
  private currentY: number = 50;
  private pageWidth: number = 595;
  private pageHeight: number = 842;
  private marginLeft: number = 50;
  private marginRight: number = 50;
  private marginTop: number = 50;
  private marginBottom: number = 50;

  constructor(options?: {
    pageWidth?: number;
    pageHeight?: number;
    margins?: { top?: number; right?: number; bottom?: number; left?: number };
    defaultStyle?: TextStyle;
  }) {
    if (options?.pageWidth) this.pageWidth = options.pageWidth;
    if (options?.pageHeight) this.pageHeight = options.pageHeight;
    if (options?.margins) {
      this.marginTop = options.margins.top || 50;
      this.marginRight = options.margins.right || 50;
      this.marginBottom = options.margins.bottom || 50;
      this.marginLeft = options.margins.left || 50;
    }
    if (options?.defaultStyle) this.defaultStyle = options.defaultStyle;
    this.resetPosition();
  }

  addText(content: string, style?: TextStyle): PDFContentBuilder {
    const block: TextBlock = {
      id: `text_${Date.now()}_${Math.random()}`,
      type: 'text',
      content,
      style: { ...this.defaultStyle, ...style },
    };
    this.blocks.push(block);
    return this;
  }

  addHeading(content: string, level: 1 | 2 | 3 | 4 | 5 | 6 = 1): PDFContentBuilder {
    const fontSizes: Record<number, number> = { 1: 24, 2: 20, 3: 16, 4: 14, 5: 12, 6: 10 };
    const style: TextStyle = {
      fontSize: fontSizes[level],
      fontWeight: 'bold',
      alignment: 'left',
    };
    return this.addText(content, style);
  }

  addParagraph(content: string, justified: boolean = false): PDFContentBuilder {
    const style: TextStyle = {
      fontSize: 12,
      alignment: justified ? 'justify' : 'left',
      lineHeight: 1.5,
    };
    return this.addText(content, style);
  }

  addImage(image: PDFImage): PDFContentBuilder {
    const block: ImageBlock = {
      id: `image_${Date.now()}_${Math.random()}`,
      type: 'image',
      image,
    };
    this.blocks.push(block);
    return this;
  }

  addTable(table: PDFTable): PDFContentBuilder {
    const block: TableBlock = {
      id: `table_${Date.now()}_${Math.random()}`,
      type: 'table',
      table,
    };
    this.blocks.push(block);
    return this;
  }

  addSpacer(height: number): PDFContentBuilder {
    const block: SpacerBlock = {
      id: `spacer_${Date.now()}_${Math.random()}`,
      type: 'spacer',
      height,
    };
    this.blocks.push(block);
    return this;
  }

  addGroup(blocks: ComposableBlock[], layout: 'vertical' | 'horizontal' = 'vertical'): PDFContentBuilder {
    const group: GroupBlock = {
      id: `group_${Date.now()}_${Math.random()}`,
      type: 'group',
      blocks,
      layout,
    };
    this.blocks.push(group);
    return this;
  }

  addLineBreak(): PDFContentBuilder {
    return this.addSpacer(10);
  }

  addDivider(color: string = '#cccccc', thickness: number = 1): PDFContentBuilder {
    const block: RectElement = {
      id: `divider_${Date.now()}_${Math.random()}`,
      type: 'rect',
      x: this.marginLeft,
      y: this.currentY,
      width: this.pageWidth - this.marginLeft - this.marginRight,
      height: thickness,
      fillColor: color,
    };
    (this.blocks as unknown[]).push(block);
    this.currentY += thickness + 10;
    return this;
  }

  addList(items: string[], ordered: boolean = false): PDFContentBuilder {
    for (let i = 0; i < items.length; i++) {
      const bullet = ordered ? `${i + 1}. ` : '• ';
      this.addText(bullet + items[i], {
        fontSize: 11,
        alignment: 'left',
      });
    }
    return this;
  }

  addTable2D(data: string[][], options?: {
    headers?: boolean;
    alternateRows?: boolean;
    columnWidths?: number[];
  }): PDFContentBuilder {
    const table: PDFTable = {
      id: `table_${Date.now()}_${Math.random()}`,
      columns: data[0]?.map((_, idx) => ({
        width: options?.columnWidths?.[idx] || 100,
        header: options?.headers ? data[0][idx] : undefined,
      })) || [],
      rows: (options?.headers ? data.slice(1) : data).map((row) => ({
        cells: row.map((cell) => ({
          content: cell,
        })),
      })),
      alternateRowColors: options?.alternateRows ?? true,
    };
    return this.addTable(table);
  }

  getBlocks(): ComposableBlock[] {
    return [...this.blocks];
  }

  resetPosition(): void {
    this.currentX = this.marginLeft;
    this.currentY = this.marginTop;
  }

  clearBlocks(): PDFContentBuilder {
    this.blocks = [];
    this.resetPosition();
    return this;
  }

  getContentHeight(): number {
    let height = 0;
    for (const block of this.blocks) {
      if (block.type === 'text') {
        height += 15;
      } else if (block.type === 'spacer') {
        height += (block as SpacerBlock).height;
      } else if (block.type === 'image') {
        height += (block as ImageBlock).image.dimensions.height;
      } else if (block.type === 'table') {
        height += (block as TableBlock).table.rows.length * 20;
      }
    }
    return height;
  }
}

export class PDFStyleManager {
  private styles: Map<string, TextStyle> = new Map();
  private defaultStyle: TextStyle = {
    fontFamily: 'Helvetica',
    fontSize: 12,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#000000',
    alignment: 'left',
    lineHeight: 1.5,
  };

  constructor(defaultStyle?: TextStyle) {
    if (defaultStyle) {
      this.defaultStyle = { ...this.defaultStyle, ...defaultStyle };
    }
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.styles.set('heading1', {
      ...this.defaultStyle,
      fontSize: 24,
      fontWeight: 'bold',
    });
    this.styles.set('heading2', {
      ...this.defaultStyle,
      fontSize: 20,
      fontWeight: 'bold',
    });
    this.styles.set('heading3', {
      ...this.defaultStyle,
      fontSize: 16,
      fontWeight: 'bold',
    });
    this.styles.set('paragraph', {
      ...this.defaultStyle,
      fontSize: 12,
      lineHeight: 1.6,
    });
    this.styles.set('emphasis', {
      ...this.defaultStyle,
      fontStyle: 'italic',
    });
    this.styles.set('strong', {
      ...this.defaultStyle,
      fontWeight: 'bold',
    });
    this.styles.set('small', {
      ...this.defaultStyle,
      fontSize: 10,
    });
    this.styles.set('code', {
      ...this.defaultStyle,
      fontFamily: 'Courier',
      fontSize: 10,
      backgroundColor: '#f5f5f5',
    });
  }

  defineStyle(name: string, style: TextStyle): PDFStyleManager {
    this.styles.set(name, { ...this.defaultStyle, ...style });
    return this;
  }

  getStyle(name: string): TextStyle | undefined {
    return this.styles.get(name);
  }

  applyStyle(name: string, base?: TextStyle): TextStyle {
    const style = this.styles.get(name);
    if (!style) {
      return base || this.defaultStyle;
    }
    return { ...style, ...(base || {}) };
  }

  listStyles(): string[] {
    return Array.from(this.styles.keys());
  }

  removeStyle(name: string): boolean {
    return this.styles.delete(name);
  }

  clone(): PDFStyleManager {
    const manager = new PDFStyleManager(this.defaultStyle);
    for (const [name, style] of this.styles) {
      manager.styles.set(name, { ...style });
    }
    return manager;
  }

  mergeWith(other: PDFStyleManager): PDFStyleManager {
    const merged = this.clone();
    for (const style of other.listStyles()) {
      const otherStyle = other.getStyle(style);
      if (otherStyle) {
        merged.defineStyle(style, otherStyle);
      }
    }
    return merged;
  }
}

export class PDFPageLayout {
  private pages: PDFPage[] = [];
  private currentPageIndex: number = 0;
  private columns: number = 1;
  private columnGap: number = 20;
  private columnWidth: number = 0;
  private pageWidth: number = 595;
  private pageHeight: number = 842;
  private margins: { top: number; right: number; bottom: number; left: number } = {
    top: 50,
    right: 50,
    bottom: 50,
    left: 50,
  };

  constructor(options?: {
    pageWidth?: number;
    pageHeight?: number;
    columns?: number;
    columnGap?: number;
    margins?: { top?: number; right?: number; bottom?: number; left?: number };
  }) {
    if (options?.pageWidth) this.pageWidth = options.pageWidth;
    if (options?.pageHeight) this.pageHeight = options.pageHeight;
    if (options?.columns) this.columns = options.columns;
    if (options?.columnGap) this.columnGap = options.columnGap;
    if (options?.margins) {
      this.margins = { ...this.margins, ...options.margins };
    }
    this.calculateColumnWidth();
  }

  private calculateColumnWidth(): void {
    const usableWidth = this.pageWidth - this.margins.left - this.margins.right;
    const totalGap = this.columnGap * (this.columns - 1);
    this.columnWidth = (usableWidth - totalGap) / this.columns;
  }

  getColumnPositions(): { x: number; width: number }[] {
    const positions: { x: number; width: number }[] = [];
    let currentX = this.margins.left;

    for (let i = 0; i < this.columns; i++) {
      positions.push({ x: currentX, width: this.columnWidth });
      currentX += this.columnWidth + this.columnGap;
    }

    return positions;
  }

  getUsableArea(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    return {
      x: this.margins.left,
      y: this.margins.top,
      width: this.pageWidth - this.margins.left - this.margins.right,
      height: this.pageHeight - this.margins.top - this.margins.bottom,
    };
  }

  setColumns(columns: number): PDFPageLayout {
    this.columns = columns;
    this.calculateColumnWidth();
    return this;
  }

  setColumnGap(gap: number): PDFPageLayout {
    this.columnGap = gap;
    this.calculateColumnWidth();
    return this;
  }

  setMargins(margins: { top?: number; right?: number; bottom?: number; left?: number }): PDFPageLayout {
    this.margins = { ...this.margins, ...margins };
    this.calculateColumnWidth();
    return this;
  }

  getMargins(): Readonly<{ top: number; right: number; bottom: number; left: number }> {
    return { ...this.margins };
  }

  getPageSize(): { width: number; height: number } {
    return { width: this.pageWidth, height: this.pageHeight };
  }

  getContentArea(): { width: number; height: number } {
    return {
      width: this.pageWidth - this.margins.left - this.margins.right,
      height: this.pageHeight - this.margins.top - this.margins.bottom,
    };
  }
}

export class PDFValidationService {
  static validateTextElement(element: TextElement): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!element.content || element.content.trim().length === 0) {
      errors.push('Text content cannot be empty');
    }

    if (element.content.length > 10000) {
      errors.push('Text content exceeds maximum length of 10000 characters');
    }

    if (element.x < 0 || element.y < 0) {
      errors.push('Position coordinates cannot be negative');
    }

    if (element.style?.fontSize && (element.style.fontSize < 1 || element.style.fontSize > 100)) {
      errors.push('Font size must be between 1 and 100 points');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static validateImage(image: PDFImage): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!image.src || image.src.trim().length === 0) {
      errors.push('Image source cannot be empty');
    }

    if (image.dimensions.width <= 0 || image.dimensions.height <= 0) {
      errors.push('Image dimensions must be positive');
    }

    if (image.quality && (image.quality < 1 || image.quality > 100)) {
      errors.push('Image quality must be between 1 and 100');
    }

    if (image.opacity && (image.opacity < 0 || image.opacity > 1)) {
      errors.push('Opacity must be between 0 and 1');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static validateTable(table: PDFTable): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (table.columns.length === 0) {
      errors.push('Table must have at least one column');
    }

    if (table.rows.length === 0) {
      errors.push('Table must have at least one row');
    }

    for (let i = 0; i < table.rows.length; i++) {
      if (table.rows[i].cells.length !== table.columns.length) {
        errors.push(`Row ${i} has ${table.rows[i].cells.length} cells, expected ${table.columns.length}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static validateColor(color: string): { valid: boolean; error?: string } {
    const hexRegex = /^#[0-9A-F]{6}$/i;
    const rgbRegex = /^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/;

    if (!hexRegex.test(color) && !rgbRegex.test(color)) {
      return {
        valid: false,
        error: `Invalid color format: ${color}. Use #RRGGBB or rgb(r,g,b)`,
      };
    }

    return { valid: true };
  }
}

export class PDFBatchProcessor {
  private queue: Array<{ id: string; task: () => Promise<Buffer> }> = [];
  private concurrency: number = 3;
  private results: Map<string, { buffer: Buffer; success: boolean; error?: Error }> = new Map();
  private inProgress: Set<string> = new Set();

  constructor(concurrency: number = 3) {
    this.concurrency = Math.max(1, concurrency);
  }

  addTask(id: string, task: () => Promise<Buffer>): PDFBatchProcessor {
    this.queue.push({ id, task });
    return this;
  }

  async process(): Promise<Map<string, { buffer: Buffer; success: boolean; error?: Error }>> {
    this.results.clear();

    while (this.queue.length > 0 || this.inProgress.size > 0) {
      while (this.inProgress.size < this.concurrency && this.queue.length > 0) {
        const { id, task } = this.queue.shift()!;
        this.inProgress.add(id);
        this.executeTask(id, task).catch((_e) => {
          // Error handled in executeTask
        });
      }

      if (this.inProgress.size > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return this.results;
  }

  private async executeTask(id: string, task: () => Promise<Buffer>): Promise<void> {
    try {
      const buffer = await task();
      this.results.set(id, { buffer, success: true });
    } catch (error) {
      this.results.set(id, {
        buffer: Buffer.alloc(0),
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    } finally {
      this.inProgress.delete(id);
    }
  }

  getResult(id: string): { buffer: Buffer; success: boolean; error?: Error } | undefined {
    return this.results.get(id);
  }

  getAllResults(): Map<string, { buffer: Buffer; success: boolean; error?: Error }> {
    return new Map(this.results);
  }

  clearQueue(): PDFBatchProcessor {
    this.queue = [];
    return this;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getProcessedCount(): number {
    return this.results.size;
  }
}

export function createContentBuilder(options?: {
  pageWidth?: number;
  pageHeight?: number;
  margins?: { top?: number; right?: number; bottom?: number; left?: number };
  defaultStyle?: TextStyle;
}): PDFContentBuilder {
  return new PDFContentBuilder(options);
}

export function createStyleManager(defaultStyle?: TextStyle): PDFStyleManager {
  return new PDFStyleManager(defaultStyle);
}

export function createPageLayout(options?: {
  pageWidth?: number;
  pageHeight?: number;
  columns?: number;
  columnGap?: number;
  margins?: { top?: number; right?: number; bottom?: number; left?: number };
}): PDFPageLayout {
  return new PDFPageLayout(options);
}

export function createValidationService(): PDFValidationService {
  return PDFValidationService;
}

export function createBatchProcessor(concurrency?: number): PDFBatchProcessor {
  return new PDFBatchProcessor(concurrency);
}
