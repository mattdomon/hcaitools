import {
  PDFContentBuilder,
  PDFStyleManager,
  PDFPageLayout,
  PDFValidationService,
  PDFBatchProcessor,
  TextStyle,
  createContentBuilder,
  createStyleManager,
  createPageLayout,
  createValidationService,
  createBatchProcessor,
  PDFGenerationService,
  DEFAULT_TEXT_STYLE,
} from '../src/core/pdfGeneration';

describe('PDF Generation Advanced Features', () => {
  describe('PDFContentBuilder', () => {
    describe('constructor', () => {
      it('should create content builder with default options', () => {
        const builder = new PDFContentBuilder();
        expect(builder).toBeDefined();
        expect(builder.getBlocks().length).toBe(0);
      });

      it('should create content builder with custom page dimensions', () => {
        const builder = new PDFContentBuilder({
          pageWidth: 800,
          pageHeight: 1000,
        });
        expect(builder).toBeDefined();
      });

      it('should create content builder with custom margins', () => {
        const builder = new PDFContentBuilder({
          margins: { top: 100, right: 80, bottom: 100, left: 80 },
        });
        expect(builder).toBeDefined();
      });
    });

    describe('addText', () => {
      it('should add text block', () => {
        const builder = new PDFContentBuilder();
        builder.addText('Hello World');
        expect(builder.getBlocks().length).toBe(1);
        expect(builder.getBlocks()[0].type).toBe('text');
      });

      it('should add text with style', () => {
        const builder = new PDFContentBuilder();
        const style: TextStyle = {
          fontSize: 16,
          fontWeight: 'bold',
          color: '#FF0000',
        };
        builder.addText('Bold Text', style);
        expect(builder.getBlocks().length).toBe(1);
      });

      it('should chain multiple text additions', () => {
        const builder = new PDFContentBuilder();
        builder
          .addText('First')
          .addText('Second')
          .addText('Third');
        expect(builder.getBlocks().length).toBe(3);
      });
    });

    describe('addHeading', () => {
      it('should add heading with correct size', () => {
        const builder = new PDFContentBuilder();
        builder.addHeading('Title', 1);
        builder.addHeading('Subtitle', 2);
        builder.addHeading('Section', 3);
        expect(builder.getBlocks().length).toBe(3);
      });

      it('should create h1 heading', () => {
        const builder = new PDFContentBuilder();
        builder.addHeading('Main Title');
        const block = builder.getBlocks()[0];
        expect((block as any).style?.fontSize).toBe(24);
        expect((block as any).style?.fontWeight).toBe('bold');
      });

      it('should create h3 heading', () => {
        const builder = new PDFContentBuilder();
        builder.addHeading('Section Title', 3);
        const block = builder.getBlocks()[0];
        expect((block as any).style?.fontSize).toBe(16);
      });
    });

    describe('addParagraph', () => {
      it('should add paragraph with default alignment', () => {
        const builder = new PDFContentBuilder();
        builder.addParagraph('This is a paragraph');
        expect(builder.getBlocks().length).toBe(1);
      });

      it('should add justified paragraph', () => {
        const builder = new PDFContentBuilder();
        builder.addParagraph('This is a justified paragraph', true);
        const block = builder.getBlocks()[0];
        expect((block as any).style?.alignment).toBe('justify');
      });
    });

    describe('addSpacer', () => {
      it('should add spacer block', () => {
        const builder = new PDFContentBuilder();
        builder.addSpacer(20);
        expect(builder.getBlocks().length).toBe(1);
        expect(builder.getBlocks()[0].type).toBe('spacer');
      });

      it('should chain with other elements', () => {
        const builder = new PDFContentBuilder();
        builder
          .addText('Text 1')
          .addSpacer(10)
          .addText('Text 2')
          .addSpacer(15)
          .addText('Text 3');
        expect(builder.getBlocks().length).toBe(5);
      });
    });

    describe('addLineBreak', () => {
      it('should add line break as spacer', () => {
        const builder = new PDFContentBuilder();
        builder.addText('Line 1').addLineBreak().addText('Line 2');
        expect(builder.getBlocks().length).toBe(3);
      });
    });

    describe('addList', () => {
      it('should add unordered list', () => {
        const builder = new PDFContentBuilder();
        builder.addList(['Item 1', 'Item 2', 'Item 3']);
        expect(builder.getBlocks().length).toBe(3);
      });

      it('should add ordered list', () => {
        const builder = new PDFContentBuilder();
        builder.addList(['Item 1', 'Item 2', 'Item 3'], true);
        expect(builder.getBlocks().length).toBe(3);
      });
    });

    describe('addTable2D', () => {
      it('should add table from 2D array', () => {
        const builder = new PDFContentBuilder();
        const data = [
          ['Name', 'Age', 'City'],
          ['John', '30', 'New York'],
          ['Jane', '28', 'Los Angeles'],
        ];
        builder.addTable2D(data);
        expect(builder.getBlocks().length).toBe(1);
        expect(builder.getBlocks()[0].type).toBe('table');
      });

      it('should add table with headers', () => {
        const builder = new PDFContentBuilder();
        const data = [
          ['Name', 'Score'],
          ['Alice', '95'],
          ['Bob', '87'],
        ];
        builder.addTable2D(data, { headers: true });
        expect(builder.getBlocks().length).toBe(1);
      });

      it('should add table with alternate row colors', () => {
        const builder = new PDFContentBuilder();
        const data = [
          ['A', 'B'],
          ['C', 'D'],
        ];
        builder.addTable2D(data, { alternateRows: true });
        expect(builder.getBlocks().length).toBe(1);
      });
    });

    describe('getContentHeight', () => {
      it('should calculate total content height', () => {
        const builder = new PDFContentBuilder();
        builder
          .addText('Text 1')
          .addSpacer(10)
          .addText('Text 2');
        const height = builder.getContentHeight();
        expect(height).toBeGreaterThan(0);
      });
    });

    describe('clearBlocks', () => {
      it('should clear all blocks', () => {
        const builder = new PDFContentBuilder();
        builder.addText('Text 1').addText('Text 2');
        expect(builder.getBlocks().length).toBe(2);
        builder.clearBlocks();
        expect(builder.getBlocks().length).toBe(0);
      });

      it('should return builder for chaining', () => {
        const builder = new PDFContentBuilder();
        const result = builder.clearBlocks();
        expect(result).toBe(builder);
      });
    });
  });

  describe('PDFStyleManager', () => {
    describe('constructor', () => {
      it('should create style manager with defaults', () => {
        const manager = new PDFStyleManager();
        expect(manager).toBeDefined();
      });

      it('should register default styles', () => {
        const manager = new PDFStyleManager();
        expect(manager.getStyle('heading1')).toBeDefined();
        expect(manager.getStyle('paragraph')).toBeDefined();
        expect(manager.getStyle('strong')).toBeDefined();
      });

      it('should create with custom default style', () => {
        const defaultStyle: TextStyle = {
          fontFamily: 'Arial',
          fontSize: 14,
        };
        const manager = new PDFStyleManager(defaultStyle);
        expect(manager).toBeDefined();
      });
    });

    describe('defineStyle', () => {
      it('should define custom style', () => {
        const manager = new PDFStyleManager();
        manager.defineStyle('customStyle', {
          fontSize: 18,
          color: '#FF0000',
        });
        const style = manager.getStyle('customStyle');
        expect(style?.fontSize).toBe(18);
        expect(style?.color).toBe('#FF0000');
      });

      it('should return manager for chaining', () => {
        const manager = new PDFStyleManager();
        const result = manager.defineStyle('test', { fontSize: 12 });
        expect(result).toBe(manager);
      });

      it('should override existing style', () => {
        const manager = new PDFStyleManager();
        manager.defineStyle('heading1', { fontSize: 30 });
        const style = manager.getStyle('heading1');
        expect(style?.fontSize).toBe(30);
      });
    });

    describe('getStyle', () => {
      it('should return existing style', () => {
        const manager = new PDFStyleManager();
        const style = manager.getStyle('heading1');
        expect(style).toBeDefined();
        expect(style?.fontSize).toBe(24);
      });

      it('should return undefined for non-existent style', () => {
        const manager = new PDFStyleManager();
        const style = manager.getStyle('nonExistent');
        expect(style).toBeUndefined();
      });
    });

    describe('applyStyle', () => {
      it('should apply style from manager', () => {
        const manager = new PDFStyleManager();
        const style = manager.applyStyle('heading1');
        expect(style.fontSize).toBe(24);
        expect(style.fontWeight).toBe('bold');
      });

      it('should merge with base style', () => {
        const manager = new PDFStyleManager();
        const baseStyle: TextStyle = { color: '#FF0000' };
        const style = manager.applyStyle('heading1', baseStyle);
        expect(style.fontSize).toBe(24);
        expect(style.color).toBe('#FF0000');
      });
    });

    describe('listStyles', () => {
      it('should list all style names', () => {
        const manager = new PDFStyleManager();
        const styles = manager.listStyles();
        expect(styles.length).toBeGreaterThan(0);
        expect(styles).toContain('heading1');
        expect(styles).toContain('paragraph');
      });
    });

    describe('removeStyle', () => {
      it('should remove custom style', () => {
        const manager = new PDFStyleManager();
        manager.defineStyle('custom', { fontSize: 12 });
        expect(manager.getStyle('custom')).toBeDefined();
        manager.removeStyle('custom');
        expect(manager.getStyle('custom')).toBeUndefined();
      });

      it('should return false for non-existent style', () => {
        const manager = new PDFStyleManager();
        const result = manager.removeStyle('nonExistent');
        expect(result).toBe(false);
      });
    });

    describe('clone', () => {
      it('should clone manager with all styles', () => {
        const manager = new PDFStyleManager();
        manager.defineStyle('custom', { fontSize: 16 });
        const clone = manager.clone();

        expect(clone.getStyle('heading1')).toBeDefined();
        expect(clone.getStyle('custom')).toBeDefined();
      });

      it('should create independent clone', () => {
        const manager = new PDFStyleManager();
        const clone = manager.clone();

        clone.defineStyle('newStyle', { fontSize: 20 });
        expect(manager.getStyle('newStyle')).toBeUndefined();
      });
    });

    describe('mergeWith', () => {
      it('should merge two style managers', () => {
        const manager1 = new PDFStyleManager();
        const manager2 = new PDFStyleManager();

        manager2.defineStyle('customStyle', { fontSize: 18 });
        const merged = manager1.mergeWith(manager2);

        expect(merged.getStyle('heading1')).toBeDefined();
        expect(merged.getStyle('customStyle')).toBeDefined();
      });
    });
  });

  describe('PDFPageLayout', () => {
    describe('constructor', () => {
      it('should create layout with defaults', () => {
        const layout = new PDFPageLayout();
        expect(layout).toBeDefined();
      });

      it('should create layout with custom options', () => {
        const layout = new PDFPageLayout({
          pageWidth: 800,
          pageHeight: 1000,
          columns: 2,
          columnGap: 30,
        });
        expect(layout).toBeDefined();
      });
    });

    describe('getColumnPositions', () => {
      it('should return single column position', () => {
        const layout = new PDFPageLayout({ columns: 1 });
        const positions = layout.getColumnPositions();
        expect(positions.length).toBe(1);
        expect(positions[0].x).toBe(50);
      });

      it('should return multiple column positions', () => {
        const layout = new PDFPageLayout({
          columns: 2,
          columnGap: 20,
        });
        const positions = layout.getColumnPositions();
        expect(positions.length).toBe(2);
        expect(positions[0].x).toBeLessThan(positions[1].x);
      });

      it('should calculate correct column widths', () => {
        const layout = new PDFPageLayout({
          pageWidth: 600,
          columns: 2,
          columnGap: 20,
          margins: { top: 50, right: 50, bottom: 50, left: 50 },
        });
        const positions = layout.getColumnPositions();
        const expectedWidth = (600 - 50 - 50 - 20) / 2;
        expect(positions[0].width).toBeCloseTo(expectedWidth, 0);
      });
    });

    describe('getUsableArea', () => {
      it('should return usable area', () => {
        const layout = new PDFPageLayout({
          margins: { top: 60, right: 60, bottom: 60, left: 60 },
        });
        const area = layout.getUsableArea();
        expect(area.x).toBe(60);
        expect(area.y).toBe(60);
        expect(area.width).toBeLessThan(595);
        expect(area.height).toBeLessThan(842);
      });
    });

    describe('setColumns', () => {
      it('should set number of columns', () => {
        const layout = new PDFPageLayout();
        layout.setColumns(3);
        expect(layout.getColumnPositions().length).toBe(3);
      });

      it('should return layout for chaining', () => {
        const layout = new PDFPageLayout();
        const result = layout.setColumns(2);
        expect(result).toBe(layout);
      });
    });

    describe('setColumnGap', () => {
      it('should set gap between columns', () => {
        const layout = new PDFPageLayout({ columns: 2 });
        layout.setColumnGap(30);
        const positions = layout.getColumnPositions();
        const gap = positions[1].x - (positions[0].x + positions[0].width);
        expect(gap).toBeCloseTo(30, 0);
      });
    });

    describe('setMargins', () => {
      it('should set page margins', () => {
        const layout = new PDFPageLayout();
        layout.setMargins({ top: 100, right: 100, bottom: 100, left: 100 });
        const margins = layout.getMargins();
        expect(margins.top).toBe(100);
        expect(margins.left).toBe(100);
      });

      it('should return layout for chaining', () => {
        const layout = new PDFPageLayout();
        const result = layout.setMargins({ top: 80 });
        expect(result).toBe(layout);
      });
    });

    describe('getPageSize', () => {
      it('should return page dimensions', () => {
        const layout = new PDFPageLayout({
          pageWidth: 800,
          pageHeight: 1000,
        });
        const size = layout.getPageSize();
        expect(size.width).toBe(800);
        expect(size.height).toBe(1000);
      });
    });

    describe('getContentArea', () => {
      it('should return content area dimensions', () => {
        const layout = new PDFPageLayout({
          pageWidth: 600,
          margins: { top: 50, right: 50, bottom: 50, left: 50 },
        });
        const area = layout.getContentArea();
        expect(area.width).toBe(500);
      });
    });
  });

  describe('PDFValidationService', () => {
    describe('validateTextElement', () => {
      it('should validate correct text element', () => {
        const element: any = {
          id: 'text1',
          type: 'text',
          content: 'Hello World',
          x: 100,
          y: 100,
          style: { fontSize: 12 },
        };
        const result = PDFValidationService.validateTextElement(element);
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
      });

      it('should reject empty content', () => {
        const element: any = {
          id: 'text1',
          type: 'text',
          content: '',
          x: 100,
          y: 100,
        };
        const result = PDFValidationService.validateTextElement(element);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject negative coordinates', () => {
        const element: any = {
          id: 'text1',
          type: 'text',
          content: 'Text',
          x: -10,
          y: 100,
        };
        const result = PDFValidationService.validateTextElement(element);
        expect(result.valid).toBe(false);
      });

      it('should reject invalid font size', () => {
        const element: any = {
          id: 'text1',
          type: 'text',
          content: 'Text',
          x: 100,
          y: 100,
          style: { fontSize: 150 },
        };
        const result = PDFValidationService.validateTextElement(element);
        expect(result.valid).toBe(false);
      });
    });

    describe('validateImage', () => {
      it('should validate correct image', () => {
        const image: any = {
          id: 'img1',
          src: 'image.png',
          position: { x: 100, y: 100 },
          dimensions: { width: 200, height: 150 },
        };
        const result = PDFValidationService.validateImage(image);
        expect(result.valid).toBe(true);
      });

      it('should reject empty source', () => {
        const image: any = {
          id: 'img1',
          src: '',
          position: { x: 100, y: 100 },
          dimensions: { width: 200, height: 150 },
        };
        const result = PDFValidationService.validateImage(image);
        expect(result.valid).toBe(false);
      });

      it('should reject invalid dimensions', () => {
        const image: any = {
          id: 'img1',
          src: 'image.png',
          position: { x: 100, y: 100 },
          dimensions: { width: -200, height: 150 },
        };
        const result = PDFValidationService.validateImage(image);
        expect(result.valid).toBe(false);
      });
    });

    describe('validateTable', () => {
      it('should validate correct table', () => {
        const table: any = {
          id: 'table1',
          columns: [{ header: 'A' }, { header: 'B' }],
          rows: [
            { cells: [{ content: 'A1' }, { content: 'B1' }] },
            { cells: [{ content: 'A2' }, { content: 'B2' }] },
          ],
        };
        const result = PDFValidationService.validateTable(table);
        expect(result.valid).toBe(true);
      });

      it('should reject table with no columns', () => {
        const table: any = {
          id: 'table1',
          columns: [],
          rows: [{ cells: [] }],
        };
        const result = PDFValidationService.validateTable(table);
        expect(result.valid).toBe(false);
      });

      it('should reject mismatched cell counts', () => {
        const table: any = {
          id: 'table1',
          columns: [{ header: 'A' }, { header: 'B' }],
          rows: [
            { cells: [{ content: 'A1' }, { content: 'B1' }] },
            { cells: [{ content: 'A2' }] },
          ],
        };
        const result = PDFValidationService.validateTable(table);
        expect(result.valid).toBe(false);
      });
    });

    describe('validateColor', () => {
      it('should validate hex color', () => {
        const result = PDFValidationService.validateColor('#FF0000');
        expect(result.valid).toBe(true);
      });

      it('should validate rgb color', () => {
        const result = PDFValidationService.validateColor('rgb(255, 0, 0)');
        expect(result.valid).toBe(true);
      });

      it('should reject invalid color format', () => {
        const result = PDFValidationService.validateColor('red');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should reject invalid hex', () => {
        const result = PDFValidationService.validateColor('#GGGGGG');
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('PDFBatchProcessor', () => {
    describe('constructor', () => {
      it('should create batch processor with default concurrency', () => {
        const processor = new PDFBatchProcessor();
        expect(processor).toBeDefined();
      });

      it('should create batch processor with custom concurrency', () => {
        const processor = new PDFBatchProcessor(5);
        expect(processor).toBeDefined();
      });

      it('should enforce minimum concurrency of 1', () => {
        const processor = new PDFBatchProcessor(0);
        expect(processor).toBeDefined();
      });
    });

    describe('addTask', () => {
      it('should add task to queue', () => {
        const processor = new PDFBatchProcessor();
        processor.addTask('task1', async () => Buffer.from('test'));
        expect(processor.getQueueSize()).toBe(1);
      });

      it('should return processor for chaining', () => {
        const processor = new PDFBatchProcessor();
        const result = processor.addTask('task1', async () => Buffer.from('test'));
        expect(result).toBe(processor);
      });

      it('should add multiple tasks', () => {
        const processor = new PDFBatchProcessor();
        processor
          .addTask('task1', async () => Buffer.from('test1'))
          .addTask('task2', async () => Buffer.from('test2'))
          .addTask('task3', async () => Buffer.from('test3'));
        expect(processor.getQueueSize()).toBe(3);
      });
    });

    describe('process', () => {
      it('should process tasks', async () => {
        const processor = new PDFBatchProcessor(2);
        processor
          .addTask('task1', async () => Buffer.from('content1'))
          .addTask('task2', async () => Buffer.from('content2'));

        const results = await processor.process();
        expect(results.size).toBe(2);
        expect(results.get('task1')?.success).toBe(true);
        expect(results.get('task2')?.success).toBe(true);
      });

      it('should handle task errors', async () => {
        const processor = new PDFBatchProcessor(1);
        processor.addTask('task1', async () => {
          throw new Error('Task failed');
        });

        const results = await processor.process();
        expect(results.get('task1')?.success).toBe(false);
        expect(results.get('task1')?.error).toBeDefined();
      });

      it('should respect concurrency limit', async () => {
        const processor = new PDFBatchProcessor(1);
        let concurrent = 0;
        let maxConcurrent = 0;

        const task = async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((resolve) => setTimeout(resolve, 10));
          concurrent--;
          return Buffer.from('test');
        };

        processor
          .addTask('task1', task)
          .addTask('task2', task)
          .addTask('task3', task);

        await processor.process();
        expect(maxConcurrent).toBeLessThanOrEqual(1);
      });
    });

    describe('getResult', () => {
      it('should get specific result', async () => {
        const processor = new PDFBatchProcessor();
        processor.addTask('task1', async () => Buffer.from('content1'));
        await processor.process();

        const result = processor.getResult('task1');
        expect(result).toBeDefined();
        expect(result?.success).toBe(true);
      });

      it('should return undefined for non-existent task', () => {
        const processor = new PDFBatchProcessor();
        const result = processor.getResult('nonExistent');
        expect(result).toBeUndefined();
      });
    });

    describe('clearQueue', () => {
      it('should clear pending tasks', () => {
        const processor = new PDFBatchProcessor();
        processor
          .addTask('task1', async () => Buffer.from('test1'))
          .addTask('task2', async () => Buffer.from('test2'));
        expect(processor.getQueueSize()).toBe(2);

        processor.clearQueue();
        expect(processor.getQueueSize()).toBe(0);
      });

      it('should return processor for chaining', () => {
        const processor = new PDFBatchProcessor();
        const result = processor.clearQueue();
        expect(result).toBe(processor);
      });
    });
  });

  describe('Factory Functions', () => {
    describe('createContentBuilder', () => {
      it('should create content builder', () => {
        const builder = createContentBuilder();
        expect(builder).toBeInstanceOf(PDFContentBuilder);
      });

      it('should create with options', () => {
        const builder = createContentBuilder({
          pageWidth: 800,
          pageHeight: 1000,
        });
        expect(builder).toBeInstanceOf(PDFContentBuilder);
      });
    });

    describe('createStyleManager', () => {
      it('should create style manager', () => {
        const manager = createStyleManager();
        expect(manager).toBeInstanceOf(PDFStyleManager);
      });
    });

    describe('createPageLayout', () => {
      it('should create page layout', () => {
        const layout = createPageLayout();
        expect(layout).toBeInstanceOf(PDFPageLayout);
      });
    });

    describe('createValidationService', () => {
      it('should return validation service', () => {
        const service = createValidationService();
        expect(service).toBe(PDFValidationService);
      });
    });

    describe('createBatchProcessor', () => {
      it('should create batch processor', () => {
        const processor = createBatchProcessor();
        expect(processor).toBeInstanceOf(PDFBatchProcessor);
      });

      it('should create with concurrency', () => {
        const processor = createBatchProcessor(5);
        expect(processor).toBeInstanceOf(PDFBatchProcessor);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should build complex document with content builder', () => {
      const builder = createContentBuilder();
      const styleManager = createStyleManager();

      builder
        .addHeading('Document Title', 1)
        .addParagraph('This is an introduction paragraph.')
        .addLineBreak()
        .addHeading('Section 1', 2)
        .addList(['Point 1', 'Point 2', 'Point 3'])
        .addLineBreak()
        .addHeading('Section 2', 2)
        .addParagraph('Another paragraph with more details.')
        .addTable2D(
          [
            ['Name', 'Value'],
            ['Item 1', '100'],
            ['Item 2', '200'],
          ],
          { headers: true }
        );

      expect(builder.getBlocks().length).toBeGreaterThan(5);
    });

    it('should apply styles to content', () => {
      const builder = createContentBuilder({
        defaultStyle: {
          fontFamily: 'Arial',
          fontSize: 11,
        },
      });
      const styleManager = createStyleManager();

      const heading1Style = styleManager.getStyle('heading1');
      builder.addText('Styled Text', heading1Style);

      expect(builder.getBlocks().length).toBe(1);
    });

    it('should create multi-column layout', () => {
      const layout = createPageLayout({
        columns: 3,
        columnGap: 25,
        margins: { top: 72, right: 72, bottom: 72, left: 72 },
      });

      const positions = layout.getColumnPositions();
      expect(positions.length).toBe(3);

      for (let i = 1; i < positions.length; i++) {
        const gap = positions[i].x - (positions[i - 1].x + positions[i - 1].width);
        expect(gap).toBeCloseTo(25, 0);
      }
    });

    it('should validate complex document', () => {
      const builder = createContentBuilder();
      builder
        .addText('Test')
        .addList(['A', 'B', 'C'])
        .addTable2D([['X', 'Y']]);

      const validation = createValidationService();
      expect(validation).toBeDefined();
    });

    it('should process multiple PDFs in parallel', async () => {
      const processor = createBatchProcessor(2);

      processor
        .addTask('doc1', async () => {
          const service = new PDFGenerationService();
          service.addText('Document 1', 100, 100);
          const result = await service.render();
          return result.document;
        })
        .addTask('doc2', async () => {
          const service = new PDFGenerationService();
          service.addText('Document 2', 100, 100);
          const result = await service.render();
          return result.document;
        });

      const results = await processor.process();
      expect(results.size).toBe(2);
      expect(results.get('doc1')?.success).toBe(true);
      expect(results.get('doc2')?.success).toBe(true);
    });
  });
});