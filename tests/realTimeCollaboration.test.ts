/**
 * Real-time Collaboration Tests
 */

import {
  RealTimeCollaboration,
  createRealTimeCollaboration,
  PresenceServiceImpl,
  SelectionServiceImpl,
  DocumentServiceImpl,
  ConflictResolutionServiceImpl,
  NotificationServiceImpl,
  CollaborationServiceImpl,
} from '../src/core/realTimeCollaboration';

describe('RealTimeCollaboration', () => {
  let collaboration: RealTimeCollaboration;

  beforeEach(() => {
    collaboration = createRealTimeCollaboration();
  });

  describe('Presence Service', () => {
    let presenceService: PresenceServiceImpl;

    beforeEach(() => {
      presenceService = collaboration.getPresenceService() as PresenceServiceImpl;
    });

    test('should set user presence', async () => {
      await presenceService.setPresence('user1', 'doc1', 'online', 'Working on it');
      const presence = await presenceService.getPresence('user1');
      expect(presence).not.toBeNull();
      expect(presence?.presence).toBe('online');
      expect(presence?.statusMessage).toBe('Working on it');
    });

    test('should get presence as null for unknown user', async () => {
      const presence = await presenceService.getPresence('unknown');
      expect(presence).toBeNull();
    });

    test('should get document presence', async () => {
      await presenceService.setPresence('user1', 'doc1', 'online');
      await presenceService.setPresence('user2', 'doc1', 'away');
      const docPresence = await presenceService.getDocumentPresence('doc1');
      expect(docPresence.length).toBe(2);
    });

    test('should not include offline users in document presence', async () => {
      await presenceService.setPresence('user1', 'doc1', 'online');
      await presenceService.setPresence('user2', 'doc1', 'offline');
      const docPresence = await presenceService.getDocumentPresence('doc1');
      expect(docPresence.length).toBe(1);
      expect(docPresence[0].userId).toBe('user1');
    });

    test('should update cursor', async () => {
      const cursor = await presenceService.updateCursor('user1', 'doc1', {
        type: 'text',
        position: { start: 10, end: 15 },
        documentId: 'doc1',
        color: '#FF0000',
        label: 'user1',
      });
      expect(cursor.cursorId).toBeDefined();
      expect(cursor.userId).toBe('user1');
      expect(cursor.position.start).toBe(10);
    });

    test('should get cursors for document', async () => {
      await presenceService.updateCursor('user1', 'doc1', {
        type: 'pointer',
        position: { start: 5 },
        documentId: 'doc1',
        color: '#00FF00',
        label: 'user1',
      });
      const cursors = await presenceService.getCursors('doc1');
      expect(cursors.length).toBe(1);
    });

    test('should remove cursor', async () => {
      await presenceService.updateCursor('user1', 'doc1', {
        type: 'selection',
        position: { start: 0, end: 5 },
        documentId: 'doc1',
        color: '#0000FF',
        label: 'user1',
      });
      await presenceService.removeCursor('user1', 'doc1');
      const cursors = await presenceService.getCursors('doc1');
      expect(cursors.length).toBe(0);
    });
  });

  describe('Selection Service', () => {
    let selectionService: SelectionServiceImpl;

    beforeEach(() => {
      selectionService = collaboration.getSelectionService() as SelectionServiceImpl;
    });

    test('should set selection', async () => {
      const selection = await selectionService.setSelection('user1', 'doc1', {
        documentId: 'doc1',
        start: 0,
        end: 10,
        color: '#FF0000',
      });
      expect(selection.selectionId).toBeDefined();
      expect(selection.userId).toBe('user1');
      expect(selection.start).toBe(0);
      expect(selection.end).toBe(10);
    });

    test('should get selection', async () => {
      await selectionService.setSelection('user1', 'doc1', {
        documentId: 'doc1',
        start: 5,
        end: 15,
        color: '#00FF00',
      });
      const selection = await selectionService.getSelection('user1', 'doc1');
      expect(selection).not.toBeNull();
      expect(selection?.start).toBe(5);
    });

    test('should return null for unknown selection', async () => {
      const selection = await selectionService.getSelection('unknown', 'doc1');
      expect(selection).toBeNull();
    });

    test('should clear selection', async () => {
      await selectionService.setSelection('user1', 'doc1', {
        documentId: 'doc1',
        start: 0,
        end: 5,
        color: '#0000FF',
      });
      await selectionService.clearSelection('user1', 'doc1');
      const selection = await selectionService.getSelection('user1', 'doc1');
      expect(selection).toBeNull();
    });

    test('should get document selections', async () => {
      await selectionService.setSelection('user1', 'doc1', {
        documentId: 'doc1',
        start: 0,
        end: 5,
        color: '#FF0000',
      });
      await selectionService.setSelection('user2', 'doc1', {
        documentId: 'doc1',
        start: 10,
        end: 15,
        color: '#00FF00',
      });
      const selections = await selectionService.getDocumentSelections('doc1');
      expect(selections.length).toBe(2);
    });
  });

  describe('Document Service', () => {
    let documentService: DocumentServiceImpl;

    beforeEach(() => {
      documentService = collaboration.getDocumentService() as DocumentServiceImpl;
    });

    test('should create document', async () => {
      const doc = await documentService.createDocument('Test Doc', 'Initial content');
      expect(doc.documentId).toBeDefined();
      expect(doc.title).toBe('Test Doc');
      expect(doc.content).toBe('Initial content');
      expect(doc.version).toBe(0);
    });

    test('should create document with default content', async () => {
      const doc = await documentService.createDocument('Empty Doc');
      expect(doc.content).toBe('');
    });

    test('should get document', async () => {
      const created = await documentService.createDocument('Test');
      const retrieved = await documentService.getDocument(created.documentId);
      expect(retrieved?.title).toBe('Test');
    });

    test('should return null for unknown document', async () => {
      const doc = await documentService.getDocument('unknown');
      expect(doc).toBeNull();
    });

    test('should update document', async () => {
      const doc = await documentService.createDocument('Test');
      const updated = await documentService.updateDocument(doc.documentId, 'New content');
      expect(updated.content).toBe('New content');
    });

    test('should apply insert operation', async () => {
      const doc = await documentService.createDocument('Test', 'Hello');
      const operation = await documentService.applyOperation(doc.documentId, {
        documentId: doc.documentId,
        userId: 'user1',
        type: 'insert',
        position: 5,
        content: ' World',
      });
      expect(operation.operationId).toBeDefined();
      expect(operation.type).toBe('insert');
    });

    test('should apply delete operation', async () => {
      const doc = await documentService.createDocument('Test', 'Hello World');
      await documentService.applyOperation(doc.documentId, {
        documentId: doc.documentId,
        userId: 'user1',
        type: 'delete',
        position: 5,
        length: 6,
      });
      const updated = await documentService.getDocument(doc.documentId);
      expect(updated?.content).toBe('Hello');
    });

    test('should get document history', async () => {
      const doc = await documentService.createDocument('Test', 'Hi');
      await documentService.applyOperation(doc.documentId, {
        documentId: doc.documentId,
        userId: 'user1',
        type: 'insert',
        position: 2,
        content: '!',
      });
      const history = await documentService.getHistory(doc.documentId);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Conflict Resolution Service', () => {
    let conflictService: ConflictResolutionServiceImpl;

    beforeEach(() => {
      conflictService = collaboration.getConflictService() as ConflictResolutionServiceImpl;
    });

    test('should detect conflict for nearby inserts', () => {
      const op1: any = {
        documentId: 'doc1',
        type: 'insert',
        position: 10,
        content: 'abc',
        timestamp: new Date(),
      };
      const op2: any = {
        documentId: 'doc1',
        type: 'insert',
        position: 15,
        content: 'def',
        timestamp: new Date(),
      };
      expect(conflictService.detectConflict(op1, op2)).toBe(true);
    });

    test('should not detect conflict for distant operations', () => {
      const op1: any = {
        documentId: 'doc1',
        type: 'insert',
        position: 10,
        content: 'abc',
        timestamp: new Date(),
      };
      const op2: any = {
        documentId: 'doc1',
        type: 'insert',
        position: 100,
        content: 'def',
        timestamp: new Date(),
      };
      expect(conflictService.detectConflict(op1, op2)).toBe(false);
    });

    test('should not detect conflict for different documents', () => {
      const op1: any = {
        documentId: 'doc1',
        type: 'insert',
        position: 10,
        content: 'abc',
        timestamp: new Date(),
      };
      const op2: any = {
        documentId: 'doc2',
        type: 'insert',
        position: 10,
        content: 'def',
        timestamp: new Date(),
      };
      expect(conflictService.detectConflict(op1, op2)).toBe(false);
    });

    test('should detect conflict for overlapping deletes', () => {
      const op1: any = {
        documentId: 'doc1',
        type: 'delete',
        position: 5,
        length: 10,
        timestamp: new Date(),
      };
      const op2: any = {
        documentId: 'doc1',
        type: 'delete',
        position: 8,
        length: 10,
        timestamp: new Date(),
      };
      expect(conflictService.detectConflict(op1, op2)).toBe(true);
    });

    test('should resolve with last_write_wins', () => {
      const op1: any = {
        documentId: 'doc1',
        type: 'insert',
        position: 0,
        content: 'abc',
        timestamp: new Date('2024-01-01'),
      };
      const op2: any = {
        documentId: 'doc1',
        type: 'insert',
        position: 0,
        content: 'xyz',
        timestamp: new Date('2024-01-02'),
      };
      const resolved = conflictService.resolve(op1, op2, 'last_write_wins');
      expect(resolved.content).toBe('xyz');
    });

    test('should apply operational transform for inserts', () => {
      const op1: any = {
        documentId: 'doc1',
        type: 'insert',
        position: 5,
        content: 'abc',
        timestamp: new Date(),
      };
      const op2: any = {
        documentId: 'doc1',
        type: 'insert',
        position: 3,
        content: 'xyz',
        timestamp: new Date(),
      };
      const transformed = conflictService.applyOperationalTransform(op1, op2);
      expect(transformed.position).toBe(8);
    });

    test('should merge insert operations', () => {
      const op1: any = {
        documentId: 'doc1',
        type: 'insert',
        position: 0,
        content: 'Hello',
        timestamp: new Date(),
      };
      const op2: any = {
        documentId: 'doc1',
        type: 'insert',
        position: 5,
        content: ' World',
        timestamp: new Date(),
      };
      const merged = conflictService.applyMerge(op1, op2);
      expect(merged.content).toBe('Hello World');
    });
  });

  describe('Notification Service', () => {
    let notificationService: NotificationServiceImpl;

    beforeEach(() => {
      notificationService = collaboration.getNotificationService() as NotificationServiceImpl;
    });

    test('should create notification', async () => {
      const event: any = {
        eventId: 'evt1',
        type: 'presence_change',
        documentId: 'doc1',
        userId: 'user1',
        payload: {},
        timestamp: new Date(),
      };
      const notification = await notificationService.createNotification('user1', event);
      expect(notification.notificationId).toBeDefined();
      expect(notification.userId).toBe('user1');
      expect(notification.read).toBe(false);
    });

    test('should get notifications', async () => {
      const event: any = {
        eventId: 'evt1',
        type: 'cursor_move',
        documentId: 'doc1',
        userId: 'user1',
        payload: {},
        timestamp: new Date(),
      };
      await notificationService.createNotification('user1', event);
      const notifications = await notificationService.getNotifications('user1');
      expect(notifications.length).toBe(1);
    });

    test('should mark notification as read', async () => {
      const event: any = {
        eventId: 'evt1',
        type: 'operation',
        documentId: 'doc1',
        userId: 'user1',
        payload: {},
        timestamp: new Date(),
      };
      const notification = await notificationService.createNotification('user1', event);
      await notificationService.markAsRead(notification.notificationId);
      const notifications = await notificationService.getNotifications('user1');
      expect(notifications[0].read).toBe(true);
    });

    test('should mark all notifications as read', async () => {
      const event1: any = { eventId: 'evt1', type: 'presence_change', documentId: 'doc1', userId: 'user1', payload: {}, timestamp: new Date() };
      const event2: any = { eventId: 'evt2', type: 'cursor_move', documentId: 'doc1', userId: 'user1', payload: {}, timestamp: new Date() };
      await notificationService.createNotification('user1', event1);
      await notificationService.createNotification('user1', event2);
      await notificationService.markAllAsRead('user1');
      const notifications = await notificationService.getNotifications('user1');
      expect(notifications.every(n => n.read)).toBe(true);
    });

    test('should get unread count', async () => {
      const event: any = {
        eventId: 'evt1',
        type: 'sync',
        documentId: 'doc1',
        userId: 'user1',
        payload: {},
        timestamp: new Date(),
      };
      await notificationService.createNotification('user1', event);
      await notificationService.createNotification('user1', event);
      const count = await notificationService.getUnreadCount('user1');
      expect(count).toBe(2);
    });
  });

  describe('Collaboration Service', () => {
    let collaborationService: CollaborationServiceImpl;

    beforeEach(() => {
      collaborationService = collaboration.getCollaborationService() as CollaborationServiceImpl;
    });

    test('should join document', async () => {
      await collaborationService.joinDocument('user1', 'doc1');
      const docs = await collaborationService.getActiveDocuments('user1');
      expect(docs).toContain('doc1');
    });

    test('should leave document', async () => {
      await collaborationService.joinDocument('user1', 'doc1');
      await collaborationService.leaveDocument('user1', 'doc1');
      const docs = await collaborationService.getActiveDocuments('user1');
      expect(docs).not.toContain('doc1');
    });

    test('should get connection info', async () => {
      await collaborationService.joinDocument('user1', 'doc1');
      const conn = await collaborationService.getConnectionInfo('user1');
      expect(conn).not.toBeNull();
      expect(conn?.documentId).toBe('doc1');
    });

    test('should return null for unknown connection', async () => {
      const conn = await collaborationService.getConnectionInfo('unknown');
      expect(conn).toBeNull();
    });

    test('should track multiple active documents', async () => {
      await collaborationService.joinDocument('user1', 'doc1');
      await collaborationService.joinDocument('user1', 'doc2');
      const docs = await collaborationService.getActiveDocuments('user1');
      expect(docs.length).toBe(2);
    });
  });

  describe('RealTimeCollaboration Integration', () => {
    test('should create with default config', () => {
      const collab = createRealTimeCollaboration();
      expect(collab).toBeInstanceOf(RealTimeCollaboration);
    });

    test('should create with custom config', () => {
      const collab = createRealTimeCollaboration({
        cursorThrottleMs: 100,
        maxPresenceAge: 600000,
      });
      expect(collab).toBeInstanceOf(RealTimeCollaboration);
    });

    test('should set user presence', async () => {
      await collaboration.setUserPresence('user1', 'doc1', 'online', 'Hello');
      const presence = await collaboration.getDocumentPresence('doc1');
      expect(presence.some(p => p.presence === 'online')).toBe(true);
    });

    test('should update cursor', async () => {
      const cursor = await collaboration.updateCursor(
        'user1',
        'doc1',
        'text',
        { start: 10, end: 15 },
        '#FF0000',
        'user1'
      );
      expect(cursor.cursorId).toBeDefined();
      expect(cursor.type).toBe('text');
    });

    test('should set selection', async () => {
      const selection = await collaboration.setUserSelection(
        'user1',
        'doc1',
        0,
        10,
        '#00FF00'
      );
      expect(selection.selectionId).toBeDefined();
      expect(selection.start).toBe(0);
    });

    test('should create document', async () => {
      const doc = await collaboration.createDocument('Test Document', 'Content here');
      expect(doc.documentId).toBeDefined();
      expect(doc.title).toBe('Test Document');
    });

    test('should apply document operation', async () => {
      const doc = await collaboration.createDocument('Test', 'Hello');
      const operation = await collaboration.applyDocumentOperation(
        doc.documentId,
        'user1',
        'insert',
        5,
        ' World'
      );
      expect(operation.operationId).toBeDefined();
      expect(operation.type).toBe('insert');
    });

    test('should get document', async () => {
      const created = await collaboration.createDocument('Test');
      const retrieved = await collaboration.getDocument(created.documentId);
      expect(retrieved?.title).toBe('Test');
    });

    test('should get document presence', async () => {
      await collaboration.joinDocument('user1', 'doc1');
      const presence = await collaboration.getDocumentPresence('doc1');
      expect(presence.length).toBeGreaterThan(0);
    });

    test('should get document cursors', async () => {
      await collaboration.updateCursor('user1', 'doc1', 'pointer', { start: 5 }, '#FF0000', 'user1');
      const cursors = await collaboration.getDocumentCursors('doc1');
      expect(cursors.length).toBe(1);
    });

    test('should get document selections', async () => {
      await collaboration.setUserSelection('user1', 'doc1', 0, 10, '#00FF00');
      const selections = await collaboration.getDocumentSelections('doc1');
      expect(selections.length).toBe(1);
    });

    test('should get notifications', async () => {
      await collaboration.setUserPresence('user1', 'doc1', 'online');
      const notifications = await collaboration.getNotifications('user1');
      expect(notifications.length).toBeGreaterThan(0);
    });

    test('should mark notification as read', async () => {
      await collaboration.setUserPresence('user1', 'doc1', 'online');
      const notifications = await collaboration.getNotifications('user1');
      if (notifications.length > 0) {
        await collaboration.markNotificationAsRead(notifications[0].notificationId);
      }
    });

    test('should join and leave document', async () => {
      await collaboration.joinDocument('user1', 'doc1');
      let activeDocs = await collaboration.getActiveDocuments('user1');
      expect(activeDocs).toContain('doc1');

      await collaboration.leaveDocument('user1', 'doc1');
      activeDocs = await collaboration.getActiveDocuments('user1');
      expect(activeDocs).not.toContain('doc1');
    });

    test('should detect and resolve conflict', async () => {
      const doc = await collaboration.createDocument('Test', 'Hello World');
      const op1 = await collaboration.applyDocumentOperation(doc.documentId, 'user1', 'insert', 5, '!');
      const op2 = await collaboration.applyDocumentOperation(doc.documentId, 'user2', 'insert', 6, '?');

      const conflict = await collaboration.detectAndResolveConflict(doc.documentId, op1, op2);
      expect(conflict).not.toBeNull();
      expect(conflict?.conflictId).toBeDefined();
    });

    test('should return null when no conflict detected', async () => {
      const doc = await collaboration.createDocument('Test', 'Hello');
      const op1 = await collaboration.applyDocumentOperation(doc.documentId, 'user1', 'insert', 0, 'A');
      const op2 = await collaboration.applyDocumentOperation(doc.documentId, 'user2', 'insert', 100, 'B');

      const conflict = await collaboration.detectAndResolveConflict(doc.documentId, op1, op2);
      expect(conflict).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('should handle presence update for same user twice', async () => {
      const presenceService = collaboration.getPresenceService();
      await presenceService.setPresence('user1', 'doc1', 'online');
      await presenceService.setPresence('user1', 'doc1', 'away');
      const presence = await presenceService.getPresence('user1');
      expect(presence?.presence).toBe('away');
    });

    test('should handle multiple cursors for same user different docs', async () => {
      const presenceService = collaboration.getPresenceService();
      await presenceService.updateCursor('user1', 'doc1', {
        type: 'pointer',
        position: { start: 5 },
        documentId: 'doc1',
        color: '#FF0000',
        label: 'user1',
      });
      await presenceService.updateCursor('user1', 'doc2', {
        type: 'text',
        position: { start: 10 },
        documentId: 'doc2',
        color: '#00FF00',
        label: 'user1',
      });
      const cursors1 = await presenceService.getCursors('doc1');
      const cursors2 = await presenceService.getCursors('doc2');
      expect(cursors1.length).toBe(1);
      expect(cursors2.length).toBe(1);
    });

    test('should handle update on non-existent document', async () => {
      const documentService = collaboration.getDocumentService();
      await expect(
        documentService.updateDocument('nonexistent', 'content')
      ).rejects.toThrow();
    });

    test('should handle operation on non-existent document', async () => {
      const documentService = collaboration.getDocumentService();
      await expect(
        documentService.applyOperation('nonexistent', {
          documentId: 'nonexistent',
          userId: 'user1',
          type: 'insert',
          position: 0,
          content: 'test',
        })
      ).rejects.toThrow();
    });

    test('should handle empty notifications for new user', async () => {
      const notifications = await collaboration.getNotifications('newuser');
      expect(notifications.length).toBe(0);
    });

    test('should handle leaving document user never joined', async () => {
      await expect(
        collaboration.leaveDocument('neverjoined', 'doc1')
      ).resolves.not.toThrow();
    });
  });
});
