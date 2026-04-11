import {
  PDFGenerationService,
  PDFTemplateEngine,
  HTMLToPDFConverter,
  PDFWatermarkService,
  PDFSecurityService,
  PDFTableRenderer,
  createPDFService,
  createTemplateEngine,
  createHTMLConverter,
  createWatermarkService,
  createSecurityService,
  createTableRenderer,
  generatePDFFromHTML,
  generatePDFFromTemplate,
  isPDFGenerationError,
  getErrorMessage,
  PageSize,
  Orientation,
  CompressionLevel,
  ImageFormat,
  Alignment,
  BorderStyle,
  CustomPageSize,
  Margin,
  HeaderConfig,
  FooterConfig,
  PDFImage,
  TableCell,
  TableRow,
  TableColumn,
  PDFTable,
  TextStyle,
  PDFMetadata,
  PDFEncryption,
  PDFPermissions,
  PDFSignature,
  PDFWatermark,
  PDFTemplate,
  HTMLContent,
  PDFGenerationOptions,
  PDFGenerationResult,
  isPageSize,
  isOrientation,
  isCompressionLevel,
  isImageFormat,
  isAlignment,
  isBorderStyle,
  generatePDFId,
  getPageDimensions,
  pointsToMM,
  mmToPoints,
  validateMargin,
  DEFAULT_MARGINS,
  DEFAULT_TEXT_STYLE,
  DEFAULT_PERMISSIONS,
  PageDimensions,
  PDFPage,
  TextElement,
  LineElement,
  RectElement,
  PDFGenerationError,
} from '../src/core/pdfGeneration';

describe('PDF Generation Module', () => {
  describe('Type Guards', () => {
    describe('isPageSize', () => {
      it('should return true for valid page sizes', () => {
        expect(isPageSize('A4')).toBe(true);
        expect(isPageSize('Letter')).toBe(true);
        expect(isPageSize('Legal')).toBe(true);
        expect(isPageSize('Custom')).toBe(true);
      });

      it('should return false for invalid page sizes', () => {
        expect(isPageSize('A3')).toBe(false);
        expect(isPageSize('Custom1')).toBe(false);
        expect(isPageSize('')).toBe(false);
        expect(isPageSize(123 as unknown)).toBe(false);
      });
    });

    describe('isOrientation', () => {
      it('should return true for valid orientations', () => {
        expect(isOrientation('portrait')).toBe(true);
        expect(isOrientation('landscape')).toBe(true);
      });

      it('should return false for invalid orientations', () => {
        expect(isOrientation('square')).toBe(false);
        expect(isOrientation('')).toBe(false);
        expect(isOrientation(null as unknown)).toBe(false);
      });
    });

    describe('isCompressionLevel', () => {
      it('should return true for valid compression levels', () => {
        expect(isCompressionLevel('none')).toBe(true);
        expect(isCompressionLevel('standard')).toBe(true);
        expect(isCompressionLevel('maximum')).toBe(true);
      });

      it('should return false for invalid compression levels', () => {
        expect(isCompressionLevel('low')).toBe(false);
        expect(isCompressionLevel('')).toBe(false);
      });
    });

    describe('isImageFormat', () => {
      it('should return true for valid image formats', () => {
        expect(isImageFormat('jpeg')).toBe(true);
        expect(isImageFormat('png')).toBe(true);
        expect(isImageFormat('gif')).toBe(true);
        expect(isImageFormat('webp')).toBe(true);
        expect(isImageFormat('bmp')).toBe(true);
      });

      it('should return false for invalid image formats', () => {
        expect(isImageFormat('tiff')).toBe(false);
        expect(isImageFormat('')).toBe(false);
      });
    });

    describe('isAlignment', () => {
      it('should return true for valid alignments', () => {
        expect(isAlignment('left')).toBe(true);
        expect(isAlignment('center')).toBe(true);
        expect(isAlignment('right')).toBe(true);
        expect(isAlignment('justify')).toBe(true);
      });

      it('should return false for invalid alignments', () => {
        expect(isAlignment('middle')).toBe(false);
        expect(isAlignment('')).toBe(false);
      });
    });

    describe('isBorderStyle', () => {
      it('should return true for valid border styles', () => {
        expect(isBorderStyle('none')).toBe(true);
        expect(isBorderStyle('solid')).toBe(true);
        expect(isBorderStyle('dashed')).toBe(true);
        expect(isBorderStyle('dotted')).toBe(true);
        expect(isBorderStyle('double')).toBe(true);
      });

      it('should return false for invalid border styles', () => {
        expect(isBorderStyle('thick')).toBe(false);
        expect(isBorderStyle('')).toBe(false);
      });
    });
  });

  describe('Utility Functions', () => {
    describe('generatePDFId', () => {
      it('should generate a PDF ID with default prefix', () => {
        const id = generatePDFId();
        expect(id).toMatch(/^PDF_[a-f0-9]{16}$/);
      });

      it('should generate a PDF ID with custom prefix', () => {
        const id = generatePDFId('TEST');
        expect(id).toMatch(/^TEST_[a-f0-9]{16}$/);
      });

      it('should generate unique IDs', () => {
        const ids = new Set<string>();
        for (let i = 0; i < 100; i++) {
          ids.add(generatePDFId());
        }
        expect(ids.size).toBe(100);
      });
    });

    describe('getPageDimensions', () => {
      it('should return A4 dimensions in portrait', () => {
        const dims = getPageDimensions('A4', 'portrait');
        expect(dims.width).toBeCloseTo(595.28, 2);
        expect(dims.height).toBeCloseTo(841.89, 2);
      });

      it('should return A4 dimensions in landscape', () => {
        const dims = getPageDimensions('A4', 'landscape');
        expect(dims.width).toBeCloseTo(841.89, 2);
        expect(dims.height).toBeCloseTo(595.28, 2);
      });

      it('should return Letter dimensions in portrait', () => {
        const dims = getPageDimensions('Letter', 'portrait');
        expect(dims.width).toBe(612);
        expect(dims.height).toBe(792);
      });

      it('should return Letter dimensions in landscape', () => {
        const dims = getPageDimensions('Letter', 'landscape');
        expect(dims.width).toBe(792);
        expect(dims.height).toBe(612);
      });

      it('should return Legal dimensions in portrait', () => {
        const dims = getPageDimensions('Legal', 'portrait');
        expect(dims.width).toBe(612);
        expect(dims.height).toBe(1008);
      });

      it('should return custom dimensions', () => {
        const customSize: CustomPageSize = { width: 500, height: 700 };
        const dims = getPageDimensions('Custom', 'portrait', customSize);
        expect(dims.width).toBe(500);
        expect(dims.height).toBe(700);
      });

      it('should return custom dimensions in landscape', () => {
        const customSize: CustomPageSize = { width: 500, height: 700 };
        const dims = getPageDimensions('Custom', 'landscape', customSize);
        expect(dims.width).toBe(700);
        expect(dims.height).toBe(500);
      });
    });

    describe('pointsToMM', () => {
      it('should convert points to millimeters', () => {
        expect(pointsToMM(72)).toBeCloseTo(25.4, 1);
        expect(pointsToMM(100)).toBeCloseTo(35.28, 1);
      });
    });

    describe('mmToPoints', () => {
      it('should convert millimeters to points', () => {
        expect(mmToPoints(25.4)).toBeCloseTo(72, 1);
        expect(mmToPoints(100)).toBeCloseTo(283.47, 1);
      });
    });

    describe('validateMargin', () => {
      it('should return true for valid margins', () => {
        expect(validateMargin(DEFAULT_MARGINS)).toBe(true);
        expect(validateMargin({ top: 0, right: 0, bottom: 0, left: 0 })).toBe(true);
        expect(validateMargin({ top: 50, right: 50, bottom: 50, left: 50 })).toBe(true);
      });

      it('should return false for negative margins', () => {
        expect(validateMargin({ top: -1, right: 0, bottom: 0, left: 0 })).toBe(false);
        expect(validateMargin({ top: 0, right: -10, bottom: 0, left: 0 })).toBe(false);
      });

      it('should return false for margins exceeding 300', () => {
        expect(validateMargin({ top: 301, right: 0, bottom: 0, left: 0 })).toBe(false);
      });
    });
  });

  describe('PDFGenerationService', () => {
    describe('constructor', () => {
      it('should create a PDF service with default options', () => {
        const service = new PDFGenerationService();
        const options = service.getOptions();
        expect(options.pageSize).toBe('A4');
        expect(options.orientation).toBe('portrait');
        expect(options.compression).toBe('standard');
      });

      it('should create a PDF service with custom options', () => {
        const service = new PDFGenerationService({
          pageSize: 'Letter',
          orientation: 'landscape',
          compression: 'maximum',
        });
        const options = service.getOptions();
        expect(options.pageSize).toBe('Letter');
        expect(options.orientation).toBe('landscape');
        expect(options.compression).toBe('maximum');
      });
    });

    describe('addPage', () => {
      it('should add a new page', () => {
        const service = new PDFGenerationService();
        expect(service.getPageCount()).toBe(1);
        service.addPage();
        expect(service.getPageCount()).toBe(2);
      });

      it('should return PDFBuilder for chaining', () => {
        const service = new PDFGenerationService();
        const result = service.addPage();
        expect(result).toBe(service);
      });
    });

    describe('addText', () => {
      it('should add text to current page', () => {
        const service = new PDFGenerationService();
        service.addText('Hello World', 100, 100);
        const page = service.getCurrentPage();
        expect(page?.elements.length).toBe(1);
        expect((page?.elements[0] as TextElement).content).toBe('Hello World');
      });

      it('should apply style options', () => {
        const service = new PDFGenerationService();
        const style: TextStyle = {
          fontSize: 16,
          fontWeight: 'bold',
          color: '#FF0000',
        };
        service.addText('Styled Text', 50, 50, style);
        const page = service.getCurrentPage();
        const textEl = page?.elements[0] as TextElement;
        expect(textEl.style?.fontSize).toBe(16);
        expect(textEl.style?.fontWeight).toBe('bold');
        expect(textEl.style?.color).toBe('#FF0000');
      });

      it('should return PDFBuilder for chaining', () => {
        const service = new PDFGenerationService();
        const result = service.addText('Test', 0, 0);
        expect(result).toBe(service);
      });
    });

    describe('addImage', () => {
      it('should add image to current page', () => {
        const service = new PDFGenerationService();
        const image: PDFImage = {
          id: 'img1',
          src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          position: { x: 100, y: 100 },
          dimensions: { width: 200, height: 150 },
        };
        service.addImage(image);
        const page = service.getCurrentPage();
        expect(page?.elements.length).toBe(1);
      });

      it('should return PDFBuilder for chaining', () => {
        const service = new PDFGenerationService();
        const image: PDFImage = {
          id: 'img1',
          src: 'test.png',
          position: { x: 0, y: 0 },
          dimensions: { width: 100, height: 100 },
        };
        const result = service.addImage(image);
        expect(result).toBe(service);
      });
    });

    describe('addTable', () => {
      it('should add table to current page', () => {
        const service = new PDFGenerationService();
        const table: PDFTable = {
          id: 'table1',
          columns: [
            { header: 'Name', width: 100 },
            { header: 'Age', width: 50 },
          ],
          rows: [
            {
              cells: [
                { content: 'John' },
                { content: '30' },
              ],
            },
          ],
        };
        service.addTable(table);
        const page = service.getCurrentPage();
        expect(page?.elements.length).toBe(1);
      });

      it('should return PDFBuilder for chaining', () => {
        const service = new PDFGenerationService();
        const table: PDFTable = {
          id: 'table1',
          columns: [{ header: 'Col1' }],
          rows: [{ cells: [{ content: 'Cell' }] }],
        };
        const result = service.addTable(table);
        expect(result).toBe(service);
      });
    });

    describe('addLine', () => {
      it('should add line to current page', () => {
        const service = new PDFGenerationService();
        const line: LineElement = {
          id: 'line1',
          type: 'line',
          startX: 0,
          startY: 0,
          endX: 100,
          endY: 100,
        };
        service.addLine(line);
        const page = service.getCurrentPage();
        expect(page?.elements.length).toBe(1);
        expect((page?.elements[0] as LineElement).type).toBe('line');
      });

      it('should return PDFBuilder for chaining', () => {
        const service = new PDFGenerationService();
        const line: LineElement = {
          id: 'line1',
          type: 'line',
          startX: 0,
          startY: 0,
          endX: 100,
          endY: 100,
        };
        const result = service.addLine(line);
        expect(result).toBe(service);
      });
    });

    describe('addRect', () => {
      it('should add rectangle to current page', () => {
        const service = new PDFGenerationService();
        const rect: RectElement = {
          id: 'rect1',
          type: 'rect',
          x: 50,
          y: 50,
          width: 200,
          height: 100,
          fillColor: '#FF0000',
        };
        service.addRect(rect);
        const page = service.getCurrentPage();
        expect(page?.elements.length).toBe(1);
        expect((page?.elements[0] as RectElement).type).toBe('rect');
      });

      it('should return PDFBuilder for chaining', () => {
        const service = new PDFGenerationService();
        const rect: RectElement = {
          id: 'rect1',
          type: 'rect',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        };
        const result = service.addRect(rect);
        expect(result).toBe(service);
      });
    });

    describe('setHeader', () => {
      it('should set header configuration', () => {
        const service = new PDFGenerationService();
        const config: HeaderConfig = {
          content: 'Header Text',
          height: 50,
          fontSize: 14,
          displayPageNumber: true,
        };
        const result = service.setHeader(config);
        expect(result).toBe(service);
      });
    });

    describe('setFooter', () => {
      it('should set footer configuration', () => {
        const service = new PDFGenerationService();
        const config: FooterConfig = {
          content: 'Footer Text',
          height: 50,
          fontSize: 12,
          displayPageNumber: true,
          startPageNumber: 1,
        };
        const result = service.setFooter(config);
        expect(result).toBe(service);
      });
    });

    describe('setMetadata', () => {
      it('should set document metadata', () => {
        const service = new PDFGenerationService();
        const metadata: PDFMetadata = {
          title: 'Test Document',
          author: 'Test Author',
          subject: 'Test Subject',
          keywords: ['test', 'pdf'],
        };
        const result = service.setMetadata(metadata);
        expect(result).toBe(service);
        const page = service.getCurrentPage();
        expect(page).toBeDefined();
      });
    });

    describe('setEncryption', () => {
      it('should enable PDF encryption', () => {
        const service = new PDFGenerationService();
        const encryption: PDFEncryption = {
          enabled: true,
          algorithm: 'aes-256',
          userPassword: 'user123',
          ownerPassword: 'owner123',
        };
        const result = service.setEncryption(encryption);
        expect(result).toBe(service);
      });

      it('should disable encryption when enabled is false', () => {
        const service = new PDFGenerationService();
        service.setEncryption({ enabled: false });
        expect(service.getOptions().encryption.enabled).toBe(false);
      });
    });

    describe('setSignature', () => {
      it('should set signature configuration', () => {
        const service = new PDFGenerationService();
        const signature: PDFSignature = {
          id: 'sig1',
          reason: 'Document signing',
          location: 'New York',
          contactInfo: 'test@example.com',
          name: 'John Doe',
        };
        const result = service.setSignature(signature);
        expect(result).toBe(service);
      });
    });

    describe('setWatermark', () => {
      it('should set text watermark', () => {
        const service = new PDFGenerationService();
        const watermark: PDFWatermark = {
          text: 'CONFIDENTIAL',
          opacity: 0.3,
          rotation: 45,
          fontSize: 36,
          color: '#cccccc',
        };
        const result = service.setWatermark(watermark);
        expect(result).toBe(service);
      });

      it('should set image watermark', () => {
        const service = new PDFGenerationService();
        const watermark: PDFWatermark = {
          imageSrc: 'watermark.png',
          opacity: 0.2,
          rotation: 30,
        };
        const result = service.setWatermark(watermark);
        expect(result).toBe(service);
      });
    });

    describe('setMargins', () => {
      it('should set page margins', () => {
        const service = new PDFGenerationService();
        const margins: Margin = {
          top: 50,
          right: 50,
          bottom: 50,
          left: 50,
        };
        const result = service.setMargins(margins);
        expect(result).toBe(service);
        expect(service.getOptions().margins).toEqual(margins);
      });
    });

    describe('clear', () => {
      it('should clear all pages and reset state', () => {
        const service = new PDFGenerationService();
        service.addPage();
        service.addText('Test', 0, 0);
        service.clear();
        expect(service.getPageCount()).toBe(1);
        const page = service.getCurrentPage();
        expect(page?.elements.length).toBe(0);
      });
    });

    describe('registerTemplate', () => {
      it('should register a template', () => {
        const service = new PDFGenerationService();
        const template: PDFTemplate = {
          id: 'template1',
          name: 'Test Template',
          header: { content: 'Template Header' },
          footer: { content: 'Template Footer', displayPageNumber: true },
        };
        const result = service.registerTemplate(template);
        expect(result).toBe(service);
      });
    });

    describe('render', () => {
      it('should render PDF with text content', async () => {
        const service = new PDFGenerationService();
        service.addText('Hello World', 100, 100);
        const result = await service.render();
        expect(result).toBeDefined();
        expect(result.pageCount).toBe(1);
        expect(result.fileSize).toBeGreaterThan(0);
        expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
      });

      it('should render PDF with multiple pages', async () => {
        const service = new PDFGenerationService();
        service.addText('Page 1', 100, 100);
        service.addPage();
        service.addText('Page 2', 100, 100);
        service.addPage();
        service.addText('Page 3', 100, 100);
        const result = await service.render();
        expect(result.pageCount).toBe(3);
      });

      it('should include metadata in result', async () => {
        const service = new PDFGenerationService();
        service.setMetadata({ title: 'Test', author: 'Author' });
        service.addText('Test', 0, 0);
        const result = await service.render();
        expect(result.metadata).toBeDefined();
        expect(result.metadata?.title).toBe('Test');
      });

      it('should apply encryption when enabled', async () => {
        const service = new PDFGenerationService();
        service.addText('Encrypted', 100, 100);
        service.setEncryption({
          enabled: true,
          algorithm: 'aes-256',
          userPassword: 'password',
        });
        const result = await service.render();
        expect(result).toBeDefined();
        expect(result.document).toBeInstanceOf(Buffer);
      });
    });

    describe('getPageCount', () => {
      it('should return correct page count', () => {
        const service = new PDFGenerationService();
        expect(service.getPageCount()).toBe(1);
        service.addPage();
        expect(service.getPageCount()).toBe(2);
        service.addPage();
        expect(service.getPageCount()).toBe(3);
      });
    });

    describe('getCurrentPage', () => {
      it('should return current page', () => {
        const service = new PDFGenerationService();
        const page = service.getCurrentPage();
        expect(page).toBeDefined();
        expect(page?.pageNumber).toBe(1);
      });

      it('should return current page after clear (not null)', () => {
        const service = new PDFGenerationService();
        service.clear();
        const page = service.getCurrentPage();
        expect(page).toBeDefined();
        expect(page?.pageNumber).toBe(1);
      });
    });
  });

  describe('PDFTemplateEngine', () => {
    describe('createTemplate', () => {
      it('should create a template', () => {
        const engine = new PDFTemplateEngine();
        const template: PDFTemplate = {
          id: 'tmpl1',
          name: 'Invoice Template',
          header: { content: 'INVOICE' },
          margin: DEFAULT_MARGINS,
        };
        engine.createTemplate(template);
        const retrieved = engine.getTemplate('tmpl1');
        expect(retrieved).toBeDefined();
        expect(retrieved?.name).toBe('Invoice Template');
      });
    });

    describe('getTemplate', () => {
      it('should return null for non-existent template', () => {
        const engine = new PDFTemplateEngine();
        const template = engine.getTemplate('nonExistent');
        expect(template).toBeNull();
      });
    });

    describe('listTemplates', () => {
      it('should list all templates', () => {
        const engine = new PDFTemplateEngine();
        engine.createTemplate({ id: 'tmpl1', name: 'Template 1' });
        engine.createTemplate({ id: 'tmpl2', name: 'Template 2' });
        const templates = engine.listTemplates();
        expect(templates.length).toBe(2);
      });
    });

    describe('deleteTemplate', () => {
      it('should delete a template', () => {
        const engine = new PDFTemplateEngine();
        engine.createTemplate({ id: 'tmpl1', name: 'Template 1' });
        expect(engine.deleteTemplate('tmpl1')).toBe(true);
        expect(engine.getTemplate('tmpl1')).toBeNull();
      });

      it('should return false for non-existent template', () => {
        const engine = new PDFTemplateEngine();
        expect(engine.deleteTemplate('nonExistent')).toBe(false);
      });
    });
  });

  describe('HTMLToPDFConverter', () => {
    describe('convert', () => {
      it('should convert simple HTML', async () => {
        const converter = new HTMLToPDFConverter();
        const html: HTMLContent = {
          html: '<body><p>Hello World</p></body>',
        };
        const result = await converter.convert(html);
        expect(result).toBeDefined();
        expect(result.pageCount).toBeGreaterThanOrEqual(1);
      });

      it('should handle div elements', async () => {
        const converter = new HTMLToPDFConverter();
        const html: HTMLContent = {
          html: '<body><div>Test Content</div></body>',
        };
        const result = await converter.convert(html);
        expect(result).toBeDefined();
      });

      it('should apply options to conversion', async () => {
        const converter = new HTMLToPDFConverter({
          pageSize: 'Letter',
          orientation: 'landscape',
        });
        const html: HTMLContent = {
          html: '<body><p>Test</p></body>',
        };
        const result = await converter.convert(html);
        expect(result).toBeDefined();
      });
    });
  });

  describe('PDFWatermarkService', () => {
    describe('addTextWatermark', () => {
      it('should add text watermark', () => {
        const service = new PDFWatermarkService();
        const pdfService = new PDFGenerationService();
        service.addTextWatermark(pdfService, 'CONFIDENTIAL', {
          opacity: 0.2,
          rotation: 45,
        });
        expect(pdfService).toBeDefined();
      });
    });

    describe('addImageWatermark', () => {
      it('should add image watermark', () => {
        const service = new PDFWatermarkService();
        const pdfService = new PDFGenerationService();
        service.addImageWatermark(pdfService, 'logo.png', {
          opacity: 0.3,
        });
        expect(pdfService).toBeDefined();
      });
    });
  });

  describe('PDFSecurityService', () => {
    describe('signPDF', () => {
      it('should sign PDF', async () => {
        const security = new PDFSecurityService();
        const pdfData = Buffer.from('%PDF-1.7\ntest content');
        const signature: PDFSignature = {
          id: 'sig1',
          reason: 'Document signing',
          location: 'Test Location',
        };
        const signedPDF = await security.signPDF(pdfData, signature);
        expect(signedPDF).toBeInstanceOf(Buffer);
        expect(signedPDF.length).toBeGreaterThan(pdfData.length);
      });
    });

    describe('verifyPDFSignature', () => {
      it('should return invalid for unsigned PDF', async () => {
        const security = new PDFSecurityService();
        const pdfData = Buffer.from('%PDF-1.7\ntest content');
        const result = await security.verifyPDFSignature(pdfData);
        expect(result.valid).toBe(false);
      });

      it('should return valid for signed PDF', async () => {
        const security = new PDFSecurityService();
        const pdfData = Buffer.from('%PDF-1.7\ntest content');
        const signature: PDFSignature = {
          id: 'sig1',
          reason: 'Document signing',
        };
        const signedPDF = await security.signPDF(pdfData, signature);
        const result = await security.verifyPDFSignature(signedPDF);
        expect(result.valid).toBe(true);
        expect(result.signature).toBeDefined();
      });
    });

    describe('encryptPDF', () => {
      it('should encrypt PDF', () => {
        const security = new PDFSecurityService();
        const pdfData = Buffer.from('%PDF-1.7\ntest content');
        const encryption: PDFEncryption = {
          enabled: true,
          algorithm: 'aes-256',
          userPassword: 'password',
        };
        const encrypted = security.encryptPDF(pdfData, encryption);
        expect(encrypted).toBeInstanceOf(Buffer);
        expect(encrypted.length).toBeGreaterThan(pdfData.length);
      });

      it('should return original buffer when encryption disabled', () => {
        const security = new PDFSecurityService();
        const pdfData = Buffer.from('%PDF-1.7\ntest content');
        const encryption: PDFEncryption = {
          enabled: false,
        };
        const encrypted = security.encryptPDF(pdfData, encryption);
        expect(encrypted).toBe(pdfData);
      });
    });

    describe('decryptPDF', () => {
      it('should decrypt PDF', () => {
        const security = new PDFSecurityService();
        const originalData = Buffer.from('%PDF-1.7\ntest content');
        const encryption: PDFEncryption = {
          enabled: true,
          algorithm: 'aes-256',
          userPassword: 'password',
        };
        const encrypted = security.encryptPDF(originalData, encryption);
        const decrypted = security.decryptPDF(encrypted, 'password');
        expect(decrypted.toString()).toBe(originalData.toString());
      });
    });
  });

  describe('PDFTableRenderer', () => {
    describe('renderTable', () => {
      it('should render table on PDF service', () => {
        const renderer = createTableRenderer();
        const service = new PDFGenerationService();
        const table: PDFTable = {
          id: 'table1',
          columns: [
            { header: 'Name', width: 100 },
            { header: 'Value', width: 100 },
          ],
          rows: [
            {
              cells: [
                { content: 'Item 1' },
                { content: '100' },
              ],
            },
          ],
        };
        renderer.renderTable(service, table, 50, 50);
        expect(service).toBeDefined();
      });
    });
  });

  describe('Factory Functions', () => {
    describe('createPDFService', () => {
      it('should create PDF service with options', () => {
        const service = createPDFService({
          pageSize: 'A4',
          orientation: 'portrait',
        });
        expect(service).toBeInstanceOf(PDFGenerationService);
        expect(service.getOptions().pageSize).toBe('A4');
      });
    });

    describe('createTemplateEngine', () => {
      it('should create template engine', () => {
        const engine = createTemplateEngine();
        expect(engine).toBeInstanceOf(PDFTemplateEngine);
      });
    });

    describe('createHTMLConverter', () => {
      it('should create HTML converter', () => {
        const converter = createHTMLConverter();
        expect(converter).toBeInstanceOf(HTMLToPDFConverter);
      });
    });

    describe('createWatermarkService', () => {
      it('should create watermark service', () => {
        const service = createWatermarkService();
        expect(service).toBeInstanceOf(PDFWatermarkService);
      });
    });

    describe('createSecurityService', () => {
      it('should create security service', () => {
        const service = createSecurityService();
        expect(service).toBeInstanceOf(PDFSecurityService);
      });
    });

    describe('createTableRenderer', () => {
      it('should create table renderer', () => {
        const renderer = createTableRenderer();
        expect(renderer).toBeInstanceOf(PDFTableRenderer);
      });
    });
  });

  describe('generatePDFFromHTML', () => {
    it('should generate PDF from HTML content', async () => {
      const html: HTMLContent = {
        html: '<body><p>Test Paragraph</p></body>',
      };
      const result = await generatePDFFromHTML(html);
      expect(result).toBeDefined();
      expect(result.pageCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('generatePDFFromTemplate', () => {
    it('should render template and generate PDF', () => {
      const engine = createTemplateEngine();
      engine.createTemplate({
        id: 'testTemplate',
        name: 'Test',
        elements: [
          {
            id: 'text1',
            type: 'text',
            content: 'Hello {{name}}',
            x: 100,
            y: 100,
          },
        ],
        placeholders: {
          name: 'Default Name',
        },
      });

      const data = { name: 'John' };
      const pdfService = engine.renderTemplate('testTemplate', data);
      expect(pdfService).toBeInstanceOf(PDFGenerationService);
    });
  });

  describe('Error Handling', () => {
    describe('isPDFGenerationError', () => {
      it('should return true for PDF generation errors', () => {
        const error = new Error('Test') as PDFGenerationError;
        error.code = 'PDF_RENDER_FAILED';
        expect(isPDFGenerationError(error)).toBe(true);
      });

      it('should return false for regular errors', () => {
        const error = new Error('Test');
        expect(isPDFGenerationError(error)).toBe(false);
      });

      it('should return false for non-error values', () => {
        expect(isPDFGenerationError('string')).toBe(false);
        expect(isPDFGenerationError(null)).toBe(false);
        expect(isPDFGenerationError(undefined)).toBe(false);
      });
    });

    describe('getErrorMessage', () => {
      it('should return message from Error objects', () => {
        const error = new Error('Test Error');
        expect(getErrorMessage(error)).toBe('Test Error');
      });

      it('should return string representation for non-errors', () => {
        expect(getErrorMessage('string error')).toBe('string error');
        expect(getErrorMessage(123)).toBe('123');
      });
    });
  });

  describe('Default Constants', () => {
    describe('DEFAULT_MARGINS', () => {
      it('should have valid margin values', () => {
        expect(DEFAULT_MARGINS.top).toBe(72);
        expect(DEFAULT_MARGINS.right).toBe(72);
        expect(DEFAULT_MARGINS.bottom).toBe(72);
        expect(DEFAULT_MARGINS.left).toBe(72);
      });
    });

    describe('DEFAULT_TEXT_STYLE', () => {
      it('should have default text style values', () => {
        expect(DEFAULT_TEXT_STYLE.fontFamily).toBe('Helvetica');
        expect(DEFAULT_TEXT_STYLE.fontSize).toBe(12);
        expect(DEFAULT_TEXT_STYLE.fontWeight).toBe('normal');
      });
    });

    describe('DEFAULT_PERMISSIONS', () => {
      it('should have default permission values', () => {
        expect(DEFAULT_PERMISSIONS.print).toBe(true);
        expect(DEFAULT_PERMISSIONS.copy).toBe(true);
        expect(DEFAULT_PERMISSIONS.modify).toBe(true);
        expect(DEFAULT_PERMISSIONS.annotate).toBe(true);
        expect(DEFAULT_PERMISSIONS.fillForms).toBe(true);
        expect(DEFAULT_PERMISSIONS.extractContent).toBe(true);
        expect(DEFAULT_PERMISSIONS.assemble).toBe(true);
        expect(DEFAULT_PERMISSIONS.printToQuality).toBe('high');
      });
    });
  });
});