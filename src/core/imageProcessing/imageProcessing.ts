import {
  ImageFormat,
  ImageTransformation,
  ImageTransformationType,
  ImageProcessingOptions,
  ProcessedImage,
  CDNConfig,
  CDNUploadResult,
  ImageMetadata,
  ImageStats,
  OptimizationConfig,
  CacheConfig,
  ImageVariant,
  ImageVariantSet,
  ImageUploadOptions,
  HealthCheckResult,
  ImageProcessorEvents,
  PresetTransformation,
  CompressionResult,
  DEFAULT_IMAGE_QUALITY,
  DEFAULT_OPTIMIZATION_CONFIG,
  DEFAULT_CACHE_CONFIG,
  DEFAULT_CDN_CONFIG,
  isValidImageFormat,
  generateImageId,
  getMimeType,
  ResizeOptions,
  CropOptions,
  RotateOptions,
  FlipOptions,
  WatermarkOptions,
  ImageQualitySettings,
  OptimizationLevel,
} from './types';

export class ImageTransformationBuilder {
  private transformations: ImageTransformation[] = [];

  resize(options: ResizeOptions): this {
    this.transformations.push({ type: 'resize', options });
    return this;
  }

  crop(options: CropOptions): this {
    this.transformations.push({ type: 'crop', options });
    return this;
  }

  rotate(options: RotateOptions): this {
    this.transformations.push({ type: 'rotate', options });
    return this;
  }

  flip(options: FlipOptions): this {
    this.transformations.push({ type: 'flip', options });
    return this;
  }

  watermark(options: WatermarkOptions): this {
    this.transformations.push({ type: 'watermark', options });
    return this;
  }

  build(): ImageTransformation[] {
    return [...this.transformations];
  }

  reset(): void {
    this.transformations = [];
  }
}

export class ImageFormatConverter {
  private qualitySettings: ImageQualitySettings;

  constructor(qualitySettings: Partial<ImageQualitySettings> = {}) {
    this.qualitySettings = { ...DEFAULT_IMAGE_QUALITY, ...qualitySettings };
  }

  convert(imageData: Buffer, sourceFormat: ImageFormat, targetFormat: ImageFormat, quality?: number): Buffer {
    if (!isValidImageFormat(targetFormat)) {
      throw new Error(`Invalid target format: ${targetFormat}`);
    }

    const targetQuality = quality || this.getDefaultQuality(targetFormat);
    return this.performConversion(imageData, sourceFormat, targetFormat, targetQuality);
  }

  private performConversion(data: Buffer, _source: ImageFormat, target: ImageFormat, quality: number): Buffer {
    const base64 = data.toString('base64');
    const prefix = `data:${getMimeType(target)};base64,`;
    return Buffer.from(`${prefix}${base64.slice(0, Math.floor(base64.length * (quality / 100)))}`);
  }

  private getDefaultQuality(format: ImageFormat): number {
    switch (format) {
      case 'jpeg':
        return this.qualitySettings.jpegQuality;
      case 'png':
        return this.qualitySettings.pngCompressionLevel;
      case 'webp':
        return this.qualitySettings.webpQuality;
      case 'avif':
        return this.qualitySettings.avifQuality;
      case 'gif':
        return this.qualitySettings.gifColors;
      default:
        return 80;
    }
  }

  getQualitySettings(): ImageQualitySettings {
    return { ...this.qualitySettings };
  }

  setQualitySettings(settings: Partial<ImageQualitySettings>): void {
    this.qualitySettings = { ...this.qualitySettings, ...settings };
  }
}

export class ImageOptimizer {
  private config: OptimizationConfig;
  private qualitySettings: ImageQualitySettings;

  constructor(
    config: Partial<OptimizationConfig> = {},
    qualitySettings: Partial<ImageQualitySettings> = {}
  ) {
    this.config = { ...DEFAULT_OPTIMIZATION_CONFIG, ...config };
    this.qualitySettings = { ...DEFAULT_IMAGE_QUALITY, ...qualitySettings };
  }

  optimize(imageData: Buffer, format: ImageFormat, level?: OptimizationLevel): CompressionResult {
    const optimizationLevel = level || this.config.level;
    const targetQuality = this.getQualityForLevel(optimizationLevel, format);
    
    const compressedData = this.compress(imageData, format, targetQuality);
    
    return {
      originalSize: imageData.length,
      compressedSize: compressedData.length,
      savingsPercentage: ((imageData.length - compressedData.length) / imageData.length) * 100,
      compressionRatio: imageData.length / compressedData.length,
    };
  }

  private getQualityForLevel(level: OptimizationLevel, _format: ImageFormat): number {
    switch (level) {
      case 'low':
        return 60;
      case 'medium':
        return 80;
      case 'high':
        return 95;
      default:
        return 80;
    }
  }

  private compress(data: Buffer, _format: ImageFormat, quality: number): Buffer {
    const ratio = quality / 100;
    const targetSize = Math.floor(data.length * ratio);
    return data.slice(0, targetSize);
  }

  getConfig(): OptimizationConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export class ImageCache {
  private cache: Map<string, { data: ProcessedImage; expiresAt?: number }>;
  private config: CacheConfig;
  private stats: { hits: number; misses: number };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0 };
  }

  async get(key: string): Promise<ProcessedImage | null> {
    if (!this.config.enabled) {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  async set(key: string, image: ProcessedImage, ttlMs?: number): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
    this.cache.set(key, { data: image, expiresAt });
  }

  async invalidate(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  getStats(): { hits: number; misses: number; hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  size(): number {
    return this.cache.size;
  }
}

export class CDNClient {
  private config: CDNConfig;
  private cache: ImageCache;

  constructor(config: Partial<CDNConfig> = {}, cache?: ImageCache) {
    this.config = { ...DEFAULT_CDN_CONFIG, ...config };
    this.cache = cache || new ImageCache();
  }

  async upload(imageData: Buffer, options?: ImageUploadOptions): Promise<CDNUploadResult> {
    const publicId = options?.publicId || generateImageId('cdn');
    const folder = options?.folder || 'images';
    
    const url = `${this.config.baseUrl}/${folder}/${publicId}`;
    const cdnUrl = this.buildCdnUrl(url);

    return {
      url,
      cdnUrl,
      publicId,
      width: 0,
      height: 0,
      format: 'jpeg',
      size: imageData.length,
      uploadedAt: new Date(),
    };
  }

  async delete(_publicId: string): Promise<boolean> {
    return true;
  }

  async getUrl(publicId: string, transformations?: ImageTransformation[]): Promise<string> {
    let url = `${this.config.baseUrl}/${publicId}`;
    
    if (transformations && transformations.length > 0) {
      const transformString = this.buildTransformString(transformations);
      url += `?transform=${encodeURIComponent(transformString)}`;
    }

    return this.buildCdnUrl(url);
  }

  private buildCdnUrl(url: string): string {
    if (this.config.customDomain) {
      return url.replace(this.config.baseUrl, this.config.customDomain);
    }
    return url;
  }

  private buildTransformString(transformations: ImageTransformation[]): string {
    return transformations.map(t => `${t.type}`).join(',');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      healthy: true,
      cdnConnected: true,
      processingAvailable: true,
      latencyMs: 0,
      errors: [],
    };
  }

  getConfig(): CDNConfig {
    return { ...this.config };
  }
}

export class ImageVariantManager {
  private variants: Map<string, ImageVariantSet>;

  constructor() {
    this.variants = new Map();
  }

  createVariantSet(name: string, variants: ImageVariant[]): ImageVariantSet {
    const variantSet: ImageVariantSet = {
      id: generateImageId('vset'),
      name,
      variants,
      createdAt: new Date(),
    };
    this.variants.set(variantSet.id, variantSet);
    return variantSet;
  }

  getVariantSet(id: string): ImageVariantSet | undefined {
    return this.variants.get(id);
  }

  getAllVariantSets(): ImageVariantSet[] {
    return Array.from(this.variants.values());
  }

  addVariant(setId: string, variant: ImageVariant): boolean {
    const set = this.variants.get(setId);
    if (!set) return false;
    set.variants.push(variant);
    return true;
  }

  removeVariant(setId: string, variantId: string): boolean {
    const set = this.variants.get(setId);
    if (!set) return false;
    const index = set.variants.findIndex(v => v.id === variantId);
    if (index === -1) return false;
    set.variants.splice(index, 1);
    return true;
  }

  deleteVariantSet(id: string): boolean {
    return this.variants.delete(id);
  }
}

export class TransformationPresets {
  private presets: Map<string, PresetTransformation>;
  private defaultPresets: Set<string>;

  constructor() {
    this.presets = new Map();
    this.defaultPresets = new Set();
    this.initializeDefaultPresets();
  }

  private initializeDefaultPresets(): void {
    this.presets.set('thumbnail', {
      name: 'thumbnail',
      description: 'Small thumbnail image',
      transformations: [
        { type: 'resize', options: { width: 150, height: 150, fit: 'cover' } as ResizeOptions },
      ],
    });
    this.defaultPresets.add('thumbnail');

    this.presets.set('medium', {
      name: 'medium',
      description: 'Medium sized image',
      transformations: [
        { type: 'resize', options: { width: 640, height: 480, fit: 'inside' } as ResizeOptions },
      ],
    });
    this.defaultPresets.add('medium');

    this.presets.set('large', {
      name: 'large',
      description: 'Large image',
      transformations: [
        { type: 'resize', options: { width: 1920, height: 1080, fit: 'inside' } as ResizeOptions },
      ],
    });
    this.defaultPresets.add('large');

    this.presets.set('square', {
      name: 'square',
      description: 'Square cropped image',
      transformations: [
        { type: 'resize', options: { width: 500, height: 500, fit: 'cover' } as ResizeOptions },
      ],
    });
    this.defaultPresets.add('square');
  }

  createPreset(name: string, transformations: ImageTransformation[], description?: string): PresetTransformation {
    const preset: PresetTransformation = { name, transformations, description };
    this.presets.set(name, preset);
    return preset;
  }

  getPreset(name: string): PresetTransformation | undefined {
    return this.presets.get(name);
  }

  getAllPresets(): PresetTransformation[] {
    return Array.from(this.presets.values());
  }

  deletePreset(name: string): boolean {
    if (this.defaultPresets.has(name)) {
      return false;
    }
    return this.presets.delete(name);
  }

  applyPreset(name: string): ImageTransformation[] | undefined {
    const preset = this.presets.get(name);
    return preset ? [...preset.transformations] : undefined;
  }
}

export class ImageProcessor {
  private optimizer: ImageOptimizer;
  private converter: ImageFormatConverter;
  private cache: ImageCache;
  private cdn: CDNClient;
  private variantManager: ImageVariantManager;
  private presets: TransformationPresets;
  private events: ImageProcessorEvents;
  private stats: ImageStats;

  constructor(
    optimizationConfig?: Partial<OptimizationConfig>,
    cdnConfig?: Partial<CDNConfig>,
    events?: ImageProcessorEvents
  ) {
    this.optimizer = new ImageOptimizer(optimizationConfig);
    this.converter = new ImageFormatConverter();
    this.cache = new ImageCache();
    this.cdn = new CDNClient(cdnConfig, this.cache);
    this.variantManager = new ImageVariantManager();
    this.presets = new TransformationPresets();
    this.events = events || {};
    this.stats = this.createInitialStats();
  }

  private createInitialStats(): ImageStats {
    return {
      totalProcessed: 0,
      totalCached: 0,
      cacheHitRate: 0,
      totalSizeSaved: 0,
      averageProcessingTimeMs: 0,
      formatDistribution: {
        jpeg: 0,
        png: 0,
        webp: 0,
        avif: 0,
        gif: 0,
      },
    };
  }

  async process(
    imageData: Buffer,
    url: string,
    options: ImageProcessingOptions = {}
  ): Promise<ProcessedImage> {
    const imageId = generateImageId('img');
    
    if (this.events.onProcessingStart) {
      this.events.onProcessingStart(imageId);
    }

    try {
      const cacheKey = this.buildCacheKey(url, options);
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        if (this.events.onCacheHit) {
          this.events.onCacheHit(imageId);
        }
        return { ...cached, cacheHit: true };
      }

      const metadata = this.extractMetadata(imageData, options.format?.format || 'jpeg');
      const transformations = options.transformations || [];
      
      let processedData = imageData;
      let format = options.format?.format || 'jpeg';

      if (options.format) {
        processedData = this.converter.convert(
          processedData,
          metadata.format,
          options.format.format,
          options.format.quality
        );
        format = options.format.format;
      }

      if (options.optimization) {
        const result = this.optimizer.optimize(processedData, format, options.optimization.level);
        this.stats.totalSizeSaved += result.originalSize - result.compressedSize;
      }

      const processed: ProcessedImage = {
        id: imageId,
        originalUrl: url,
        width: metadata.width,
        height: metadata.height,
        format,
        size: processedData.length,
        originalSize: imageData.length,
        transformations,
        metadata,
        processedAt: new Date(),
        cacheHit: false,
      };

      if (options.cache?.enabled !== false) {
        await this.cache.set(cacheKey, processed);
      }

      this.updateStats(processed);
      
      if (this.events.onProcessingComplete) {
        this.events.onProcessingComplete(processed);
      }

      return processed;
    } catch (error) {
      if (this.events.onProcessingError && error instanceof Error) {
        this.events.onProcessingError(imageId, error);
      }
      throw error;
    }
  }

  private extractMetadata(imageData: Buffer, format: ImageFormat): ImageMetadata {
    return {
      format,
      width: 1920,
      height: 1080,
      size: imageData.length,
      hasAlpha: format === 'png' || format === 'webp' || format === 'avif',
      orientation: 1,
      density: 72,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };
  }

  private buildCacheKey(url: string, options: ImageProcessingOptions): string {
    const parts = [url];
    
    if (options.transformations) {
      parts.push(`t:${options.transformations.length}`);
    }
    
    if (options.format) {
      parts.push(`f:${options.format.format}`);
      if (options.format.quality) {
        parts.push(`q:${options.format.quality}`);
      }
    }
    
    if (options.optimization) {
      parts.push(`o:${options.optimization.level}`);
    }
    
    return parts.join('|');
  }

  private updateStats(image: ProcessedImage): void {
    this.stats.totalProcessed++;
    this.stats.formatDistribution[image.format]++;
    
    const cacheStats = this.cache.getStats();
    this.stats.totalCached = cacheStats.hits;
    this.stats.cacheHitRate = cacheStats.hitRate;
  }

  async uploadToCDN(imageData: Buffer, options?: ImageUploadOptions): Promise<CDNUploadResult> {
    const result = await this.cdn.upload(imageData, options);
    
    if (this.events.onUploadComplete) {
      this.events.onUploadComplete(result);
    }
    
    return result;
  }

  createTransformationBuilder(): ImageTransformationBuilder {
    return new ImageTransformationBuilder();
  }

  applyPreset(presetName: string): ImageTransformation[] | undefined {
    return this.presets.applyPreset(presetName);
  }

  getPreset(presetName: string): PresetTransformation | undefined {
    return this.presets.getPreset(presetName);
  }

  createPreset(name: string, transformations: ImageTransformation[], description?: string): PresetTransformation {
    return this.presets.createPreset(name, transformations, description);
  }

  getAllPresets(): PresetTransformation[] {
    return this.presets.getAllPresets();
  }

  getVariantManager(): ImageVariantManager {
    return this.variantManager;
  }

  getCache(): ImageCache {
    return this.cache;
  }

  getOptimizer(): ImageOptimizer {
    return this.optimizer;
  }

  getConverter(): ImageFormatConverter {
    return this.converter;
  }

  getCDN(): CDNClient {
    return this.cdn;
  }

  getStats(): ImageStats {
    return { ...this.stats };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return this.cdn.healthCheck();
  }

  setEvents(events: ImageProcessorEvents): void {
    this.events = events;
  }
}

export function createImageProcessor(
  optimizationConfig?: Partial<OptimizationConfig>,
  cdnConfig?: Partial<CDNConfig>,
  events?: ImageProcessorEvents
): ImageProcessor {
  return new ImageProcessor(optimizationConfig, cdnConfig, events);
}

export function createPreset(
  name: string,
  transformations: ImageTransformation[],
  description?: string
): PresetTransformation {
  return { name, transformations, description };
}

export function buildResizeTransformation(
  width?: number,
  height?: number,
  fit: ResizeOptions['fit'] = 'inside'
): ImageTransformation {
  return {
    type: 'resize',
    options: { width, height, fit } as ResizeOptions,
  };
}

export function buildCropTransformation(
  width: number,
  height: number,
  gravity: CropOptions['gravity'] = 'center'
): ImageTransformation {
  return {
    type: 'crop',
    options: { width, height, gravity } as CropOptions,
  };
}

export function buildRotateTransformation(
  angle: number,
  background?: string
): ImageTransformation {
  return {
    type: 'rotate',
    options: { angle, background } as RotateOptions,
  };
}

export function buildFlipTransformation(
  horizontal: boolean = false,
  vertical: boolean = false
): ImageTransformation {
  return {
    type: 'flip',
    options: { horizontal, vertical } as FlipOptions,
  };
}

export function buildWatermarkTransformation(
  text: string,
  position: WatermarkOptions['position'] = 'bottom-right',
  opacity: number = 0.5
): ImageTransformation {
  return {
    type: 'watermark',
    options: { text, position, opacity } as WatermarkOptions,
  };
}

export function validateTransformation(
  transformation: ImageTransformation
): { valid: boolean; error?: string } {
  if (!transformation.type) {
    return { valid: false, error: 'Transformation type is required' };
  }

  const validTypes: ImageTransformationType[] = ['resize', 'crop', 'rotate', 'flip', 'watermark'];
  if (!validTypes.includes(transformation.type)) {
    return { valid: false, error: `Invalid transformation type: ${transformation.type}` };
  }

  switch (transformation.type) {
    case 'resize':
      const resizeOpts = transformation.options as ResizeOptions;
      if (resizeOpts.width !== undefined && resizeOpts.width <= 0) {
        return { valid: false, error: 'Resize width must be positive' };
      }
      if (resizeOpts.height !== undefined && resizeOpts.height <= 0) {
        return { valid: false, error: 'Resize height must be positive' };
      }
      break;
    case 'crop':
      const cropOpts = transformation.options as CropOptions;
      if (cropOpts.width <= 0) {
        return { valid: false, error: 'Crop width must be positive' };
      }
      if (cropOpts.height <= 0) {
        return { valid: false, error: 'Crop height must be positive' };
      }
      break;
    case 'rotate':
      const rotateOpts = transformation.options as RotateOptions;
      if (typeof rotateOpts.angle !== 'number') {
        return { valid: false, error: 'Rotate angle must be a number' };
      }
      break;
    case 'watermark':
      const watermarkOpts = transformation.options as WatermarkOptions;
      if (!watermarkOpts.text) {
        return { valid: false, error: 'Watermark text is required' };
      }
      if (watermarkOpts.opacity !== undefined && (watermarkOpts.opacity < 0 || watermarkOpts.opacity > 1)) {
        return { valid: false, error: 'Watermark opacity must be between 0 and 1' };
      }
      break;
  }

  return { valid: true };
}

export function composeTransformations(
  ...transformationArrays: ImageTransformation[][]
): ImageTransformation[] {
  return transformationArrays.flat();
}

export function mergeTransformationOptions(
  base: ImageTransformation[],
  override: ImageTransformation[]
): ImageTransformation[] {
  const result = [...base];
  
  for (const trans of override) {
    const index = result.findIndex(t => t.type === trans.type);
    if (index >= 0) {
      result[index] = trans;
    } else {
      result.push(trans);
    }
  }
  
  return result;
}
