export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif';

export type ImageTransformationType = 'resize' | 'crop' | 'rotate' | 'flip' | 'watermark';

export type OptimizationLevel = 'low' | 'medium' | 'high';

export type CacheStrategy = 'immutable' | 'stale_while_revalidate';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ResizeOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  kernel?: 'lanczos' | 'cubic' | 'linear' | 'nearest';
}

export interface CropOptions {
  width: number;
  height: number;
  x?: number;
  y?: number;
  gravity?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface RotateOptions {
  angle: number;
  background?: string;
}

export interface FlipOptions {
  horizontal: boolean;
  vertical: boolean;
}

export interface WatermarkOptions {
  text: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile';
  opacity?: number;
  fontSize?: number;
  fontColor?: string;
  angle?: number;
}

export interface ImageTransformation {
  type: ImageTransformationType;
  options?: ResizeOptions | CropOptions | RotateOptions | FlipOptions | WatermarkOptions;
}

export interface ImageFormatOptions {
  format: ImageFormat;
  quality?: number;
  progressive?: boolean;
  compressionLevel?: number;
}

export interface ImageMetadata {
  format: ImageFormat;
  width: number;
  height: number;
  size: number;
  colorSpace?: string;
  hasAlpha?: boolean;
  orientation?: number;
  density?: number;
  createdAt: Date;
  modifiedAt?: Date;
}

export interface CDNConfig {
  baseUrl: string;
  provider: CDNProvider;
  apiKey?: string;
  region?: string;
  customDomain?: string;
  secure?: boolean;
  signedUrls?: boolean;
  urlExpiration?: number;
}

export type CDNProvider = 'cloudflare' | 'cloudfront' | 'imgix' | 'unsplash' | 'custom';

export interface CDNUploadResult {
  url: string;
  cdnUrl: string;
  publicId?: string;
  width: number;
  height: number;
  format: ImageFormat;
  size: number;
  etag?: string;
  cacheControl?: string;
  uploadedAt: Date;
}

export interface ImageProcessingOptions {
  transformations?: ImageTransformation[];
  format?: ImageFormatOptions;
  optimization?: OptimizationConfig;
  cache?: CacheConfig;
  metadata?: boolean;
}

export interface OptimizationConfig {
  level: OptimizationLevel;
  keepMetadata?: boolean;
  stripProfileData?: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

export interface CacheConfig {
  enabled: boolean;
  strategy: CacheStrategy;
  maxAge?: number;
  staleWhileRevalidate?: number;
  varyCacheOn?: string[];
}

export interface ProcessedImage {
  id: string;
  originalUrl: string;
  processedUrl?: string;
  cdnUrl?: string;
  width: number;
  height: number;
  format: ImageFormat;
  size: number;
  originalSize: number;
  transformations: ImageTransformation[];
  metadata: ImageMetadata;
  processedAt: Date;
  cacheHit?: boolean;
}

export interface ImageGenerationOptions {
  prompt: string;
  width?: number;
  height?: number;
  style?: string;
  negativePrompt?: string;
  numImages?: number;
}

export interface ImageEditOptions {
  imageUrl: string;
  maskUrl?: string;
  prompt: string;
  strength?: number;
}

export interface GeneratedImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  prompt: string;
  model?: string;
  createdAt: Date;
}

export interface ImageStats {
  totalProcessed: number;
  totalCached: number;
  cacheHitRate: number;
  totalSizeSaved: number;
  averageProcessingTimeMs: number;
  formatDistribution: Record<ImageFormat, number>;
}

export interface ImageProcessorEvents {
  onProcessingStart?: (imageId: string) => void;
  onProcessingComplete?: (image: ProcessedImage) => void;
  onProcessingError?: (imageId: string, error: Error) => void;
  onCacheHit?: (imageId: string) => void;
  onUploadComplete?: (result: CDNUploadResult) => void;
}

export interface TransformationChain {
  id: string;
  transformations: ImageTransformation[];
  createdAt: Date;
  expiresAt?: Date;
}

export interface PresetTransformation {
  name: string;
  description?: string;
  transformations: ImageTransformation[];
}

export interface ImageWatermarkData {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  opacity: number;
  position: WatermarkOptions['position'];
  rotation?: number;
  margin?: number;
}

export interface ImageFilterOptions {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  sharpen?: number;
  grayscale?: boolean;
  sepia?: boolean;
  invert?: boolean;
}

export interface ImageQualitySettings {
  jpegQuality: number;
  pngCompressionLevel: number;
  webpQuality: number;
  avifQuality: number;
  gifColors: number;
  mozjpeg: boolean;
  optimizeScans: boolean;
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  savingsPercentage: number;
  compressionRatio: number;
}

export interface ImageVariant {
  id: string;
  name: string;
  transformations: ImageTransformation[];
  format: ImageFormat;
  quality: number;
  width?: number;
  height?: number;
}

export interface ImageVariantSet {
  id: string;
  name: string;
  variants: ImageVariant[];
  createdAt: Date;
}

export interface ImageUploadOptions {
  folder?: string;
  publicId?: string;
  overwrite?: boolean;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  accessMode?: 'public' | 'authenticated';
  metadata?: Record<string, unknown>;
}

export interface ImageSearchOptions {
  query: string;
  page?: number;
  perPage?: number;
  sortBy?: 'relevance' | 'created_at' | 'size' | 'width' | 'height';
  sortOrder?: 'asc' | 'desc';
  format?: ImageFormat;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

export interface SearchResult {
  images: ProcessedImage[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface ImageError extends Error {
  code: ImageErrorCode;
  imageId?: string;
  originalError?: Error;
}

export type ImageErrorCode =
  | 'IMAGE_NOT_FOUND'
  | 'INVALID_FORMAT'
  | 'INVALID_TRANSFORMATION'
  | 'PROCESSING_FAILED'
  | 'UPLOAD_FAILED'
  | 'CDN_ERROR'
  | 'CACHE_ERROR'
  | 'INVALID_CONFIG'
  | 'QUOTA_EXCEEDED'
  | 'GENERATION_FAILED';

export interface HealthCheckResult {
  healthy: boolean;
  cdnConnected: boolean;
  processingAvailable: boolean;
  latencyMs: number;
  errors: string[];
}

export const DEFAULT_IMAGE_QUALITY: ImageQualitySettings = {
  jpegQuality: 80,
  pngCompressionLevel: 6,
  webpQuality: 80,
  avifQuality: 70,
  gifColors: 256,
  mozjpeg: true,
  optimizeScans: true,
};

export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  level: 'medium',
  keepMetadata: false,
  stripProfileData: true,
  maxWidth: 4096,
  maxHeight: 4096,
};

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  strategy: 'stale_while_revalidate',
  maxAge: 31536000,
  staleWhileRevalidate: 86400,
  varyCacheOn: ['width', 'format', 'quality'],
};

export const DEFAULT_CDN_CONFIG: CDNConfig = {
  baseUrl: 'https://cdn.example.com',
  provider: 'custom',
  secure: true,
  signedUrls: false,
  urlExpiration: 3600,
};

export const SUPPORTED_FORMATS: ImageFormat[] = ['jpeg', 'png', 'webp', 'avif', 'gif'];

export const FORMAT_MIME_TYPES: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
};

export const FORMAT_EXTENSIONS: Record<ImageFormat, string> = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
  avif: '.avif',
  gif: '.gif',
};

export const OPTIMIZATION_LEVEL_QUALITY: Record<OptimizationLevel, number> = {
  low: 60,
  medium: 80,
  high: 95,
};

export function isValidImageFormat(format: string): format is ImageFormat {
  return SUPPORTED_FORMATS.includes(format as ImageFormat);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function generateImageId(prefix: string = 'img'): string {
  const array = new Uint8Array(8);
  globalThis.crypto.getRandomValues(array);
  const hex = Array.from(array).map((b: number) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

export function getImageExtension(format: ImageFormat): string {
  return FORMAT_EXTENSIONS[format];
}

export function getMimeType(format: ImageFormat): string {
  return FORMAT_MIME_TYPES[format];
}
