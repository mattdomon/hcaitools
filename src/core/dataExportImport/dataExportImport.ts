import * as crypto from 'crypto';
import {
  ExportFormat,
  ImportFormat,
  ExportOptions,
  ImportOptions,
  Schema,
  SchemaField,
  ValidationError,
  ValidationResult,
  ExportProgress,
  ImportProgress,
  BatchConfig,
  ExportResult,
  ImportResult,
  DataRecord,
  ProgressCallback,
  FieldMapping,
  TransformContext,
  DataTransformer,
  ExportFormatter,
  ImportParser,
  ExportEvent,
  ImportEvent,
  DataEventHandler,
  ExportConfig,
  ImportConfig,
  FieldTypeInfo,
  CsvOptions,
  JsonOptions,
  XmlOptions,
  XlsxOptions,
  ValueTransform,
} from './types';

const generateId = (prefix: string): string => {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
};

export class CsvFormatter implements ExportFormatter {
  format(data: DataRecord[], options: ExportOptions): string {
    const csvOptions: CsvOptions = {
      delimiter: options.delimiter || ',',
      includeHeaders: options.includeHeaders !== false,
      nullValue: options.nullValue || '',
      dateFormat: options.dateFormat || 'ISO',
    };

    if (data.length === 0) {
      return csvOptions.includeHeaders ? '' : '';
    }

    const headers = Object.keys(data[0]);
    const rows: string[] = [];

    if (csvOptions.includeHeaders) {
      rows.push(this.escapeRow(headers, csvOptions.delimiter!));
    }

    for (const record of data) {
      const values = headers.map(header => this.formatValue(record[header], csvOptions));
      rows.push(this.escapeRow(values, csvOptions.delimiter!));
    }

    return rows.join('\n');
  }

  supportsStreaming = true;

  private escapeRow(values: string[], delimiter: string): string {
    return values.map(v => this.escapeValue(v, delimiter)).join(delimiter);
  }

  private escapeValue(value: string, delimiter: string): string {
    if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private formatValue(value: unknown, options: CsvOptions): string {
    if (value === null || value === undefined) {
      return options.nullValue || '';
    }
    if (value instanceof Date) {
      return options.dateFormat === 'ISO' ? value.toISOString() : value.toLocaleDateString();
    }
    return String(value);
  }
}

export class JsonFormatter implements ExportFormatter {
  format(data: DataRecord[], options: ExportOptions): string {
    const jsonOptions: JsonOptions = {
      prettyPrint: options.prettyPrint !== false,
      indent: 2,
    };

    if (jsonOptions.prettyPrint) {
      return JSON.stringify(data, null, jsonOptions.indent);
    }
    return JSON.stringify(data);
  }
}

export class XmlFormatter implements ExportFormatter {
  format(data: DataRecord[], options: ExportOptions): string {
    const xmlOptions: XmlOptions = {
      rootElement: (options as unknown as XmlOptions).rootElement || 'root',
      rowElement: (options as unknown as XmlOptions).rowElement || 'row',
      includeHeaders: options.includeHeaders !== false,
      prettyPrint: options.prettyPrint !== false,
    };

    if (data.length === 0) {
      return this.createXmlDocument([], xmlOptions);
    }

    return this.createXmlDocument(data, xmlOptions);
  }

  supportsStreaming = true;

  private createXmlDocument(data: DataRecord[], options: XmlOptions): string {
    const indent = options.prettyPrint ? '\n' : '';
    const tab = options.prettyPrint ? '  ' : '';
    
    const rowsXml = data.map(row => {
      const fields = Object.entries(row)
        .map(([key, value]) => {
          const formattedValue = this.escapeXml(this.formatValue(value));
          return `${tab}<${key}>${formattedValue}</${key}>`;
        })
        .join(indent);
      return `${tab}<${options.rowElement}>${indent}${fields}${indent}</${options.rowElement}>`;
    }).join(indent);

    const rootContent = rowsXml ? `${indent}${rowsXml}${indent}` : '';
    return `<${options.rootElement}>${rootContent}</${options.rootElement}>`;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }
}

export class XlsxFormatter implements ExportFormatter {
  format(data: DataRecord[], options: ExportOptions): Buffer {
    const xlsxOptions: XlsxOptions = {
      sheetName: options.sheetName || 'Sheet1',
      includeHeaders: options.includeHeaders !== false,
    };

    const result: Buffer[] = [];
    
    result.push(Buffer.from(this.generateSimpleXlsx(data, xlsxOptions)));
    
    return Buffer.concat(result);
  }

  private generateSimpleXlsx(data: DataRecord[], options: XlsxOptions): string {
    if (data.length === 0) {
      return this.createEmptyXlsx(options.sheetName!);
    }

    const headers = Object.keys(data[0]);
    const rows: string[][] = [];

    if (options.includeHeaders) {
      rows.push(headers);
    }

    for (const record of data) {
      const values = headers.map(header => this.formatValue(record[header]));
      rows.push(values);
    }

    return this.createSimpleXml(rows, options.sheetName!);
  }

  private createSimpleXml(rows: string[][], _sheetName: string): string {
    const rowsXml = rows.map(row => {
      const cells = row.map(cell => `<c t="inlineStr"><is><t>${this.escapeXml(cell)}</t></is></c>`).join('');
      return `<row r="${rows.indexOf(row) + 1}">${cells}</row>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;
  }

  private createEmptyXlsx(_sheetName: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData/>
</worksheet>`;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }
}

export class CsvParser implements ImportParser {
  parse(input: string | Buffer, options: ImportOptions): DataRecord[] {
    const content = typeof input === 'string' ? input : input.toString('utf-8');
    const delimiter = options.delimiter || ',';
    const hasHeaders = options.hasHeaders !== false;
    const skipRows = options.skipRows || 0;

    const lines = content.split(/\r?\n/).filter(line => line.trim());
    const dataLines = lines.slice(skipRows);

    if (dataLines.length === 0) {
      return [];
    }

    let headers: string[];
    let dataStartIndex: number;

    if (hasHeaders) {
      headers = this.parseRow(dataLines[0], delimiter);
      dataStartIndex = 1;
    } else {
      const firstRow = this.parseRow(dataLines[0], delimiter);
      headers = firstRow.map((_, idx) => `column${idx + 1}`);
      dataStartIndex = 0;
    }

    const records: DataRecord[] = [];
    for (let i = dataStartIndex; i < dataLines.length; i++) {
      const values = this.parseRow(dataLines[i], delimiter);
      const record: DataRecord = {};
      headers.forEach((header, idx) => {
        record[header] = values[idx] || null;
      });
      records.push(record);
    }

    return records;
  }

  validate(data: unknown, schema?: Schema): ValidationResult {
    return this.validateData(data as DataRecord[], schema);
  }

  private parseRow(row: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      const nextChar = row[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === delimiter) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }

    result.push(current.trim());
    return result;
  }

  private validateData(data: DataRecord[], schema?: Schema): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    let validRows = 0;
    let invalidRows = 0;

    if (!schema) {
      return {
        valid: true,
        errors: [],
        warnings: [],
        totalRows: data.length,
        validRows: data.length,
        invalidRows: 0,
      };
    }

    const schemaFieldMap = new Map(schema.fields.map(f => [f.name, f]));

    for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx];
      let rowValid = true;

      for (const field of schema.fields) {
        const value = row[field.name];

        if (field.required && (value === null || value === undefined || value === '')) {
          errors.push({
            field: field.name,
            message: `Required field is missing or empty`,
            severity: 'error',
            value,
            row: rowIdx + 1,
          });
          rowValid = false;
        }

        if (value !== null && value !== undefined && value !== '') {
          const typeInfo = this.inferType(value);
          if (typeInfo.type !== field.type) {
            errors.push({
              field: field.name,
              message: `Type mismatch: expected ${field.type}, got ${typeInfo.type}`,
              severity: 'error',
              value,
              row: rowIdx + 1,
            });
            rowValid = false;
          }

          if (field.minLength !== undefined && typeof value === 'string' && value.length < field.minLength) {
            errors.push({
              field: field.name,
              message: `Value length ${value.length} is less than minimum ${field.minLength}`,
              severity: 'error',
              value,
              row: rowIdx + 1,
            });
            rowValid = false;
          }

          if (field.maxLength !== undefined && typeof value === 'string' && value.length > field.maxLength) {
            errors.push({
              field: field.name,
              message: `Value length ${value.length} exceeds maximum ${field.maxLength}`,
              severity: 'error',
              value,
              row: rowIdx + 1,
            });
            rowValid = false;
          }

          if (field.min !== undefined && typeof value === 'number' && value < field.min) {
            errors.push({
              field: field.name,
              message: `Value ${value} is less than minimum ${field.min}`,
              severity: 'error',
              value,
              row: rowIdx + 1,
            });
            rowValid = false;
          }

          if (field.max !== undefined && typeof value === 'number' && value > field.max) {
            errors.push({
              field: field.name,
              message: `Value ${value} exceeds maximum ${field.max}`,
              severity: 'error',
              value,
              row: rowIdx + 1,
            });
            rowValid = false;
          }

          if (field.pattern !== undefined && typeof value === 'string') {
            const regex = new RegExp(field.pattern);
            if (!regex.test(value)) {
              errors.push({
                field: field.name,
                message: `Value does not match pattern ${field.pattern}`,
                severity: 'error',
                value,
                row: rowIdx + 1,
              });
              rowValid = false;
            }
          }

          if (field.enum && !field.enum.includes(value)) {
            errors.push({
              field: field.name,
              message: `Value must be one of: ${field.enum.join(', ')}`,
              severity: 'error',
              value,
              row: rowIdx + 1,
            });
            rowValid = false;
          }
        }
      }

      if (!schema.allowAdditionalFields) {
        for (const key of Object.keys(row)) {
          if (!schemaFieldMap.has(key)) {
            warnings.push({
              field: key,
              message: `Additional field not defined in schema`,
              severity: 'warning',
              value: row[key],
              row: rowIdx + 1,
            });
          }
        }
      }

      if (rowValid) {
        validRows++;
      } else {
        invalidRows++;
      }
    }

    return {
      valid: invalidRows === 0,
      errors,
      warnings,
      totalRows: data.length,
      validRows,
      invalidRows,
    };
  }

  private inferType(value: unknown): FieldTypeInfo {
    if (value === null || value === undefined) {
      return { type: 'null', nullable: true, emptyAsNull: false };
    }
    if (typeof value === 'boolean') {
      return { type: 'boolean', nullable: false, emptyAsNull: false };
    }
    if (typeof value === 'number') {
      return { type: 'number', nullable: false, emptyAsNull: false };
    }
    if (value instanceof Date) {
      return { type: 'date', nullable: false, emptyAsNull: false };
    }
    if (typeof value === 'string') {
      if (value === '') {
        return { type: 'string', nullable: false, emptyAsNull: true };
      }
      return { type: 'string', nullable: false, emptyAsNull: false };
    }
    if (Array.isArray(value)) {
      return { type: 'array', nullable: false, emptyAsNull: false };
    }
    if (typeof value === 'object') {
      return { type: 'object', nullable: false, emptyAsNull: false };
    }
    return { type: 'unknown', nullable: true, emptyAsNull: false };
  }
}

export class JsonParser implements ImportParser {
  parse(input: string | Buffer, _options: ImportOptions): DataRecord[] {
    const content = typeof input === 'string' ? input : input.toString('utf-8');
    
    try {
      const parsed = JSON.parse(content);
      
      if (Array.isArray(parsed)) {
        return parsed as DataRecord[];
      }
      
      if (typeof parsed === 'object' && parsed !== null) {
        const data = (parsed as Record<string, unknown>).data;
        if (Array.isArray(data)) {
          return data as DataRecord[];
        }
        return [parsed as DataRecord];
      }
      
      return [];
    } catch {
      throw new Error('Invalid JSON format');
    }
  }

  validate(data: unknown, schema?: Schema): ValidationResult {
    const csvParser = new CsvParser();
    return csvParser.validate(data, schema);
  }
}

export class XmlParser implements ImportParser {
  parse(input: string | Buffer, options: ImportOptions): DataRecord[] {
    const content = typeof input === 'string' ? input : input.toString('utf-8');
    
    const rows: DataRecord[] = [];
    const rowElement = (options as unknown as XmlOptions).rowElement || 'row';
    
    const rowRegex = new RegExp(`<${rowElement}[^>]*>(.*?)</${rowElement}>`, 'gs');
    const matches = content.matchAll(rowRegex);
    
    for (const match of matches) {
      const rowContent = match[1];
      const record: DataRecord = {};
      
      const fieldRegex = /<(\w+)>(.*?)<\/\1>/gs;
      const fieldMatches = rowContent.matchAll(fieldRegex);
      
      for (const fieldMatch of fieldMatches) {
        const fieldName = fieldMatch[1];
        let fieldValue = fieldMatch[2];
        
        fieldValue = this.unescapeXml(fieldValue);
        
        const numValue = Number(fieldValue);
        if (!isNaN(numValue) && fieldValue.trim() !== '') {
          record[fieldName] = numValue;
        } else if (fieldValue.toLowerCase() === 'true') {
          record[fieldName] = true;
        } else if (fieldValue.toLowerCase() === 'false') {
          record[fieldName] = false;
        } else {
          record[fieldName] = fieldValue;
        }
      }
      
      rows.push(record);
    }
    
    return rows;
  }

  validate(data: unknown, schema?: Schema): ValidationResult {
    const csvParser = new CsvParser();
    return csvParser.validate(data, schema);
  }

  private unescapeXml(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
}

export class XlsxParser implements ImportParser {
  parse(input: string | Buffer, _options: ImportOptions): DataRecord[] {
    const content = typeof input === 'string' ? input : input.toString('utf-8');
    
    const rows: DataRecord[] = [];
    
    const rowRegex = /<row r="(\d+)">(.*?)<\/row>/gs;
    const cellRegex = /<c r="([A-Z]+)(\d+)"[^>]*>(?:<v>(.*?)<\/v>|<is><t>(.*?)<\/t><\/is>)<\/c>/gs;
    const headerRegex = /<row r="1">(.*?)<\/row>/s;
    
    const headerMatch = content.match(headerRegex);
    if (!headerMatch) {
      return [];
    }
    
    const headerRowContent = headerMatch[1];
    const headers: string[] = [];
    const headerCellRegex = /<c r="([A-Z]+)\d+"[^>]*>(?:<v>(.*?)<\/v>|<is><t>(.*?)<\/t><\/is>)<\/c>/g;
    
    let headerMatchResult;
    while ((headerMatchResult = headerCellRegex.exec(headerRowContent)) !== null) {
      const col = headerMatchResult[1];
      const value = headerMatchResult[3] || headerMatchResult[2] || '';
      headers.push(value || col);
    }

    if (headers.length === 0) {
      for (let i = 0; i < 26; i++) {
        headers.push(String.fromCharCode(65 + i));
      }
    }

    let rowMatch;
    while ((rowMatch = rowRegex.exec(content)) !== null) {
      const rowNum = parseInt(rowMatch[1], 10);
      if (rowNum === 1) continue;

      const rowContent = rowMatch[2];
      const record: DataRecord = {};
      
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const col = cellMatch[1];
        const value = cellMatch[3] || cellMatch[4] || '';
        
        const colIndex = this.columnToIndex(col);
        if (colIndex < headers.length) {
          record[headers[colIndex]] = value;
        }
      }
      
      if (Object.keys(record).length > 0) {
        rows.push(record);
      }
    }

    return rows;
  }

  validate(data: unknown, schema?: Schema): ValidationResult {
    const csvParser = new CsvParser();
    return csvParser.validate(data, schema);
  }

  private columnToIndex(column: string): number {
    let index = 0;
    for (let i = 0; i < column.length; i++) {
      index = index * 26 + (column.charCodeAt(i) - 64);
    }
    return index - 1;
  }
}

export class DataTransformerImpl implements DataTransformer {
  applyTransformations(data: DataRecord[], mappings: FieldMapping[], context?: TransformContext): DataRecord[] {
    if (!mappings || mappings.length === 0) {
      return data;
    }

    return data.map((record, index) => {
      const transformed: DataRecord = {};
      const ctx: TransformContext = context || { index, row: record };

      for (const mapping of mappings) {
        const sourceValue = record[mapping.sourceField];
        const valueToUse = sourceValue !== undefined ? sourceValue : mapping.defaultValue;

        if (mapping.transform) {
          transformed[mapping.targetField] = this.applyTransform(valueToUse, mapping.transform, ctx);
        } else {
          transformed[mapping.targetField] = valueToUse;
        }
      }

      return transformed;
    });
  }

  applyReverseTransformations(data: DataRecord[], mappings: FieldMapping[]): DataRecord[] {
    if (!mappings || mappings.length === 0) {
      return data;
    }

    return data.map(record => {
      const transformed: DataRecord = {};

      for (const mapping of mappings) {
        const sourceValue = record[mapping.targetField];
        
        if (mapping.transform) {
          transformed[mapping.sourceField] = this.applyReverseTransform(sourceValue, mapping.transform);
        } else {
          transformed[mapping.sourceField] = sourceValue;
        }
      }

      return transformed;
    });
  }

  private applyTransform(value: unknown, transform: ValueTransform, context: TransformContext): unknown {
    switch (transform.type) {
      case 'toString':
        return String(value ?? '');
      case 'toNumber':
        return value === null || value === undefined ? null : Number(value);
      case 'toBoolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
        }
        return Boolean(value);
      case 'toDate':
        if (value instanceof Date) {
          return value;
        }
        return value ? new Date(String(value)) : null;
      case 'toUpperCase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'toLowerCase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'trim':
        return typeof value === 'string' ? value.trim() : value;
      case 'custom':
        if (transform.customFn) {
          try {
            const fn = new Function('value', 'context', `return (${transform.customFn})(value, context)`);
            return fn(value, context);
          } catch {
            return value;
          }
        }
        return value;
      default:
        return value;
    }
  }

  private applyReverseTransform(value: unknown, transform: ValueTransform): unknown {
    switch (transform.type) {
      case 'toString':
      case 'toUpperCase':
      case 'toLowerCase':
      case 'trim':
        return value;
      case 'toNumber':
        return typeof value === 'number' ? value : value !== null && value !== undefined ? Number(value) : null;
      case 'toBoolean':
        return Boolean(value);
      case 'toDate':
        return value instanceof Date ? value : value ? new Date(String(value)) : null;
      default:
        return value;
    }
  }
}

export class BatchProcessor {
  process<T, R>(
    items: T[],
    config: BatchConfig,
    processor: (chunk: T[], chunkIndex: number) => Promise<R[]>,
    progressCallback?: ProgressCallback
  ): Promise<R[]> {
    const chunkSize = config.chunkSize || 100;
    const totalChunks = Math.ceil(items.length / chunkSize);
    const results: R[] = [];
    let processedChunks = 0;

    const processNext = async (startIndex: number): Promise<void> => {
      const endIndex = Math.min(startIndex + chunkSize, items.length);
      const chunk = items.slice(startIndex, endIndex);
      const chunkResults = await processor(chunk, Math.floor(startIndex / chunkSize));
      results.push(...chunkResults);
      processedChunks++;

      if (progressCallback) {
        const progress = {
          totalRows: items.length,
          processedRows: endIndex,
          percentage: Math.round((processedChunks / totalChunks) * 100),
          currentChunk: processedChunks,
          totalChunks,
        };
        progressCallback(progress as ProgressCallback extends (p: infer P) => void ? P : never);
      }

      if (endIndex < items.length) {
        await processNext(endIndex);
      }
    };

    return processNext(0).then(() => results);
  }

  processParallel<T, R>(
    items: T[],
    config: BatchConfig,
    processor: (chunk: T[], chunkIndex: number) => Promise<R[]>,
    progressCallback?: ProgressCallback
  ): Promise<R[]> {
    const chunkSize = config.chunkSize || 100;
    const maxParallel = config.maxParallelBatches || 2;
    const totalChunks = Math.ceil(items.length / chunkSize);
    const results: R[] = [];
    let currentChunk = 0;

    const processChunk = async (): Promise<void> => {
      while (currentChunk < totalChunks) {
        const chunkIndex = currentChunk++;
        const startIndex = chunkIndex * chunkSize;
        const endIndex = Math.min(startIndex + chunkSize, items.length);
        const chunk = items.slice(startIndex, endIndex);
        
        const chunkResults = await processor(chunk, chunkIndex);
        results.push(...chunkResults);

        if (progressCallback) {
          progressCallback({
            totalRows: items.length,
            processedRows: endIndex,
            percentage: Math.round(((chunkIndex + 1) / totalChunks) * 100),
            currentChunk: chunkIndex + 1,
            totalChunks,
          } as ProgressCallback extends (p: infer P) => void ? P : never);
        }
      }
    };

    const workers = Array(Math.min(maxParallel, totalChunks))
      .fill(null)
      .map(() => processChunk());

    return Promise.all(workers).then(() => results);
  }
}

export class DataExporter {
  private formatters: Map<ExportFormat, ExportFormatter>;
  private transformer: DataTransformer;
  private eventHandlers: Map<string, Set<DataEventHandler>>;

  constructor() {
    this.formatters = new Map<ExportFormat, ExportFormatter>([
      ['csv', new CsvFormatter()],
      ['json', new JsonFormatter()],
      ['xml', new XmlFormatter()],
      ['xlsx', new XlsxFormatter()],
    ]);
    this.transformer = new DataTransformerImpl();
    this.eventHandlers = new Map();
  }

  async exportData(config: ExportConfig): Promise<ExportResult> {
    const startTime = Date.now();
    const exportId = generateId('exp');

    await this.emit({
      type: 'export.started',
      exportId,
      timestamp: new Date(),
      data: { format: config.options.format, rowCount: config.data.length },
    });

    const progress: ExportProgress = {
      totalRows: config.data.length,
      processedRows: 0,
      percentage: 0,
      currentChunk: 0,
      totalChunks: 0,
      status: 'processing',
    };

    try {
      let processedData = config.data;

      if (config.mappings && config.mappings.length > 0) {
        processedData = this.transformer.applyTransformations(processedData, config.mappings);
      }

      const formatter = this.formatters.get(config.options.format);
      if (!formatter) {
        throw new Error(`Unsupported export format: ${config.options.format}`);
      }

      const batchConfig: BatchConfig = config.batchConfig || { chunkSize: 1000 };
      const chunks = this.chunkData(processedData, batchConfig.chunkSize);
      progress.totalChunks = chunks.length;

      const formattedChunks: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const formatted = formatter.format(chunk, config.options);
        formattedChunks.push(typeof formatted === 'string' ? formatted : formatted.toString());
        progress.processedRows += chunk.length;
        progress.currentChunk = i + 1;
        progress.percentage = Math.round((progress.processedRows / progress.totalRows) * 100);

        if (config.progressCallback) {
          config.progressCallback(progress);
        }

        await this.emit({
          type: 'chunk.exported',
          exportId,
          timestamp: new Date(),
          data: { chunkIndex: i, rowCount: chunk.length },
        });
      }

      const finalData = formattedChunks.join('\n');

      progress.status = 'completed';
      progress.percentage = 100;
      progress.processedRows = progress.totalRows;

      await this.emit({
        type: 'export.completed',
        exportId,
        timestamp: new Date(),
        data: { rowCount: progress.totalRows },
      });

      return {
        exportId,
        format: config.options.format,
        data: finalData,
        rowCount: progress.totalRows,
        progress,
        duration: Date.now() - startTime,
        errors: [],
      };
    } catch (error) {
      progress.status = 'failed';
      progress.error = error instanceof Error ? error.message : String(error);

      await this.emit({
        type: 'export.failed',
        exportId,
        timestamp: new Date(),
        data: { error: progress.error },
      });

      return {
        exportId,
        format: config.options.format,
        data: '',
        rowCount: 0,
        progress,
        duration: Date.now() - startTime,
        errors: [progress.error || 'Unknown error'],
      };
    }
  }

  private chunkData(data: DataRecord[], chunkSize: number): DataRecord[][] {
    const chunks: DataRecord[][] = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    return chunks;
  }

  on(eventType: string, handler: DataEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: DataEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private async emit(event: ExportEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      await Promise.all(
        Array.from(handlers).map(handler => handler(event))
      );
    }
  }
}

export class DataImporter {
  private parsers: Map<ImportFormat, ImportParser>;
  private transformer: DataTransformer;
  private eventHandlers: Map<string, Set<DataEventHandler>>;

  constructor() {
    this.parsers = new Map<ImportFormat, ImportParser>([
      ['csv', new CsvParser()],
      ['json', new JsonParser()],
      ['xml', new XmlParser()],
      ['xlsx', new XlsxParser()],
    ]);
    this.transformer = new DataTransformerImpl();
    this.eventHandlers = new Map();
  }

  async importData(config: ImportConfig): Promise<ImportResult> {
    const startTime = Date.now();
    const importId = generateId('imp');

    await this.emit({
      type: 'import.started',
      importId,
      timestamp: new Date(),
      data: { format: config.options.format },
    });

    const progress: ImportProgress = {
      totalRows: 0,
      processedRows: 0,
      percentage: 0,
      currentChunk: 0,
      totalChunks: 0,
      validatedRows: 0,
      invalidRows: 0,
      status: 'processing',
    };

    try {
      const parser = this.parsers.get(config.options.format);
      if (!parser) {
        throw new Error(`Unsupported import format: ${config.options.format}`);
      }

      const rawData = parser.parse(config.input, config.options);
      progress.totalRows = rawData.length;

      const batchConfig: BatchConfig = config.batchConfig || { chunkSize: 1000 };
      const chunks = this.chunkData(rawData, batchConfig.chunkSize);
      progress.totalChunks = chunks.length;

      let validation: ValidationResult;
      if (config.schema) {
        validation = parser.validate(rawData, config.schema);
        progress.validatedRows = validation.validRows;
        progress.invalidRows = validation.invalidRows;
      } else {
        validation = {
          valid: true,
          errors: [],
          warnings: [],
          totalRows: rawData.length,
          validRows: rawData.length,
          invalidRows: 0,
        };
        progress.validatedRows = rawData.length;
      }

      let processedData = rawData;

      if (config.mappings && config.mappings.length > 0) {
        processedData = this.transformer.applyTransformations(processedData, config.mappings);
      }

      for (let i = 0; i < chunks.length; i++) {
        progress.currentChunk = i + 1;
        progress.processedRows = Math.min((i + 1) * batchConfig.chunkSize, rawData.length);
        progress.percentage = Math.round((progress.processedRows / progress.totalRows) * 100);

        if (config.progressCallback) {
          config.progressCallback(progress);
        }

        await this.emit({
          type: 'chunk.processed',
          importId,
          timestamp: new Date(),
          data: { chunkIndex: i, rowCount: chunks[i].length },
        });
      }

      progress.status = 'completed';
      progress.percentage = 100;
      progress.processedRows = progress.totalRows;

      await this.emit({
        type: 'import.completed',
        importId,
        timestamp: new Date(),
        data: { rowCount: progress.totalRows, validRows: progress.validatedRows },
      });

      return {
        importId,
        format: config.options.format,
        data: processedData,
        rowCount: progress.totalRows,
        progress,
        validation,
        duration: Date.now() - startTime,
        errors: validation.errors.map(e => e.message),
      };
    } catch (error) {
      progress.status = 'failed';
      progress.error = error instanceof Error ? error.message : String(error);

      await this.emit({
        type: 'import.failed',
        importId,
        timestamp: new Date(),
        data: { error: progress.error },
      });

      return {
        importId,
        format: config.options.format,
        data: [],
        rowCount: 0,
        progress,
        validation: {
          valid: false,
          errors: [{ field: '', message: progress.error!, severity: 'error' }],
          warnings: [],
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
        },
        duration: Date.now() - startTime,
        errors: [progress.error || 'Unknown error'],
      };
    }
  }

  private chunkData(data: DataRecord[], chunkSize: number): DataRecord[][] {
    const chunks: DataRecord[][] = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    return chunks;
  }

  on(eventType: string, handler: DataEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: DataEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private async emit(event: ImportEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      await Promise.all(
        Array.from(handlers).map(handler => handler(event))
      );
    }
  }
}

export class SchemaValidator {
  validate(data: DataRecord[], schema: Schema): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    let validRows = 0;
    let invalidRows = 0;

    const schemaFieldMap = new Map(schema.fields.map(f => [f.name, f]));

    for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx];
      let rowValid = true;

      for (const field of schema.fields) {
        const value = row[field.name];
        const fieldErrors = this.validateField(field, value, rowIdx);
        
        for (const error of fieldErrors) {
          if (error.severity === 'error') {
            errors.push(error);
            rowValid = false;
          } else {
            warnings.push(error);
          }
        }
      }

      if (!schema.allowAdditionalFields) {
        for (const key of Object.keys(row)) {
          if (!schemaFieldMap.has(key)) {
            warnings.push({
              field: key,
              message: `Additional field not defined in schema`,
              severity: 'warning',
              value: row[key],
              row: rowIdx + 1,
            });
          }
        }
      }

      if (rowValid) {
        validRows++;
      } else {
        invalidRows++;
      }
    }

    return {
      valid: invalidRows === 0,
      errors,
      warnings,
      totalRows: data.length,
      validRows,
      invalidRows,
    };
  }

  private validateField(field: SchemaField, value: unknown, rowIdx: number): ValidationError[] {
    const errors: ValidationError[] = [];

    if (field.required && (value === null || value === undefined || value === '')) {
      errors.push({
        field: field.name,
        message: `Required field is missing or empty`,
        severity: 'error',
        value,
        row: rowIdx + 1,
      });
      return errors;
    }

    if (value === null || value === undefined || value === '') {
      return errors;
    }

    if (field.type === 'string') {
      if (typeof value !== 'string') {
        errors.push({
          field: field.name,
          message: `Expected string type, got ${typeof value}`,
          severity: 'error',
          value,
          row: rowIdx + 1,
        });
        return errors;
      }

      if (field.minLength !== undefined && value.length < field.minLength) {
        errors.push({
          field: field.name,
          message: `Value length ${value.length} is less than minimum ${field.minLength}`,
          severity: 'error',
          value,
          row: rowIdx + 1,
        });
      }

      if (field.maxLength !== undefined && value.length > field.maxLength) {
        errors.push({
          field: field.name,
          message: `Value length ${value.length} exceeds maximum ${field.maxLength}`,
          severity: 'error',
          value,
          row: rowIdx + 1,
        });
      }

      if (field.pattern !== undefined) {
        const regex = new RegExp(field.pattern);
        if (!regex.test(value)) {
          errors.push({
            field: field.name,
            message: `Value does not match pattern ${field.pattern}`,
            severity: 'error',
            value,
            row: rowIdx + 1,
          });
        }
      }
    }

    if (field.type === 'number') {
      if (typeof value !== 'number') {
        errors.push({
          field: field.name,
          message: `Expected number type, got ${typeof value}`,
          severity: 'error',
          value,
          row: rowIdx + 1,
        });
        return errors;
      }

      if (field.min !== undefined && value < field.min) {
        errors.push({
          field: field.name,
          message: `Value ${value} is less than minimum ${field.min}`,
          severity: 'error',
          value,
          row: rowIdx + 1,
        });
      }

      if (field.max !== undefined && value > field.max) {
        errors.push({
          field: field.name,
          message: `Value ${value} exceeds maximum ${field.max}`,
          severity: 'error',
          value,
          row: rowIdx + 1,
        });
      }
    }

    if (field.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push({
          field: field.name,
          message: `Expected boolean type, got ${typeof value}`,
          severity: 'error',
          value,
          row: rowIdx + 1,
        });
      }
    }

    if (field.type === 'date') {
      if (!(value instanceof Date) && isNaN(Date.parse(String(value)))) {
        errors.push({
          field: field.name,
          message: `Invalid date format`,
          severity: 'error',
          value,
          row: rowIdx + 1,
        });
      }
    }

    if (field.enum && !field.enum.includes(value)) {
      errors.push({
        field: field.name,
        message: `Value must be one of: ${field.enum.join(', ')}`,
        severity: 'error',
        value,
        row: rowIdx + 1,
      });
    }

    return errors;
  }
}

export { generateId };
