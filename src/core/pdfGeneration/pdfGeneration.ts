import * as crypto from 'crypto';
import {
  PageDimensions,
  Margin,
  HeaderConfig,
  FooterConfig,
  PDFImage,
  TableRow,
  PDFTable,
  TextStyle,
  TextElement,
  PDFElement,
  LineElement,
  RectElement,
  TableElement,
  ImageElement,
  PDFPage,
  PDFMetadata,
  PDFEncryption,
  PDFSignature,
  PDFWatermark,
  PDFTemplate,
  HTMLContent,
  PDFGenerationOptions,
  PDFGenerationResult,
  PDFBuilder,
  PDFGenerationError,
  PDFErrorCode,
  DEFAULT_MARGINS,
  DEFAULT_TEXT_STYLE,
  DEFAULT_PERMISSIONS,
  isPageSize,
  isOrientation,
  isCompressionLevel,
  isImageFormat,
  isAlignment,
  isBorderStyle,
  generatePDFId,
  getPageDimensions,
  validateMargin,
} from './types';

export class PDFGenerationService {
  private pages: PDFPage[] = [];
  private currentPage: PDFPage | null = null;
  private options: Required<PDFGenerationOptions>;
  private header: HeaderConfig | null = null;
  private footer: FooterConfig | null = null;
  private metadata: PDFMetadata = {};
  private encryption: PDFEncryption | null = null;
  private signature: PDFSignature | null = null;
  private watermark: PDFWatermark | null = null;
  private templates: Map<string, PDFTemplate> = new Map();

  constructor(options: PDFGenerationOptions = {}) {
    this.options = this.normalizeOptions(options);
    this.initializeDocument();
  }

  private normalizeOptions(options: PDFGenerationOptions): Required<PDFGenerationOptions> {
    return {
      pageSize: isPageSize(options.pageSize) ? options.pageSize : 'A4',
      orientation: isOrientation(options.orientation) ? options.orientation : 'portrait',
      customSize: options.customSize || { width: 612, height: 792 },
      margins: options.margins && validateMargin(options.margins) ? options.margins : { ...DEFAULT_MARGINS },
      header: options.header || null as unknown as HeaderConfig,
      footer: options.footer || null as unknown as FooterConfig,
      metadata: options.metadata || {},
      encryption: options.encryption || { enabled: false },
      signature: options.signature || null as unknown as PDFSignature,
      watermark: options.watermark || null as unknown as PDFWatermark,
      compression: isCompressionLevel(options.compression) ? options.compression : 'standard',
      embedFonts: options.embedFonts ?? true,
      autoPageBreak: options.autoPageBreak ?? true,
      pageBreakMargin: options.pageBreakMargin ?? 20,
      template: options.template || '',
    };
  }

  private initializeDocument(): void {
    this.pages = [];
    this.addPage();
  }

  private getPageDimensions(): PageDimensions {
    return getPageDimensions(this.options.pageSize, this.options.orientation, this.options.customSize);
  }

  addPage(): PDFBuilder {
    const dimensions = this.getPageDimensions();
    const newPage: PDFPage = {
      pageNumber: this.pages.length + 1,
      elements: [],
      width: dimensions.width,
      height: dimensions.height,
      orientation: this.options.orientation,
    };
    this.pages.push(newPage);
    this.currentPage = newPage;
    return this;
  }

  addText(content: string, x: number, y: number, options?: TextStyle): PDFBuilder {
    if (!this.currentPage) {
      throw this.createError('PDF_RENDER_FAILED', 'No current page available');
    }

    const style = { ...DEFAULT_TEXT_STYLE, ...options };
    const textElement: TextElement = {
      id: generatePDFId('TEXT'),
      type: 'text',
      content,
      x,
      y,
      style,
    };

    this.currentPage.elements.push(textElement);
    return this;
  }

  addImage(image: PDFImage): PDFBuilder {
    if (!this.currentPage) {
      throw this.createError('PDF_RENDER_FAILED', 'No current page available');
    }

    const validatedImage: PDFImage = {
      id: image.id || generatePDFId('IMG'),
      src: image.src,
      position: image.position,
      dimensions: image.dimensions,
      format: isImageFormat(image.format) ? image.format : 'png',
      quality: image.quality ?? 90,
      opacity: image.opacity ?? 1,
    };

    const imageElement: ImageElement = {
      id: validatedImage.id,
      type: 'image',
      image: validatedImage,
    };

    this.currentPage.elements.push(imageElement);
    return this;
  }

  addTable(table: PDFTable): PDFBuilder {
    if (!this.currentPage) {
      throw this.createError('PDF_RENDER_FAILED', 'No current page available');
    }

    const validatedTable: PDFTable = {
      id: table.id || generatePDFId('TABLE'),
      columns: table.columns.map((col) => ({
        width: col.width,
        header: col.header,
        alignment: isAlignment(col.alignment) ? col.alignment : 'left',
        backgroundColor: col.backgroundColor,
        textColor: col.textColor,
        fontWeight: col.fontWeight || 'normal',
      })),
      rows: table.rows.map((row) => ({
        cells: row.cells.map((cell) => ({
          content: cell.content,
          colSpan: cell.colSpan || 1,
          rowSpan: cell.rowSpan || 1,
          alignment: isAlignment(cell.alignment) ? cell.alignment : 'left',
          backgroundColor: cell.backgroundColor,
          textColor: cell.textColor,
          fontSize: cell.fontSize,
          fontFamily: cell.fontFamily,
          fontWeight: cell.fontWeight || 'normal',
          fontStyle: cell.fontStyle || 'normal',
          padding: cell.padding || 5,
          borderStyle: isBorderStyle(cell.borderStyle) ? cell.borderStyle : 'solid',
          borderColor: cell.borderColor,
        })),
        height: row.height,
        backgroundColor: row.backgroundColor,
      })),
      x: table.x,
      y: table.y,
      width: table.width,
      borderStyle: isBorderStyle(table.borderStyle) ? table.borderStyle : 'solid',
      borderColor: table.borderColor || '#000000',
      borderWidth: table.borderWidth || 1,
      alternateRowColors: table.alternateRowColors ?? false,
      headerBackgroundColor: table.headerBackgroundColor || '#f0f0f0',
      headerTextColor: table.headerTextColor || '#000000',
    };

    const tableElement: TableElement = {
      id: validatedTable.id,
      type: 'table',
      table: validatedTable,
    };

    this.currentPage.elements.push(tableElement);
    return this;
  }

  addLine(line: LineElement): PDFBuilder {
    if (!this.currentPage) {
      throw this.createError('PDF_RENDER_FAILED', 'No current page available');
    }

    const validatedLine: LineElement = {
      id: line.id || generatePDFId('LINE'),
      type: 'line',
      startX: line.startX,
      startY: line.startY,
      endX: line.endX,
      endY: line.endY,
      color: line.color || '#000000',
      width: line.width || 1,
      dashPattern: line.dashPattern,
    };

    this.currentPage.elements.push(validatedLine);
    return this;
  }

  addRect(rect: RectElement): PDFBuilder {
    if (!this.currentPage) {
      throw this.createError('PDF_RENDER_FAILED', 'No current page available');
    }

    const validatedRect: RectElement = {
      id: rect.id || generatePDFId('RECT'),
      type: 'rect',
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      fillColor: rect.fillColor,
      borderColor: rect.borderColor,
      borderWidth: rect.borderWidth || 1,
      borderStyle: isBorderStyle(rect.borderStyle) ? rect.borderStyle : 'solid',
      opacity: rect.opacity ?? 1,
    };

    this.currentPage.elements.push(validatedRect);
    return this;
  }

  setHeader(config: HeaderConfig): PDFBuilder {
    this.header = {
      content: config.content || '',
      height: config.height || 50,
      margin: config.margin || 10,
      fontSize: config.fontSize || 10,
      fontFamily: config.fontFamily || 'Helvetica',
      color: config.color || '#000000',
      alignment: isAlignment(config.alignment) ? config.alignment : 'center',
      displayPageNumber: config.displayPageNumber ?? false,
      startPageNumber: config.startPageNumber || 1,
    };
    return this;
  }

  setFooter(config: FooterConfig): PDFBuilder {
    this.footer = {
      content: config.content || '',
      height: config.height || 50,
      margin: config.margin || 10,
      fontSize: config.fontSize || 10,
      fontFamily: config.fontFamily || 'Helvetica',
      color: config.color || '#000000',
      alignment: isAlignment(config.alignment) ? config.alignment : 'center',
      displayPageNumber: config.displayPageNumber ?? false,
      startPageNumber: config.startPageNumber || 1,
    };
    return this;
  }

  setMetadata(metadata: PDFMetadata): PDFBuilder {
    this.metadata = {
      ...this.metadata,
      ...metadata,
      creationDate: metadata.creationDate || new Date(),
      modificationDate: new Date(),
    };
    return this;
  }

  setEncryption(encryption: PDFEncryption): PDFBuilder {
    if (!encryption.enabled) {
      this.encryption = null;
      return this;
    }

    this.encryption = {
      enabled: true,
      algorithm: encryption.algorithm || 'aes-256',
      userPassword: encryption.userPassword || '',
      ownerPassword: encryption.ownerPassword || '',
      permissions: encryption.permissions || { ...DEFAULT_PERMISSIONS },
    };
    return this;
  }

  setSignature(signature: PDFSignature): PDFBuilder {
    this.signature = {
      id: signature.id || generatePDFId('SIG'),
      reason: signature.reason,
      location: signature.location,
      contactInfo: signature.contactInfo,
      name: signature.name,
      reasonDate: signature.reasonDate || new Date(),
      visible: signature.visible ?? false,
      signatureFieldName: signature.signatureFieldName || 'Signature',
    };
    return this;
  }

  setWatermark(watermark: PDFWatermark): PDFBuilder {
    this.watermark = {
      text: watermark.text,
      imageSrc: watermark.imageSrc,
      opacity: watermark.opacity ?? 0.3,
      rotation: watermark.rotation ?? 45,
      fontSize: watermark.fontSize || 36,
      fontFamily: watermark.fontFamily || 'Helvetica',
      color: watermark.color || '#cccccc',
      position: watermark.position || 'center',
      xOffset: watermark.xOffset || 0,
      yOffset: watermark.yOffset || 0,
    };
    return this;
  }

  async render(): Promise<PDFGenerationResult> {
    const startTime = Date.now();

    try {
      const document = await this.buildPDF();
      const fileSize = document.length;
      const generationTimeMs = Date.now() - startTime;

      return {
        id: generatePDFId('DOC'),
        document,
        pageCount: this.pages.length,
        fileSize,
        generationTimeMs,
        metadata: this.metadata,
      };
    } catch (error) {
      throw this.createError(
        'PDF_RENDER_FAILED',
        error instanceof Error ? error.message : 'PDF rendering failed'
      );
    }
  }

  private async buildPDF(): Promise<Buffer> {
    const chunks: string[] = [];

    chunks.push(this.buildPDFHeader());
    chunks.push(this.buildPDFBody());
    chunks.push(this.buildPDFFooter());

    const pdfContent = chunks.join('');

    if (this.encryption?.enabled) {
      return this.encryptPDF(Buffer.from(pdfContent, 'utf8'));
    }

    return Buffer.from(pdfContent, 'utf8');
  }

  private buildPDFHeader(): string {
    const version = '1.7';
    const builder: string[] = [];

    builder.push(`%PDF-${version}\n`);
    builder.push(`%\xe2\xe3\xcf\xd3\n`);

    return builder.join('');
  }

  private buildPDFBody(): string {
    const objects: string[] = [];
    const objectOffsets: number[] = [];

    for (const page of this.pages) {
      const pageObjId = objects.length + 1;
      objectOffsets.push(Buffer.from(objects.join('')).length);

      objects.push(this.buildPageObject(page, pageObjId));
    }

    if (this.header) {
      objects.push(this.buildHeaderObject());
    }

    if (this.footer) {
      objects.push(this.buildFooterObject());
    }

    if (this.metadata.title || this.metadata.author) {
      objects.push(this.buildMetadataObject());
    }

    return objects.join('');
  }

  private buildPageObject(page: PDFPage, pageObjId: number): string {
    const lines: string[] = [];
    const contentObjId = pageObjId + 1;

    lines.push(`${pageObjId} 0 obj\n`);
    lines.push(`<<\n`);
    lines.push(`/Type /Page\n`);
    lines.push(`/Parent 1 0 R\n`);
    lines.push(`/MediaBox [0 0 ${page.width} ${page.height}]\n`);
    lines.push(`/Contents ${contentObjId} 0 R\n`);

    if (this.encryption?.enabled) {
      lines.push(`/Annots [\n]\n`);
    }

    lines.push(`>>\n`);
    lines.push(`endobj\n\n`);

    const content = this.buildPageContent(page);
    lines.push(`${contentObjId} 0 obj\n`);
    lines.push(`<<\n`);
    lines.push(`/Length ${content.length}\n`);
    lines.push(`>>\n`);
    lines.push(`stream\n`);
    lines.push(content);
    lines.push(`endstream\n`);
    lines.push(`endobj\n\n`);

    return lines.join('');
  }

  private buildPageContent(page: PDFPage): string {
    const contentParts: string[] = [];

    contentParts.push(`BT\n`);

    for (const element of page.elements) {
      if (element.type === 'text') {
        const textEl = element as TextElement;
        const fontSize = textEl.style?.fontSize || 12;
        const color = textEl.style?.color || '#000000';

        contentParts.push(`/F1 ${fontSize} Tf\n`);
        contentParts.push(`${color} rg\n`);
        contentParts.push(`${textEl.x} ${textEl.y} Td\n`);
        contentParts.push(`(${this.escapeText(textEl.content)}) Tj\n`);
      } else if (element.type === 'line') {
        const lineEl = element as LineElement;
        const color = lineEl.color || '#000000';
        const width = lineEl.width || 1;

        contentParts.push(`q\n`);
        contentParts.push(`${color} RG\n`);
        contentParts.push(`${width} w\n`);
        contentParts.push(`${lineEl.startX} ${lineEl.startY} m\n`);
        contentParts.push(`${lineEl.endX} ${lineEl.endY} l\n`);
        contentParts.push(`S\n`);
        contentParts.push(`Q\n`);
      } else if (element.type === 'rect') {
        const rectEl = element as RectElement;
        const fillColor = rectEl.fillColor || '#ffffff';
        const borderColor = rectEl.borderColor || '#000000';
        const width = rectEl.borderWidth || 1;

        contentParts.push(`q\n`);
        contentParts.push(`${fillColor} rg\n`);
        contentParts.push(`${rectEl.x} ${rectEl.y} ${rectEl.width} ${rectEl.height} re\n`);
        contentParts.push(`f\n`);

        if (rectEl.borderColor) {
          contentParts.push(`${borderColor} RG\n`);
          contentParts.push(`${width} w\n`);
          contentParts.push(`${rectEl.x} ${rectEl.y} ${rectEl.width} ${rectEl.height} re\n`);
          contentParts.push(`S\n`);
        }
        contentParts.push(`Q\n`);
      }
    }

    if (this.footer?.displayPageNumber) {
      const pageNum = page.pageNumber;
      const displayNum = (this.footer.startPageNumber || 1) + pageNum - 1;
      contentParts.push(`BT\n`);
      contentParts.push(`/F1 10 Tf\n`);
      contentParts.push(`0 0 0 rg\n`);
      contentParts.push(`${page.width / 2} 20 Td\n`);
      contentParts.push(`(Page ${displayNum}) Tj\n`);
      contentParts.push(`ET\n`);
    }

    contentParts.push(`ET\n`);

    return contentParts.join('');
  }

  private buildHeaderObject(): string {
    const headerId = this.pages.length + 2;
    const lines: string[] = [];

    lines.push(`${headerId} 0 obj\n`);
    lines.push(`<<\n`);
    lines.push(`/Type /Header\n`);
    lines.push(`/Height ${this.header?.height || 50}\n`);
    lines.push(`>>\n`);
    lines.push(`endobj\n\n`);

    return lines.join('');
  }

  private buildFooterObject(): string {
    const footerId = this.pages.length + 3;
    const lines: string[] = [];

    lines.push(`${footerId} 0 obj\n`);
    lines.push(`<<\n`);
    lines.push(`/Type /Footer\n`);
    lines.push(`/Height ${this.footer?.height || 50}\n`);
    lines.push(`>>\n`);
    lines.push(`endobj\n\n`);

    return lines.join('');
  }

  private buildMetadataObject(): string {
    const metaId = this.pages.length + 4;
    const lines: string[] = [];

    lines.push(`${metaId} 0 obj\n`);
    lines.push(`<<\n`);

    if (this.metadata.title) {
      lines.push(`/Title (${this.escapeText(this.metadata.title)})\n`);
    }

    if (this.metadata.author) {
      lines.push(`/Author (${this.escapeText(this.metadata.author)})\n`);
    }

    if (this.metadata.subject) {
      lines.push(`/Subject (${this.escapeText(this.metadata.subject)})\n`);
    }

    if (this.metadata.keywords?.length) {
      lines.push(`/Keywords (${this.escapeText(this.metadata.keywords.join(', '))})\n`);
    }

    if (this.metadata.creator) {
      lines.push(`/Creator (${this.escapeText(this.metadata.creator)})\n`);
    }

    if (this.metadata.producer) {
      lines.push(`/Producer (${this.escapeText(this.metadata.producer)})\n`);
    }

    if (this.metadata.creationDate) {
      lines.push(`/CreationDate (${this.formatDate(this.metadata.creationDate)})\n`);
    }

    lines.push(`>>\n`);
    lines.push(`endobj\n\n`);

    return lines.join('');
  }

  private buildPDFFooter(): string {
    const lines: string[] = [];

    const xrefOffset = Buffer.from(this.buildPDFBody()).length;
    lines.push(`xref\n`);
    lines.push(`0 ${this.pages.length + 5}\n`);
    lines.push(`0000000000 65535 f \n`);

    for (let i = 0; i < this.pages.length + 4; i++) {
      lines.push(`${String(i * 100).padStart(10, '0')} 00000 n \n`);
    }

    lines.push(`trailer\n`);
    lines.push(`<<\n`);
    lines.push(`/Size ${this.pages.length + 5}\n`);
    lines.push(`/Root 1 0 R\n`);

    if (this.encryption?.enabled) {
      lines.push(`/Encrypt 100 0 R\n`);
      lines.push(`/ID [(${this.generateDocId()}) (${this.generateDocId()})]\n`);
    }

    lines.push(`>>\n`);
    lines.push(`startxref\n`);
    lines.push(`${xrefOffset}\n`);
    lines.push(`%%EOF\n`);

    return lines.join('');
  }

  private escapeText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  private formatDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  private generateDocId(): string {
    return crypto.randomBytes(16).toString('hex').toUpperCase();
  }

  private async encryptPDF(content: Buffer): Promise<Buffer> {
    if (!this.encryption?.enabled) {
      return content;
    }

    try {
      const key = this.deriveKey(this.encryption.userPassword || '');
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);

      const header = Buffer.from('ENCRYPTED_PDF_V1\n');
      return Buffer.concat([header, iv, encrypted]);
    } catch {
      throw this.createError('PDF_ENCRYPTION_FAILED', 'Failed to encrypt PDF');
    }
  }

  private deriveKey(password: string): Buffer {
    const salt = crypto.randomBytes(32);
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  }

  private createError(code: PDFErrorCode, message: string): PDFGenerationError {
    const error = new Error(message) as PDFGenerationError;
    error.code = code;
    error.pageNumber = this.currentPage?.pageNumber;
    return error;
  }

  setMargins(margins: Margin): PDFBuilder {
    this.options.margins = margins;
    return this;
  }

  applyTemplate(templateId: string): PDFBuilder {
    const template = this.templates.get(templateId);
    if (!template) {
      throw this.createError('PDF_TEMPLATE_FAILED', `Template ${templateId} not found`);
    }

    if (template.header) {
      this.setHeader(template.header);
    }

    if (template.footer) {
      this.setFooter(template.footer);
    }

    if (template.margin) {
      this.setMargins(template.margin);
    }

    if (template.elements) {
      for (const element of template.elements) {
        this.currentPage?.elements.push(element);
      }
    }

    return this;
  }

  registerTemplate(template: PDFTemplate): PDFBuilder {
    this.templates.set(template.id, template);
    return this;
  }

  clear(): void {
    this.pages = [];
    this.header = null;
    this.footer = null;
    this.metadata = {};
    this.encryption = null;
    this.signature = null;
    this.watermark = null;
    this.addPage();
  }

  getPageCount(): number {
    return this.pages.length;
  }

  getCurrentPage(): PDFPage | null {
    return this.currentPage;
  }

  getOptions(): Required<PDFGenerationOptions> {
    return { ...this.options };
  }
}

export class PDFTemplateEngine {
  private templates: Map<string, PDFTemplate> = new Map();

  createTemplate(template: PDFTemplate): void {
    this.templates.set(template.id, template);
  }

  getTemplate(id: string): PDFTemplate | null {
    return this.templates.get(id) || null;
  }

  listTemplates(): PDFTemplate[] {
    return Array.from(this.templates.values());
  }

  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  renderTemplate(
    templateId: string,
    data: Record<string, string>,
    options?: PDFGenerationOptions
  ): PDFGenerationService {
    const template = this.templates.get(templateId);

    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const pdfService = new PDFGenerationService({
      ...options,
      pageSize: options?.pageSize || 'A4',
      orientation: options?.orientation || 'portrait',
    });

    if (template.header) {
      pdfService.setHeader(template.header);
    }

    if (template.footer) {
      pdfService.setFooter(template.footer);
    }

    if (template.margin) {
      pdfService.setMargins(template.margin);
    }

    if (template.backgroundColor) {
      pdfService.addRect({
        id: 'background',
        type: 'rect',
        x: 0,
        y: 0,
        width: 595,
        height: 842,
        fillColor: template.backgroundColor,
      });
    }

    if (template.placeholders) {
      const placeholders = { ...template.placeholders, ...data };
      for (const [key, value] of Object.entries(placeholders)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        for (const element of template.elements || []) {
          if (element.type === 'text') {
            const textEl = element as TextElement;
            textEl.content = textEl.content.replace(regex, value);
          }
        }
      }
    }

    for (const element of template.elements || []) {
      if (element.type === 'text') {
        const textEl = element as TextElement;
        pdfService.addText(textEl.content, textEl.x, textEl.y, textEl.style);
      }
    }

    return pdfService;
  }
}

export class HTMLToPDFConverter {
  private service: PDFGenerationService;

  constructor(options?: PDFGenerationOptions) {
    this.service = new PDFGenerationService(options);
  }

  async convert(html: HTMLContent, options?: PDFGenerationOptions): Promise<PDFGenerationResult> {
    try {
      const parsedElements = this.parseHTML(html.html);

      for (const element of parsedElements) {
        if (element.type === 'text') {
          const textEl = element as TextElement;
          this.service.addText(textEl.content, textEl.x, textEl.y, textEl.style);
        } else if (element.type === 'rect') {
          const rectEl = element as RectElement;
          this.service.addRect(rectEl);
        }
      }

      if (options?.header) {
        this.service.setHeader(options.header);
      }

      if (options?.footer) {
        this.service.setFooter(options.footer);
      }

      if (options?.metadata) {
        this.service.setMetadata(options.metadata);
      }

      return this.service.render();
    } catch {
      throw new Error('PDF_HTML_PARSE_FAILED: Failed to parse HTML content');
    }
  }

  private parseHTML(html: string): PDFElement[] {
    const elements: PDFElement[] = [];
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

    if (!bodyMatch) {
      return elements;
    }

    const bodyContent = bodyMatch[1];
    let yPosition = 50;
    const lineHeight = 20;

    const textMatches = bodyContent.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    for (const match of textMatches) {
      const content = match[1].replace(/<[^>]+>/g, '');
      elements.push({
        id: generatePDFId('TEXT'),
        type: 'text',
        content,
        x: 50,
        y: yPosition,
        style: {
          fontFamily: 'Helvetica',
          fontSize: 12,
          color: '#000000',
        },
      } as TextElement);
      yPosition += lineHeight;
    }

    const divMatches = bodyContent.matchAll(/<div[^>]*>([\s\S]*?)<\/div>/gi);
    for (const match of divMatches) {
      const content = match[1].replace(/<[^>]+>/g, '');
      if (content.trim()) {
        elements.push({
          id: generatePDFId('TEXT'),
          type: 'text',
          content,
          x: 50,
          y: yPosition,
          style: {
            fontFamily: 'Helvetica',
            fontSize: 12,
            color: '#000000',
          },
        } as TextElement);
        yPosition += lineHeight;
      }
    }

    if (elements.length === 0 && bodyContent.trim()) {
      elements.push({
        id: generatePDFId('TEXT'),
        type: 'text',
        content: bodyContent.replace(/<[^>]+>/g, '').trim(),
        x: 50,
        y: yPosition,
        style: {
          fontFamily: 'Helvetica',
          fontSize: 12,
          color: '#000000',
        },
      } as TextElement);
    }

    return elements;
  }
}

export class PDFWatermarkService {
  addTextWatermark(
    service: PDFGenerationService,
    text: string,
    options?: Partial<PDFWatermark>
  ): PDFBuilder {
    const watermark: PDFWatermark = {
      text,
      opacity: options?.opacity ?? 0.3,
      rotation: options?.rotation ?? 45,
      fontSize: options?.fontSize ?? 36,
      fontFamily: options?.fontFamily ?? 'Helvetica',
      color: options?.color ?? '#cccccc',
      position: options?.position ?? 'center',
      xOffset: options?.xOffset ?? 0,
      yOffset: options?.yOffset ?? 0,
    };

    service.setWatermark(watermark);
    return service;
  }

  addImageWatermark(
    service: PDFGenerationService,
    imageSrc: string,
    options?: Partial<PDFWatermark>
  ): PDFBuilder {
    const watermark: PDFWatermark = {
      imageSrc,
      opacity: options?.opacity ?? 0.3,
      rotation: options?.rotation ?? 45,
      position: options?.position ?? 'center',
      xOffset: options?.xOffset ?? 0,
      yOffset: options?.yOffset ?? 0,
    };

    service.setWatermark(watermark);
    return service;
  }
}

export class PDFSecurityService {
  async signPDF(
    pdfData: Buffer,
    signature: PDFSignature
  ): Promise<Buffer> {
    const signatureId = signature.id || generatePDFId('SIG');
    const signatureData = this.createSignaturePlaceholder(signature);

    const header = Buffer.from(`%PDF-1.7\n%\xe2\xe3\xcf\xd3\n`);
    const sigMarker = Buffer.from(`\n%%signature_${signatureId}_begin\n`);
    const sigContent = Buffer.from(JSON.stringify(signatureData));
    const sigEnd = Buffer.from(`\n%%signature_${signatureId}_end\n`);

    return Buffer.concat([header, sigMarker, sigContent, sigEnd, pdfData]);
  }

  private createSignaturePlaceholder(signature: PDFSignature): Record<string, unknown> {
    return {
      signatureId: signature.id,
      reason: signature.reason || 'Document signed',
      location: signature.location || 'Unknown',
      contactInfo: signature.contactInfo,
      name: signature.name,
      date: (signature.reasonDate || new Date()).toISOString(),
      visible: signature.visible,
      fieldName: signature.signatureFieldName || 'Signature',
    };
  }

  async verifyPDFSignature(pdfData: Buffer): Promise<{ valid: boolean; signature?: PDFSignature }> {
    const signatureMatch = pdfData.toString('utf8').match(/%%signature_(\w+)_begin\n([\s\S]*?)%%signature_\1_end/);

    if (!signatureMatch) {
      return { valid: false };
    }

    try {
      const signatureData = JSON.parse(signatureMatch[2]) as PDFSignature;
      return {
        valid: true,
        signature: signatureData,
      };
    } catch {
      return { valid: false };
    }
  }

  encryptPDF(pdfData: Buffer, encryption: PDFEncryption): Buffer {
    if (!encryption.enabled) {
      return pdfData;
    }

    const key = this.deriveKey(encryption.userPassword || 'default');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(pdfData), cipher.final()]);

    const header = Buffer.from('ENCRYPTED_PDF_V1\n');
    return Buffer.concat([header, iv, encrypted]);
  }

  decryptPDF(pdfData: Buffer, password: string): Buffer {
    if (!pdfData.toString('utf8').startsWith('ENCRYPTED_PDF_V1')) {
      return pdfData;
    }

    const iv = pdfData.subarray(17, 33);
    const encrypted = pdfData.subarray(33);

    const key = this.deriveKey(password);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  private deriveKey(password: string): Buffer {
    const salt = Buffer.alloc(32, 0);
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  }
}

export class PDFTableRenderer {
  renderTable(
    service: PDFGenerationService,
    table: PDFTable,
    startX: number,
    startY: number
  ): void {
    const columnWidth = table.width
      ? table.width / table.columns.length
      : 100;

    let currentY = startY;

    if (table.columns.some((col) => col.header)) {
      currentY = this.renderTableHeader(service, table, startX, currentY, columnWidth);
    }

    for (let rowIdx = 0; rowIdx < table.rows.length; rowIdx++) {
      const row = table.rows[rowIdx];
      currentY = this.renderTableRow(
        service,
        table,
        row,
        startX,
        currentY,
        columnWidth,
        rowIdx
      );
    }
  }

  private renderTableHeader(
    service: PDFGenerationService,
    table: PDFTable,
    startX: number,
    startY: number,
    columnWidth: number
  ): number {
    let currentX = startX;

    for (let colIdx = 0; colIdx < table.columns.length; colIdx++) {
      const column = table.columns[colIdx];
      const headerText = column.header || '';

      service.addRect({
        id: generatePDFId('CELL'),
        type: 'rect',
        x: currentX,
        y: startY,
        width: column.width || columnWidth,
        height: 25,
        fillColor: table.headerBackgroundColor,
        borderColor: table.borderColor,
        borderWidth: table.borderWidth,
        borderStyle: table.borderStyle,
      });

      service.addText(headerText, currentX + 5, startY + 15, {
        fontFamily: 'Helvetica',
        fontSize: 10,
        fontWeight: 'bold',
        color: table.headerTextColor,
        alignment: isAlignment(column.alignment) ? column.alignment : 'left',
      });

      currentX += column.width || columnWidth;
    }

    return startY + 25;
  }

  private renderTableRow(
    service: PDFGenerationService,
    table: PDFTable,
    row: TableRow,
    startX: number,
    startY: number,
    columnWidth: number,
    rowIdx: number
  ): number {
    let currentX = startX;
    const rowHeight = row.height || 20;
    const backgroundColor = table.alternateRowColors
      ? rowIdx % 2 === 0
        ? '#ffffff'
        : '#f9f9f9'
      : row.backgroundColor || '#ffffff';

    for (let colIdx = 0; colIdx < table.columns.length; colIdx++) {
      const column = table.columns[colIdx];
      const cell = row.cells[colIdx];
      const cellContent = cell?.content || '';

      service.addRect({
        id: generatePDFId('CELL'),
        type: 'rect',
        x: currentX,
        y: startY,
        width: column.width || columnWidth,
        height: rowHeight,
        fillColor: cell?.backgroundColor || backgroundColor,
        borderColor: table.borderColor,
        borderWidth: table.borderWidth,
        borderStyle: table.borderStyle,
      });

      if (cellContent) {
        service.addText(cellContent, currentX + 5, startY + 15, {
          fontFamily: cell?.fontFamily || 'Helvetica',
          fontSize: cell?.fontSize || 10,
          fontWeight: cell?.fontWeight || 'normal',
          fontStyle: cell?.fontStyle || 'normal',
          color: cell?.textColor || '#000000',
          alignment: isAlignment(cell?.alignment) ? cell.alignment : 'left',
        });
      }

      currentX += column.width || columnWidth;
    }

    return startY + rowHeight;
  }
}

export function createPDFService(options?: PDFGenerationOptions): PDFGenerationService {
  return new PDFGenerationService(options);
}

export function createTemplateEngine(): PDFTemplateEngine {
  return new PDFTemplateEngine();
}

export function createHTMLConverter(options?: PDFGenerationOptions): HTMLToPDFConverter {
  return new HTMLToPDFConverter(options);
}

export function createWatermarkService(): PDFWatermarkService {
  return new PDFWatermarkService();
}

export function createSecurityService(): PDFSecurityService {
  return new PDFSecurityService();
}

export function createTableRenderer(): PDFTableRenderer {
  return new PDFTableRenderer();
}

export async function generatePDFFromHTML(
  html: HTMLContent,
  options?: PDFGenerationOptions
): Promise<PDFGenerationResult> {
  const converter = new HTMLToPDFConverter(options);
  return converter.convert(html, options);
}

export async function generatePDFFromTemplate(
  templateId: string,
  data: Record<string, string>,
  options?: PDFGenerationOptions
): Promise<PDFGenerationResult> {
  const engine = new PDFTemplateEngine();
  const pdfService = engine.renderTemplate(templateId, data, options);
  return pdfService.render();
}

export function isPDFGenerationError(error: unknown): error is PDFGenerationError {
  return error instanceof Error && 'code' in error;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}