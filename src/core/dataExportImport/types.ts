export type ExportFormat = 'csv' | 'json' | 'xml' | 'xlsx';

export type ImportFormat = 'csv' | 'json' | 'xml' | 'xlsx';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: ValueTransform;
  defaultValue?: unknown;
}

export interface ValueTransform {
  type: 'toString' | 'toNumber' | 'toBoolean' | 'toDate' | 'toUpperCase' | 'toLowerCase' | 'trim' | 'custom';
  customFn?: string;
}

export interface ExportOptions {
  format: ExportFormat;
  includeHeaders?: boolean;
  delimiter?: string;
  dateFormat?: string;
  nullValue?: string;
  prettyPrint?: boolean;
  sheetName?: string;
}

export interface ImportOptions {
  format: ImportFormat;
  delimiter?: string;
  dateFormat?: string;
  hasHeaders?: boolean;
  skipRows?: number;
  sheetName?: string;
  strictValidation?: boolean;
}

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  enum?: unknown[];
  transform?: ValueTransform;
}

export interface Schema {
  name: string;
  fields: SchemaField[];
  allowAdditionalFields?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: ValidationSeverity;
  value?: unknown;
  row?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export interface ExportProgress {
  totalRows: number;
  processedRows: number;
  percentage: number;
  currentChunk: number;
  totalChunks: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface ImportProgress {
  totalRows: number;
  processedRows: number;
  percentage: number;
  currentChunk: number;
  totalChunks: number;
  validatedRows: number;
  invalidRows: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface BatchConfig {
  chunkSize: number;
  parallelBatches?: boolean;
  maxParallelBatches?: number;
}

export interface ExportResult {
  exportId: string;
  format: ExportFormat;
  data: unknown;
  fileName?: string;
  rowCount: number;
  progress: ExportProgress;
  duration: number;
  errors: string[];
}

export interface ImportResult {
  importId: string;
  format: ImportFormat;
  data: unknown[];
  rowCount: number;
  progress: ImportProgress;
  validation: ValidationResult;
  duration: number;
  errors: string[];
}

export interface DataRecord {
  [key: string]: unknown;
}

export type ProgressCallback = (progress: ExportProgress | ImportProgress) => void;

export interface TransformContext {
  index: number;
  row: DataRecord;
  metadata?: Record<string, unknown>;
}

export interface DataTransformer {
  applyTransformations(
    data: DataRecord[],
    mappings: FieldMapping[],
    context?: TransformContext
  ): DataRecord[];
  applyReverseTransformations(
    data: DataRecord[],
    mappings: FieldMapping[]
  ): DataRecord[];
}

export interface ExportFormatter {
  format(data: DataRecord[], options: ExportOptions): string | Buffer;
  supportsStreaming?: boolean;
}

export interface ImportParser {
  parse(input: string | Buffer, options: ImportOptions): DataRecord[];
  validate(data: unknown, schema?: Schema): ValidationResult;
}

export type ExportEventType =
  | 'export.started'
  | 'export.progress'
  | 'export.completed'
  | 'export.failed'
  | 'chunk.exported';

export interface ExportEvent {
  type: ExportEventType;
  exportId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export type ImportEventType =
  | 'import.started'
  | 'import.progress'
  | 'import.completed'
  | 'import.failed'
  | 'row.validated'
  | 'chunk.processed';

export interface ImportEvent {
  type: ImportEventType;
  importId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export type DataEventHandler = (event: ExportEvent | ImportEvent) => void | Promise<void>;

export interface CsvOptions {
  delimiter?: string;
  includeHeaders?: boolean;
  nullValue?: string;
  dateFormat?: string;
}

export interface JsonOptions {
  prettyPrint?: boolean;
  indent?: number;
}

export interface XmlOptions {
  rootElement?: string;
  rowElement?: string;
  includeHeaders?: boolean;
  prettyPrint?: boolean;
}

export interface XlsxOptions {
  sheetName?: string;
  includeHeaders?: boolean;
}

export interface ExportConfig {
  data: DataRecord[];
  options: ExportOptions;
  schema?: Schema;
  mappings?: FieldMapping[];
  batchConfig?: BatchConfig;
  progressCallback?: ProgressCallback;
}

export interface ImportConfig {
  input: string | Buffer;
  options: ImportOptions;
  schema?: Schema;
  mappings?: FieldMapping[];
  batchConfig?: BatchConfig;
  progressCallback?: ProgressCallback;
}

export interface FieldTypeInfo {
  type: string;
  nullable: boolean;
  emptyAsNull: boolean;
}

export interface ParsedCell {
  value: unknown;
  raw: string;
  row: number;
  column: string;
}
