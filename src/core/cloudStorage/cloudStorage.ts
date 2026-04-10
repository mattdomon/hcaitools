import crypto from 'crypto';
import type {
  StorageProviderType,
  StorageClass,
  CloudFileMetadata,
  CloudFolderMetadata,
  BucketMetadata,
  StorageAnalytics,
  StorageQuota,
  PreSignedUrlOptions,
  UploadOptions,
  UploadResult,
  DownloadOptions,
  DownloadResult,
  CopyOptions,
  CopyResult,
  MoveOptions,
  DeleteOptions,
  DeleteResult,
  ListOptions,
  ListResult,
  StreamTransferOptions,
  StreamTransferProgress,
  BucketCreateOptions,
  BucketUpdateOptions,
  AccessTokenOptions,
  AccessToken,
  IStorageProvider,
  CloudStorageConfig,
  BucketConfiguration,
  AccessPatternStats,
} from './types';

function generateFileId(): string {
  return `cloud_${crypto.randomBytes(8).toString('hex')}`;
}

function generateBucketId(): string {
  return `bucket_${crypto.randomBytes(8).toString('hex')}`;
}

function generateETag(): string {
  return `"${crypto.randomBytes(16).toString('hex')}"`;
}

function generateAccessToken(): string {
  return `token_${crypto.randomBytes(32).toString('hex')}`;
}

class LocalStorageProvider implements IStorageProvider {
  public readonly type: StorageProviderType = 'local';
  private files: Map<string, CloudFileMetadata> = new Map();
  private folders: Map<string, CloudFolderMetadata> = new Map();
  private buckets: Map<string, BucketMetadata> = new Map();
  private fileContents: Map<string, Buffer> = new Map();
  private quotas: Map<string, StorageQuota> = new Map();

  async upload(options: UploadOptions): Promise<UploadResult> {
    const bucket = await this.getOrCreateBucket(options.bucket, 'local');
    const bodyBuffer = Buffer.isBuffer(options.body)
      ? options.body
      : await this.readStream(options.body);

    const existing = this.findFileByPath(options.bucket, options.path);
    const now = new Date();
    const file: CloudFileMetadata = {
      id: existing?.id ?? generateFileId(),
      name: options.path.split('/').pop() ?? options.path,
      path: options.path,
      bucket: options.bucket,
      size: bodyBuffer.length,
      mimeType: options.mimeType ?? 'application/octet-stream',
      etag: generateETag(),
      storageClass: options.storageClass ?? 'standard',
      accessType: options.accessType ?? 'private',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expiresAt: null,
      metadata: options.metadata ?? {},
      versionId: bucket.configuration.versioning ? generateBucketId() : null,
    };

    this.files.set(file.id, file);
    this.fileContents.set(`${options.bucket}:${options.path}`, bodyBuffer);
    bucket.sizeBytes += bodyBuffer.length;
    bucket.fileCount += 1;

    return { file, etag: file.etag, versionId: file.versionId };
  }

  async download(options: DownloadOptions): Promise<DownloadResult> {
    const file = this.findFileByPath(options.bucket, options.path);
    if (!file) {
      throw new Error(`File not found: ${options.path}`);
    }

    const content = this.fileContents.get(`${options.bucket}:${options.path}`);
    if (!content) {
      throw new Error(`File content not found: ${options.path}`);
    }

    return { body: content, metadata: file, etag: file.etag };
  }

  async copy(options: CopyOptions): Promise<CopyResult> {
    const sourceFile = this.findFileByPath(options.sourceBucket, options.sourcePath);
    if (!sourceFile) {
      throw new Error(`Source file not found: ${options.sourcePath}`);
    }

    const content = this.fileContents.get(`${options.sourceBucket}:${options.sourcePath}`);
    if (!content) {
      throw new Error(`Source file content not found: ${options.sourcePath}`);
    }

    const uploadResult = await this.upload({
      bucket: options.destBucket,
      path: options.destPath,
      body: content,
      mimeType: sourceFile.mimeType,
      storageClass: options.storageClass ?? sourceFile.storageClass,
      metadata: options.metadata ?? sourceFile.metadata,
    });

    return uploadResult;
  }

  async move(options: MoveOptions): Promise<CopyResult> {
    const copyResult = await this.copy({
      sourceBucket: options.sourceBucket,
      sourcePath: options.sourcePath,
      destBucket: options.destBucket,
      destPath: options.destPath,
      metadata: options.metadata,
      storageClass: options.storageClass,
    });

    await this.delete({
      bucket: options.sourceBucket,
      path: options.sourcePath,
    });

    return copyResult;
  }

  async delete(options: DeleteOptions): Promise<DeleteResult> {
    const file = this.findFileByPath(options.bucket, options.path);
    if (!file) {
      return { deleted: false, path: options.path };
    }

    this.files.delete(file.id);
    this.fileContents.delete(`${options.bucket}:${options.path}`);
    const bucket = await this.getBucket(options.bucket);
    if (bucket) {
      bucket.sizeBytes = Math.max(0, bucket.sizeBytes - file.size);
      bucket.fileCount = Math.max(0, bucket.fileCount - 1);
    }

    return { deleted: true, path: options.path };
  }

  async list(options: ListOptions): Promise<ListResult> {
    const bucket = await this.getBucket(options.bucket);
    if (!bucket) {
      return { files: [], folders: [], prefix: options.prefix ?? null, isTruncated: false, nextMarker: null, totalCount: 0 };
    }

    const prefix = options.prefix ?? '';
    const matchingFiles = Array.from(this.files.values()).filter(
      (f) => f.bucket === options.bucket && f.path.startsWith(prefix)
    );

    const maxKeys = options.maxKeys ?? 100;
    const start = options.marker ? matchingFiles.findIndex((f) => f.path === options.marker) + 1 : 0;
    const pagedFiles = matchingFiles.slice(start, start + maxKeys);

    return {
      files: pagedFiles,
      folders: [],
      prefix: prefix || null,
      isTruncated: start + maxKeys < matchingFiles.length,
      nextMarker: start + maxKeys < matchingFiles.length ? pagedFiles[pagedFiles.length - 1]?.path ?? null : null,
      totalCount: matchingFiles.length,
    };
  }

  async getOrCreateBucket(name: string, region: string, _config?: Partial<BucketConfiguration>): Promise<BucketMetadata> {
    const existing = this.buckets.get(name);
    if (existing) return existing;

    const bucket: BucketMetadata = {
      id: generateBucketId(),
      name,
      provider: 'local',
      region,
      createdAt: new Date(),
      storageClass: 'standard',
      sizeBytes: 0,
      fileCount: 0,
      isDefault: this.buckets.size === 0,
      configuration: {
        versioning: false,
        encryption: 'none',
        publicAccessBlock: true,
        corsEnabled: false,
        lifecycleRules: [],
      },
    };

    this.buckets.set(name, bucket);
    return bucket;
  }

  async getBucket(name: string): Promise<BucketMetadata | null> {
    return this.buckets.get(name) ?? null;
  }

  async listBuckets(): Promise<BucketMetadata[]> {
    return Array.from(this.buckets.values());
  }

  async getSignedUrl(options: PreSignedUrlOptions): Promise<string> {
    const expiry = Math.min(options.expiresIn, 3600);
    const params = new URLSearchParams({
      bucket: options.bucket,
      path: options.path,
      access: options.accessType,
      expires: String(Date.now() + expiry * 1000),
      signature: crypto.randomBytes(16).toString('hex'),
    });
    return `https://local.storage.example.com/signed?${params.toString()}`;
  }

  async getAccessToken(options: AccessTokenOptions): Promise<AccessToken> {
    return {
      token: generateAccessToken(),
      expiresAt: new Date(Date.now() + options.expiresIn * 1000),
      bucket: options.bucket,
      path: options.path,
      accessTypes: options.accessTypes,
      userId: options.userId ?? null,
    };
  }

  async streamUpload(
    options: StreamTransferOptions,
    progressCallback?: (progress: StreamTransferProgress) => void
  ): Promise<UploadResult> {
    const sourceContent = this.fileContents.get(`${options.sourceBucket}:${options.sourcePath}`);
    if (!sourceContent) {
      throw new Error(`Source file not found: ${options.sourcePath}`);
    }

    const totalBytes = sourceContent.length;
    const chunkSize = options.chunkSize ?? 1024 * 1024;
    let bytesTransferred = 0;

    for (let i = 0; i < totalBytes; i += chunkSize) {
      bytesTransferred = Math.min(i + chunkSize, totalBytes);
      if (progressCallback) {
        progressCallback({
          bytesTransferred,
          totalBytes,
          percentage: (bytesTransferred / totalBytes) * 100,
        });
      }
      await new Promise((resolve) => setImmediate(resolve));
    }

    return this.upload({
      bucket: options.destBucket,
      path: options.destPath,
      body: sourceContent,
      storageClass: options.storageClass,
      metadata: options.metadata,
    });
  }

  async streamDownload(
    options: StreamTransferOptions,
    progressCallback?: (progress: StreamTransferProgress) => void
  ): Promise<DownloadResult> {
    const sourceFile = this.findFileByPath(options.sourceBucket, options.sourcePath);
    if (!sourceFile) {
      throw new Error(`Source file not found: ${options.sourcePath}`);
    }

    const content = this.fileContents.get(`${options.sourceBucket}:${options.sourcePath}`);
    if (!content) {
      throw new Error(`Source file content not found: ${options.sourcePath}`);
    }

    const totalBytes = content.length;
    const chunkSize = options.chunkSize ?? 1024 * 1024;
    let bytesTransferred = 0;

    for (let i = 0; i < totalBytes; i += chunkSize) {
      bytesTransferred = Math.min(i + chunkSize, totalBytes);
      if (progressCallback) {
        progressCallback({
          bytesTransferred,
          totalBytes,
          percentage: (bytesTransferred / totalBytes) * 100,
        });
      }
      await new Promise((resolve) => setImmediate(resolve));
    }

    return {
      body: content,
      metadata: sourceFile,
      etag: sourceFile.etag,
    };
  }

  async getStorageAnalytics(bucket: string): Promise<StorageAnalytics> {
    const bucketMeta = await this.getBucket(bucket);
    if (!bucketMeta) {
      throw new Error(`Bucket not found: ${bucket}`);
    }

    const files = Array.from(this.files.values()).filter((f) => f.bucket === bucket);
    const storageByClass: Record<StorageClass, number> = {
      standard: 0,
      infrequent: 0,
      archive: 0,
    };

    let totalSize = 0;
    for (const file of files) {
      totalSize += file.size;
      storageByClass[file.storageClass] += file.size;
    }

    const accessPatterns: AccessPatternStats = {
      uploads: 0,
      downloads: 0,
      lists: 0,
      totalBytesUploaded: 0,
      totalBytesDownloaded: 0,
    };

    return {
      bucketId: bucketMeta.id,
      totalSizeBytes: totalSize,
      fileCount: files.length,
      averageFileSizeBytes: files.length > 0 ? totalSize / files.length : 0,
      storageByClass,
      accessPatterns,
      lastUpdated: new Date(),
    };
  }

  async getStorageQuota(bucket: string): Promise<StorageQuota> {
    let quota = this.quotas.get(bucket);
    if (!quota) {
      const bucketMeta = await this.getBucket(bucket);
      quota = {
        bucketId: bucketMeta?.id ?? bucket,
        maxSizeBytes: 1024 * 1024 * 1024 * 100,
        usedSizeBytes: bucketMeta?.sizeBytes ?? 0,
        maxFileCount: 1000000,
        usedFileCount: bucketMeta?.fileCount ?? 0,
        warnThreshold: 0.8,
        limitThreshold: 0.95,
      };
      this.quotas.set(bucket, quota);
    }
    return quota;
  }

  async setBucketQuota(
    bucket: string,
    quota: Omit<StorageQuota, 'bucketId' | 'usedSizeBytes' | 'usedFileCount'>
  ): Promise<StorageQuota> {
    const existing = await this.getStorageQuota(bucket);
    const updated: StorageQuota = {
      ...existing,
      maxSizeBytes: quota.maxSizeBytes,
      maxFileCount: quota.maxFileCount,
      warnThreshold: quota.warnThreshold,
      limitThreshold: quota.limitThreshold,
    };
    this.quotas.set(bucket, updated);
    return updated;
  }

  private findFileByPath(bucket: string, path: string): CloudFileMetadata | undefined {
    return Array.from(this.files.values()).find((f) => f.bucket === bucket && f.path === path);
  }

  private async readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}

class S3StorageProvider implements IStorageProvider {
  public readonly type: StorageProviderType = 's3';
  private files: Map<string, CloudFileMetadata> = new Map();
  private buckets: Map<string, BucketMetadata> = new Map();
  private fileContents: Map<string, Buffer> = new Map();
  private quotas: Map<string, StorageQuota> = new Map();

  async upload(options: UploadOptions): Promise<UploadResult> {
    const bucket = await this.getOrCreateBucket(options.bucket, 'us-east-1');
    const bodyBuffer = Buffer.isBuffer(options.body)
      ? options.body
      : await this.readStream(options.body);

    const existing = this.findFileByPath(options.bucket, options.path);
    const now = new Date();
    const file: CloudFileMetadata = {
      id: existing?.id ?? generateFileId(),
      name: options.path.split('/').pop() ?? options.path,
      path: options.path,
      bucket: options.bucket,
      size: bodyBuffer.length,
      mimeType: options.mimeType ?? 'application/octet-stream',
      etag: generateETag(),
      storageClass: options.storageClass ?? 'standard',
      accessType: options.accessType ?? 'private',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expiresAt: null,
      metadata: options.metadata ?? {},
      versionId: bucket.configuration.versioning ? generateFileId() : null,
    };

    this.files.set(file.id, file);
    this.fileContents.set(`${options.bucket}:${options.path}`, bodyBuffer);
    bucket.sizeBytes += bodyBuffer.length;
    bucket.fileCount += 1;

    return { file, etag: file.etag, versionId: file.versionId };
  }

  async download(options: DownloadOptions): Promise<DownloadResult> {
    const file = this.findFileByPath(options.bucket, options.path);
    if (!file) {
      throw new Error(`File not found: ${options.path}`);
    }

    const content = this.fileContents.get(`${options.bucket}:${options.path}`);
    if (!content) {
      throw new Error(`File content not found: ${options.path}`);
    }

    return { body: content, metadata: file, etag: file.etag };
  }

  async copy(options: CopyOptions): Promise<CopyResult> {
    const sourceFile = this.findFileByPath(options.sourceBucket, options.sourcePath);
    if (!sourceFile) {
      throw new Error(`Source file not found: ${options.sourcePath}`);
    }

    const content = this.fileContents.get(`${options.sourceBucket}:${options.sourcePath}`);
    if (!content) {
      throw new Error(`Source file content not found: ${options.sourcePath}`);
    }

    const uploadResult = await this.upload({
      bucket: options.destBucket,
      path: options.destPath,
      body: content,
      mimeType: sourceFile.mimeType,
      storageClass: options.storageClass ?? sourceFile.storageClass,
      metadata: options.metadata ?? sourceFile.metadata,
    });

    return uploadResult;
  }

  async move(options: MoveOptions): Promise<CopyResult> {
    const copyResult = await this.copy({
      sourceBucket: options.sourceBucket,
      sourcePath: options.sourcePath,
      destBucket: options.destBucket,
      destPath: options.destPath,
      metadata: options.metadata,
      storageClass: options.storageClass,
    });

    await this.delete({
      bucket: options.sourceBucket,
      path: options.sourcePath,
    });

    return copyResult;
  }

  async delete(options: DeleteOptions): Promise<DeleteResult> {
    const file = this.findFileByPath(options.bucket, options.path);
    if (!file) {
      return { deleted: false, path: options.path };
    }

    this.files.delete(file.id);
    this.fileContents.delete(`${options.bucket}:${options.path}`);

    const bucket = await this.getBucket(options.bucket);
    if (bucket) {
      bucket.sizeBytes = Math.max(0, bucket.sizeBytes - file.size);
      bucket.fileCount = Math.max(0, bucket.fileCount - 1);
    }

    return { deleted: true, path: options.path };
  }

  async list(options: ListOptions): Promise<ListResult> {
    const bucket = await this.getBucket(options.bucket);
    if (!bucket) {
      return { files: [], folders: [], prefix: options.prefix ?? null, isTruncated: false, nextMarker: null, totalCount: 0 };
    }

    const prefix = options.prefix ?? '';
    const matchingFiles = Array.from(this.files.values()).filter(
      (f) => f.bucket === options.bucket && f.path.startsWith(prefix)
    );

    const maxKeys = options.maxKeys ?? 100;
    const start = options.marker ? matchingFiles.findIndex((f) => f.path === options.marker) + 1 : 0;
    const pagedFiles = matchingFiles.slice(start, start + maxKeys);

    return {
      files: pagedFiles,
      folders: [],
      prefix: prefix || null,
      isTruncated: start + maxKeys < matchingFiles.length,
      nextMarker: start + maxKeys < matchingFiles.length ? pagedFiles[pagedFiles.length - 1]?.path ?? null : null,
      totalCount: matchingFiles.length,
    };
  }

  async getOrCreateBucket(name: string, region: string, _config?: Partial<BucketConfiguration>): Promise<BucketMetadata> {
    const existing = this.buckets.get(name);
    if (existing) return existing;

    const bucket: BucketMetadata = {
      id: generateBucketId(),
      name,
      provider: 's3',
      region,
      createdAt: new Date(),
      storageClass: 'standard',
      sizeBytes: 0,
      fileCount: 0,
      isDefault: this.buckets.size === 0,
      configuration: {
        versioning: true,
        encryption: 'aes256',
        publicAccessBlock: true,
        corsEnabled: false,
        lifecycleRules: [],
      },
    };

    this.buckets.set(name, bucket);
    return bucket;
  }

  async getBucket(name: string): Promise<BucketMetadata | null> {
    return this.buckets.get(name) ?? null;
  }

  async listBuckets(): Promise<BucketMetadata[]> {
    return Array.from(this.buckets.values());
  }

  async getSignedUrl(options: PreSignedUrlOptions): Promise<string> {
    const expiry = Math.min(options.expiresIn, 3600);
    const params = new URLSearchParams({
      bucket: options.bucket,
      path: options.path,
      access: options.accessType,
      expires: String(Date.now() + expiry * 1000),
      signature: crypto.randomBytes(16).toString('hex'),
    });
    return `https://s3.amazonaws.com/signed?${params.toString()}`;
  }

  async getAccessToken(options: AccessTokenOptions): Promise<AccessToken> {
    return {
      token: generateAccessToken(),
      expiresAt: new Date(Date.now() + options.expiresIn * 1000),
      bucket: options.bucket,
      path: options.path,
      accessTypes: options.accessTypes,
      userId: options.userId ?? null,
    };
  }

  async streamUpload(
    options: StreamTransferOptions,
    progressCallback?: (progress: StreamTransferProgress) => void
  ): Promise<UploadResult> {
    const sourceContent = this.fileContents.get(`${options.sourceBucket}:${options.sourcePath}`);
    if (!sourceContent) {
      throw new Error(`Source file not found: ${options.sourcePath}`);
    }

    const totalBytes = sourceContent.length;
    const chunkSize = options.chunkSize ?? 1024 * 1024;
    let bytesTransferred = 0;

    for (let i = 0; i < totalBytes; i += chunkSize) {
      bytesTransferred = Math.min(i + chunkSize, totalBytes);
      if (progressCallback) {
        progressCallback({
          bytesTransferred,
          totalBytes,
          percentage: (bytesTransferred / totalBytes) * 100,
        });
      }
      await new Promise((resolve) => setImmediate(resolve));
    }

    return this.upload({
      bucket: options.destBucket,
      path: options.destPath,
      body: sourceContent,
      storageClass: options.storageClass,
      metadata: options.metadata,
    });
  }

  async streamDownload(
    options: StreamTransferOptions,
    progressCallback?: (progress: StreamTransferProgress) => void
  ): Promise<DownloadResult> {
    const sourceFile = this.findFileByPath(options.sourceBucket, options.sourcePath);
    if (!sourceFile) {
      throw new Error(`Source file not found: ${options.sourcePath}`);
    }

    const content = this.fileContents.get(`${options.sourceBucket}:${options.sourcePath}`);
    if (!content) {
      throw new Error(`Source file content not found: ${options.sourcePath}`);
    }

    const totalBytes = content.length;
    const chunkSize = options.chunkSize ?? 1024 * 1024;
    let bytesTransferred = 0;

    for (let i = 0; i < totalBytes; i += chunkSize) {
      bytesTransferred = Math.min(i + chunkSize, totalBytes);
      if (progressCallback) {
        progressCallback({
          bytesTransferred,
          totalBytes,
          percentage: (bytesTransferred / totalBytes) * 100,
        });
      }
      await new Promise((resolve) => setImmediate(resolve));
    }

    return {
      body: content,
      metadata: sourceFile,
      etag: sourceFile.etag,
    };
  }

  async getStorageAnalytics(bucket: string): Promise<StorageAnalytics> {
    const bucketMeta = await this.getBucket(bucket);
    if (!bucketMeta) {
      throw new Error(`Bucket not found: ${bucket}`);
    }

    const files = Array.from(this.files.values()).filter((f) => f.bucket === bucket);
    const storageByClass: Record<StorageClass, number> = {
      standard: 0,
      infrequent: 0,
      archive: 0,
    };

    let totalSize = 0;
    for (const file of files) {
      totalSize += file.size;
      storageByClass[file.storageClass] += file.size;
    }

    const accessPatterns: AccessPatternStats = {
      uploads: 0,
      downloads: 0,
      lists: 0,
      totalBytesUploaded: 0,
      totalBytesDownloaded: 0,
    };

    return {
      bucketId: bucketMeta.id,
      totalSizeBytes: totalSize,
      fileCount: files.length,
      averageFileSizeBytes: files.length > 0 ? totalSize / files.length : 0,
      storageByClass,
      accessPatterns,
      lastUpdated: new Date(),
    };
  }

  async getStorageQuota(bucket: string): Promise<StorageQuota> {
    let quota = this.quotas.get(bucket);
    if (!quota) {
      const bucketMeta = await this.getBucket(bucket);
      quota = {
        bucketId: bucketMeta?.id ?? bucket,
        maxSizeBytes: 1024 * 1024 * 1024 * 100,
        usedSizeBytes: bucketMeta?.sizeBytes ?? 0,
        maxFileCount: 1000000,
        usedFileCount: bucketMeta?.fileCount ?? 0,
        warnThreshold: 0.8,
        limitThreshold: 0.95,
      };
      this.quotas.set(bucket, quota);
    }
    return quota;
  }

  async setBucketQuota(
    bucket: string,
    quota: Omit<StorageQuota, 'bucketId' | 'usedSizeBytes' | 'usedFileCount'>
  ): Promise<StorageQuota> {
    const existing = await this.getStorageQuota(bucket);
    const updated: StorageQuota = {
      ...existing,
      maxSizeBytes: quota.maxSizeBytes,
      maxFileCount: quota.maxFileCount,
      warnThreshold: quota.warnThreshold,
      limitThreshold: quota.limitThreshold,
    };
    this.quotas.set(bucket, updated);
    return updated;
  }

  private findFileByPath(bucket: string, path: string): CloudFileMetadata | undefined {
    return Array.from(this.files.values()).find((f) => f.bucket === bucket && f.path === path);
  }

  private async readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}

class GoogleCloudStorageProvider implements IStorageProvider {
  public readonly type: StorageProviderType = 'google_cloud';
  private files: Map<string, CloudFileMetadata> = new Map();
  private buckets: Map<string, BucketMetadata> = new Map();
  private fileContents: Map<string, Buffer> = new Map();
  private quotas: Map<string, StorageQuota> = new Map();

  async upload(options: UploadOptions): Promise<UploadResult> {
    const bucket = await this.getOrCreateBucket(options.bucket, 'us-central1');
    const bodyBuffer = Buffer.isBuffer(options.body)
      ? options.body
      : await this.readStream(options.body);

    const existing = this.findFileByPath(options.bucket, options.path);
    const now = new Date();
    const file: CloudFileMetadata = {
      id: existing?.id ?? generateFileId(),
      name: options.path.split('/').pop() ?? options.path,
      path: options.path,
      bucket: options.bucket,
      size: bodyBuffer.length,
      mimeType: options.mimeType ?? 'application/octet-stream',
      etag: generateETag(),
      storageClass: options.storageClass ?? 'standard',
      accessType: options.accessType ?? 'private',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expiresAt: null,
      metadata: options.metadata ?? {},
      versionId: bucket.configuration.versioning ? generateFileId() : null,
    };

    this.files.set(file.id, file);
    this.fileContents.set(`${options.bucket}:${options.path}`, bodyBuffer);
    bucket.sizeBytes += bodyBuffer.length;
    bucket.fileCount += 1;

    return { file, etag: file.etag, versionId: file.versionId };
  }

  async download(options: DownloadOptions): Promise<DownloadResult> {
    const file = this.findFileByPath(options.bucket, options.path);
    if (!file) {
      throw new Error(`File not found: ${options.path}`);
    }

    const content = this.fileContents.get(`${options.bucket}:${options.path}`);
    if (!content) {
      throw new Error(`File content not found: ${options.path}`);
    }

    return { body: content, metadata: file, etag: file.etag };
  }

  async copy(options: CopyOptions): Promise<CopyResult> {
    const sourceFile = this.findFileByPath(options.sourceBucket, options.sourcePath);
    if (!sourceFile) {
      throw new Error(`Source file not found: ${options.sourcePath}`);
    }

    const content = this.fileContents.get(`${options.sourceBucket}:${options.sourcePath}`);
    if (!content) {
      throw new Error(`Source file content not found: ${options.sourcePath}`);
    }

    const uploadResult = await this.upload({
      bucket: options.destBucket,
      path: options.destPath,
      body: content,
      mimeType: sourceFile.mimeType,
      storageClass: options.storageClass ?? sourceFile.storageClass,
      metadata: options.metadata ?? sourceFile.metadata,
    });

    return uploadResult;
  }

  async move(options: MoveOptions): Promise<CopyResult> {
    const copyResult = await this.copy({
      sourceBucket: options.sourceBucket,
      sourcePath: options.sourcePath,
      destBucket: options.destBucket,
      destPath: options.destPath,
      metadata: options.metadata,
      storageClass: options.storageClass,
    });

    await this.delete({
      bucket: options.sourceBucket,
      path: options.sourcePath,
    });

    return copyResult;
  }

  async delete(options: DeleteOptions): Promise<DeleteResult> {
    const file = this.findFileByPath(options.bucket, options.path);
    if (!file) {
      return { deleted: false, path: options.path };
    }

    this.files.delete(file.id);
    this.fileContents.delete(`${options.bucket}:${options.path}`);

    const bucket = await this.getBucket(options.bucket);
    if (bucket) {
      bucket.sizeBytes = Math.max(0, bucket.sizeBytes - file.size);
      bucket.fileCount = Math.max(0, bucket.fileCount - 1);
    }

    return { deleted: true, path: options.path };
  }

  async list(options: ListOptions): Promise<ListResult> {
    const bucket = await this.getBucket(options.bucket);
    if (!bucket) {
      return { files: [], folders: [], prefix: options.prefix ?? null, isTruncated: false, nextMarker: null, totalCount: 0 };
    }

    const prefix = options.prefix ?? '';
    const matchingFiles = Array.from(this.files.values()).filter(
      (f) => f.bucket === options.bucket && f.path.startsWith(prefix)
    );

    const maxKeys = options.maxKeys ?? 100;
    const start = options.marker ? matchingFiles.findIndex((f) => f.path === options.marker) + 1 : 0;
    const pagedFiles = matchingFiles.slice(start, start + maxKeys);

    return {
      files: pagedFiles,
      folders: [],
      prefix: prefix || null,
      isTruncated: start + maxKeys < matchingFiles.length,
      nextMarker: start + maxKeys < matchingFiles.length ? pagedFiles[pagedFiles.length - 1]?.path ?? null : null,
      totalCount: matchingFiles.length,
    };
  }

  async getOrCreateBucket(name: string, region: string, _config?: Partial<BucketConfiguration>): Promise<BucketMetadata> {
    const existing = this.buckets.get(name);
    if (existing) return existing;

    const bucket: BucketMetadata = {
      id: generateBucketId(),
      name,
      provider: 'google_cloud',
      region,
      createdAt: new Date(),
      storageClass: 'standard',
      sizeBytes: 0,
      fileCount: 0,
      isDefault: this.buckets.size === 0,
      configuration: {
        versioning: true,
        encryption: 'google_kms',
        publicAccessBlock: true,
        corsEnabled: false,
        lifecycleRules: [],
      },
    };

    this.buckets.set(name, bucket);
    return bucket;
  }

  async getBucket(name: string): Promise<BucketMetadata | null> {
    return this.buckets.get(name) ?? null;
  }

  async listBuckets(): Promise<BucketMetadata[]> {
    return Array.from(this.buckets.values());
  }

  async getSignedUrl(options: PreSignedUrlOptions): Promise<string> {
    const expiry = Math.min(options.expiresIn, 3600);
    const params = new URLSearchParams({
      bucket: options.bucket,
      path: options.path,
      access: options.accessType,
      expires: String(Date.now() + expiry * 1000),
      signature: crypto.randomBytes(16).toString('hex'),
    });
    return `https://storage.googleapis.com/signed?${params.toString()}`;
  }

  async getAccessToken(options: AccessTokenOptions): Promise<AccessToken> {
    return {
      token: generateAccessToken(),
      expiresAt: new Date(Date.now() + options.expiresIn * 1000),
      bucket: options.bucket,
      path: options.path,
      accessTypes: options.accessTypes,
      userId: options.userId ?? null,
    };
  }

  async streamUpload(
    options: StreamTransferOptions,
    progressCallback?: (progress: StreamTransferProgress) => void
  ): Promise<UploadResult> {
    const sourceContent = this.fileContents.get(`${options.sourceBucket}:${options.sourcePath}`);
    if (!sourceContent) {
      throw new Error(`Source file not found: ${options.sourcePath}`);
    }

    const totalBytes = sourceContent.length;
    const chunkSize = options.chunkSize ?? 1024 * 1024;
    let bytesTransferred = 0;

    for (let i = 0; i < totalBytes; i += chunkSize) {
      bytesTransferred = Math.min(i + chunkSize, totalBytes);
      if (progressCallback) {
        progressCallback({
          bytesTransferred,
          totalBytes,
          percentage: (bytesTransferred / totalBytes) * 100,
        });
      }
      await new Promise((resolve) => setImmediate(resolve));
    }

    return this.upload({
      bucket: options.destBucket,
      path: options.destPath,
      body: sourceContent,
      storageClass: options.storageClass,
      metadata: options.metadata,
    });
  }

  async streamDownload(
    options: StreamTransferOptions,
    progressCallback?: (progress: StreamTransferProgress) => void
  ): Promise<DownloadResult> {
    const sourceFile = this.findFileByPath(options.sourceBucket, options.sourcePath);
    if (!sourceFile) {
      throw new Error(`Source file not found: ${options.sourcePath}`);
    }

    const content = this.fileContents.get(`${options.sourceBucket}:${options.sourcePath}`);
    if (!content) {
      throw new Error(`Source file content not found: ${options.sourcePath}`);
    }

    const totalBytes = content.length;
    const chunkSize = options.chunkSize ?? 1024 * 1024;
    let bytesTransferred = 0;

    for (let i = 0; i < totalBytes; i += chunkSize) {
      bytesTransferred = Math.min(i + chunkSize, totalBytes);
      if (progressCallback) {
        progressCallback({
          bytesTransferred,
          totalBytes,
          percentage: (bytesTransferred / totalBytes) * 100,
        });
      }
      await new Promise((resolve) => setImmediate(resolve));
    }

    return {
      body: content,
      metadata: sourceFile,
      etag: sourceFile.etag,
    };
  }

  async getStorageAnalytics(bucket: string): Promise<StorageAnalytics> {
    const bucketMeta = await this.getBucket(bucket);
    if (!bucketMeta) {
      throw new Error(`Bucket not found: ${bucket}`);
    }

    const files = Array.from(this.files.values()).filter((f) => f.bucket === bucket);
    const storageByClass: Record<StorageClass, number> = {
      standard: 0,
      infrequent: 0,
      archive: 0,
    };

    let totalSize = 0;
    for (const file of files) {
      totalSize += file.size;
      storageByClass[file.storageClass] += file.size;
    }

    const accessPatterns: AccessPatternStats = {
      uploads: 0,
      downloads: 0,
      lists: 0,
      totalBytesUploaded: 0,
      totalBytesDownloaded: 0,
    };

    return {
      bucketId: bucketMeta.id,
      totalSizeBytes: totalSize,
      fileCount: files.length,
      averageFileSizeBytes: files.length > 0 ? totalSize / files.length : 0,
      storageByClass,
      accessPatterns,
      lastUpdated: new Date(),
    };
  }

  async getStorageQuota(bucket: string): Promise<StorageQuota> {
    let quota = this.quotas.get(bucket);
    if (!quota) {
      const bucketMeta = await this.getBucket(bucket);
      quota = {
        bucketId: bucketMeta?.id ?? bucket,
        maxSizeBytes: 1024 * 1024 * 1024 * 100,
        usedSizeBytes: bucketMeta?.sizeBytes ?? 0,
        maxFileCount: 1000000,
        usedFileCount: bucketMeta?.fileCount ?? 0,
        warnThreshold: 0.8,
        limitThreshold: 0.95,
      };
      this.quotas.set(bucket, quota);
    }
    return quota;
  }

  async setBucketQuota(
    bucket: string,
    quota: Omit<StorageQuota, 'bucketId' | 'usedSizeBytes' | 'usedFileCount'>
  ): Promise<StorageQuota> {
    const existing = await this.getStorageQuota(bucket);
    const updated: StorageQuota = {
      ...existing,
      maxSizeBytes: quota.maxSizeBytes,
      maxFileCount: quota.maxFileCount,
      warnThreshold: quota.warnThreshold,
      limitThreshold: quota.limitThreshold,
    };
    this.quotas.set(bucket, updated);
    return updated;
  }

  private findFileByPath(bucket: string, path: string): CloudFileMetadata | undefined {
    return Array.from(this.files.values()).find((f) => f.bucket === bucket && f.path === path);
  }

  private async readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}

class AzureBlobStorageProvider implements IStorageProvider {
  public readonly type: StorageProviderType = 'azure';
  private files: Map<string, CloudFileMetadata> = new Map();
  private buckets: Map<string, BucketMetadata> = new Map();
  private fileContents: Map<string, Buffer> = new Map();
  private quotas: Map<string, StorageQuota> = new Map();

  async upload(options: UploadOptions): Promise<UploadResult> {
    const bucket = await this.getOrCreateBucket(options.bucket, 'eastus');
    const bodyBuffer = Buffer.isBuffer(options.body)
      ? options.body
      : await this.readStream(options.body);

    const existing = this.findFileByPath(options.bucket, options.path);
    const now = new Date();
    const file: CloudFileMetadata = {
      id: existing?.id ?? generateFileId(),
      name: options.path.split('/').pop() ?? options.path,
      path: options.path,
      bucket: options.bucket,
      size: bodyBuffer.length,
      mimeType: options.mimeType ?? 'application/octet-stream',
      etag: generateETag(),
      storageClass: options.storageClass ?? 'standard',
      accessType: options.accessType ?? 'private',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expiresAt: null,
      metadata: options.metadata ?? {},
      versionId: bucket.configuration.versioning ? generateFileId() : null,
    };

    this.files.set(file.id, file);
    this.fileContents.set(`${options.bucket}:${options.path}`, bodyBuffer);
    bucket.sizeBytes += bodyBuffer.length;
    bucket.fileCount += 1;

    return { file, etag: file.etag, versionId: file.versionId };
  }

  async download(options: DownloadOptions): Promise<DownloadResult> {
    const file = this.findFileByPath(options.bucket, options.path);
    if (!file) {
      throw new Error(`File not found: ${options.path}`);
    }

    const content = this.fileContents.get(`${options.bucket}:${options.path}`);
    if (!content) {
      throw new Error(`File content not found: ${options.path}`);
    }

    return { body: content, metadata: file, etag: file.etag };
  }

  async copy(options: CopyOptions): Promise<CopyResult> {
    const sourceFile = this.findFileByPath(options.sourceBucket, options.sourcePath);
    if (!sourceFile) {
      throw new Error(`Source file not found: ${options.sourcePath}`);
    }

    const content = this.fileContents.get(`${options.sourceBucket}:${options.sourcePath}`);
    if (!content) {
      throw new Error(`Source file content not found: ${options.sourcePath}`);
    }

    const uploadResult = await this.upload({
      bucket: options.destBucket,
      path: options.destPath,
      body: content,
      mimeType: sourceFile.mimeType,
      storageClass: options.storageClass ?? sourceFile.storageClass,
      metadata: options.metadata ?? sourceFile.metadata,
    });

    return uploadResult;
  }

  async move(options: MoveOptions): Promise<CopyResult> {
    const copyResult = await this.copy({
      sourceBucket: options.sourceBucket,
      sourcePath: options.sourcePath,
      destBucket: options.destBucket,
      destPath: options.destPath,
      metadata: options.metadata,
      storageClass: options.storageClass,
    });

    await this.delete({
      bucket: options.sourceBucket,
      path: options.sourcePath,
    });

    return copyResult;
  }

  async delete(options: DeleteOptions): Promise<DeleteResult> {
    const file = this.findFileByPath(options.bucket, options.path);
    if (!file) {
      return { deleted: false, path: options.path };
    }

    this.files.delete(file.id);
    this.fileContents.delete(`${options.bucket}:${options.path}`);

    const bucket = await this.getBucket(options.bucket);
    if (bucket) {
      bucket.sizeBytes = Math.max(0, bucket.sizeBytes - file.size);
      bucket.fileCount = Math.max(0, bucket.fileCount - 1);
    }

    return { deleted: true, path: options.path };
  }

  async list(options: ListOptions): Promise<ListResult> {
    const bucket = await this.getBucket(options.bucket);
    if (!bucket) {
      return { files: [], folders: [], prefix: options.prefix ?? null, isTruncated: false, nextMarker: null, totalCount: 0 };
    }

    const prefix = options.prefix ?? '';
    const matchingFiles = Array.from(this.files.values()).filter(
      (f) => f.bucket === options.bucket && f.path.startsWith(prefix)
    );

    const maxKeys = options.maxKeys ?? 100;
    const start = options.marker ? matchingFiles.findIndex((f) => f.path === options.marker) + 1 : 0;
    const pagedFiles = matchingFiles.slice(start, start + maxKeys);

    return {
      files: pagedFiles,
      folders: [],
      prefix: prefix || null,
      isTruncated: start + maxKeys < matchingFiles.length,
      nextMarker: start + maxKeys < matchingFiles.length ? pagedFiles[pagedFiles.length - 1]?.path ?? null : null,
      totalCount: matchingFiles.length,
    };
  }

  async getOrCreateBucket(name: string, region: string, _config?: Partial<BucketConfiguration>): Promise<BucketMetadata> {
    const existing = this.buckets.get(name);
    if (existing) return existing;

    const bucket: BucketMetadata = {
      id: generateBucketId(),
      name,
      provider: 'azure',
      region,
      createdAt: new Date(),
      storageClass: 'standard',
      sizeBytes: 0,
      fileCount: 0,
      isDefault: this.buckets.size === 0,
      configuration: {
        versioning: true,
        encryption: 'azure_key_vault',
        publicAccessBlock: true,
        corsEnabled: false,
        lifecycleRules: [],
      },
    };

    this.buckets.set(name, bucket);
    return bucket;
  }

  async getBucket(name: string): Promise<BucketMetadata | null> {
    return this.buckets.get(name) ?? null;
  }

  async listBuckets(): Promise<BucketMetadata[]> {
    return Array.from(this.buckets.values());
  }

  async getSignedUrl(options: PreSignedUrlOptions): Promise<string> {
    const expiry = Math.min(options.expiresIn, 3600);
    const params = new URLSearchParams({
      bucket: options.bucket,
      path: options.path,
      access: options.accessType,
      expires: String(Date.now() + expiry * 1000),
      signature: crypto.randomBytes(16).toString('hex'),
    });
    return `https://blob.core.windows.net/signed?${params.toString()}`;
  }

  async getAccessToken(options: AccessTokenOptions): Promise<AccessToken> {
    return {
      token: generateAccessToken(),
      expiresAt: new Date(Date.now() + options.expiresIn * 1000),
      bucket: options.bucket,
      path: options.path,
      accessTypes: options.accessTypes,
      userId: options.userId ?? null,
    };
  }

  async streamUpload(
    options: StreamTransferOptions,
    progressCallback?: (progress: StreamTransferProgress) => void
  ): Promise<UploadResult> {
    const sourceContent = this.fileContents.get(`${options.sourceBucket}:${options.sourcePath}`);
    if (!sourceContent) {
      throw new Error(`Source file not found: ${options.sourcePath}`);
    }

    const totalBytes = sourceContent.length;
    const chunkSize = options.chunkSize ?? 1024 * 1024;
    let bytesTransferred = 0;

    for (let i = 0; i < totalBytes; i += chunkSize) {
      bytesTransferred = Math.min(i + chunkSize, totalBytes);
      if (progressCallback) {
        progressCallback({
          bytesTransferred,
          totalBytes,
          percentage: (bytesTransferred / totalBytes) * 100,
        });
      }
      await new Promise((resolve) => setImmediate(resolve));
    }

    return this.upload({
      bucket: options.destBucket,
      path: options.destPath,
      body: sourceContent,
      storageClass: options.storageClass,
      metadata: options.metadata,
    });
  }

  async streamDownload(
    options: StreamTransferOptions,
    progressCallback?: (progress: StreamTransferProgress) => void
  ): Promise<DownloadResult> {
    const sourceFile = this.findFileByPath(options.sourceBucket, options.sourcePath);
    if (!sourceFile) {
      throw new Error(`Source file not found: ${options.sourcePath}`);
    }

    const content = this.fileContents.get(`${options.sourceBucket}:${options.sourcePath}`);
    if (!content) {
      throw new Error(`Source file content not found: ${options.sourcePath}`);
    }

    const totalBytes = content.length;
    const chunkSize = options.chunkSize ?? 1024 * 1024;
    let bytesTransferred = 0;

    for (let i = 0; i < totalBytes; i += chunkSize) {
      bytesTransferred = Math.min(i + chunkSize, totalBytes);
      if (progressCallback) {
        progressCallback({
          bytesTransferred,
          totalBytes,
          percentage: (bytesTransferred / totalBytes) * 100,
        });
      }
      await new Promise((resolve) => setImmediate(resolve));
    }

    return {
      body: content,
      metadata: sourceFile,
      etag: sourceFile.etag,
    };
  }

  async getStorageAnalytics(bucket: string): Promise<StorageAnalytics> {
    const bucketMeta = await this.getBucket(bucket);
    if (!bucketMeta) {
      throw new Error(`Bucket not found: ${bucket}`);
    }

    const files = Array.from(this.files.values()).filter((f) => f.bucket === bucket);
    const storageByClass: Record<StorageClass, number> = {
      standard: 0,
      infrequent: 0,
      archive: 0,
    };

    let totalSize = 0;
    for (const file of files) {
      totalSize += file.size;
      storageByClass[file.storageClass] += file.size;
    }

    const accessPatterns: AccessPatternStats = {
      uploads: 0,
      downloads: 0,
      lists: 0,
      totalBytesUploaded: 0,
      totalBytesDownloaded: 0,
    };

    return {
      bucketId: bucketMeta.id,
      totalSizeBytes: totalSize,
      fileCount: files.length,
      averageFileSizeBytes: files.length > 0 ? totalSize / files.length : 0,
      storageByClass,
      accessPatterns,
      lastUpdated: new Date(),
    };
  }

  async getStorageQuota(bucket: string): Promise<StorageQuota> {
    let quota = this.quotas.get(bucket);
    if (!quota) {
      const bucketMeta = await this.getBucket(bucket);
      quota = {
        bucketId: bucketMeta?.id ?? bucket,
        maxSizeBytes: 1024 * 1024 * 1024 * 100,
        usedSizeBytes: bucketMeta?.sizeBytes ?? 0,
        maxFileCount: 1000000,
        usedFileCount: bucketMeta?.fileCount ?? 0,
        warnThreshold: 0.8,
        limitThreshold: 0.95,
      };
      this.quotas.set(bucket, quota);
    }
    return quota;
  }

  async setBucketQuota(
    bucket: string,
    quota: Omit<StorageQuota, 'bucketId' | 'usedSizeBytes' | 'usedFileCount'>
  ): Promise<StorageQuota> {
    const existing = await this.getStorageQuota(bucket);
    const updated: StorageQuota = {
      ...existing,
      maxSizeBytes: quota.maxSizeBytes,
      maxFileCount: quota.maxFileCount,
      warnThreshold: quota.warnThreshold,
      limitThreshold: quota.limitThreshold,
    };
    this.quotas.set(bucket, updated);
    return updated;
  }

  private findFileByPath(bucket: string, path: string): CloudFileMetadata | undefined {
    return Array.from(this.files.values()).find((f) => f.bucket === bucket && f.path === path);
  }

  private async readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}

export function createStorageProvider(type: StorageProviderType): IStorageProvider {
  switch (type) {
    case 'local':
      return new LocalStorageProvider();
    case 's3':
      return new S3StorageProvider();
    case 'google_cloud':
      return new GoogleCloudStorageProvider();
    case 'azure':
      return new AzureBlobStorageProvider();
    default:
      throw new Error(`Unsupported storage provider type: ${type}`);
  }
}

export function createCloudStorage(initialConfig: Partial<CloudStorageConfig> = {}) {
  const buckets = new Map<string, BucketMetadata>();
  const providers = new Map<StorageProviderType, IStorageProvider>();

  providers.set('local', new LocalStorageProvider());
  providers.set('s3', new S3StorageProvider());
  providers.set('google_cloud', new GoogleCloudStorageProvider());
  providers.set('azure', new AzureBlobStorageProvider());

  const storageConfig: CloudStorageConfig = {
    defaultProvider: initialConfig.defaultProvider ?? 'local',
    defaultRegion: initialConfig.defaultRegion ?? 'us-east-1',
    defaultStorageClass: initialConfig.defaultStorageClass ?? 'standard',
    defaultAccessType: initialConfig.defaultAccessType ?? 'private',
    buckets,
    providers,
    localStoragePath: initialConfig.localStoragePath,
    preSignedUrlDefaultExpiry: initialConfig.preSignedUrlDefaultExpiry ?? 3600,
    accessTokenDefaultExpiry: initialConfig.accessTokenDefaultExpiry ?? 86400,
  };

  const getProvider = (type?: StorageProviderType): IStorageProvider => {
    const providerType = type ?? storageConfig.defaultProvider;
    const provider = providers.get(providerType);
    if (!provider) {
      throw new Error(`Provider not found for type: ${providerType}`);
    }
    return provider;
  };

  const addProvider = (type: StorageProviderType, provider: IStorageProvider): void => {
    providers.set(type, provider);
  };

  const upload = async (options: UploadOptions): Promise<UploadResult> => {
    const provider = getProvider(options.bucket ? undefined : storageConfig.defaultProvider);
    return provider.upload(options);
  };

  const download = async (options: DownloadOptions): Promise<DownloadResult> => {
    const provider = getProvider();
    return provider.download(options);
  };

  const copy = async (options: CopyOptions): Promise<CopyResult> => {
    const provider = getProvider();
    return provider.copy(options);
  };

  const move = async (options: MoveOptions): Promise<CopyResult> => {
    const provider = getProvider();
    return provider.move(options);
  };

  const _delete = async (options: DeleteOptions): Promise<DeleteResult> => {
    const provider = getProvider();
    return provider.delete(options);
  };

  const list = async (options: ListOptions): Promise<ListResult> => {
    const provider = getProvider();
    return provider.list(options);
  };

  const createBucket = async (options: BucketCreateOptions): Promise<BucketMetadata> => {
    const provider = providers.get(options.provider);
    if (!provider) {
      throw new Error(`Provider not found for type: ${options.provider}`);
    }
    const bucket = await provider.getOrCreateBucket(options.name, options.region, options.configuration);
    storageConfig.buckets.set(bucket.name, bucket);
    return bucket;
  };

  const updateBucket = async (options: BucketUpdateOptions): Promise<BucketMetadata> => {
    const bucket = storageConfig.buckets.get(options.bucketId);
    if (!bucket) {
      throw new Error(`Bucket not found: ${options.bucketId}`);
    }
    if (options.storageClass) {
      bucket.storageClass = options.storageClass;
    }
    if (options.configuration) {
      bucket.configuration = { ...bucket.configuration, ...options.configuration };
    }
    return bucket;
  };

  const getBucket = async (name: string): Promise<BucketMetadata | null> => {
    return storageConfig.buckets.get(name) ?? null;
  };

  const listBuckets = async (): Promise<BucketMetadata[]> => {
    return Array.from(storageConfig.buckets.values());
  };

  const getSignedUrl = async (options: PreSignedUrlOptions): Promise<string> => {
    const provider = getProvider();
    return provider.getSignedUrl(options);
  };

  const getAccessToken = async (options: AccessTokenOptions): Promise<AccessToken> => {
    const provider = getProvider();
    return provider.getAccessToken(options);
  };

  const streamUpload = async (
    options: StreamTransferOptions,
    progressCallback?: (progress: StreamTransferProgress) => void
  ): Promise<UploadResult> => {
    const provider = getProvider();
    return provider.streamUpload(options, progressCallback);
  };

  const streamDownload = async (
    options: StreamTransferOptions,
    progressCallback?: (progress: StreamTransferProgress) => void
  ): Promise<DownloadResult> => {
    const provider = getProvider();
    return provider.streamDownload(options, progressCallback);
  };

  const getStorageAnalytics = async (bucket: string): Promise<StorageAnalytics> => {
    const provider = getProvider();
    return provider.getStorageAnalytics(bucket);
  };

  const getStorageQuota = async (bucket: string): Promise<StorageQuota> => {
    const provider = getProvider();
    return provider.getStorageQuota(bucket);
  };

  const setBucketQuota = async (
    bucket: string,
    quota: Omit<StorageQuota, 'bucketId' | 'usedSizeBytes' | 'usedFileCount'>
  ): Promise<StorageQuota> => {
    const provider = getProvider();
    return provider.setBucketQuota(bucket, quota);
  };

  return {
    config: storageConfig,
    addProvider,
    getProvider,
    upload,
    download,
    copy,
    move,
    delete: _delete,
    list,
    createBucket,
    updateBucket,
    getBucket,
    listBuckets,
    getSignedUrl,
    getAccessToken,
    streamUpload,
    streamDownload,
    getStorageAnalytics,
    getStorageQuota,
    setBucketQuota,
  };
}
