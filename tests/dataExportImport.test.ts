import {
  DataExporter,
  DataImporter,
  DataTransformerImpl,
  BatchProcessor,
  SchemaValidator,
  CsvFormatter,
  JsonFormatter,
  XmlFormatter,
  XlsxFormatter,
  CsvParser,
  JsonParser,
  XmlParser,
  XlsxParser,
  generateId,
  ExportOptions,
  ImportOptions,
  Schema,
  SchemaField,
  FieldMapping,
  DataRecord,
  ExportResult,
  ImportResult,
  ValidationResult,
  ExportProgress,
  ImportProgress,
  BatchConfig,
  ExportConfig,
  ImportConfig,
} from '../src/core/dataExportImport';

describe('DataExportImport', () => {
  describe('generateId', () => {
    it('should generate ID with correct prefix', () => {
      const id = generateId('exp');
      expect(id.startsWith('exp_')).toBe(true);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId('imp');
      const id2 = generateId('imp');
      expect(id1).not.toBe(id2);
    });

    it('should generate ID with hex string after prefix', () => {
      const id = generateId('test');
      const parts = id.split('_');
      expect(parts.length).toBe(2);
      expect(parts[1]).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe('CsvFormatter', () => {
    let formatter: CsvFormatter;

    beforeEach(() => {
      formatter = new CsvFormatter();
    });

    it('should format data as CSV string', () => {
      const data: DataRecord[] = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ];
      const options: ExportOptions = { format: 'csv' };
      const result = formatter.format(data, options);
      expect(typeof result).toBe('string');
      expect(result).toContain('name');
      expect(result).toContain('John');
      expect(result).toContain('Jane');
    });

    it('should include headers by default', () => {
      const data: DataRecord[] = [{ name: 'John' }];
      const options: ExportOptions = { format: 'csv' };
      const result = formatter.format(data, options);
      expect(result.split('\n')[0]).toBe('name');
    });

    it('should format empty array', () => {
      const data: DataRecord[] = [];
      const options: ExportOptions = { format: 'csv' };
      const result = formatter.format(data, options);
      expect(result).toBe('');
    });

    it('should handle null values', () => {
      const data: DataRecord[] = [{ name: null }];
      const options: ExportOptions = { format: 'csv', nullValue: 'NULL' };
      const result = formatter.format(data, options);
      expect(result).toContain('NULL');
    });

    it('should handle custom delimiter', () => {
      const data: DataRecord[] = [{ name: 'John', age: 30 }];
      const options: ExportOptions = { format: 'csv', delimiter: ';' };
      const result = formatter.format(data, options);
      expect(result).toContain(';');
    });
  });

  describe('JsonFormatter', () => {
    let formatter: JsonFormatter;

    beforeEach(() => {
      formatter = new JsonFormatter();
    });

    it('should format data as JSON string', () => {
      const data: DataRecord[] = [{ name: 'John', age: 30 }];
      const options: ExportOptions = { format: 'json' };
      const result = formatter.format(data, options);
      expect(typeof result).toBe('string');
      expect(result).toContain('John');
    });

    it('should pretty print by default', () => {
      const data: DataRecord[] = [{ name: 'John' }];
      const options: ExportOptions = { format: 'json' };
      const result = formatter.format(data, options);
      expect(result).toContain('\n');
    });

    it('should not pretty print when disabled', () => {
      const data: DataRecord[] = [{ name: 'John' }];
      const options: ExportOptions = { format: 'json', prettyPrint: false };
      const result = formatter.format(data, options);
      expect(result).not.toContain('\n');
    });
  });

  describe('XmlFormatter', () => {
    let formatter: XmlFormatter;

    beforeEach(() => {
      formatter = new XmlFormatter();
    });

    it('should format data as XML string', () => {
      const data: DataRecord[] = [{ name: 'John', age: 30 }];
      const options: ExportOptions = { format: 'xml' };
      const result = formatter.format(data, options);
      expect(result).toContain('<root>');
      expect(result).toContain('<row>');
      expect(result).toContain('<name>John</name>');
    });

    it('should support streaming', () => {
      const formatter = new XmlFormatter();
      expect(formatter.supportsStreaming).toBe(true);
    });
  });

  describe('XlsxFormatter', () => {
    let formatter: XlsxFormatter;

    beforeEach(() => {
      formatter = new XlsxFormatter();
    });

    it('should format data as Buffer', () => {
      const data: DataRecord[] = [{ name: 'John', age: 30 }];
      const options: ExportOptions = { format: 'xlsx' };
      const result = formatter.format(data, options);
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('CsvParser', () => {
    let parser: CsvParser;

    beforeEach(() => {
      parser = new CsvParser();
    });

    it('should parse CSV string to data records', () => {
      const csv = 'name,age\nJohn,30\nJane,25';
      const options: ImportOptions = { format: 'csv' };
      const result = parser.parse(csv, options);
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('John');
      expect(result[0].age).toBe('30');
    });

    it('should handle headers', () => {
      const csv = 'name,age\nJohn,30';
      const options: ImportOptions = { format: 'csv', hasHeaders: true };
      const result = parser.parse(csv, options);
      expect(Object.keys(result[0])).toContain('name');
    });

    it('should handle no headers', () => {
      const csv = 'John,30';
      const options: ImportOptions = { format: 'csv', hasHeaders: false };
      const result = parser.parse(csv, options);
      expect(Object.keys(result[0])[0]).toBe('column1');
    });

    it('should skip rows', () => {
      const csv = 'skip\nskip\nname,age\nJohn,30';
      const options: ImportOptions = { format: 'csv', skipRows: 2 };
      const result = parser.parse(csv, options);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('John');
    });

    it('should handle custom delimiter', () => {
      const csv = 'name;age;John;30';
      const options: ImportOptions = { format: 'csv', hasHeaders: false, delimiter: ';' };
      const result = parser.parse(csv, options);
      expect(result[0].column3).toBe('John');
    });
  });

  describe('JsonParser', () => {
    let parser: JsonParser;

    beforeEach(() => {
      parser = new JsonParser();
    });

    it('should parse JSON array string', () => {
      const json = '[{"name":"John","age":30}]';
      const options: ImportOptions = { format: 'json' };
      const result = parser.parse(json, options);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('John');
    });

    it('should parse JSON object with data property', () => {
      const json = '{"data":[{"name":"John"}]}';
      const options: ImportOptions = { format: 'json' };
      const result = parser.parse(json, options);
      expect(result[0].name).toBe('John');
    });

    it('should throw on invalid JSON', () => {
      const json = 'invalid json';
      const options: ImportOptions = { format: 'json' };
      expect(() => parser.parse(json, options)).toThrow('Invalid JSON format');
    });
  });

  describe('XmlParser', () => {
    let parser: XmlParser;

    beforeEach(() => {
      parser = new XmlParser();
    });

    it('should parse XML string to data records', () => {
      const xml = '<root><row><name>John</name><age>30</age></row></root>';
      const options: ImportOptions = { format: 'xml' };
      const result = parser.parse(xml, options);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('John');
    });

    it('should convert numeric values', () => {
      const xml = '<root><row><age>30</age></row></root>';
      const options: ImportOptions = { format: 'xml' };
      const result = parser.parse(xml, options);
      expect(result[0].age).toBe(30);
    });

    it('should convert boolean values', () => {
      const xml = '<root><row><active>true</active></row></root>';
      const options: ImportOptions = { format: 'xml' };
      const result = parser.parse(xml, options);
      expect(result[0].active).toBe(true);
    });
  });

  describe('XlsxParser', () => {
    let parser: XlsxParser;

    beforeEach(() => {
      parser = new XlsxParser();
    });

    it('should parse simple xlsx XML format', () => {
      const xlsx = `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <sheetData>
            <row r="1"><c r="A1"><is><t>Name</t></is></c></row>
            <row r="2"><c r="A2"><is><t>John</t></is></c></row>
          </sheetData>
        </worksheet>`;
      const options: ImportOptions = { format: 'xlsx' };
      const result = parser.parse(xlsx, options);
      expect(result.length).toBe(1);
    });
  });

  describe('DataTransformerImpl', () => {
    let transformer: DataTransformerImpl;

    beforeEach(() => {
      transformer = new DataTransformerImpl();
    });

    it('should apply field mappings', () => {
      const data: DataRecord[] = [{ firstName: 'John', lastName: 'Doe' }];
      const mappings: FieldMapping[] = [
        { sourceField: 'firstName', targetField: 'name' },
      ];
      const result = transformer.applyTransformations(data, mappings);
      expect(result[0].name).toBe('John');
    });

    it('should use default values when source is missing', () => {
      const data: DataRecord[] = [{ lastName: 'Doe' }];
      const mappings: FieldMapping[] = [
        { sourceField: 'firstName', targetField: 'name', defaultValue: 'Unknown' },
      ];
      const result = transformer.applyTransformations(data, mappings);
      expect(result[0].name).toBe('Unknown');
    });

    it('should apply value transformations', () => {
      const data: DataRecord[] = [{ name: 'JOHN' }];
      const mappings: FieldMapping[] = [
        { sourceField: 'name', targetField: 'lowerName', transform: { type: 'toLowerCase' } },
      ];
      const result = transformer.applyTransformations(data, mappings);
      expect(result[0].lowerName).toBe('john');
    });

    it('should return original data when no mappings', () => {
      const data: DataRecord[] = [{ name: 'John' }];
      const result = transformer.applyTransformations(data, []);
      expect(result).toEqual(data);
    });

    it('should apply reverse transformations', () => {
      const data: DataRecord[] = [{ name: 'John' }];
      const mappings: FieldMapping[] = [
        { sourceField: 'fullName', targetField: 'name' },
      ];
      const result = transformer.applyReverseTransformations(data, mappings);
      expect(result[0].fullName).toBe('John');
    });
  });

  describe('BatchProcessor', () => {
    let processor: BatchProcessor;

    beforeEach(() => {
      processor = new BatchProcessor();
    });

    it('should process items in batches', async () => {
      const items = [1, 2, 3, 4, 5];
      const config: BatchConfig = { chunkSize: 2 };
      const result = await processor.process(
        items,
        config,
        async (chunk) => chunk.map(x => x * 2)
      );
      expect(result).toEqual([2, 4, 6, 8, 10]);
    });

    it('should handle single batch', async () => {
      const items = [1, 2, 3];
      const config: BatchConfig = { chunkSize: 10 };
      const result = await processor.process(
        items,
        config,
        async (chunk) => chunk.map(x => x * 2)
      );
      expect(result).toEqual([2, 4, 6]);
    });

    it('should report progress', async () => {
      const items = [1, 2, 3, 4];
      const config: BatchConfig = { chunkSize: 2 };
      const progressCallback = jest.fn();
      await processor.process(
        items,
        config,
        async (chunk) => chunk,
        progressCallback
      );
      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe('SchemaValidator', () => {
    let validator: SchemaValidator;

    beforeEach(() => {
      validator = new SchemaValidator();
    });

    it('should validate valid data', () => {
      const data: DataRecord[] = [{ name: 'John', age: 30 }];
      const schema: Schema = {
        name: 'TestSchema',
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'age', type: 'number', required: true },
        ],
      };
      const result = validator.validate(data, schema);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect missing required fields', () => {
      const data: DataRecord[] = [{ name: 'John' }];
      const schema: Schema = {
        name: 'TestSchema',
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'age', type: 'number', required: true },
        ],
      };
      const result = validator.validate(data, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'age')).toBe(true);
    });

    it('should detect type mismatches', () => {
      const data: DataRecord[] = [{ name: 'John', age: 'not a number' }];
      const schema: Schema = {
        name: 'TestSchema',
        fields: [
          { name: 'age', type: 'number' },
        ],
      };
      const result = validator.validate(data, schema);
      expect(result.valid).toBe(false);
    });

    it('should validate string length', () => {
      const data: DataRecord[] = [{ name: 'Jo' }];
      const schema: Schema = {
        name: 'TestSchema',
        fields: [
          { name: 'name', type: 'string', minLength: 3 },
        ],
      };
      const result = validator.validate(data, schema);
      expect(result.valid).toBe(false);
    });

    it('should validate number range', () => {
      const data: DataRecord[] = [{ age: 150 }];
      const schema: Schema = {
        name: 'TestSchema',
        fields: [
          { name: 'age', type: 'number', min: 0, max: 120 },
        ],
      };
      const result = validator.validate(data, schema);
      expect(result.valid).toBe(false);
    });

    it('should validate enum values', () => {
      const data: DataRecord[] = [{ status: 'invalid' }];
      const schema: Schema = {
        name: 'TestSchema',
        fields: [
          { name: 'status', type: 'string', enum: ['active', 'inactive'] },
        ],
      };
      const result = validator.validate(data, schema);
      expect(result.valid).toBe(false);
    });

    it('should warn about additional fields', () => {
      const data: DataRecord[] = [{ name: 'John', extra: 'value' }];
      const schema: Schema = {
        name: 'TestSchema',
        allowAdditionalFields: false,
        fields: [
          { name: 'name', type: 'string' },
        ],
      };
      const result = validator.validate(data, schema);
      expect(result.warnings.some(w => w.field === 'extra')).toBe(true);
    });
  });

  describe('DataExporter', () => {
    let exporter: DataExporter;

    beforeEach(() => {
      exporter = new DataExporter();
    });

    it('should export data in CSV format', async () => {
      const config: ExportConfig = {
        data: [{ name: 'John', age: 30 }],
        options: { format: 'csv' },
      };
      const result = await exporter.exportData(config);
      expect(result.format).toBe('csv');
      expect(result.rowCount).toBe(1);
      expect(result.errors.length).toBe(0);
    });

    it('should export data in JSON format', async () => {
      const config: ExportConfig = {
        data: [{ name: 'John' }],
        options: { format: 'json' },
      };
      const result = await exporter.exportData(config);
      expect(result.format).toBe('json');
      expect(result.rowCount).toBe(1);
    });

    it('should export data in XML format', async () => {
      const config: ExportConfig = {
        data: [{ name: 'John' }],
        options: { format: 'xml' },
      };
      const result = await exporter.exportData(config);
      expect(result.format).toBe('xml');
    });

    it('should apply field mappings during export', async () => {
      const config: ExportConfig = {
        data: [{ firstName: 'John' }],
        options: { format: 'csv' },
        mappings: [{ sourceField: 'firstName', targetField: 'name' }],
      };
      const result = await exporter.exportData(config);
      expect(result.data).toContain('name');
    });

    it('should emit export events', async () => {
      const eventHandler = jest.fn();
      exporter.on('export.started', eventHandler);
      const config: ExportConfig = {
        data: [{ name: 'John' }],
        options: { format: 'csv' },
      };
      await exporter.exportData(config);
      expect(eventHandler).toHaveBeenCalled();
    });

    it('should report progress during export', async () => {
      const progressCallback = jest.fn();
      const config: ExportConfig = {
        data: Array(100).fill(null).map((_, i) => ({ id: i })),
        options: { format: 'csv' },
        batchConfig: { chunkSize: 10 },
        progressCallback,
      };
      await exporter.exportData(config);
      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe('DataImporter', () => {
    let importer: DataImporter;

    beforeEach(() => {
      importer = new DataImporter();
    });

    it('should import CSV data', async () => {
      const config: ImportConfig = {
        input: 'name,age\nJohn,30',
        options: { format: 'csv' },
      };
      const result = await importer.importData(config);
      expect(result.format).toBe('csv');
      expect(result.rowCount).toBe(1);
    });

    it('should import JSON data', async () => {
      const config: ImportConfig = {
        input: '[{"name":"John"}]',
        options: { format: 'json' },
      };
      const result = await importer.importData(config);
      expect(result.format).toBe('json');
      expect(result.rowCount).toBe(1);
    });

    it('should validate imported data against schema', async () => {
      const schema: Schema = {
        name: 'TestSchema',
        fields: [
          { name: 'name', type: 'string', required: true },
        ],
      };
      const config: ImportConfig = {
        input: '[{"name":"John"}]',
        options: { format: 'json' },
        schema,
      };
      const result = await importer.importData(config);
      expect(result.validation.valid).toBe(true);
    });

    it('should detect validation errors', async () => {
      const schema: Schema = {
        name: 'TestSchema',
        fields: [
          { name: 'age', type: 'number', required: true },
        ],
      };
      const config: ImportConfig = {
        input: '[{"name":"John"}]',
        options: { format: 'json' },
        schema,
      };
      const result = await importer.importData(config);
      expect(result.validation.valid).toBe(false);
    });

    it('should apply field mappings during import', async () => {
      const config: ImportConfig = {
        input: '[{"firstName":"John"}]',
        options: { format: 'json' },
        mappings: [{ sourceField: 'firstName', targetField: 'name' }],
      };
      const result = await importer.importData(config);
      expect((result.data[0] as DataRecord).name).toBe('John');
    });

    it('should emit import events', async () => {
      const eventHandler = jest.fn();
      importer.on('import.started', eventHandler);
      const config: ImportConfig = {
        input: '[{"name":"John"}]',
        options: { format: 'json' },
      };
      await importer.importData(config);
      expect(eventHandler).toHaveBeenCalled();
    });

    it('should handle unsupported format', async () => {
      const config: ImportConfig = {
        input: 'test',
        options: { format: 'unsupported' as any },
      };
      const result = await importer.importData(config);
      expect(result.progress.status).toBe('failed');
    });
  });

  describe('Integration', () => {
    it('should export and import CSV roundtrip', async () => {
      const exporter = new DataExporter();
      const importer = new DataImporter();
      
      const originalData: DataRecord[] = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ];

      const exportResult = await exporter.exportData({
        data: originalData,
        options: { format: 'csv' },
      });

      const importResult = await importer.importData({
        input: exportResult.data as string,
        options: { format: 'csv' },
      });

      expect(importResult.rowCount).toBe(2);
    });

    it('should export and import JSON roundtrip', async () => {
      const exporter = new DataExporter();
      const importer = new DataImporter();
      
      const originalData: DataRecord[] = [
        { name: 'John', age: 30 },
      ];

      const exportResult = await exporter.exportData({
        data: originalData,
        options: { format: 'json' },
      });

      const importResult = await importer.importData({
        input: exportResult.data as string,
        options: { format: 'json' },
      });

      expect((importResult.data[0] as DataRecord).name).toBe('John');
    });

    it('should handle large datasets with batching', async () => {
      const exporter = new DataExporter();
      
      const largeData: DataRecord[] = Array(1000).fill(null).map((_, i) => ({
        id: i,
        name: `User ${i}`,
      }));

      const result = await exporter.exportData({
        data: largeData,
        options: { format: 'csv' },
        batchConfig: { chunkSize: 100 },
      });

      expect(result.rowCount).toBe(1000);
      expect(result.progress.percentage).toBe(100);
    });
  });
});
