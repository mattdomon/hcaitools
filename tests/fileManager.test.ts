import crypto from 'crypto';
import {
  FileManager,
  createLocalStorageProvider,
  createMockStorageProvider,
  generateFileId,
  generateFolderId,
  generateVersionId,
  generateThumbnailId,
  generateChecksum,
  buildFolderPath,
  isValidMimeType,
  isPreviewable,
  FileMetadata,
  FolderNode,
  FileACL,
  ACLEntry,
  Thumbnail,
  MimeType,
  FilePermission,
} from '../src/core/fileManager';

describe('FileManager', () => {
  let fileManager: FileManager;
  let storageProvider: ReturnType<typeof createLocalStorageProvider>;

  beforeEach(() => {
    storageProvider = createLocalStorageProvider();
    fileManager = new FileManager({
      storageProvider,
      maxFileSize: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'text/plain', 'application/pdf'],
      thumbnailConfig: {
        maxWidth: 200,
        maxHeight: 200,
        defaultFormat: 'jpeg',
        quality: 80,
      },
      versioningEnabled: true,
      maxVersionsPerFile: 5,
    });
  });

  describe('Upload', () => {
    it('should upload a file successfully', async () => {
      const buffer = Buffer.from('test file content');
      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      });

      expect(result.file).toBeDefined();
      expect(result.file.name).toBe('test.txt');
      expect(result.file.mimeType).toBe('text/plain');
      expect(result.file.size).toBe(buffer.length);
      expect(result.file.id).toMatch(/^file_[a-f0-9]{16}$/);
    });

    it('should reject file exceeding max size', async () => {
      const buffer = Buffer.alloc(11 * 1024 * 1024);
      await expect(fileManager.upload(buffer, {
        filename: 'large.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      })).rejects.toThrow('File size exceeds maximum allowed size');
    });

    it('should reject disallowed MIME type', async () => {
      const fileManagerNoAllowed = new FileManager({
        storageProvider: createMockStorageProvider(),
        maxFileSize: 10 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg'],
        versioningEnabled: false,
        maxVersionsPerFile: 5,
      });

      const buffer = Buffer.from('test');
      await expect(fileManagerNoAllowed.upload(buffer, {
        filename: 'test.exe',
        mimeType: 'application/exe',
        size: buffer.length,
      })).rejects.toThrow('MIME type application/exe is not allowed');
    });

    it('should store file in storage provider', async () => {
      const buffer = Buffer.from('test content');
      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      });

      const exists = await storageProvider.exists(`/${result.file.id}_test.txt`);
      expect(exists).toBe(true);
    });

    it('should generate correct checksum', async () => {
      const buffer = Buffer.from('test content');
      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      });

      const expectedChecksum = crypto.createHash('sha256').update(buffer).digest('hex');
      expect(result.file.checksum).toBe(expectedChecksum);
    });

    it('should create version entry when versioning is enabled', async () => {
      const buffer = Buffer.from('test content');
      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      });

      const versions = await fileManager.getFileVersions(result.file.id);
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe(1);
    });

    it('should set initial ACL if provided', async () => {
      const buffer = Buffer.from('test content');
      const aclEntries: ACLEntry[] = [
        {
          principalId: 'user123',
          principalType: 'user',
          permissions: ['read', 'write'],
          grantedAt: new Date(),
          grantedBy: 'admin',
        },
      ];

      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
        acl: aclEntries,
      });

      const acl = await fileManager.getPermissions(result.file.id);
      expect(acl.entries).toHaveLength(1);
      expect(acl.entries[0].principalId).toBe('user123');
    });

    it('should upload file to specific folder', async () => {
      const folder = await fileManager.createFolder('documents', null, 'user1');
      const buffer = Buffer.from('test content');

      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
        folderId: folder.id,
      });

      expect(result.folder).toBeDefined();
      expect(result.folder?.id).toBe(folder.id);
    });
  });

  describe('Download', () => {
    it('should download an existing file', async () => {
      const buffer = Buffer.from('test content');
      const uploadResult = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      });

      const downloadResult = await fileManager.download({
        fileId: uploadResult.file.id,
      });

      expect(downloadResult.buffer?.toString()).toBe('test content');
      expect(downloadResult.filename).toBe('test.txt');
      expect(downloadResult.metadata.id).toBe(uploadResult.file.id);
    });

    it('should throw error for non-existent file', async () => {
      await expect(fileManager.download({
        fileId: 'non_existent_id',
      })).rejects.toThrow('File not found');
    });
  });

  describe('Delete', () => {
    it('should delete an existing file', async () => {
      const buffer = Buffer.from('test content');
      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      });

      await fileManager.delete(result.file.id, 'user1');

      const file = await fileManager.getFile(result.file.id);
      expect(file).toBeNull();
    });

    it('should delete file from storage provider', async () => {
      const buffer = Buffer.from('test content');
      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      });

      await fileManager.delete(result.file.id, 'user1');

      const exists = await storageProvider.exists(`/${result.file.id}_test.txt`);
      expect(exists).toBe(false);
    });

    it('should throw error when deleting non-existent file', async () => {
      await expect(fileManager.delete('non_existent', 'user1')).rejects.toThrow('File not found');
    });
  });

  describe('File Operations', () => {
    it('should get file by id', async () => {
      const buffer = Buffer.from('test content');
      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      });

      const file = await fileManager.getFile(result.file.id);
      expect(file).toBeDefined();
      expect(file?.name).toBe('test.txt');
    });

    it('should return null for non-existent file', async () => {
      const file = await fileManager.getFile('non_existent');
      expect(file).toBeNull();
    });

    it('should list files with pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await fileManager.upload(Buffer.from(`content${i}`), {
          filename: `file${i}.txt`,
          mimeType: 'text/plain',
          size: i,
        });
      }

      const result = await fileManager.listFiles({
        limit: 2,
        offset: 0,
      });

      expect(result.files).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(true);
    });

    it('should sort files by name', async () => {
      await fileManager.upload(Buffer.from('bbb'), { filename: 'bbb.txt', mimeType: 'text/plain', size: 3 });
      await fileManager.upload(Buffer.from('aaa'), { filename: 'aaa.txt', mimeType: 'text/plain', size: 3 });
      await fileManager.upload(Buffer.from('ccc'), { filename: 'ccc.txt', mimeType: 'text/plain', size: 3 });

      const result = await fileManager.listFiles({
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(result.files[0].name).toBe('aaa.txt');
      expect(result.files[1].name).toBe('bbb.txt');
      expect(result.files[2].name).toBe('ccc.txt');
    });

    it('should filter files by MIME type', async () => {
      await fileManager.upload(Buffer.from('test'), { filename: 'test.txt', mimeType: 'text/plain', size: 4 });
      await fileManager.upload(Buffer.from('test'), { filename: 'test.jpg', mimeType: 'image/jpeg', size: 4 });

      const result = await fileManager.listFiles({
        mimeTypes: ['text/plain'],
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].mimeType).toBe('text/plain');
    });

    it('should search files by name', async () => {
      await fileManager.upload(Buffer.from('test'), { filename: 'document.txt', mimeType: 'text/plain', size: 4 });
      await fileManager.upload(Buffer.from('test'), { filename: 'image.jpg', mimeType: 'image/jpeg', size: 4 });

      const result = await fileManager.listFiles({
        search: 'doc',
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('document.txt');
    });
  });

  describe('Folder Operations', () => {
    it('should create a root folder', async () => {
      const folder = await fileManager.createFolder('documents', null, 'user1');

      expect(folder).toBeDefined();
      expect(folder.name).toBe('documents');
      expect(folder.parentId).toBeNull();
      expect(folder.path).toBe('/documents');
    });

    it('should create a nested folder', async () => {
      const parent = await fileManager.createFolder('documents', null, 'user1');
      const child = await fileManager.createFolder('subfolder', parent.id, 'user1');

      expect(child.parentId).toBe(parent.id);
      expect(child.path).toBe('/documents/subfolder');
    });

    it('should get folder by id', async () => {
      const created = await fileManager.createFolder('documents', null, 'user1');
      const folder = await fileManager.getFolder(created.id);

      expect(folder).toBeDefined();
      expect(folder?.name).toBe('documents');
    });

    it('should return null for non-existent folder', async () => {
      const folder = await fileManager.getFolder('non_existent');
      expect(folder).toBeNull();
    });

    it('should get folder tree', async () => {
      await fileManager.createFolder('documents', null, 'user1');
      await fileManager.createFolder('images', null, 'user1');

      const tree = await fileManager.getFolderTree(null);

      expect(tree.id).toBe('root');
      expect(tree.children.length).toBe(2);
    });

    it('should delete an empty folder', async () => {
      const folder = await fileManager.createFolder('documents', null, 'user1');
      await fileManager.deleteFolder(folder.id, 'user1');

      const deleted = await fileManager.getFolder(folder.id);
      expect(deleted).toBeNull();
    });

    it('should not delete non-empty folder', async () => {
      const parent = await fileManager.createFolder('documents', null, 'user1');
      await fileManager.createFolder('subfolder', parent.id, 'user1');

      await expect(fileManager.deleteFolder(parent.id, 'user1')).rejects.toThrow('folder is not empty');
    });

    it('should move folder to new parent', async () => {
      const folder1 = await fileManager.createFolder('folder1', null, 'user1');
      const folder2 = await fileManager.createFolder('folder2', null, 'user1');
      const subfolder = await fileManager.createFolder('subfolder', folder1.id, 'user1');

      const moved = await fileManager.moveFolder(subfolder.id, folder2.id, 'user1');

      expect(moved.parentId).toBe(folder2.id);
      expect(moved.path).toBe('/folder2/subfolder');
    });

    it('should not move folder into its own descendant', async () => {
      const parent = await fileManager.createFolder('parent', null, 'user1');
      const child = await fileManager.createFolder('child', parent.id, 'user1');

      await expect(fileManager.moveFolder(parent.id, child.id, 'user1')).rejects.toThrow(/Cannot move folder.*into its own descendant/);
    });
  });

  describe('File Versioning', () => {
    it('should get file versions', async () => {
      const buffer = Buffer.from('test content');
      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      });

      const versions = await fileManager.getFileVersions(result.file.id);
      expect(versions.length).toBe(1);
      expect(versions[0].version).toBe(1);
    });

    it('should restore file to previous version', async () => {
      const buffer = Buffer.from('original content');
      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      });

      const updated = await fileManager.restoreVersion(result.file.id, 1, 'user1');
      expect(updated.version).toBe(2);
    });

    it('should limit number of stored versions', async () => {
      const mockProvider = createMockStorageProvider();
      const limitedManager = new FileManager({
        storageProvider: mockProvider,
        maxFileSize: 10 * 1024 * 1024,
        versioningEnabled: true,
        maxVersionsPerFile: 3,
      });

      const buffer = Buffer.from('test content');
      const result = await limitedManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      });

      await limitedManager.restoreVersion(result.file.id, 1, 'user1');
      await limitedManager.restoreVersion(result.file.id, 2, 'user1');
      await limitedManager.restoreVersion(result.file.id, 3, 'user1');

      const versions = await limitedManager.getFileVersions(result.file.id);
      expect(versions.length).toBe(3);
    });
  });

  describe('Permissions', () => {
    it('should check permission granted in ACL', async () => {
      const buffer = Buffer.from('test content');
      const aclEntries: ACLEntry[] = [
        {
          principalId: 'user123',
          principalType: 'user',
          permissions: ['read', 'write'],
          grantedAt: new Date(),
          grantedBy: 'admin',
        },
      ];

      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
        acl: aclEntries,
      });

      const hasRead = await fileManager.checkPermission(result.file.id, 'user123', 'read');
      const hasWrite = await fileManager.checkPermission(result.file.id, 'user123', 'write');
      const hasDelete = await fileManager.checkPermission(result.file.id, 'user123', 'delete');

      expect(hasRead).toBe(true);
      expect(hasWrite).toBe(true);
      expect(hasDelete).toBe(false);
    });

    it('should deny permission for non-listed user', async () => {
      const buffer = Buffer.from('test content');
      const aclEntries: ACLEntry[] = [
        {
          principalId: 'user123',
          principalType: 'user',
          permissions: ['read'],
          grantedAt: new Date(),
          grantedBy: 'admin',
        },
      ];

      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
        acl: aclEntries,
      });

      const hasPermission = await fileManager.checkPermission(result.file.id, 'other_user', 'read');
      expect(hasPermission).toBe(false);
    });

    it('should set permissions for a file', async () => {
      const buffer = Buffer.from('test content');
      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      });

      const entries: ACLEntry[] = [
        {
          principalId: 'user456',
          principalType: 'user',
          permissions: ['read', 'write', 'delete'],
          grantedAt: new Date(),
          grantedBy: 'admin',
        },
      ];

      const acl = await fileManager.setPermissions(result.file.id, entries, 'admin');
      expect(acl.entries).toHaveLength(1);
      expect(acl.entries[0].principalId).toBe('user456');
    });

    it('should return empty ACL for file without permissions', async () => {
      const buffer = Buffer.from('test content');
      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      });

      const acl = await fileManager.getPermissions(result.file.id);
      expect(acl.entries).toHaveLength(0);
    });

    it('should deny delete without permission', async () => {
      const buffer = Buffer.from('test content');
      const aclEntries: ACLEntry[] = [
        {
          principalId: 'user123',
          principalType: 'user',
          permissions: ['read'],
          grantedAt: new Date(),
          grantedBy: 'admin',
        },
      ];

      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
        acl: aclEntries,
      });

      await expect(fileManager.delete(result.file.id, 'user123')).rejects.toThrow('does not have delete permission');
    });
  });

  describe('Preview Generation', () => {
    it('should generate preview for image files', async () => {
      const buffer = Buffer.from('fake image data');
      const result = await fileManager.upload(buffer, {
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        size: buffer.length,
      });

      const preview = await fileManager.generatePreview(result.file.id);
      expect(preview.thumbnail).toBeDefined();
      expect(preview.thumbnail.fileId).toBe(result.file.id);
    });

    it('should reject preview for non-previewable files', async () => {
      const buffer = Buffer.from('test content');
      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      });

      await expect(fileManager.generatePreview(result.file.id)).rejects.toThrow('not previewable');
    });

    it('should get existing preview', async () => {
      const buffer = Buffer.from('fake image data');
      const result = await fileManager.upload(buffer, {
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        size: buffer.length,
      });

      const preview = await fileManager.generatePreview(result.file.id);
      const url = await fileManager.getPreview(result.file.id, preview.thumbnail.id);

      expect(url).toBeDefined();
    });
  });

  describe('Move Operations', () => {
    it('should move file to different folder', async () => {
      const buffer = Buffer.from('test content');
      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
      });

      const folder = await fileManager.createFolder('newfolder', null, 'user1');
      const moved = await fileManager.moveFile(result.file.id, folder.id, 'user1');

      expect(moved.id).toBe(result.file.id);
    });

    it('should not move file without write permission', async () => {
      const buffer = Buffer.from('test content');
      const aclEntries: ACLEntry[] = [
        {
          principalId: 'user123',
          principalType: 'user',
          permissions: ['read'],
          grantedAt: new Date(),
          grantedBy: 'admin',
        },
      ];

      const result = await fileManager.upload(buffer, {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: buffer.length,
        acl: aclEntries,
      });

      const folder = await fileManager.createFolder('newfolder', null, 'user1');
      await expect(fileManager.moveFile(result.file.id, folder.id, 'user123')).rejects.toThrow('does not have write permission');
    });
  });

  describe('Utility Functions', () => {
    it('should generate valid file ID', () => {
      const id = generateFileId();
      expect(id).toMatch(/^file_[a-f0-9]{16}$/);
    });

    it('should generate valid folder ID', () => {
      const id = generateFolderId();
      expect(id).toMatch(/^folder_[a-f0-9]{16}$/);
    });

    it('should generate valid version ID', () => {
      const id = generateVersionId();
      expect(id).toMatch(/^ver_[a-f0-9]{16}$/);
    });

    it('should generate valid thumbnail ID', () => {
      const id = generateThumbnailId();
      expect(id).toMatch(/^thumb_[a-f0-9]{16}$/);
    });

    it('should generate checksum for buffer', () => {
      const buffer = Buffer.from('test content');
      const checksum = generateChecksum(buffer);
      expect(checksum).toBe(crypto.createHash('sha256').update(buffer).digest('hex'));
    });

    it('should validate correct MIME types', () => {
      expect(isValidMimeType('image/jpeg')).toBe(true);
      expect(isValidMimeType('text/plain')).toBe(true);
      expect(isValidMimeType('application/pdf')).toBe(true);
    });

    it('should reject invalid MIME types', () => {
      expect(isValidMimeType('application/octet-stream')).toBe(false);
      expect(isValidMimeType('invalid/type')).toBe(false);
    });

    it('should identify previewable MIME types', () => {
      expect(isPreviewable('image/jpeg')).toBe(true);
      expect(isPreviewable('image/png')).toBe(true);
      expect(isPreviewable('application/pdf')).toBe(true);
      expect(isPreviewable('text/plain')).toBe(false);
    });

    it('should build folder path correctly', () => {
      const folders = new Map<string, FolderNode>();
      folders.set('folder1', {
        id: 'folder1',
        name: 'documents',
        parentId: null,
        path: '/documents',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user1',
        metadata: {},
      });
      folders.set('folder2', {
        id: 'folder2',
        name: 'images',
        parentId: 'folder1',
        path: '/documents/images',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user1',
        metadata: {},
      });

      expect(buildFolderPath(folders, null)).toBe('/');
      expect(buildFolderPath(folders, 'folder1')).toBe('/documents');
      expect(buildFolderPath(folders, 'folder2')).toBe('/documents/images');
    });
  });
});
