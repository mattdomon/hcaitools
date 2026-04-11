import crypto from 'crypto';

export type FilePermission = 'read' | 'write' | 'delete';

export type StorageProviderType = 'local' | 's3' | 'azure' | 'gcs';

export type MimeType = 
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'image/svg+xml'
  | 'application/pdf'
  | 'text/plain'
  | 'text/html'
  | 'text/css'
  | 'text/javascript'
  | 'application/json'
  | 'application/xml'
  | 'application/zip'
  | 'application/x-tar'
  | 'audio/mpeg'
  | 'audio/wav'
  | 'video/mp4'
  | 'video/webm';

export interface FileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  checksum: string;
  version: number;
}

export interface FileVersion {
  id: string;
  fileId: string;
  version: number;
  size: number;
  checksum: string;
  createdAt: Date;
  createdBy: string;
  storagePath: string;
}

export interface Thumbnail {
  id: string;
  fileId: string;
  width: number;
  height: number;
  format: 'jpeg' | 'png' | 'webp';
  storagePath: string;
  createdAt: Date;
}

export interface FileACL {
  fileId: string;
  entries: ACLEntry[];
}

export interface ACLEntry {
  principalId: string;
  principalType: 'user' | 'group' | 'role';
  permissions: FilePermission[];
  grantedAt: Date;
  grantedBy: string;
}

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  metadata: Record<string, unknown>;
}

export interface FolderTree extends FolderNode {
  children: FolderTree[];
}

export interface StorageProvider {
  type: StorageProviderType;
  upload(file: Buffer, path: string, metadata?: Record<string, unknown>): Promise<void>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  getSignedUrl(path: string, expiresIn: number): Promise<string>;
  list(prefix: string): Promise<StorageObject[]>;
}

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
}

export interface UploadOptions {
  filename: string;
  mimeType: string;
  size: number;
  folderId?: string;
  metadata?: Record<string, unknown>;
  acl?: ACLEntry[];
}

export interface UploadResult {
  file: FileMetadata;
  folder: FolderNode | null;
}

export interface DownloadOptions {
  fileId: string;
  version?: number;
  responseType?: 'buffer' | 'stream';
}

export interface DownloadResult {
  buffer?: Buffer;
  stream?: NodeJS.ReadableStream;
  metadata: FileMetadata;
  filename: string;
}

export interface FileQueryOptions {
  folderId?: string | null;
  search?: string;
  mimeTypes?: string[];
  createdBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'size';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface FileQueryResult {
  files: FileMetadata[];
  total: number;
  hasMore: boolean;
}

export interface PreviewOptions {
  width?: number;
  height?: number;
  format?: 'jpeg' | 'png' | 'webp';
  quality?: number;
}

export interface PreviewResult {
  thumbnail: Thumbnail;
  url: string;
}

export interface FileManagerConfig {
  storageProvider: StorageProvider;
  maxFileSize: number;
  allowedMimeTypes?: string[];
  thumbnailConfig?: {
    maxWidth: number;
    maxHeight: number;
    defaultFormat: 'jpeg' | 'png' | 'webp';
    quality: number;
  };
  versioningEnabled: boolean;
  maxVersionsPerFile: number;
  tempDirectory?: string;
}

export interface IFileManager {
  upload(buffer: Buffer, options: UploadOptions, _notification?: unknown): Promise<UploadResult>;
  download(options: DownloadOptions): Promise<DownloadResult>;
  delete(fileId: string, userId: string): Promise<void>;
  getFile(fileId: string): Promise<FileMetadata | null>;
  getFileVersions(fileId: string): Promise<FileVersion[]>;
  restoreVersion(fileId: string, version: number, userId: string): Promise<FileMetadata>;
  listFiles(options: FileQueryOptions): Promise<FileQueryResult>;
  createFolder(name: string, parentId: string | null, userId: string): Promise<FolderNode>;
  getFolder(folderId: string): Promise<FolderNode | null>;
  getFolderTree(folderId: string | null): Promise<FolderTree>;
  deleteFolder(folderId: string, userId: string): Promise<void>;
  moveFolder(folderId: string, newParentId: string | null, userId: string): Promise<FolderNode>;
  moveFile(fileId: string, newFolderId: string | null, userId: string): Promise<FileMetadata>;
  checkPermission(fileId: string, userId: string, permission: FilePermission): Promise<boolean>;
  setPermissions(fileId: string, entries: ACLEntry[], userId: string): Promise<FileACL>;
  getPermissions(fileId: string): Promise<FileACL>;
  generatePreview(fileId: string, options?: PreviewOptions): Promise<PreviewResult>;
  getPreview(fileId: string, thumbnailId?: string): Promise<string>;
}

export interface FileStorage {
  files: Map<string, FileMetadata>;
  folders: Map<string, FolderNode>;
  versions: Map<string, FileVersion[]>;
  thumbnails: Map<string, Thumbnail[]>;
  acls: Map<string, FileACL>;
}

export function isValidMimeType(mimeType: string): mimeType is string {
  const validTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'text/plain', 'text/html', 'text/css', 'text/javascript',
    'application/json', 'application/xml', 'application/zip', 'application/x-tar',
    'audio/mpeg', 'audio/wav', 'video/mp4', 'video/webm'
  ];
  return validTypes.includes(mimeType);
}

export function isPreviewable(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
}

export function generateFileId(): string {
  return `file_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateFolderId(): string {
  return `folder_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateVersionId(): string {
  return `ver_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateThumbnailId(): string {
  return `thumb_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function buildFolderPath(folders: Map<string, FolderNode>, folderId: string | null): string {
  if (folderId === null) return '/';
  
  const folder = folders.get(folderId);
  if (!folder) return '/';
  
  const parts: string[] = [folder.name];
  let currentParentId = folder.parentId;
  
  while (currentParentId !== null) {
    const parent = folders.get(currentParentId);
    if (!parent) break;
    parts.unshift(parent.name);
    currentParentId = parent.parentId;
  }
  
  return '/' + parts.join('/');
}
