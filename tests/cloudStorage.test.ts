import {
  createCloudStorage,
  createStorageProvider,
  isCloudFileMetadata,
  isCloudFolderMetadata,
  isBucketMetadata,
  isStorageAnalytics,
  isStorageQuota,
  isSupportedMimeType,
  calculateStorageCost,
  buildCloudPath,
  parseCloudPath,
  generateFileId,
  generateFolderId,
  generateBucketId,
  generateETag,
  generateAccessToken,
  generatePreSignedUrl,
} from '../src/core/cloudStorage';
import type {
  StorageProviderType,
  StorageClass,
  AccessType,
  UploadOptions,
  DownloadOptions,
  CopyOptions,
  MoveOptions,
  DeleteOptions,
  ListOptions,
  PreSignedUrlOptions,
  AccessTokenOptions,
  StreamTransferOptions,
  BucketCreateOptions,
} from '../src/core/cloudStorage';

describe('CloudStorage - Type Guards', () => {
  describe('isCloudFileMetadata', () => {
    it('should return true for valid CloudFileMetadata', () => {
      const validFile = {
        id: 'cloud_abc123',
        name: 'test.txt',
        path: '/bucket/test.txt',
        bucket: 'bucket',
        size: 1024,
        mimeType: 'text/plain',
        etag: '"abc123"',
        storageClass: 'standard',
        accessType: 'private',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        metadata: {},
        versionId: null,
      };
      expect(isCloudFileMetadata(validFile)).toBe(true);
    });

    it('should return false for invalid object', () => {
      expect(isCloudFileMetadata(null)).toBe(false);
      expect(isCloudFileMetadata(undefined)).toBe(false);
      expect(isCloudFileMetadata({})).toBe(false);
      expect(isCloudFileMetadata({ id: 'test' })).toBe(false);
    });

    it('should return false for invalid storage class', () => {
      const invalidFile = {
        id: 'cloud_abc123',
        name: 'test.txt',
        path: '/bucket/test.txt',
        bucket: 'bucket',
        size: 1024,
        mimeType: 'text/plain',
        etag: '"abc123"',
        storageClass: 'invalid',
        accessType: 'private',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        metadata: {},
        versionId: null,
      };
      expect(isCloudFileMetadata(invalidFile)).toBe(false);
    });

    it('should return false for invalid access type', () => {
      const invalidFile = {
        id: 'cloud_abc123',
        name: 'test.txt',
        path: '/bucket/test.txt',
        bucket: 'bucket',
        size: 1024,
        mimeType: 'text/plain',
        etag: '"abc123"',
        storageClass: 'standard',
        accessType: 'invalid',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        metadata: {},
        versionId: null,
      };
      expect(isCloudFileMetadata(invalidFile)).toBe(false);
    });
  });

  describe('isCloudFolderMetadata', () => {
    it('should return true for valid CloudFolderMetadata', () => {
      const validFolder = {
        id: 'cloudfolder_abc123',
        name: 'folder',
        path: '/bucket/folder',
        bucket: 'bucket',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };
      expect(isCloudFolderMetadata(validFolder)).toBe(true);
    });

    it('should return false for invalid object', () => {
      expect(isCloudFolderMetadata(null)).toBe(false);
      expect(isCloudFolderMetadata({})).toBe(false);
    });
  });

  describe('isBucketMetadata', () => {
    it('should return true for valid BucketMetadata', () => {
      const validBucket = {
        id: 'bucket_abc123',
        name: 'my-bucket',
        provider: 's3',
        region: 'us-east-1',
        createdAt: new Date(),
        storageClass: 'standard',
        sizeBytes: 0,
        fileCount: 0,
        isDefault: true,
        configuration: {
          versioning: false,
          encryption: 'none',
          publicAccessBlock: true,
          corsEnabled: false,
          lifecycleRules: [],
        },
      };
      expect(isBucketMetadata(validBucket)).toBe(true);
    });

    it('should return false for invalid provider', () => {
      const invalidBucket = {
        id: 'bucket_abc123',
        name: 'my-bucket',
        provider: 'invalid',
        region: 'us-east-1',
        createdAt: new Date(),
        storageClass: 'standard',
        sizeBytes: 0,
        fileCount: 0,
        isDefault: true,
        configuration: {
          versioning: false,
          encryption: 'none',
          publicAccessBlock: true,
          corsEnabled: false,
          lifecycleRules: [],
        },
      };
      expect(isBucketMetadata(invalidBucket)).toBe(false);
    });
  });

  describe('isStorageAnalytics', () => {
    it('should return true for valid StorageAnalytics', () => {
      const validAnalytics = {
        bucketId: 'bucket_abc123',
        totalSizeBytes: 1024,
        fileCount: 10,
        averageFileSizeBytes: 102.4,
        storageByClass: { standard: 1024, infrequent: 0, archive: 0 },
        accessPatterns: {
          uploads: 5,
          downloads: 3,
          lists: 10,
          totalBytesUploaded: 5120,
          totalBytesDownloaded: 3072,
        },
        lastUpdated: new Date(),
      };
      expect(isStorageAnalytics(validAnalytics)).toBe(true);
    });

    it('should return false for invalid object', () => {
      expect(isStorageAnalytics({ bucketId: 'test' })).toBe(false);
    });
  });

  describe('isStorageQuota', () => {
    it('should return true for valid StorageQuota', () => {
      const validQuota = {
        bucketId: 'bucket_abc123',
        maxSizeBytes: 1000000,
        usedSizeBytes: 500000,
        maxFileCount: 1000,
        usedFileCount: 500,
        warnThreshold: 0.8,
        limitThreshold: 0.95,
      };
      expect(isStorageQuota(validQuota)).toBe(true);
    });

    it('should return false for invalid object', () => {
      expect(isStorageQuota({ bucketId: 'test' })).toBe(false);
    });
  });

  describe('isSupportedMimeType', () => {
    it('should return true for supported mime types', () => {
      expect(isSupportedMimeType('image/png')).toBe(true);
      expect(isSupportedMimeType('application/pdf')).toBe(true);
      expect(isSupportedMimeType('text/plain')).toBe(true);
      expect(isSupportedMimeType('video/mp4')).toBe(true);
    });

    it('should return false for unsupported mime types', () => {
      expect(isSupportedMimeType('application/custom')).toBe(false);
      expect(isSupportedMimeType('text/hack')).toBe(false);
    });
  });

  describe('calculateStorageCost', () => {
    it('should calculate cost for standard storage', () => {
      const cost = calculateStorageCost(1024 * 1024 * 1024, 'standard');
      expect(cost).toBeCloseTo(0.023, 5);
    });

    it('should calculate cost for infrequent access', () => {
      const cost = calculateStorageCost(1024 * 1024 * 1024, 'infrequent');
      expect(cost).toBeCloseTo(0.0125, 5);
    });

    it('should calculate cost for archive storage', () => {
      const cost = calculateStorageCost(1024 * 1024 * 1024, 'archive');
      expect(cost).toBeCloseTo(0.0045, 5);
    });
  });
});

describe('CloudStorage - ID Generators', () => {
  describe('generateFileId', () => {
    it('should generate file ID with correct prefix', () => {
      const fileId = generateFileId();
      expect(fileId.startsWith('cloud_')).toBe(true);
    });

    it('should generate unique IDs', () => {
      const id1 = generateFileId();
      const id2 = generateFileId();
      expect(id1).not.toBe(id2);
    });

    it('should generate ID with correct length', () => {
      const fileId = generateFileId();
      expect(fileId.length).toBeGreaterThan(10);
    });
  });

  describe('generateFolderId', () => {
    it('should generate folder ID with correct prefix', () => {
      const folderId = generateFolderId();
      expect(folderId.startsWith('cloudfolder_')).toBe(true);
    });
  });

  describe('generateBucketId', () => {
    it('should generate bucket ID with correct prefix', () => {
      const bucketId = generateBucketId();
      expect(bucketId.startsWith('bucket_')).toBe(true);
    });
  });

  describe('generateETag', () => {
    it('should generate ETag with quotes', () => {
      const etag = generateETag();
      expect(etag.startsWith('"')).toBe(true);
      expect(etag.endsWith('"')).toBe(true);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate access token with correct prefix', () => {
      const token = generateAccessToken();
      expect(token.startsWith('token_')).toBe(true);
    });
  });

  describe('generatePreSignedUrl', () => {
    it('should generate a URL', () => {
      const url = generatePreSignedUrl();
      expect(url.startsWith('https://')).toBe(true);
    });
  });
});

describe('CloudStorage - Path Utilities', () => {
  describe('buildCloudPath', () => {
    it('should build correct path from bucket and parts', () => {
      const path = buildCloudPath('bucket', 'folder', 'file.txt');
      expect(path).toBe('/bucket/folder/file.txt');
    });

    it('should handle single part', () => {
      const path = buildCloudPath('bucket', 'file.txt');
      expect(path).toBe('/bucket/file.txt');
    });
  });

  describe('parseCloudPath', () => {
    it('should parse valid cloud path', () => {
      const result = parseCloudPath('/bucket/folder/file.txt');
      expect(result).toEqual({
        bucket: 'bucket',
        path: 'folder/file.txt',
      });
    });

    it('should return null for invalid path', () => {
      expect(parseCloudPath('invalid')).toBe(null);
      expect(parseCloudPath('/')).toBe(null);
    });
  });
});

describe('CloudStorage - Storage Providers', () => {
  describe('createStorageProvider', () => {
    it('should create local provider', () => {
      const provider = createStorageProvider('local');
      expect(provider.type).toBe('local');
    });

    it('should create s3 provider', () => {
      const provider = createStorageProvider('s3');
      expect(provider.type).toBe('s3');
    });

    it('should create google_cloud provider', () => {
      const provider = createStorageProvider('google_cloud');
      expect(provider.type).toBe('google_cloud');
    });

    it('should create azure provider', () => {
      const provider = createStorageProvider('azure');
      expect(provider.type).toBe('azure');
    });

    it('should throw for invalid provider type', () => {
      expect(() => createStorageProvider('invalid' as StorageProviderType)).toThrow();
    });
  });
});

describe('CloudStorage - CloudStorage Instance', () => {
  let cloudStorage: ReturnType<typeof createCloudStorage>;

  beforeEach(() => {
    cloudStorage = createCloudStorage();
  });

  describe('Bucket Operations', () => {
    it('should create a bucket', async () => {
      const bucket = await cloudStorage.createBucket({
        name: 'test-bucket',
        provider: 'local',
        region: 'us-east-1',
      });
      expect(bucket.name).toBe('test-bucket');
      expect(bucket.provider).toBe('local');
    });

    it('should list buckets', async () => {
      await cloudStorage.createBucket({
        name: 'bucket-1',
        provider: 'local',
        region: 'us-east-1',
      });
      await cloudStorage.createBucket({
        name: 'bucket-2',
        provider: 's3',
        region: 'us-west-2',
      });
      const buckets = await cloudStorage.listBuckets();
      expect(buckets.length).toBeGreaterThanOrEqual(2);
    });

    it('should get bucket by name', async () => {
      await cloudStorage.createBucket({
        name: 'get-bucket-test',
        provider: 'local',
        region: 'us-east-1',
      });
      const bucket = await cloudStorage.getBucket('get-bucket-test');
      expect(bucket).not.toBeNull();
      expect(bucket?.name).toBe('get-bucket-test');
    });

    it('should return null for non-existent bucket', async () => {
      const bucket = await cloudStorage.getBucket('non-existent-bucket');
      expect(bucket).toBeNull();
    });
  });

  describe('File Operations', () => {
    beforeEach(async () => {
      await cloudStorage.createBucket({
        name: 'file-ops-bucket',
        provider: 'local',
        region: 'us-east-1',
      });
    });

    it('should upload a file', async () => {
      const buffer = Buffer.from('Hello, World!');
      const result = await cloudStorage.upload({
        bucket: 'file-ops-bucket',
        path: 'test.txt',
        body: buffer,
        mimeType: 'text/plain',
      });
      expect(result.file.name).toBe('test.txt');
      expect(result.file.size).toBe(13);
      expect(result.etag).toBeTruthy();
    });

    it('should download a file', async () => {
      const buffer = Buffer.from('Test content for download');
      await cloudStorage.upload({
        bucket: 'file-ops-bucket',
        path: 'download-test.txt',
        body: buffer,
        mimeType: 'text/plain',
      });

      const result = await cloudStorage.download({
        bucket: 'file-ops-bucket',
        path: 'download-test.txt',
      });
      expect(result.body.toString()).toBe('Test content for download');
    });

    it('should copy a file', async () => {
      const buffer = Buffer.from('Content to copy');
      await cloudStorage.upload({
        bucket: 'file-ops-bucket',
        path: 'source.txt',
        body: buffer,
        mimeType: 'text/plain',
      });

      const result = await cloudStorage.copy({
        sourceBucket: 'file-ops-bucket',
        sourcePath: 'source.txt',
        destBucket: 'file-ops-bucket',
        destPath: 'dest.txt',
      });
      expect(result.file.name).toBe('dest.txt');
    });

    it('should move a file', async () => {
      const buffer = Buffer.from('Content to move');
      await cloudStorage.upload({
        bucket: 'file-ops-bucket',
        path: 'move-source.txt',
        body: buffer,
        mimeType: 'text/plain',
      });

      await cloudStorage.move({
        sourceBucket: 'file-ops-bucket',
        sourcePath: 'move-source.txt',
        destBucket: 'file-ops-bucket',
        destPath: 'move-dest.txt',
      });

      const movedFile = await cloudStorage.download({
        bucket: 'file-ops-bucket',
        path: 'move-dest.txt',
      });
      expect(movedFile.body.toString()).toBe('Content to move');
    });

    it('should delete a file', async () => {
      const buffer = Buffer.from('Content to delete');
      await cloudStorage.upload({
        bucket: 'file-ops-bucket',
        path: 'delete-test.txt',
        body: buffer,
        mimeType: 'text/plain',
      });

      const result = await cloudStorage.delete({
        bucket: 'file-ops-bucket',
        path: 'delete-test.txt',
      });
      expect(result.deleted).toBe(true);
    });

    it('should list files in bucket', async () => {
      const buffer = Buffer.from('Test');
      await cloudStorage.upload({
        bucket: 'file-ops-bucket',
        path: 'list1.txt',
        body: buffer,
        mimeType: 'text/plain',
      });
      await cloudStorage.upload({
        bucket: 'file-ops-bucket',
        path: 'list2.txt',
        body: buffer,
        mimeType: 'text/plain',
      });

      const result = await cloudStorage.list({
        bucket: 'file-ops-bucket',
      });
      expect(result.totalCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Pre-signed URLs and Access Tokens', () => {
    beforeEach(async () => {
      await cloudStorage.createBucket({
        name: 'auth-bucket',
        provider: 'local',
        region: 'us-east-1',
      });
    });

    it('should generate pre-signed URL', async () => {
      const url = await cloudStorage.getSignedUrl({
        bucket: 'auth-bucket',
        path: 'secure.txt',
        accessType: 'private',
        expiresIn: 3600,
      });
      expect(url).toContain('signed');
      expect(url).toContain('auth-bucket');
    });

    it('should generate access token', async () => {
      const token = await cloudStorage.getAccessToken({
        bucket: 'auth-bucket',
        path: '/',
        accessTypes: ['private'],
        expiresIn: 86400,
      });
      expect(token.token).toContain('token_');
      expect(token.bucket).toBe('auth-bucket');
      expect(token.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('Storage Analytics and Quotas', () => {
    beforeEach(async () => {
      await cloudStorage.createBucket({
        name: 'analytics-bucket',
        provider: 'local',
        region: 'us-east-1',
      });
    });

    it('should get storage analytics', async () => {
      const analytics = await cloudStorage.getStorageAnalytics('analytics-bucket');
      expect(analytics.bucketId).toBeTruthy();
      expect(typeof analytics.totalSizeBytes).toBe('number');
      expect(typeof analytics.fileCount).toBe('number');
      expect(analytics.storageByClass).toBeDefined();
    });

    it('should get storage quota', async () => {
      const quota = await cloudStorage.getStorageQuota('analytics-bucket');
      expect(quota.maxSizeBytes).toBeGreaterThan(0);
      expect(quota.maxFileCount).toBeGreaterThan(0);
      expect(quota.warnThreshold).toBeLessThan(1);
      expect(quota.limitThreshold).toBeLessThan(1);
    });

    it('should set bucket quota', async () => {
      const newQuota = await cloudStorage.setBucketQuota('analytics-bucket', {
        maxSizeBytes: 5000000000,
        maxFileCount: 50000,
        warnThreshold: 0.75,
        limitThreshold: 0.9,
      });
      expect(newQuota.maxSizeBytes).toBe(5000000000);
      expect(newQuota.maxFileCount).toBe(50000);
    });
  });

  describe('Stream Transfers', () => {
    beforeEach(async () => {
      await cloudStorage.createBucket({
        name: 'stream-bucket',
        provider: 'local',
        region: 'us-east-1',
      });
    });

    it('should upload file with progress callback', async () => {
      const buffer = Buffer.from('Stream test content');
      await cloudStorage.upload({
        bucket: 'stream-bucket',
        path: 'stream-upload.txt',
        body: buffer,
        mimeType: 'text/plain',
      });

      let lastProgress: { bytesTransferred: number; totalBytes: number; percentage: number } | null = null;
      await cloudStorage.streamUpload(
        {
          sourceBucket: 'stream-bucket',
          sourcePath: 'stream-upload.txt',
          destBucket: 'stream-bucket',
          destPath: 'stream-upload-dest.txt',
        },
        (progress) => {
          lastProgress = progress;
        }
      );

      expect(lastProgress).not.toBeNull();
      expect(lastProgress!.percentage).toBe(100);
    });

    it('should download file with progress callback', async () => {
      const buffer = Buffer.from('Stream download test');
      await cloudStorage.upload({
        bucket: 'stream-bucket',
        path: 'stream-download.txt',
        body: buffer,
        mimeType: 'text/plain',
      });

      let lastProgress: { bytesTransferred: number; totalBytes: number; percentage: number } | null = null;
      await cloudStorage.streamDownload(
        {
          sourceBucket: 'stream-bucket',
          sourcePath: 'stream-download.txt',
          destBucket: 'stream-bucket',
          destPath: 'stream-download-dest.txt',
        },
        (progress) => {
          lastProgress = progress;
        }
      );

      expect(lastProgress).not.toBeNull();
      expect(lastProgress!.percentage).toBe(100);
    });
  });
});

describe('CloudStorage - Multiple Providers', () => {
  it('should support multiple providers', async () => {
    const storage = createCloudStorage();

    await storage.createBucket({
      name: 'local-bucket',
      provider: 'local',
      region: 'us-east-1',
    });

    const localProvider = storage.getProvider('local');
    expect(localProvider.type).toBe('local');

    const s3Provider = storage.getProvider('s3');
    expect(s3Provider.type).toBe('s3');
  });
});
