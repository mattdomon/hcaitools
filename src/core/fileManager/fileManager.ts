import crypto from 'crypto';
import {
  FileManagerConfig,
  FileMetadata,
  FileVersion,
  Thumbnail,
  FolderNode,
  FolderTree,
  StorageProvider,
  UploadOptions,
  UploadResult,
  DownloadOptions,
  DownloadResult,
  FileQueryOptions,
  FileQueryResult,
  PreviewOptions,
  PreviewResult,
  FileACL,
  ACLEntry,
  FilePermission,
  IFileManager,
  FileStorage,
  isValidMimeType,
  isPreviewable,
  generateFileId,
  generateFolderId,
  generateVersionId,
  generateThumbnailId,
  generateChecksum,
  buildFolderPath,
} from './types';

export class FileManager implements IFileManager {
  private config: FileManagerConfig;
  private storage: FileStorage;

  constructor(config: FileManagerConfig) {
    this.config = config;
    this.storage = {
      files: new Map(),
      folders: new Map(),
      versions: new Map(),
      thumbnails: new Map(),
      acls: new Map(),
    };
  }

  async upload(buffer: Buffer, options: UploadOptions, _notification?: unknown): Promise<UploadResult> {
    if (buffer.length > this.config.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`);
    }

    if (this.config.allowedMimeTypes && !this.config.allowedMimeTypes.includes(options.mimeType)) {
      throw new Error(`MIME type ${options.mimeType} is not allowed`);
    }

    if (!isValidMimeType(options.mimeType)) {
      throw new Error(`Invalid MIME type: ${options.mimeType}`);
    }

    const folder = options.folderId ? await this.getFolder(options.folderId) : null;
    const folderPath = folder ? buildFolderPath(this.storage.folders, folder.id) : '';
    const fileId = generateFileId();
    const checksum = generateChecksum(buffer);
    const storagePath = folderPath ? `${folderPath}/${fileId}_${options.filename}` : `/${fileId}_${options.filename}`;

    const fileMetadata: FileMetadata = {
      id: fileId,
      name: options.filename,
      mimeType: options.mimeType,
      size: buffer.length,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      checksum,
      version: 1,
    };

    await this.config.storageProvider.upload(buffer, storagePath, {
      mimeType: options.mimeType,
      fileId,
      ...options.metadata,
    });

    this.storage.files.set(fileId, fileMetadata);

    if (this.config.versioningEnabled) {
      const version: FileVersion = {
        id: generateVersionId(),
        fileId,
        version: 1,
        size: buffer.length,
        checksum,
        createdAt: new Date(),
        createdBy: 'system',
        storagePath,
      };
      this.storage.versions.set(fileId, [version]);
    }

    if (options.acl && options.acl.length > 0) {
      const acl: FileACL = {
        fileId,
        entries: options.acl,
      };
      this.storage.acls.set(fileId, acl);
    }

    return {
      file: fileMetadata,
      folder,
    };
  }

  async download(options: DownloadOptions): Promise<DownloadResult> {
    const file = await this.getFile(options.fileId);
    if (!file) {
      throw new Error(`File not found: ${options.fileId}`);
    }

    let storagePath: string;

    if (options.version !== undefined) {
      const versions = await this.getFileVersions(options.fileId);
      const targetVersion = versions.find(v => v.version === options.version);
      if (!targetVersion) {
        throw new Error(`Version ${options.version} not found for file ${options.fileId}`);
      }
      storagePath = targetVersion.storagePath;
    } else {
      storagePath = `/${file.id}_${file.name}`;
    }

    const buffer = await this.config.storageProvider.download(storagePath);

    return {
      buffer,
      metadata: file,
      filename: file.name,
    };
  }

  async delete(fileId: string, userId: string): Promise<void> {
    const file = await this.getFile(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    const hasPermission = await this.checkPermission(fileId, userId, 'delete');
    if (!hasPermission) {
      throw new Error(`User ${userId} does not have delete permission for file ${fileId}`);
    }

    const storagePath = `/${file.id}_${file.name}`;
    await this.config.storageProvider.delete(storagePath);

    const versions = this.storage.versions.get(fileId);
    if (versions) {
      for (const version of versions) {
        try {
          await this.config.storageProvider.delete(version.storagePath);
        } catch {
        }
      }
      this.storage.versions.delete(fileId);
    }

    const thumbnails = this.storage.thumbnails.get(fileId);
    if (thumbnails) {
      for (const thumbnail of thumbnails) {
        try {
          await this.config.storageProvider.delete(thumbnail.storagePath);
        } catch {
        }
      }
      this.storage.thumbnails.delete(fileId);
    }

    this.storage.acls.delete(fileId);
    this.storage.files.delete(fileId);
  }

  async getFile(fileId: string): Promise<FileMetadata | null> {
    return this.storage.files.get(fileId) || null;
  }

  async getFileVersions(fileId: string): Promise<FileVersion[]> {
    return this.storage.versions.get(fileId) || [];
  }

  async restoreVersion(fileId: string, version: number, userId: string): Promise<FileMetadata> {
    const file = await this.getFile(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    const hasPermission = await this.checkPermission(fileId, userId, 'write');
    if (!hasPermission) {
      throw new Error(`User ${userId} does not have write permission for file ${fileId}`);
    }

    const versions = await this.getFileVersions(fileId);
    const targetVersion = versions.find(v => v.version === version);
    if (!targetVersion) {
      throw new Error(`Version ${version} not found for file ${fileId}`);
    }

    const buffer = await this.config.storageProvider.download(targetVersion.storagePath);
    const newVersion = file.version + 1;
    const checksum = generateChecksum(buffer);
    const newStoragePath = targetVersion.storagePath.replace(`/v${version}_`, `/v${newVersion}_`);

    await this.config.storageProvider.upload(buffer, newStoragePath);

    const updatedFile: FileMetadata = {
      ...file,
      version: newVersion,
      checksum,
      updatedAt: new Date(),
    };

    this.storage.files.set(fileId, updatedFile);

    const versionEntry: FileVersion = {
      id: generateVersionId(),
      fileId,
      version: newVersion,
      size: buffer.length,
      checksum,
      createdAt: new Date(),
      createdBy: userId,
      storagePath: newStoragePath,
    };

    const allVersions = this.storage.versions.get(fileId) || [];
    allVersions.push(versionEntry);

    if (allVersions.length > this.config.maxVersionsPerFile) {
      const removed = allVersions.shift();
      if (removed) {
        try {
          await this.config.storageProvider.delete(removed.storagePath);
        } catch {
        }
      }
    }

    this.storage.versions.set(fileId, allVersions);

    return updatedFile;
  }

  async listFiles(options: FileQueryOptions): Promise<FileQueryResult> {
    let files = Array.from(this.storage.files.values());

    if (options.folderId !== undefined) {
      files = files.filter(_file => {
        const folder = this.storage.folders.get(options.folderId || '');
        if (!folder && options.folderId === null) return true;
        if (!folder) return false;
        return true;
      });
    }

    if (options.search) {
      const searchLower = options.search.toLowerCase();
      files = files.filter(file => file.name.toLowerCase().includes(searchLower));
    }

    if (options.mimeTypes && options.mimeTypes.length > 0) {
      files = files.filter(file => options.mimeTypes!.includes(file.mimeType));
    }

    if (options.createdBy) {
      files = files.filter(file => file.createdBy === options.createdBy);
    }

    if (options.createdAfter) {
      files = files.filter(file => file.createdAt >= options.createdAfter!);
    }

    if (options.createdBefore) {
      files = files.filter(file => file.createdAt <= options.createdBefore!);
    }

    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';

    files.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'updatedAt':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    const total = files.length;
    const offset = options.offset || 0;
    const limit = options.limit || total;

    const paginatedFiles = files.slice(offset, offset + limit);

    return {
      files: paginatedFiles,
      total,
      hasMore: offset + limit < total,
    };
  }

  async createFolder(name: string, parentId: string | null, userId: string): Promise<FolderNode> {
    if (parentId !== null) {
      const parent = await this.getFolder(parentId);
      if (!parent) {
        throw new Error(`Parent folder not found: ${parentId}`);
      }
    }

    const folderId = generateFolderId();
    const path = parentId ? `${buildFolderPath(this.storage.folders, parentId)}/${name}` : `/${name}`;

    const folder: FolderNode = {
      id: folderId,
      name,
      parentId,
      path,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      metadata: {},
    };

    this.storage.folders.set(folderId, folder);

    return folder;
  }

  async getFolder(folderId: string): Promise<FolderNode | null> {
    return this.storage.folders.get(folderId) || null;
  }

  async getFolderTree(folderId: string | null): Promise<FolderTree> {
    if (folderId === null) {
      const rootFolders = Array.from(this.storage.folders.values()).filter(f => f.parentId === null);
      return {
        id: 'root',
        name: '/',
        parentId: null,
        path: '/',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        metadata: {},
        children: await Promise.all(rootFolders.map(f => this.getFolderTree(f.id))),
      };
    }

    const folder = this.storage.folders.get(folderId);
    if (!folder) {
      throw new Error(`Folder not found: ${folderId}`);
    }

    const childFolders = Array.from(this.storage.folders.values()).filter(f => f.parentId === folderId);

    return {
      ...folder,
      children: await Promise.all(childFolders.map(f => this.getFolderTree(f.id))),
    };
  }

  async deleteFolder(folderId: string, _userId: string): Promise<void> {
    const folder = await this.getFolder(folderId);
    if (!folder) {
      throw new Error(`Folder not found: ${folderId}`);
    }

    const childFolders = Array.from(this.storage.folders.values()).filter(f => f.parentId === folderId);
    if (childFolders.length > 0) {
      throw new Error(`Cannot delete folder ${folderId}: folder is not empty`);
    }

    this.storage.folders.delete(folderId);
  }

  async moveFolder(folderId: string, newParentId: string | null, _userId: string): Promise<FolderNode> {
    const folder = await this.getFolder(folderId);
    if (!folder) {
      throw new Error(`Folder not found: ${folderId}`);
    }

    if (newParentId !== null) {
      const newParent = await this.getFolder(newParentId);
      if (!newParent) {
        throw new Error(`New parent folder not found: ${newParentId}`);
      }

      let ancestorId: string | null = newParentId;
      while (ancestorId !== null) {
        if (ancestorId === folderId) {
          throw new Error(`Cannot move folder ${folderId} into its own descendant`);
        }
        const ancestor = this.storage.folders.get(ancestorId);
        ancestorId = ancestor?.parentId || null;
      }
    }

    const updatedFolder: FolderNode = {
      ...folder,
      parentId: newParentId,
      path: buildFolderPath(this.storage.folders, newParentId) + '/' + folder.name,
      updatedAt: new Date(),
    };

    this.storage.folders.set(folderId, updatedFolder);

    return updatedFolder;
  }

  async moveFile(fileId: string, newFolderId: string | null, userId: string): Promise<FileMetadata> {
    const file = await this.getFile(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    const hasPermission = await this.checkPermission(fileId, userId, 'write');
    if (!hasPermission) {
      throw new Error(`User ${userId} does not have write permission for file ${fileId}`);
    }

    const updatedFile: FileMetadata = {
      ...file,
      updatedAt: new Date(),
    };

    this.storage.files.set(fileId, updatedFile);

    return updatedFile;
  }

  async checkPermission(fileId: string, userId: string, permission: FilePermission): Promise<boolean> {
    const acl = this.storage.acls.get(fileId);
    if (!acl) {
      return true;
    }

    const entry = acl.entries.find(e => e.principalId === userId);
    if (!entry) {
      return false;
    }

    return entry.permissions.includes(permission);
  }

  async setPermissions(fileId: string, entries: ACLEntry[], userId: string): Promise<FileACL> {
    const file = await this.getFile(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    const now = new Date();
    const aclEntries: ACLEntry[] = entries.map(entry => ({
      ...entry,
      grantedAt: now,
      grantedBy: userId,
    }));

    const acl: FileACL = {
      fileId,
      entries: aclEntries,
    };

    this.storage.acls.set(fileId, acl);

    return acl;
  }

  async getPermissions(fileId: string): Promise<FileACL> {
    const acl = this.storage.acls.get(fileId);
    if (!acl) {
      return {
        fileId,
        entries: [],
      };
    }
    return acl;
  }

  async generatePreview(fileId: string, options?: PreviewOptions): Promise<PreviewResult> {
    const file = await this.getFile(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    if (!isPreviewable(file.mimeType)) {
      throw new Error(`File ${fileId} is not previewable`);
    }

    const width = options?.width || this.config.thumbnailConfig?.maxWidth || 200;
    const height = options?.height || this.config.thumbnailConfig?.maxHeight || 200;
    const format = options?.format || this.config.thumbnailConfig?.defaultFormat || 'jpeg';

    const thumbnailId = generateThumbnailId();
    const thumbnail: Thumbnail = {
      id: thumbnailId,
      fileId,
      width,
      height,
      format,
      storagePath: `/thumbnails/${fileId}_${thumbnailId}.${format}`,
      createdAt: new Date(),
    };

    const thumbnails = this.storage.thumbnails.get(fileId) || [];
    thumbnails.push(thumbnail);
    this.storage.thumbnails.set(fileId, thumbnails);

    const url = await this.config.storageProvider.getSignedUrl(thumbnail.storagePath, 3600);

    return {
      thumbnail,
      url,
    };
  }

  async getPreview(fileId: string, thumbnailId?: string): Promise<string> {
    const thumbnails = this.storage.thumbnails.get(fileId);
    if (!thumbnails || thumbnails.length === 0) {
      throw new Error(`No thumbnails found for file ${fileId}`);
    }

    const thumbnail = thumbnailId
      ? thumbnails.find(t => t.id === thumbnailId)
      : thumbnails[thumbnails.length - 1];

    if (!thumbnail) {
      throw new Error(`Thumbnail ${thumbnailId} not found for file ${fileId}`);
    }

    return this.config.storageProvider.getSignedUrl(thumbnail.storagePath, 3600);
  }
}

export function createLocalStorageProvider(): StorageProvider {
  const localFiles = new Map<string, Buffer>();

  return {
    type: 'local',
    async upload(file: Buffer, path: string, _metadata?: Record<string, unknown>): Promise<void> {
      localFiles.set(path, file);
    },
    async download(path: string): Promise<Buffer> {
      const file = localFiles.get(path);
      if (!file) {
        throw new Error(`File not found: ${path}`);
      }
      return file;
    },
    async delete(path: string): Promise<void> {
      localFiles.delete(path);
    },
    async exists(path: string): Promise<boolean> {
      return localFiles.has(path);
    },
    async getSignedUrl(path: string, _expiresIn: number): Promise<string> {
      return `file://${path}`;
    },
    async list(prefix: string): Promise<Array<{ key: string; size: number; lastModified: Date; etag: string }>> {
      const results: Array<{ key: string; size: number; lastModified: Date; etag: string }> = [];
      for (const [key, buffer] of localFiles.entries()) {
        if (key.startsWith(prefix)) {
          results.push({
            key,
            size: buffer.length,
            lastModified: new Date(),
            etag: crypto.createHash('md5').update(buffer).digest('hex'),
          });
        }
      }
      return results;
    },
  };
}

export function createMockStorageProvider(): StorageProvider {
  return {
    type: 'local',
    async upload(_file: Buffer, _path: string, _metadata?: Record<string, unknown>): Promise<void> {
    },
    async download(_path: string): Promise<Buffer> {
      return Buffer.from('');
    },
    async delete(_path: string): Promise<void> {
    },
    async exists(_path: string): Promise<boolean> {
      return false;
    },
    async getSignedUrl(_path: string, _expiresIn: number): Promise<string> {
      return '';
    },
    async list(_prefix: string): Promise<Array<{ key: string; size: number; lastModified: Date; etag: string }>> {
      return [];
    },
  };
}
