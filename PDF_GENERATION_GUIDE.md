# PDF Generation Module - Complete Guide

## Overview

The PDF Generation module (`src/core/pdfGeneration/`) provides a comprehensive TypeScript-based system for generating, styling, and managing PDF documents with advanced features like encryption, digital signatures, watermarks, and batch processing.

## Module Structure

### Core Files

1. **types.ts** - Type definitions and constants
   - Page sizes, orientations, compression levels
   - Encryption, signatures, watermarks
   - Tables, images, text elements
   - Type guards and utility functions

2. **pdfGeneration.ts** - Main implementation
   - `PDFGenerationService` - Core PDF builder with chainable API
   - `PDFTemplateEngine` - Template creation and rendering
   - `HTMLToPDFConverter` - Convert HTML to PDF
   - `PDFWatermarkService` - Add watermarks
   - `PDFSecurityService` - Encryption and digital signatures
   - `PDFTableRenderer` - Advanced table rendering

3. **advanced.ts** - Advanced features
   - `PDFContentBuilder` - Composable content building
   - `PDFStyleManager` - Centralized style management
   - `PDFPageLayout` - Advanced page layouts with columns
   - `PDFValidationService` - Validation utilities
   - `PDFBatchProcessor` - Parallel PDF generation

4. **index.ts** - Module exports

## Quick Start

### Basic PDF Creation

```typescript
import { createPDFService } from '@manus/pdfGeneration';

const service = createPDFService();

service
  .addText('Hello World', 100, 100)
  .addText('Page 1 Content', 100, 150)
  .addPage()
  .addText('Page 2 Content', 100, 100);

const result = await service.render();
console.log(`Generated PDF: ${result.fileSize} bytes`);
```

### Content Builder (Recommended)

```typescript
import { createContentBuilder } from '@manus/pdfGeneration';

const builder = createContentBuilder();

builder
  .addHeading('Document Title', 1)
  .addParagraph('Introduction text...')
  .addLineBreak()
  .addHeading('Section 1', 2)
  .addList(['Point 1', 'Point 2', 'Point 3'])
  .addLineBreak()
  .addTable2D(
    [
      ['Name', 'Value'],
      ['Item 1', '100'],
      ['Item 2', '200'],
    ],
    { headers: true, alternateRows: true }
  );

const blocks = builder.getBlocks();
```

### Style Management

```typescript
import { createStyleManager } from '@manus/pdfGeneration';

const styleManager = createStyleManager();

// Use predefined styles
const heading = styleManager.getStyle('heading1');
const strong = styleManager.getStyle('strong');

// Define custom styles
styleManager.defineStyle('emphasis', {
  fontStyle: 'italic',
  color: '#FF5733',
  fontSize: 14,
});

// Apply styles
const customStyle = styleManager.applyStyle('emphasis');
```

## Page Layouts

### Multi-Column Layout

```typescript
import { createPageLayout } from '@manus/pdfGeneration';

const layout = createPageLayout({
  columns: 3,
  columnGap: 25,
  pageWidth: 595,
  pageHeight: 842,
  margins: { top: 72, right: 72, bottom: 72, left: 72 },
});

const positions = layout.getColumnPositions();
const usableArea = layout.getUsableArea();
```

## Security Features

### PDF Encryption

```typescript
import { createPDFService } from '@manus/pdfGeneration';

const service = createPDFService();

service.setEncryption({
  enabled: true,
  algorithm: 'aes-256',
  userPassword: 'userpass123',
  ownerPassword: 'ownerpass123',
  permissions: {
    print: true,
    copy: false,
    modify: false,
    annotate: true,
    fillForms: true,
    extractContent: false,
    assemble: false,
    printToQuality: 'high',
  },
});

service.addText('Encrypted content', 100, 100);
const result = await service.render();
```

### Digital Signatures

```typescript
import { createSecurityService, createPDFService } from '@manus/pdfGeneration';

const service = createPDFService();
const security = createSecurityService();

service.addText('Document to sign', 100, 100);
const result = await service.render();

const signed = await security.signPDF(result.document, {
  reason: 'Document Approval',
  location: 'New York',
  contactInfo: 'user@example.com',
  name: 'John Doe',
  visible: true,
});

const verification = await security.verifyPDFSignature(signed);
```

### Watermarks

```typescript
import { createWatermarkService } from '@manus/pdfGeneration';

const service = createPDFService();
const watermarkService = createWatermarkService();

watermarkService.addTextWatermark(service, 'CONFIDENTIAL', {
  opacity: 0.3,
  rotation: 45,
  fontSize: 48,
  color: '#cccccc',
});

service.addText('Content with watermark', 100, 100);
```

## Batch Processing

```typescript
import { createBatchProcessor, createPDFService } from '@manus/pdfGeneration';

const processor = createBatchProcessor(3); // 3 concurrent PDFs

processor
  .addTask('invoice-001', async () => {
    const service = createPDFService();
    service.addText('Invoice #001', 100, 100);
    const result = await service.render();
    return result.document;
  })
  .addTask('invoice-002', async () => {
    const service = createPDFService();
    service.addText('Invoice #002', 100, 100);
    const result = await service.render();
    return result.document;
  })
  .addTask('invoice-003', async () => {
    const service = createPDFService();
    service.addText('Invoice #003', 100, 100);
    const result = await service.render();
    return result.document;
  });

const results = await processor.process();
results.forEach((result, id) => {
  if (result.success) {
    console.log(`${id}: Generated ${result.buffer.length} bytes`);
  } else {
    console.error(`${id}: ${result.error?.message}`);
  }
});
```

## Validation

```typescript
import { createValidationService } from '@manus/pdfGeneration';

const validator = createValidationService();

// Validate text elements
const textValidation = validator.validateTextElement({
  id: 'text1',
  type: 'text',
  content: 'Hello',
  x: 100,
  y: 100,
  style: { fontSize: 12 },
});

// Validate images
const imageValidation = validator.validateImage({
  id: 'img1',
  src: 'image.png',
  position: { x: 0, y: 0 },
  dimensions: { width: 200, height: 150 },
});

// Validate tables
const tableValidation = validator.validateTable({
  id: 'table1',
  columns: [{ header: 'A' }, { header: 'B' }],
  rows: [{ cells: [{ content: 'A1' }, { content: 'B1' }] }],
});

// Validate colors
const colorValidation = validator.validateColor('#FF0000');
```

## Advanced Content Building

```typescript
import { createContentBuilder } from '@manus/pdfGeneration';

const builder = createContentBuilder({
  pageWidth: 595,
  pageHeight: 842,
  margins: { top: 50, right: 50, bottom: 50, left: 50 },
  defaultStyle: { fontFamily: 'Helvetica', fontSize: 12 },
});

builder
  .addHeading('Main Title', 1)
  .addHeading('Subtitle', 2)
  .addParagraph('Body text paragraph...')
  .addLineBreak()
  .addDivider('#cccccc', 2)
  .addLineBreak()
  .addList(['First item', 'Second item', 'Third item'], false)
  .addLineBreak()
  .addList(['First numbered', 'Second numbered', 'Third numbered'], true);

const contentHeight = builder.getContentHeight();
builder.clearBlocks();
```

## HTML to PDF Conversion

```typescript
import { generatePDFFromHTML } from '@manus/pdfGeneration';

const html = `
  <body>
    <p>Paragraph 1</p>
    <p>Paragraph 2</p>
    <div>Div content</div>
  </body>
`;

const result = await generatePDFFromHTML(
  { html },
  {
    pageSize: 'A4',
    orientation: 'portrait',
    metadata: { title: 'Generated PDF' },
  }
);
```

## Template System

```typescript
import { createTemplateEngine } from '@manus/pdfGeneration';

const engine = createTemplateEngine();

engine.createTemplate({
  id: 'invoice',
  name: 'Invoice Template',
  header: { content: 'INVOICE', displayPageNumber: true },
  footer: { content: 'Footer text', displayPageNumber: true },
  elements: [
    {
      id: 'title',
      type: 'text',
      content: 'Invoice #{{invoiceNumber}}',
      x: 50,
      y: 50,
      style: { fontSize: 24, fontWeight: 'bold' },
    },
  ],
  placeholders: {
    invoiceNumber: '0001',
  },
});

const pdfService = engine.renderTemplate(
  'invoice',
  { invoiceNumber: '1234' }
);
```

## Type Guards

```typescript
import {
  isPageSize,
  isOrientation,
  isCompressionLevel,
  isImageFormat,
  isAlignment,
  isBorderStyle,
} from '@manus/pdfGeneration';

if (isPageSize('A4')) {
  console.log('Valid page size');
}

if (isCompressionLevel('maximum')) {
  console.log('Valid compression level');
}
```

## Utility Functions

```typescript
import {
  generatePDFId,
  getPageDimensions,
  pointsToMM,
  mmToPoints,
  validateMargin,
  DEFAULT_MARGINS,
  DEFAULT_TEXT_STYLE,
} from '@manus/pdfGeneration';

// Generate unique IDs
const id = generatePDFId('DOC'); // DOC_a1b2c3d4e5f6g7h8

// Get page dimensions
const dims = getPageDimensions('A4', 'portrait');
// { width: 595.28, height: 841.89 }

// Unit conversion
const mm = pointsToMM(72); // 25.4 mm
const pts = mmToPoints(25.4); // 72 points

// Validate margins
if (validateMargin(DEFAULT_MARGINS)) {
  console.log('Valid margins');
}
```

## Configuration Options

### Page Sizes
- `A4` - 595.28 x 841.89 points
- `Letter` - 612 x 792 points
- `Legal` - 612 x 1008 points
- `Custom` - Custom dimensions

### Orientations
- `portrait` - Vertical
- `landscape` - Horizontal

### Compression Levels
- `none` - No compression
- `standard` - Standard compression
- `maximum` - Maximum compression

### Image Formats
- `jpeg`
- `png`
- `gif`
- `webp`
- `bmp`

## Error Handling

```typescript
import { isPDFGenerationError, getErrorMessage } from '@manus/pdfGeneration';

try {
  const service = createPDFService();
  // ... build PDF ...
  const result = await service.render();
} catch (error) {
  if (isPDFGenerationError(error)) {
    console.error(`PDF Error (${error.code}): ${error.message}`);
    console.error(`Page: ${error.pageNumber}`);
  } else {
    console.error(getErrorMessage(error));
  }
}
```

## Testing

Run tests with:
```bash
npm test -- tests/pdfGeneration.test.ts     # Core tests (93 tests)
npm test -- tests/pdfAdvanced.test.ts       # Advanced tests (90 tests)
npm test -- tests/pdf                       # All PDF tests (183 tests)
```

## Type Safety

All code uses strict TypeScript types with no `any` types. Type guards provided for:
- Page sizes
- Orientations
- Compression levels
- Image formats
- Alignments
- Border styles

## Performance Considerations

1. **Batch Processing**: Use `PDFBatchProcessor` for generating multiple PDFs
2. **Content Reuse**: Cache `PDFStyleManager` instances
3. **Layout Optimization**: Pre-calculate `PDFPageLayout` dimensions
4. **Validation**: Use `PDFValidationService` to catch errors early

## API Reference

### PDFGenerationService
- `addPage()` - Add new page
- `addText(content, x, y, style?)` - Add text
- `addImage(image)` - Add image
- `addTable(table)` - Add table
- `addLine(line)` - Add line
- `addRect(rect)` - Add rectangle
- `setHeader(config)` - Set header
- `setFooter(config)` - Set footer
- `setMetadata(metadata)` - Set metadata
- `setEncryption(encryption)` - Enable encryption
- `setSignature(signature)` - Set signature
- `setWatermark(watermark)` - Set watermark
- `render()` - Generate PDF

### PDFContentBuilder
- `addText(content, style?)` - Add text
- `addHeading(content, level?)` - Add heading
- `addParagraph(content, justified?)` - Add paragraph
- `addImage(image)` - Add image
- `addTable(table)` - Add table
- `addSpacer(height)` - Add spacing
- `addLineBreak()` - Add line break
- `addDivider(color?, thickness?)` - Add divider
- `addList(items, ordered?)` - Add list
- `addTable2D(data, options?)` - Add 2D table
- `getBlocks()` - Get all blocks
- `getContentHeight()` - Get total height
- `clearBlocks()` - Clear all blocks

### PDFStyleManager
- `defineStyle(name, style)` - Define style
- `getStyle(name)` - Get style
- `applyStyle(name, base?)` - Apply style
- `listStyles()` - List all styles
- `removeStyle(name)` - Remove style
- `clone()` - Clone manager
- `mergeWith(other)` - Merge managers

### PDFPageLayout
- `setColumns(columns)` - Set column count
- `setColumnGap(gap)` - Set gap
- `setMargins(margins)` - Set margins
- `getColumnPositions()` - Get column positions
- `getUsableArea()` - Get usable area
- `getPageSize()` - Get page size
- `getContentArea()` - Get content area

### PDFBatchProcessor
- `addTask(id, task)` - Add task
- `process()` - Process tasks
- `getResult(id)` - Get result
- `getAllResults()` - Get all results
- `clearQueue()` - Clear queue
- `getQueueSize()` - Get queue size
- `getProcessedCount()` - Get processed count

## License

Part of the Manus AI Platform
