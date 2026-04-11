import {
  ImageProcessor,
  ImageTransformationBuilder,
  ImageFormatConverter,
  ImageOptimizer,
  ImageCache,
  CDNClient,
  ImageVariantManager,
  TransformationPresets,
  createImageProcessor,
  buildResizeTransformation,
  buildCropTransformation,
  buildRotateTransformation,
  buildFlipTransformation,
  buildWatermarkTransformation,
  validateTransformation,
  composeTransformations,
  mergeTransformationOptions,
  ImageFormat,
  ImageTransformation,
  ResizeOptions,
  CropOptions,
  RotateOptions,
  FlipOptions,
  WatermarkOptions,
  DEFAULT_IMAGE_QUALITY,
  DEFAULT_OPTIMIZATION_CONFIG,
  DEFAULT_CACHE_CONFIG,
  SUPPORTED_FORMATS,
  isValidImageFormat,
  isValidUrl,
  generateImageId,
  getImageExtension,
  getMimeType,
  ImageProcessingOptions,
  ImageVariant,
  PresetTransformation,
} from '../src/core/imageProcessing';

describe('Image Processing Module', () => {
  describe('Type Guards and Utilities', () => {
    it('should validate image formats correctly', () => {
      expect(isValidImageFormat('jpeg')).toBe(true);
      expect(isValidImageFormat('png')).toBe(true);
      expect(isValidImageFormat('webp')).toBe(true);
      expect(isValidImageFormat('avif')).toBe(true);
      expect(isValidImageFormat('gif')).toBe(true);
      expect(isValidImageFormat('bmp')).toBe(false);
      expect(isValidImageFormat('tiff')).toBe(false);
    });

    it('should validate URLs correctly', () => {
      expect(isValidUrl('https://example.com/image.jpg')).toBe(true);
      expect(isValidUrl('http://cdn.example.com/images/photo.png')).toBe(true);
      expect(isValidUrl('invalid-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });

    it('should generate unique image IDs', () => {
      const id1 = generateImageId('img');
      const id2 = generateImageId('img');
      expect(id1).toMatch(/^img_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^img_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate image IDs with different prefixes', () => {
      const imgId = generateImageId('img');
      const cdnId = generateImageId('cdn');
      expect(imgId.startsWith('img_')).toBe(true);
      expect(cdnId.startsWith('cdn_')).toBe(true);
    });

    it('should return correct MIME types', () => {
      expect(getMimeType('jpeg')).toBe('image/jpeg');
      expect(getMimeType('png')).toBe('image/png');
      expect(getMimeType('webp')).toBe('image/webp');
      expect(getMimeType('avif')).toBe('image/avif');
      expect(getMimeType('gif')).toBe('image/gif');
    });

    it('should return correct file extensions', () => {
      expect(getImageExtension('jpeg')).toBe('.jpg');
      expect(getImageExtension('png')).toBe('.png');
      expect(getImageExtension('webp')).toBe('.webp');
      expect(getImageExtension('avif')).toBe('.avif');
      expect(getImageExtension('gif')).toBe('.gif');
    });

    it('should list all supported formats', () => {
      expect(SUPPORTED_FORMATS).toEqual(['jpeg', 'png', 'webp', 'avif', 'gif']);
    });
  });

  describe('Default Configurations', () => {
    it('should have correct default image quality settings', () => {
      expect(DEFAULT_IMAGE_QUALITY.jpegQuality).toBe(80);
      expect(DEFAULT_IMAGE_QUALITY.pngCompressionLevel).toBe(6);
      expect(DEFAULT_IMAGE_QUALITY.webpQuality).toBe(80);
      expect(DEFAULT_IMAGE_QUALITY.avifQuality).toBe(70);
      expect(DEFAULT_IMAGE_QUALITY.gifColors).toBe(256);
    });

    it('should have correct default optimization config', () => {
      expect(DEFAULT_OPTIMIZATION_CONFIG.level).toBe('medium');
      expect(DEFAULT_OPTIMIZATION_CONFIG.keepMetadata).toBe(false);
      expect(DEFAULT_OPTIMIZATION_CONFIG.stripProfileData).toBe(true);
      expect(DEFAULT_OPTIMIZATION_CONFIG.maxWidth).toBe(4096);
      expect(DEFAULT_OPTIMIZATION_CONFIG.maxHeight).toBe(4096);
    });

    it('should have correct default cache config', () => {
      expect(DEFAULT_CACHE_CONFIG.enabled).toBe(true);
      expect(DEFAULT_CACHE_CONFIG.strategy).toBe('stale_while_revalidate');
      expect(DEFAULT_CACHE_CONFIG.maxAge).toBe(31536000);
      expect(DEFAULT_CACHE_CONFIG.staleWhileRevalidate).toBe(86400);
    });
  });

  describe('ImageTransformationBuilder', () => {
    it('should build resize transformation', () => {
      const builder = new ImageTransformationBuilder();
      const transformations = builder
        .resize({ width: 800, height: 600, fit: 'cover' })
        .build();

      expect(transformations).toHaveLength(1);
      expect(transformations[0].type).toBe('resize');
      expect((transformations[0].options as ResizeOptions).width).toBe(800);
      expect((transformations[0].options as ResizeOptions).height).toBe(600);
      expect((transformations[0].options as ResizeOptions).fit).toBe('cover');
    });

    it('should build crop transformation', () => {
      const builder = new ImageTransformationBuilder();
      const transformations = builder
        .crop({ width: 500, height: 500, gravity: 'center' })
        .build();

      expect(transformations).toHaveLength(1);
      expect(transformations[0].type).toBe('crop');
      expect((transformations[0].options as CropOptions).width).toBe(500);
      expect((transformations[0].options as CropOptions).gravity).toBe('center');
    });

    it('should build rotate transformation', () => {
      const builder = new ImageTransformationBuilder();
      const transformations = builder
        .rotate({ angle: 90, background: '#ffffff' })
        .build();

      expect(transformations).toHaveLength(1);
      expect(transformations[0].type).toBe('rotate');
      expect((transformations[0].options as RotateOptions).angle).toBe(90);
    });

    it('should build flip transformation', () => {
      const builder = new ImageTransformationBuilder();
      const transformations = builder
        .flip({ horizontal: true, vertical: false })
        .build();

      expect(transformations).toHaveLength(1);
      expect(transformations[0].type).toBe('flip');
      expect((transformations[0].options as FlipOptions).horizontal).toBe(true);
      expect((transformations[0].options as FlipOptions).vertical).toBe(false);
    });

    it('should build watermark transformation', () => {
      const builder = new ImageTransformationBuilder();
      const transformations = builder
        .watermark({ text: 'Copyright', position: 'bottom-right', opacity: 0.5 })
        .build();

      expect(transformations).toHaveLength(1);
      expect(transformations[0].type).toBe('watermark');
      expect((transformations[0].options as WatermarkOptions).text).toBe('Copyright');
      expect((transformations[0].options as WatermarkOptions).position).toBe('bottom-right');
    });

    it('should chain multiple transformations', () => {
      const builder = new ImageTransformationBuilder();
      const transformations = builder
        .resize({ width: 800 })
        .crop({ width: 500, height: 500 })
        .rotate({ angle: 45 })
        .build();

      expect(transformations).toHaveLength(3);
      expect(transformations[0].type).toBe('resize');
      expect(transformations[1].type).toBe('crop');
      expect(transformations[2].type).toBe('rotate');
    });

    it('should reset builder', () => {
      const builder = new ImageTransformationBuilder();
      builder.resize({ width: 800 });
      builder.reset();

      expect(builder.build()).toHaveLength(0);
    });
  });

  describe('Transformation Helper Functions', () => {
    it('should create resize transformation', () => {
      const transformation = buildResizeTransformation(800, 600, 'contain');
      expect(transformation.type).toBe('resize');
      expect((transformation.options as ResizeOptions).width).toBe(800);
      expect((transformation.options as ResizeOptions).height).toBe(600);
      expect((transformation.options as ResizeOptions).fit).toBe('contain');
    });

    it('should create crop transformation', () => {
      const transformation = buildCropTransformation(500, 500, 'center');
      expect(transformation.type).toBe('crop');
      expect((transformation.options as CropOptions).width).toBe(500);
      expect((transformation.options as CropOptions).gravity).toBe('center');
    });

    it('should create rotate transformation', () => {
      const transformation = buildRotateTransformation(180, '#000000');
      expect(transformation.type).toBe('rotate');
      expect((transformation.options as RotateOptions).angle).toBe(180);
    });

    it('should create flip transformation', () => {
      const transformation = buildFlipTransformation(true, true);
      expect(transformation.type).toBe('flip');
      expect((transformation.options as FlipOptions).horizontal).toBe(true);
      expect((transformation.options as FlipOptions).vertical).toBe(true);
    });

    it('should create watermark transformation', () => {
      const transformation = buildWatermarkTransformation('Copyright 2024', 'bottom-right', 0.8);
      expect(transformation.type).toBe('watermark');
      expect((transformation.options as WatermarkOptions).text).toBe('Copyright 2024');
      expect((transformation.options as WatermarkOptions).opacity).toBe(0.8);
    });
  });

  describe('validateTransformation', () => {
    it('should validate resize transformation', () => {
      const valid = validateTransformation({
        type: 'resize',
        options: { width: 800, height: 600 } as ResizeOptions,
      });
      expect(valid.valid).toBe(true);
    });

    it('should reject resize with zero width', () => {
      const result = validateTransformation({
        type: 'resize',
        options: { width: 0 } as ResizeOptions,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('width must be positive');
    });

    it('should reject resize with negative height', () => {
      const result = validateTransformation({
        type: 'resize',
        options: { height: -100 } as ResizeOptions,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('height must be positive');
    });

    it('should validate crop transformation', () => {
      const valid = validateTransformation({
        type: 'crop',
        options: { width: 500, height: 500 } as CropOptions,
      });
      expect(valid.valid).toBe(true);
    });

    it('should reject crop with invalid dimensions', () => {
      const result = validateTransformation({
        type: 'crop',
        options: { width: -1, height: 500 } as CropOptions,
      });
      expect(result.valid).toBe(false);
    });

    it('should validate watermark with valid opacity', () => {
      const valid = validateTransformation({
        type: 'watermark',
        options: { text: 'Test', opacity: 0.5 } as WatermarkOptions,
      });
      expect(valid.valid).toBe(true);
    });

    it('should reject watermark with opacity out of range', () => {
      const result = validateTransformation({
        type: 'watermark',
        options: { text: 'Test', opacity: 1.5 } as WatermarkOptions,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('opacity must be between 0 and 1');
    });

    it('should reject watermark without text', () => {
      const result = validateTransformation({
        type: 'watermark',
        options: { text: '' } as WatermarkOptions,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('text is required');
    });

    it('should reject invalid transformation type', () => {
      const result = validateTransformation({
        type: 'invalid' as ImageTransformation['type'],
        options: {},
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid transformation type');
    });

    it('should reject transformation without type', () => {
      const result = validateTransformation({
        type: '' as ImageTransformation['type'],
        options: {},
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('composeTransformations', () => {
    it('should compose multiple transformation arrays', () => {
      const arr1: ImageTransformation[] = [{ type: 'resize', options: { width: 100 } as ResizeOptions }];
      const arr2: ImageTransformation[] = [{ type: 'rotate', options: { angle: 90 } as RotateOptions }];
      const arr3: ImageTransformation[] = [{ type: 'flip', options: { horizontal: true } as FlipOptions }];

      const composed = composeTransformations(arr1, arr2, arr3);

      expect(composed).toHaveLength(3);
      expect(composed[0].type).toBe('resize');
      expect(composed[1].type).toBe('rotate');
      expect(composed[2].type).toBe('flip');
    });

    it('should handle empty arrays', () => {
      const composed = composeTransformations([]);
      expect(composed).toHaveLength(0);
    });

    it('should flatten nested arrays', () => {
      const arr1: ImageTransformation[] = [{ type: 'resize', options: {} as ResizeOptions }];
      const arr2: ImageTransformation[] = [];
      const arr3: ImageTransformation[] = [{ type: 'crop', options: {} as CropOptions }];

      const composed = composeTransformations(arr1, arr2, arr3);
      expect(composed).toHaveLength(2);
    });
  });

  describe('mergeTransformationOptions', () => {
    it('should merge transformations, overriding existing types', () => {
      const base: ImageTransformation[] = [
        { type: 'resize', options: { width: 100 } as ResizeOptions },
        { type: 'rotate', options: { angle: 90 } as RotateOptions },
      ];
      const override: ImageTransformation[] = [
        { type: 'resize', options: { width: 200 } as ResizeOptions },
      ];

      const merged = mergeTransformationOptions(base, override);

      expect(merged).toHaveLength(2);
      expect((merged[0].options as ResizeOptions).width).toBe(200);
      expect((merged[1].options as RotateOptions).angle).toBe(90);
    });

    it('should add new transformations from override', () => {
      const base: ImageTransformation[] = [
        { type: 'resize', options: { width: 100 } as ResizeOptions },
      ];
      const override: ImageTransformation[] = [
        { type: 'flip', options: { horizontal: true } as FlipOptions },
      ];

      const merged = mergeTransformationOptions(base, override);

      expect(merged).toHaveLength(2);
      expect(merged[1].type).toBe('flip');
    });
  });

  describe('ImageFormatConverter', () => {
    let converter: ImageFormatConverter;

    beforeEach(() => {
      converter = new ImageFormatConverter();
    });

    it('should create converter with default settings', () => {
      expect(converter).toBeDefined();
    });

    it('should get quality settings', () => {
      const settings = converter.getQualitySettings();
      expect(settings.jpegQuality).toBe(80);
      expect(settings.webpQuality).toBe(80);
    });

    it('should update quality settings', () => {
      converter.setQualitySettings({ jpegQuality: 90 });
      const settings = converter.getQualitySettings();
      expect(settings.jpegQuality).toBe(90);
      expect(settings.webpQuality).toBe(80);
    });
  });

  describe('ImageOptimizer', () => {
    let optimizer: ImageOptimizer;

    beforeEach(() => {
      optimizer = new ImageOptimizer();
    });

    it('should create optimizer with default config', () => {
      expect(optimizer).toBeDefined();
    });

    it('should get optimization config', () => {
      const config = optimizer.getConfig();
      expect(config.level).toBe('medium');
      expect(config.maxWidth).toBe(4096);
    });

    it('should update optimization config', () => {
      optimizer.setConfig({ level: 'high' });
      const config = optimizer.getConfig();
      expect(config.level).toBe('high');
    });

    it('should optimize image data', () => {
      const imageData = Buffer.from('fake image data for optimization test');
      const result = optimizer.optimize(imageData, 'jpeg', 'medium');

      expect(result.originalSize).toBe(imageData.length);
      expect(result.compressedSize).toBeLessThanOrEqual(imageData.length);
      expect(result.savingsPercentage).toBeGreaterThanOrEqual(0);
      expect(result.compressionRatio).toBeGreaterThan(0);
    });
  });

  describe('ImageCache', () => {
    let cache: ImageCache;

    beforeEach(() => {
      cache = new ImageCache({ enabled: true });
    });

    it('should create cache with default config', () => {
      expect(cache).toBeDefined();
    });

    it('should get and set cached images', async () => {
      const image = {
        id: 'test-img',
        originalUrl: 'https://example.com/image.jpg',
        processedUrl: 'https://cdn.example.com/image.jpg',
        width: 800,
        height: 600,
        format: 'jpeg' as ImageFormat,
        size: 50000,
        originalSize: 100000,
        transformations: [],
        metadata: {
          format: 'jpeg' as ImageFormat,
          width: 800,
          height: 600,
          size: 100000,
          createdAt: new Date(),
        },
        processedAt: new Date(),
      };

      await cache.set('key1', image);
      const retrieved = await cache.get('key1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('test-img');
    });

    it('should return null for non-existent key', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should invalidate cache entries', async () => {
      const image = {
        id: 'test-img',
        originalUrl: 'https://example.com/image.jpg',
        width: 800,
        height: 600,
        format: 'jpeg' as ImageFormat,
        size: 50000,
        originalSize: 100000,
        transformations: [],
        metadata: {
          format: 'jpeg' as ImageFormat,
          width: 800,
          height: 600,
          size: 100000,
          createdAt: new Date(),
        },
        processedAt: new Date(),
      };

      await cache.set('key1', image);
      const deleted = await cache.invalidate('key1');
      const result = await cache.get('key1');

      expect(deleted).toBe(true);
      expect(result).toBeNull();
    });

    it('should check if key exists', async () => {
      const image = {
        id: 'test-img',
        originalUrl: 'https://example.com/image.jpg',
        width: 800,
        height: 600,
        format: 'jpeg' as ImageFormat,
        size: 50000,
        originalSize: 100000,
        transformations: [],
        metadata: {
          format: 'jpeg' as ImageFormat,
          width: 800,
          height: 600,
          size: 100000,
          createdAt: new Date(),
        },
        processedAt: new Date(),
      };

      await cache.set('key1', image);
      const exists = await cache.has('key1');
      const notExists = await cache.has('key2');

      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });

    it('should clear all cache entries', async () => {
      const image = {
        id: 'test-img',
        originalUrl: 'https://example.com/image.jpg',
        width: 800,
        height: 600,
        format: 'jpeg' as ImageFormat,
        size: 50000,
        originalSize: 100000,
        transformations: [],
        metadata: {
          format: 'jpeg' as ImageFormat,
          width: 800,
          height: 600,
          size: 100000,
          createdAt: new Date(),
        },
        processedAt: new Date(),
      };

      await cache.set('key1', image);
      await cache.set('key2', image);
      await cache.clear();

      expect(cache.size()).toBe(0);
    });

    it('should track cache stats', async () => {
      const image = {
        id: 'test-img',
        originalUrl: 'https://example.com/image.jpg',
        width: 800,
        height: 600,
        format: 'jpeg' as ImageFormat,
        size: 50000,
        originalSize: 100000,
        transformations: [],
        metadata: {
          format: 'jpeg' as ImageFormat,
          width: 800,
          height: 600,
          size: 100000,
          createdAt: new Date(),
        },
        processedAt: new Date(),
      };

      await cache.set('key1', image);
      await cache.get('key1');
      await cache.get('key2');

      const stats = cache.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('CDNClient', () => {
    let cdn: CDNClient;

    beforeEach(() => {
      cdn = new CDNClient({
        baseUrl: 'https://cdn.example.com',
        provider: 'cloudflare',
      });
    });

    it('should create CDN client', () => {
      expect(cdn).toBeDefined();
    });

    it('should upload image', async () => {
      const imageData = Buffer.from('fake image data');
      const result = await cdn.upload(imageData, { folder: 'products' });

      expect(result.url).toContain('cdn.example.com');
      expect(result.format).toBe('jpeg');
      expect(result.size).toBe(imageData.length);
    });

    it('should generate CDN URL with public ID', async () => {
      const url = await cdn.getUrl('image-123');
      expect(url).toContain('cdn.example.com');
      expect(url).toContain('image-123');
    });

    it('should include transformations in URL', async () => {
      const transformations: ImageTransformation[] = [
        { type: 'resize', options: { width: 800 } as ResizeOptions },
      ];
      const url = await cdn.getUrl('image-123', transformations);
      expect(url).toContain('transform=');
    });

    it('should perform health check', async () => {
      const result = await cdn.healthCheck();
      expect(result.healthy).toBe(true);
      expect(result.cdnConnected).toBe(true);
    });

    it('should get CDN config', () => {
      const config = cdn.getConfig();
      expect(config.baseUrl).toBe('https://cdn.example.com');
      expect(config.provider).toBe('cloudflare');
    });
  });

  describe('ImageVariantManager', () => {
    let variantManager: ImageVariantManager;

    beforeEach(() => {
      variantManager = new ImageVariantManager();
    });

    it('should create variant set', () => {
      const variants: ImageVariant[] = [
        {
          id: 'var1',
          name: 'thumbnail',
          transformations: [{ type: 'resize', options: { width: 150 } as ResizeOptions }],
          format: 'jpeg',
          quality: 80,
          width: 150,
        },
      ];

      const set = variantManager.createVariantSet('product-images', variants);

      expect(set.id).toBeDefined();
      expect(set.name).toBe('product-images');
      expect(set.variants).toHaveLength(1);
    });

    it('should get variant set by ID', () => {
      const variants: ImageVariant[] = [
        {
          id: 'var1',
          name: 'thumbnail',
          transformations: [],
          format: 'jpeg',
          quality: 80,
        },
      ];

      const created = variantManager.createVariantSet('test-set', variants);
      const retrieved = variantManager.getVariantSet(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-set');
    });

    it('should return undefined for non-existent variant set', () => {
      const result = variantManager.getVariantSet('non-existent');
      expect(result).toBeUndefined();
    });

    it('should get all variant sets', () => {
      variantManager.createVariantSet('set1', []);
      variantManager.createVariantSet('set2', []);

      const all = variantManager.getAllVariantSets();
      expect(all).toHaveLength(2);
    });

    it('should add variant to set', () => {
      const set = variantManager.createVariantSet('test-set', []);
      const variant: ImageVariant = {
        id: 'var1',
        name: 'new-variant',
        transformations: [],
        format: 'webp',
        quality: 85,
      };

      const added = variantManager.addVariant(set.id, variant);
      expect(added).toBe(true);

      const updated = variantManager.getVariantSet(set.id);
      expect(updated?.variants).toHaveLength(1);
    });

    it('should remove variant from set', () => {
      const variant: ImageVariant = {
        id: 'var1',
        name: 'variant',
        transformations: [],
        format: 'jpeg',
        quality: 80,
      };

      const set = variantManager.createVariantSet('test-set', [variant]);
      const removed = variantManager.removeVariant(set.id, 'var1');

      expect(removed).toBe(true);
      expect(variantManager.getVariantSet(set.id)?.variants).toHaveLength(0);
    });

    it('should delete variant set', () => {
      const set = variantManager.createVariantSet('test-set', []);
      const deleted = variantManager.deleteVariantSet(set.id);

      expect(deleted).toBe(true);
      expect(variantManager.getVariantSet(set.id)).toBeUndefined();
    });
  });

  describe('TransformationPresets', () => {
    let presets: TransformationPresets;

    beforeEach(() => {
      presets = new TransformationPresets();
    });

    it('should have default presets', () => {
      const allPresets = presets.getAllPresets();
      expect(allPresets.length).toBeGreaterThan(0);
    });

    it('should get thumbnail preset', () => {
      const thumbnail = presets.getPreset('thumbnail');
      expect(thumbnail).toBeDefined();
      expect(thumbnail?.transformations).toHaveLength(1);
    });

    it('should apply preset', () => {
      const transformations = presets.applyPreset('medium');
      expect(transformations).toBeDefined();
      expect(transformations?.length).toBeGreaterThan(0);
    });

    it('should create custom preset', () => {
      const customTransformations: ImageTransformation[] = [
        { type: 'resize', options: { width: 1200 } as ResizeOptions },
        { type: 'watermark', options: { text: 'Custom' } as WatermarkOptions },
      ];

      const preset = presets.createPreset('custom', customTransformations, 'My custom preset');

      expect(preset.name).toBe('custom');
      expect(preset.transformations).toHaveLength(2);
      expect(preset.description).toBe('My custom preset');
    });

    it('should delete custom preset', () => {
      presets.createPreset('to-delete', []);
      const deleted = presets.deletePreset('to-delete');
      expect(deleted).toBe(true);
      expect(presets.getPreset('to-delete')).toBeUndefined();
    });

    it('should not delete default preset', () => {
      const deleted = presets.deletePreset('thumbnail');
      expect(deleted).toBe(false);
      expect(presets.getPreset('thumbnail')).toBeDefined();
    });
  });

  describe('ImageProcessor', () => {
    let processor: ImageProcessor;

    beforeEach(() => {
      processor = createImageProcessor();
    });

    it('should create image processor', () => {
      expect(processor).toBeDefined();
    });

    it('should process image data', async () => {
      const imageData = Buffer.from('fake image data for processing test');
      const options: ImageProcessingOptions = {
        format: { format: 'jpeg', quality: 85 },
      };

      const result = await processor.process(imageData, 'https://example.com/image.jpg', options);

      expect(result.id).toBeDefined();
      expect(result.originalUrl).toBe('https://example.com/image.jpg');
      expect(result.format).toBe('jpeg');
      expect(result.processedAt).toBeInstanceOf(Date);
    });

    it('should apply transformations during processing', async () => {
      const imageData = Buffer.from('fake image data');
      const options: ImageProcessingOptions = {
        transformations: [
          { type: 'resize', options: { width: 800, height: 600 } as ResizeOptions },
        ],
      };

      const result = await processor.process(imageData, 'https://example.com/image.jpg', options);

      expect(result.transformations).toHaveLength(1);
      expect(result.transformations[0].type).toBe('resize');
    });

    it('should use cache when available', async () => {
      const imageData = Buffer.from('fake image data');
      const options: ImageProcessingOptions = {};

      const first = await processor.process(imageData, 'https://example.com/cached.jpg', options);
      const second = await processor.process(imageData, 'https://example.com/cached.jpg', options);

      expect(second.cacheHit).toBe(true);
    });

    it('should get processor stats', () => {
      const stats = processor.getStats();
      expect(stats.totalProcessed).toBeDefined();
      expect(stats.formatDistribution).toBeDefined();
    });

    it('should create transformation builder', () => {
      const builder = processor.createTransformationBuilder();
      expect(builder).toBeInstanceOf(ImageTransformationBuilder);
    });

    it('should apply presets', () => {
      const transformations = processor.applyPreset('thumbnail');
      expect(transformations).toBeDefined();
      expect(transformations?.length).toBeGreaterThan(0);
    });

    it('should create custom presets', () => {
      const preset = processor.createPreset('test-preset', [
        { type: 'resize', options: { width: 500 } as ResizeOptions },
      ]);

      expect(preset.name).toBe('test-preset');
    });

    it('should get all presets', () => {
      const allPresets = processor.getAllPresets();
      expect(allPresets.length).toBeGreaterThan(0);
    });

    it('should get variant manager', () => {
      const manager = processor.getVariantManager();
      expect(manager).toBeInstanceOf(ImageVariantManager);
    });

    it('should get optimizer', () => {
      const optimizer = processor.getOptimizer();
      expect(optimizer).toBeInstanceOf(ImageOptimizer);
    });

    it('should get cache', () => {
      const cache = processor.getCache();
      expect(cache).toBeInstanceOf(ImageCache);
    });

    it('should perform health check', async () => {
      const result = await processor.healthCheck();
      expect(result.healthy).toBe(true);
    });

    it('should upload to CDN', async () => {
      const imageData = Buffer.from('fake image data');
      const result = await processor.uploadToCDN(imageData, { folder: 'uploads' });

      expect(result.url).toBeDefined();
      expect(result.uploadedAt).toBeInstanceOf(Date);
    });
  });

  describe('createImageProcessor', () => {
    it('should create processor with custom config', () => {
      const processor = createImageProcessor(
        { level: 'high' },
        { baseUrl: 'https://custom.cdn.com' }
      );

      expect(processor).toBeDefined();
      const optimizer = processor.getOptimizer();
      expect(optimizer.getConfig().level).toBe('high');
    });
  });
});
