export type PageSize = 'A4' | 'Letter' | 'Legal' | 'Custom';

export type Orientation = 'portrait' | 'landscape';

export type CompressionLevel = 'none' | 'standard' | 'maximum';

export type ImageFormat = 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp';

export type Alignment = 'left' | 'center' | 'right' | 'justify';

export type BorderStyle = 'none' | 'solid' | 'dashed' | 'dotted' | 'double';

export interface CustomPageSize {
  width: number;
  height: number;
}

export interface PageDimensions {
  width: number;
  height: number;
}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface HeaderFooterConfig {
  content: string;
  height?: number;
  margin?: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  alignment?: Alignment;
  displayPageNumber?: boolean;
  startPageNumber?: number;
}

export interface HeaderConfig extends HeaderFooterConfig {}

export interface FooterConfig extends HeaderFooterConfig {}

export interface ImagePosition {
  x: number;
  y: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface PDFImage {
  id: string;
  src: string;
  position: ImagePosition;
  dimensions: ImageDimensions;
  format?: ImageFormat;
  quality?: number;
  opacity?: number;
}

export interface TableCell {
  content: string;
  colSpan?: number;
  rowSpan?: number;
  alignment?: Alignment;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  padding?: number;
  borderStyle?: BorderStyle;
  borderColor?: string;
}

export interface TableRow {
  cells: TableCell[];
  height?: number;
  backgroundColor?: string;
}

export interface TableColumn {
  width?: number;
  header?: string;
  alignment?: Alignment;
  backgroundColor?: string;
  textColor?: string;
  fontWeight?: 'normal' | 'bold';
}

export interface PDFTable {
  id: string;
  columns: TableColumn[];
  rows: TableRow[];
  x?: number;
  y?: number;
  width?: number;
  borderStyle?: BorderStyle;
  borderColor?: string;
  borderWidth?: number;
  alternateRowColors?: boolean;
  headerBackgroundColor?: string;
  headerTextColor?: string;
}

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  color?: string;
  textDecoration?: 'none' | 'underline' | 'line-through';
  alignment?: Alignment;
  lineHeight?: number;
  letterSpacing?: number;
  backgroundColor?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface PDFElementBase {
  id: string;
}

export interface TextElement extends PDFElementBase {
  type: 'text';
  content: string;
  x: number;
  y: number;
  width?: number;
  style?: TextStyle;
}

export interface LineElement extends PDFElementBase {
  type: 'line';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: string;
  width?: number;
  dashPattern?: number[];
}

export interface RectElement extends PDFElementBase {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: BorderStyle;
  opacity?: number;
}

export interface TableElement extends PDFElementBase {
  type: 'table';
  table: PDFTable;
}

export interface ImageElement extends PDFElementBase {
  type: 'image';
  image: PDFImage;
}

export type PDFElement = TextElement | LineElement | RectElement | TableElement | ImageElement;

export interface PDFPage {
  pageNumber: number;
  elements: PDFElement[];
  width: number;
  height: number;
  orientation: Orientation;
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  trapped?: boolean;
}

export interface PDFEncryption {
  enabled: boolean;
  algorithm?: 'aes-128' | 'aes-256' | 'rc4-128';
  userPassword?: string;
  ownerPassword?: string;
  permissions?: PDFPermissions;
}

export interface PDFPermissions {
  print: boolean;
  copy: boolean;
  modify: boolean;
  annotate: boolean;
  fillForms: boolean;
  extractContent: boolean;
  assemble: boolean;
  printToQuality: 'low' | 'high';
}

export interface PDFSignature {
  id: string;
  reason?: string;
  location?: string;
  contactInfo?: string;
  name?: string;
  reasonDate?: Date;
  visible?: boolean;
  signatureFieldName?: string;
}

export interface PDFWatermark {
  text?: string;
  imageSrc?: string;
  opacity?: number;
  rotation?: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  position?: 'center' | 'corner' | 'tiled';
  xOffset?: number;
  yOffset?: number;
}

export interface PDFTemplate {
  id: string;
  name: string;
  header?: HeaderConfig;
  footer?: FooterConfig;
  margin?: Margin;
  backgroundColor?: string;
  elements?: PDFElement[];
  placeholders?: Record<string, string>;
}

export interface HTMLContent {
  html: string;
  baseUrl?: string;
  mediaFiles?: Record<string, string>;
}

export interface PDFGenerationOptions {
  pageSize?: PageSize;
  orientation?: Orientation;
  customSize?: CustomPageSize;
  margins?: Margin;
  header?: HeaderConfig;
  footer?: FooterConfig;
  metadata?: PDFMetadata;
  encryption?: PDFEncryption;
  signature?: PDFSignature;
  watermark?: PDFWatermark;
  compression?: CompressionLevel;
  embedFonts?: boolean;
  autoPageBreak?: boolean;
  pageBreakMargin?: number;
  template?: string;
}

export interface PDFGenerationResult {
  id: string;
  document: Buffer;
  pageCount: number;
  fileSize: number;
  generationTimeMs: number;
  metadata?: PDFMetadata;
}

export interface PDFBuilder {
  addPage(): PDFBuilder;
  addText(content: string, x: number, y: number, options?: TextStyle): PDFBuilder;
  addImage(image: PDFImage): PDFBuilder;
  addTable(table: PDFTable): PDFBuilder;
  addLine(line: LineElement): PDFBuilder;
  addRect(rect: RectElement): PDFBuilder;
  setHeader(config: HeaderConfig): PDFBuilder;
  setFooter(config: FooterConfig): PDFBuilder;
  setMetadata(metadata: PDFMetadata): PDFBuilder;
  setEncryption(encryption: PDFEncryption): PDFBuilder;
  setSignature(signature: PDFSignature): PDFBuilder;
  setWatermark(watermark: PDFWatermark): PDFBuilder;
  render(): Promise<PDFGenerationResult>;
}

export interface PDFGenerationError extends Error {
  code: PDFErrorCode;
  pageNumber?: number;
  elementId?: string;
}

export type PDFErrorCode =
  | 'PDF_INVALID_PAGE_SIZE'
  | 'PDF_INVALID_MARGIN'
  | 'PDF_INVALID_IMAGE'
  | 'PDF_INVALID_TABLE'
  | 'PDF_INVALID_TEXT'
  | 'PDF_ENCRYPTION_FAILED'
  | 'PDF_SIGNATURE_FAILED'
  | 'PDF_WATERMARK_FAILED'
  | 'PDF_RENDER_FAILED'
  | 'PDF_TEMPLATE_FAILED'
  | 'PDF_HTML_PARSE_FAILED'
  | 'PDF_PERMISSION_DENIED'
  | 'PDF_BUFFER_OVERFLOW';

export const DEFAULT_PAGE_DIMENSIONS: Record<Exclude<PageSize, 'Custom'>, PageDimensions> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
};

export const DEFAULT_MARGINS: Margin = {
  top: 72,
  right: 72,
  bottom: 72,
  left: 72,
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Helvetica',
  fontSize: 12,
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#000000',
  textDecoration: 'none',
  alignment: 'left',
  lineHeight: 1.5,
  letterSpacing: 0,
};

export const DEFAULT_PERMISSIONS: PDFPermissions = {
  print: true,
  copy: true,
  modify: true,
  annotate: true,
  fillForms: true,
  extractContent: true,
  assemble: true,
  printToQuality: 'high',
};

export const SUPPORTED_IMAGE_FORMATS: ImageFormat[] = ['jpeg', 'png', 'gif', 'webp', 'bmp'];

export function isPageSize(value: unknown): value is PageSize {
  return typeof value === 'string' && ['A4', 'Letter', 'Legal', 'Custom'].includes(value as PageSize);
}

export function isOrientation(value: unknown): value is Orientation {
  return typeof value === 'string' && ['portrait', 'landscape'].includes(value as Orientation);
}

export function isCompressionLevel(value: unknown): value is CompressionLevel {
  return typeof value === 'string' && ['none', 'standard', 'maximum'].includes(value as CompressionLevel);
}

export function isImageFormat(value: unknown): value is ImageFormat {
  return typeof value === 'string' && SUPPORTED_IMAGE_FORMATS.includes(value as ImageFormat);
}

export function isAlignment(value: unknown): value is Alignment {
  return typeof value === 'string' && ['left', 'center', 'right', 'justify'].includes(value as Alignment);
}

export function isBorderStyle(value: unknown): value is BorderStyle {
  return typeof value === 'string' && ['none', 'solid', 'dashed', 'dotted', 'double'].includes(value as BorderStyle);
}

export function generatePDFId(prefix: string = 'PDF'): string {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return `${prefix}_${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function getPageDimensions(
  pageSize: PageSize,
  orientation: Orientation,
  customSize?: CustomPageSize
): PageDimensions {
  if (pageSize === 'Custom' && customSize) {
    return orientation === 'landscape'
      ? { width: customSize.height, height: customSize.width }
      : { width: customSize.width, height: customSize.height };
  }

  const dimensions = DEFAULT_PAGE_DIMENSIONS[pageSize as Exclude<PageSize, 'Custom'>];

  return orientation === 'landscape'
    ? { width: dimensions.height, height: dimensions.width }
    : dimensions;
}

export function pointsToMM(points: number): number {
  return points * 0.352778;
}

export function mmToPoints(mm: number): number {
  return mm * 2.83465;
}

export function validateMargin(margin: Margin): boolean {
  return (
    margin.top >= 0 &&
    margin.right >= 0 &&
    margin.bottom >= 0 &&
    margin.left >= 0 &&
    margin.top <= 300 &&
    margin.right <= 300 &&
    margin.bottom <= 300 &&
    margin.left <= 300
  );
}