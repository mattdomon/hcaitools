import crypto from 'crypto';

export type StorageProviderType = 's3' | 'google_cloud' | 'azure' | 'local';

export type StorageClass = 'standard' | 'infrequent' | 'archive';

export type AccessType = 'public' | 'private' | 'authenticated';

export type FileOperation = 'upload' | 'download' | 'copy' | 'move' | 'delete' | 'list';

export interface CloudFileMetadata {
  id: string;
  name: string;
  path: string;
  bucket: string;
  size: number;
  mimeType: string;
  etag: string;
  storageClass: StorageClass;
  accessType: AccessType;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  metadata: Record<string, string>;
  versionId: string | null;
}

export interface CloudFolderMetadata {
  id: string;
  name: string;
  path: string;
  bucket: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, string>;
}

export interface BucketMetadata {
  id: string;
  name: string;
  provider: StorageProviderType;
  region: string;
  createdAt: Date;
  storageClass: StorageClass;
  sizeBytes: number;
  fileCount: number;
  isDefault: boolean;
  configuration: BucketConfiguration;
}

export interface BucketConfiguration {
  versioning: boolean;
  encryption: EncryptionType;
  publicAccessBlock: boolean;
  corsEnabled: boolean;
  lifecycleRules: LifecycleRule[];
}

export type EncryptionType = 'none' | 'aes256' | 'google_kms' | 'azure_key_vault';

export interface LifecycleRule {
  id: string;
  prefix: string;
  storageClass: StorageClass;
  daysAfterCreation: number;
  enabled: boolean;
}

export interface StorageAnalytics {
  bucketId: string;
  totalSizeBytes: number;
  fileCount: number;
  averageFileSizeBytes: number;
  storageByClass: Record<StorageClass, number>;
  accessPatterns: AccessPatternStats;
  lastUpdated: Date;
}

export interface AccessPatternStats {
  uploads: number;
  downloads: number;
  lists: number;
  totalBytesUploaded: number;
  totalBytesDownloaded: number;
}

export interface StorageQuota {
  bucketId: string;
  maxSizeBytes: number;
  usedSizeBytes: number;
  maxFileCount: number;
  usedFileCount: number;
  warnThreshold: number;
  limitThreshold: number;
}

export interface PreSignedUrlOptions {
  bucket: string;
  path: string;
  accessType: AccessType;
  expiresIn: number;
  contentType?: string;
  responseContentDisposition?: string;
}

export interface UploadOptions {
  bucket: string;
  path: string;
  body: Buffer | NodeJS.ReadableStream;
  mimeType?: string;
  storageClass?: StorageClass;
  accessType?: AccessType;
  metadata?: Record<string, string>;
  cacheControl?: string;
  contentEncoding?: string;
  tags?: Record<string, string>;
}

export interface UploadResult {
  file: CloudFileMetadata;
  etag: string;
  versionId: string | null;
}

export interface DownloadOptions {
  bucket: string;
  path: string;
  versionId?: string;
  ifMatch?: string;
  ifModifiedSince?: Date;
  ifNoneMatch?: string;
  ifUnmodifiedSince?: Date;
}

export interface DownloadResult {
  body: Buffer;
  metadata: CloudFileMetadata;
  etag: string;
}

export interface CopyOptions {
  sourceBucket: string;
  sourcePath: string;
  destBucket: string;
  destPath: string;
  metadata?: Record<string, string>;
  storageClass?: StorageClass;
}

export interface CopyResult {
  file: CloudFileMetadata;
  etag: string;
  versionId: string | null;
}

export interface MoveOptions {
  sourceBucket: string;
  sourcePath: string;
  destBucket: string;
  destPath: string;
  metadata?: Record<string, string>;
  storageClass?: StorageClass;
}

export interface DeleteOptions {
  bucket: string;
  path: string;
  versionId?: string;
}

export interface DeleteResult {
  deleted: boolean;
  path: string;
}

export interface ListOptions {
  bucket: string;
  prefix?: string;
  delimiter?: string;
  maxKeys?: number;
  marker?: string;
  includeMetadata?: boolean;
}

export interface ListResult {
  files: CloudFileMetadata[];
  folders: CloudFolderMetadata[];
  prefix: string | null;
  isTruncated: boolean;
  nextMarker: string | null;
  totalCount: number;
}

export interface StreamTransferOptions {
  sourceBucket: string;
  sourcePath: string;
  destBucket: string;
  destPath: string;
  chunkSize?: number;
  metadata?: Record<string, string>;
  storageClass?: StorageClass;
}

export interface StreamTransferProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

export interface BucketCreateOptions {
  name: string;
  provider: StorageProviderType;
  region: string;
  storageClass?: StorageClass;
  configuration?: Partial<BucketConfiguration>;
}

export interface BucketUpdateOptions {
  bucketId: string;
  storageClass?: StorageClass;
  configuration?: Partial<BucketConfiguration>;
}

export interface AccessTokenOptions {
  bucket: string;
  path: string;
  accessTypes: AccessType[];
  expiresIn: number;
  userId?: string;
  metadata?: Record<string, string>;
}

export interface AccessToken {
  token: string;
  expiresAt: Date;
  bucket: string;
  path: string;
  accessTypes: AccessType[];
  userId: string | null;
}

export interface IStorageProvider {
  readonly type: StorageProviderType;

  upload(options: UploadOptions): Promise<UploadResult>;
  download(options: DownloadOptions): Promise<DownloadResult>;
  copy(options: CopyOptions): Promise<CopyResult>;
  move(options: MoveOptions): Promise<CopyResult>;
  delete(options: DeleteOptions): Promise<DeleteResult>;
  list(options: ListOptions): Promise<ListResult>;
  getOrCreateBucket(name: string, region: string, _config?: Partial<BucketConfiguration>): Promise<BucketMetadata>;
  getBucket(name: string): Promise<BucketMetadata | null>;
  listBuckets(): Promise<BucketMetadata[]>;
  getSignedUrl(options: PreSignedUrlOptions): Promise<string>;
  getAccessToken(options: AccessTokenOptions): Promise<AccessToken>;
  streamUpload(options: StreamTransferOptions, progressCallback?: (progress: StreamTransferProgress) => void): Promise<UploadResult>;
  streamDownload(options: StreamTransferOptions, progressCallback?: (progress: StreamTransferProgress) => void): Promise<DownloadResult>;
  getStorageAnalytics(bucket: string): Promise<StorageAnalytics>;
  getStorageQuota(bucket: string): Promise<StorageQuota>;
  setBucketQuota(bucket: string, quota: Omit<StorageQuota, 'bucketId' | 'usedSizeBytes' | 'usedFileCount'>): Promise<StorageQuota>;
}

export interface CloudStorageConfig {
  defaultProvider: StorageProviderType;
  defaultRegion: string;
  defaultStorageClass: StorageClass;
  defaultAccessType: AccessType;
  buckets: Map<string, BucketMetadata>;
  providers: Map<StorageProviderType, IStorageProvider>;
  localStoragePath?: string;
  preSignedUrlDefaultExpiry: number;
  accessTokenDefaultExpiry: number;
}

export function generateFileId(): string {
  return `cloud_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateFolderId(): string {
  return `cloudfolder_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateBucketId(): string {
  return `bucket_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateVersionId(): string {
  return `version_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateETag(): string {
  return `"${crypto.randomBytes(16).toString('hex')}"`;
}

export function generateAccessToken(): string {
  return `token_${crypto.randomBytes(32).toString('hex')}`;
}

export function generatePreSignedUrl(): string {
  return `https://storage.cloud.example.com/${crypto.randomBytes(16).toString('base64url')}`;
}

export function buildCloudPath(bucket: string, ...parts: string[]): string {
  return `/${bucket}/${parts.join('/')}`;
}

export function parseCloudPath(cloudPath: string): { bucket: string; path: string } | null {
  const match = cloudPath.match(/^\/([^\/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], path: match[2] };
}

export function isSupportedMimeType(mimeType: string): boolean {
  const supported = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'text/plain', 'text/html', 'text/css', 'text/javascript',
    'application/json', 'application/xml', 'application/zip', 'application/x-tar',
    'audio/mpeg', 'audio/wav', 'video/mp4', 'video/webm', 'application/octet-stream'
  ];
  return supported.includes(mimeType);
}

export function calculateStorageCost(sizeBytes: number, storageClass: StorageClass): number {
  const rates: Record<StorageClass, number> = {
    standard: 0.023,
    infrequent: 0.0125,
    archive: 0.0045
  };
  return (sizeBytes / (1024 * 1024 * 1024)) * rates[storageClass];
}

function isValidStorageProviderType(type: string): type is StorageProviderType {
  return ['s3', 'google_cloud', 'azure', 'local'].includes(type);
}

function isValidStorageClass(classification: string): classification is StorageClass {
  return ['standard', 'infrequent', 'archive'].includes(classification);
}

function isValidAccessType(type: string): type is AccessType {
  return ['public', 'private', 'authenticated'].includes(type);
}

export function isCloudFileMetadata(obj: unknown): obj is CloudFileMetadata {
  if (typeof obj !== 'object' || obj === null) return false;
  const file = obj as Record<string, unknown>;
  return (
    typeof file.id === 'string' &&
    typeof file.name === 'string' &&
    typeof file.path === 'string' &&
    typeof file.bucket === 'string' &&
    typeof file.size === 'number' &&
    typeof file.mimeType === 'string' &&
    typeof file.etag === 'string' &&
    isValidStorageClass(file.storageClass as string) &&
    isValidAccessType(file.accessType as string)
  );
}

export function isCloudFolderMetadata(obj: unknown): obj is CloudFolderMetadata {
  if (typeof obj !== 'object' || obj === null) return false;
  const folder = obj as Record<string, unknown>;
  return (
    typeof folder.id === 'string' &&
    typeof folder.name === 'string' &&
    typeof folder.path === 'string' &&
    typeof folder.bucket === 'string' &&
    (folder.parentId === null || typeof folder.parentId === 'string')
  );
}

export function isBucketMetadata(obj: unknown): obj is BucketMetadata {
  if (typeof obj !== 'object' || obj === null) return false;
  const bucket = obj as Record<string, unknown>;
  return (
    typeof bucket.id === 'string' &&
    typeof bucket.name === 'string' &&
    isValidStorageProviderType(bucket.provider as string) &&
    typeof bucket.region === 'string' &&
    typeof bucket.sizeBytes === 'number' &&
    typeof bucket.fileCount === 'number'
  );
}

export function isStorageAnalytics(obj: unknown): obj is StorageAnalytics {
  if (typeof obj !== 'object' || obj === null) return false;
  const analytics = obj as Record<string, unknown>;
  return (
    typeof analytics.bucketId === 'string' &&
    typeof analytics.totalSizeBytes === 'number' &&
    typeof analytics.fileCount === 'number'
  );
}

export function isStorageQuota(obj: unknown): obj is StorageQuota {
  if (typeof obj !== 'object' || obj === null) return false;
  const quota = obj as Record<string, unknown>;
  return (
    typeof quota.bucketId === 'string' &&
    typeof quota.maxSizeBytes === 'number' &&
    typeof quota.maxFileCount === 'number' &&
    typeof quota.usedFileCount === 'number'
  );
}
