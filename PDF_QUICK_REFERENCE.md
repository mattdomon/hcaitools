# PDF Generation Module - Quick Reference

## Quick Start Examples

### Minimal PDF
```typescript
import { createPDFService } from '@manus/pdfGeneration';

const pdf = createPDFService();
pdf.addText('Hello World', 100, 100);
const result = await pdf.render();
```

### Content-First Approach
```typescript
import { createContentBuilder } from '@manus/pdfGeneration';

const content = createContentBuilder();
content
  .addHeading('My Report', 1)
  .addParagraph('Introduction text')
  .addList(['Point 1', 'Point 2', 'Point 3'])
  .addTable2D([['A', 'B'], ['1', '2']], { headers: true });
```

### Styled Text
```typescript
pdf.addText('Red Bold Text', 100, 100, {
  color: '#FF0000',
  fontWeight: 'bold',
  fontSize: 16,
});
```

### Multi-Page
```typescript
pdf.addText('Page 1', 100, 100);
pdf.addPage();
pdf.addText('Page 2', 100, 100);
```

### With Metadata
```typescript
pdf.setMetadata({
  title: 'My Document',
  author: 'John Doe',
  subject: 'Report',
  keywords: ['report', 'document'],
});
```

### Encrypted PDF
```typescript
pdf.setEncryption({
  enabled: true,
  algorithm: 'aes-256',
  userPassword: 'user123',
  permissions: { copy: false, modify: false },
});
```

### Digital Signature
```typescript
pdf.setSignature({
  reason: 'Document approval',
  location: 'New York',
  name: 'John Doe',
});
```

### Watermark
```typescript
pdf.setWatermark({
  text: 'CONFIDENTIAL',
  opacity: 0.3,
  rotation: 45,
});
```

### Custom Layout (2 Columns)
```typescript
import { createPageLayout } from '@manus/pdfGeneration';

const layout = createPageLayout({ columns: 2, columnGap: 20 });
const positions = layout.getColumnPositions();
```

### Batch Processing
```typescript
import { createBatchProcessor } from '@manus/pdfGeneration';

const processor = createBatchProcessor(5); // 5 concurrent
processor
  .addTask('doc1', async () => generatePDF1())
  .addTask('doc2', async () => generatePDF2())
  .addTask('doc3', async () => generatePDF3());

const results = await processor.process();
```

### HTML to PDF
```typescript
import { generatePDFFromHTML } from '@manus/pdfGeneration';

const result = await generatePDFFromHTML({
  html: '<body><p>Content</p></body>',
});
```

## API Cheat Sheet

### PDFGenerationService
| Method | Purpose |
|--------|---------|
| `addText(content, x, y, style?)` | Add text element |
| `addImage(image)` | Add image |
| `addTable(table)` | Add table |
| `addPage()` | Add new page |
| `setHeader(config)` | Set page header |
| `setFooter(config)` | Set page footer |
| `setMetadata(metadata)` | Set document metadata |
| `setEncryption(encryption)` | Enable encryption |
| `setSignature(signature)` | Add digital signature |
| `setWatermark(watermark)` | Add watermark |
| `render()` | Generate PDF (returns Promise) |

### PDFContentBuilder
| Method | Purpose |
|--------|---------|
| `addText(content, style?)` | Add text |
| `addHeading(content, level?)` | Add heading (1-6) |
| `addParagraph(content, justified?)` | Add paragraph |
| `addList(items, ordered?)` | Add list |
| `addTable2D(data, options?)` | Add 2D table |
| `addImage(image)` | Add image |
| `addSpacer(height)` | Add vertical space |
| `addLineBreak()` | Add line break |
| `addDivider(color?, thickness?)` | Add divider line |
| `getBlocks()` | Get all blocks |
| `getContentHeight()` | Get total height |
| `clearBlocks()` | Clear all content |

### PDFStyleManager
| Method | Purpose |
|--------|---------|
| `defineStyle(name, style)` | Define new style |
| `getStyle(name)` | Get style by name |
| `applyStyle(name, base?)` | Apply style (with merge) |
| `listStyles()` | List all style names |
| `removeStyle(name)` | Remove style |
| `clone()` | Clone manager |
| `mergeWith(other)` | Merge with another manager |

### PDFPageLayout
| Method | Purpose |
|--------|---------|
| `setColumns(count)` | Set column count |
| `setColumnGap(gap)` | Set gap between columns |
| `setMargins(margins)` | Set page margins |
| `getColumnPositions()` | Get column positions |
| `getUsableArea()` | Get usable area rect |
| `getPageSize()` | Get page dimensions |
| `getContentArea()` | Get content area dimensions |

### PDFBatchProcessor
| Method | Purpose |
|--------|---------|
| `addTask(id, task)` | Add processing task |
| `process()` | Process all tasks (returns Promise) |
| `getResult(id)` | Get result for task |
| `getAllResults()` | Get all results |
| `getQueueSize()` | Get pending task count |
| `getProcessedCount()` | Get completed task count |
| `clearQueue()` | Clear pending tasks |

## Type Definitions Quick Reference

```typescript
// Page configuration
type PageSize = 'A4' | 'Letter' | 'Legal' | 'Custom'
type Orientation = 'portrait' | 'landscape'
type CompressionLevel = 'none' | 'standard' | 'maximum'

// Colors & formatting
type Alignment = 'left' | 'center' | 'right' | 'justify'
type BorderStyle = 'none' | 'solid' | 'dashed' | 'dotted' | 'double'

// Content
type ImageFormat = 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp'

// Encryption
type EncryptionAlgorithm = 'aes-128' | 'aes-256' | 'rc4-128'
```

## Factory Functions

```typescript
// Core services
import {
  createPDFService,
  createTemplateEngine,
  createWatermarkService,
  createSecurityService,
  createTableRenderer,
} from '@manus/pdfGeneration';

// Advanced features
import {
  createContentBuilder,
  createStyleManager,
  createPageLayout,
  createBatchProcessor,
  createValidationService,
} from '@manus/pdfGeneration';
```

## Common Patterns

### Pattern 1: Business Document
```typescript
const service = createPDFService();
const builder = createContentBuilder();

builder
  .addHeading('Invoice #12345', 1)
  .addParagraph('Invoice Date: January 1, 2024')
  .addTable2D([/* invoice data */]);

// Render blocks to service...
const result = await service.render();
```

### Pattern 2: Report with Styling
```typescript
const styleManager = createStyleManager();
styleManager.defineStyle('reportTitle', {
  fontSize: 28,
  fontWeight: 'bold',
  color: '#003366',
});

const service = createPDFService();
service.addText('Q4 Report', 100, 100, 
  styleManager.getStyle('reportTitle'));
```

### Pattern 3: Bulk Generation
```typescript
const processor = createBatchProcessor(4);

invoices.forEach((invoice, i) => {
  processor.addTask(`invoice-${i}`, async () => {
    const service = createPDFService();
    // ... build invoice ...
    const result = await service.render();
    return result.document;
  });
});

const results = await processor.process();
results.forEach((result, id) => {
  console.log(`${id}: ${result.success ? 'OK' : 'FAILED'}`);
});
```

### Pattern 4: Secured Document
```typescript
const service = createPDFService();

service
  .setEncryption({
    enabled: true,
    algorithm: 'aes-256',
    userPassword: 'user123',
    ownerPassword: 'owner123',
  })
  .setSignature({
    reason: 'Approved',
    name: 'Authorized Signatory',
  })
  .setWatermark({
    text: 'APPROVED',
    opacity: 0.2,
  });

service.addText('Confidential Document', 100, 100);
const result = await service.render();
```

## Validation

```typescript
import { createValidationService } from '@manus/pdfGeneration';

const validator = createValidationService();

// Validate before adding
const validation = validator.validateTextElement({...});
if (validation.valid) {
  service.addText(...);
} else {
  console.error(validation.errors);
}
```

## Defaults

```typescript
DEFAULT_MARGINS: { top: 72, right: 72, bottom: 72, left: 72 }
DEFAULT_TEXT_STYLE: {
  fontFamily: 'Helvetica',
  fontSize: 12,
  fontWeight: 'normal',
  color: '#000000',
  alignment: 'left',
  lineHeight: 1.5,
}
```

## Performance Tips

1. **Reuse StyleManager** - Create once, use multiple times
2. **Batch similar tasks** - Use PDFBatchProcessor for multiple PDFs
3. **Validate early** - Check elements before adding
4. **Clear unused blocks** - Use `clearBlocks()` for memory
5. **Adjust concurrency** - Match to CPU cores for batch processing

## Common Issues

| Issue | Solution |
|-------|----------|
| Text overflow | Check x, y coordinates and page size |
| Blurry images | Ensure quality >= 90, use appropriate dimensions |
| Slow rendering | Use batch processor, check content size |
| Memory leak | Clear blocks when done, dispose processors |
| Encryption failed | Check password length and format |

## Testing

```bash
# Run all PDF tests
npm test -- tests/pdf

# Run specific suite
npm test -- tests/pdfGeneration.test.ts
npm test -- tests/pdfAdvanced.test.ts

# Type check
npm run typecheck

# Lint
npm run lint
```
