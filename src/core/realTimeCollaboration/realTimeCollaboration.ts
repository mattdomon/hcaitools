/**
 * Real-time Collaboration Implementation
 * Presence awareness, cursor sharing, document editing, and conflict resolution
 */

import {
  PresenceState,
  CursorType,
  ConflictResolutionStrategy,
  OperationType,
  CursorPosition,
  UserPresence,
  Selection,
  DocumentOperation,
  DocumentVersion,
  CollaborativeDocument,
  Conflict,
  CollaborationEvent,
  Notification,
  WebSocketConnection,
  PresenceService,
  SelectionService,
  DocumentService,
  ConflictResolutionService,
  NotificationService,
  CollaborationService,
  CollaborationConfig,
  DEFAULT_CONFIG,
} from './types';

function generateId(prefix: string): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

export class PresenceServiceImpl implements PresenceService {
  private presence: Map<string, UserPresence> = new Map();
  private cursors: Map<string, Map<string, CursorPosition>> = new Map();

  async setPresence(
    userId: string,
    documentId: string,
    presence: PresenceState,
    statusMessage?: string
  ): Promise<void> {
    const existing = this.presence.get(userId);
    this.presence.set(userId, {
      userId,
      presence,
      lastSeenAt: new Date(),
      statusMessage,
      documentId,
      cursor: existing?.cursor,
    });
  }

  async getPresence(userId: string): Promise<UserPresence | null> {
    return this.presence.get(userId) || null;
  }

  async getDocumentPresence(documentId: string): Promise<UserPresence[]> {
    const result: UserPresence[] = [];
    this.presence.forEach((p) => {
      if (p.documentId === documentId && p.presence !== 'offline') {
        result.push(p);
      }
    });
    return result;
  }

  async updateCursor(
    userId: string,
    documentId: string,
    cursor: Omit<CursorPosition, 'cursorId' | 'userId' | 'timestamp'>
  ): Promise<CursorPosition> {
    if (!this.cursors.has(documentId)) {
      this.cursors.set(documentId, new Map());
    }
    const docCursors = this.cursors.get(documentId)!;
    const cursorPosition: CursorPosition = {
      ...cursor,
      cursorId: generateId('cursor'),
      userId,
      timestamp: new Date(),
    };
    docCursors.set(userId, cursorPosition);
    return cursorPosition;
  }

  async removeCursor(userId: string, documentId: string): Promise<void> {
    const docCursors = this.cursors.get(documentId);
    if (docCursors) {
      docCursors.delete(userId);
    }
  }

  async getCursors(documentId: string): Promise<CursorPosition[]> {
    const docCursors = this.cursors.get(documentId);
    if (!docCursors) {
      return [];
    }
    return Array.from(docCursors.values());
  }
}

export class SelectionServiceImpl implements SelectionService {
  private selections: Map<string, Selection> = new Map();

  private getKey(userId: string, documentId: string): string {
    return `${documentId}:${userId}`;
  }

  async setSelection(
    userId: string,
    documentId: string,
    selection: Omit<Selection, 'selectionId' | 'userId' | 'timestamp'>
  ): Promise<Selection> {
    const key = this.getKey(userId, documentId);
    const newSelection: Selection = {
      ...selection,
      selectionId: generateId('sel'),
      userId,
      documentId,
      timestamp: new Date(),
    };
    this.selections.set(key, newSelection);
    return newSelection;
  }

  async getSelection(userId: string, documentId: string): Promise<Selection | null> {
    return this.selections.get(this.getKey(userId, documentId)) || null;
  }

  async clearSelection(userId: string, documentId: string): Promise<void> {
    this.selections.delete(this.getKey(userId, documentId));
  }

  async getDocumentSelections(documentId: string): Promise<Selection[]> {
    const result: Selection[] = [];
    this.selections.forEach((s) => {
      if (s.documentId === documentId) {
        result.push(s);
      }
    });
    return result;
  }
}

export class DocumentServiceImpl implements DocumentService {
  private documents: Map<string, CollaborativeDocument> = new Map();
  private history: Map<string, DocumentVersion[]> = new Map();

  async createDocument(
    title: string,
    content: string = '',
    conflictStrategy: ConflictResolutionStrategy = 'last_write_wins'
  ): Promise<CollaborativeDocument> {
    const documentId = generateId('doc');
    const now = new Date();
    const doc: CollaborativeDocument = {
      documentId,
      title,
      content,
      version: 0,
      activeUsers: [],
      selections: [],
      cursors: new Map(),
      conflictStrategy,
      createdAt: now,
      updatedAt: now,
    };
    this.documents.set(documentId, doc);
    this.history.set(documentId, []);
    return doc;
  }

  async getDocument(documentId: string): Promise<CollaborativeDocument | null> {
    return this.documents.get(documentId) || null;
  }

  async updateDocument(documentId: string, content: string): Promise<CollaborativeDocument> {
    const doc = this.documents.get(documentId);
    if (!doc) {
      throw new Error(`Document ${documentId} not found`);
    }
    doc.content = content;
    doc.updatedAt = new Date();
    return doc;
  }

  async applyOperation(
    documentId: string,
    operation: Omit<DocumentOperation, 'operationId' | 'timestamp' | 'version'>
  ): Promise<DocumentOperation> {
    const doc = this.documents.get(documentId);
    if (!doc) {
      throw new Error(`Document ${documentId} not found`);
    }

    const newOperation: DocumentOperation = {
      ...operation,
      operationId: generateId('op'),
      timestamp: new Date(),
      version: doc.version + 1,
    };

    if (operation.type === 'insert' && operation.content) {
      const pos = operation.position;
      doc.content = doc.content.slice(0, pos) + operation.content + doc.content.slice(pos);
    } else if (operation.type === 'delete' && operation.length) {
      doc.content = doc.content.slice(0, operation.position) + doc.content.slice(operation.position + operation.length);
    } else if (operation.type === 'update' && operation.content) {
      const pos = operation.position;
      const len = operation.length || operation.content.length;
      doc.content = doc.content.slice(0, pos) + operation.content + doc.content.slice(pos + len);
    }

    doc.version = newOperation.version;
    doc.updatedAt = new Date();

    const docHistory = this.history.get(documentId) || [];
    const lastVersion = docHistory[docHistory.length - 1];
    const versionEntry: DocumentVersion = {
      version: doc.version,
      operations: [...(lastVersion?.operations || []), newOperation],
      timestamp: new Date(),
      userId: operation.userId,
    };
    docHistory.push(versionEntry);
    this.history.set(documentId, docHistory);

    return newOperation;
  }

  async getHistory(documentId: string, limit: number = 50): Promise<DocumentVersion[]> {
    const docHistory = this.history.get(documentId) || [];
    return docHistory.slice(-limit);
  }

  async resolveConflict(_conflictId: string, _resolution: ConflictResolutionStrategy): Promise<Conflict> {
    throw new Error('Conflict resolution not implemented at document level');
  }
}

export class ConflictResolutionServiceImpl implements ConflictResolutionService {
  private conflicts: Map<string, Conflict> = new Map();

  detectConflict(op1: DocumentOperation, op2: DocumentOperation): boolean {
    if (op1.documentId !== op2.documentId) {
      return false;
    }
    if (op1.type === 'insert' && op2.type === 'insert') {
      return Math.abs(op1.position - op2.position) < 10;
    }
    if (op1.type === 'delete' && op2.type === 'delete') {
      const range1 = { start: op1.position, end: op1.position + (op1.length || 0) };
      const range2 = { start: op2.position, end: op2.position + (op2.length || 0) };
      return !(range1.end <= range2.start || range2.end <= range1.start);
    }
    if (op1.type === 'update' || op2.type === 'update') {
      return op1.position === op2.position;
    }
    return false;
  }

  resolve(
    op1: DocumentOperation,
    op2: DocumentOperation,
    strategy: ConflictResolutionStrategy
  ): DocumentOperation {
    switch (strategy) {
      case 'last_write_wins':
        return op1.timestamp > op2.timestamp ? op1 : op2;
      case 'operational_transform':
        return this.applyOperationalTransform(op1, op2);
      case 'merge':
        return this.applyMerge(op1, op2);
      default:
        return op1;
    }
  }

  async getConflicts(documentId: string): Promise<Conflict[]> {
    const result: Conflict[] = [];
    this.conflicts.forEach((c) => {
      if (c.documentId === documentId) {
        result.push(c);
      }
    });
    return result;
  }

  applyOperationalTransform(op1: DocumentOperation, op2: DocumentOperation): DocumentOperation {
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op1.position >= op2.position) {
        return { ...op1, position: op1.position + (op2.content?.length || 0) };
      }
      return op1;
    }
    if (op1.type === 'delete' && op2.type === 'delete') {
      if (op1.position > op2.position) {
        return {
          ...op1,
          position: Math.max(op2.position, op1.position - (op2.length || 0)),
        };
      }
      return op1;
    }
    if (op1.type === 'insert' && op2.type === 'delete') {
      if (op1.position > op2.position) {
        return {
          ...op1,
          position: Math.max(op2.position, op1.position - (op2.length || 0)),
        };
      }
      return op1;
    }
    if (op1.type === 'delete' && op2.type === 'insert') {
      if (op1.position >= op2.position) {
        return { ...op1, position: op1.position + (op2.content?.length || 0) };
      }
      return op1;
    }
    return op1;
  }

  applyMerge(op1: DocumentOperation, op2: DocumentOperation): DocumentOperation {
    if (op1.type === 'update' && op2.type === 'update' && op1.position === op2.position) {
      return {
        ...op1,
        content: (op1.content || '') + (op2.content || ''),
        operationId: generateId('op'),
        timestamp: new Date(),
      };
    }
    if (op1.type === 'insert' && op2.type === 'insert') {
      return {
        ...op1,
        content: (op1.content || '') + (op2.content || ''),
        operationId: generateId('op'),
        timestamp: new Date(),
      };
    }
    return op1.timestamp > op2.timestamp ? op1 : op2;
  }

  addConflict(conflict: Conflict): void {
    this.conflicts.set(conflict.conflictId, conflict);
  }
}

export class NotificationServiceImpl implements NotificationService {
  private notifications: Map<string, Notification[]> = new Map();

  async createNotification(userId: string, event: CollaborationEvent): Promise<Notification> {
    const notification: Notification = {
      notificationId: generateId('notif'),
      userId,
      event,
      read: false,
      createdAt: new Date(),
    };
    const userNotifications = this.notifications.get(userId) || [];
    userNotifications.push(notification);
    this.notifications.set(userId, userNotifications);
    return notification;
  }

  async getNotifications(userId: string, _unreadOnly: boolean = false): Promise<Notification[]> {
    return this.notifications.get(userId) || [];
  }

  async markAsRead(notificationId: string): Promise<void> {
    this.notifications.forEach((notifications) => {
      const notif = notifications.find((n) => n.notificationId === notificationId);
      if (notif) {
        notif.read = true;
      }
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    const userNotifications = this.notifications.get(userId);
    if (userNotifications) {
      userNotifications.forEach((n) => {
        n.read = true;
      });
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) {
      return 0;
    }
    return userNotifications.filter((n) => !n.read).length;
  }
}

export class CollaborationServiceImpl implements CollaborationService {
  private connections: Map<string, WebSocketConnection> = new Map();
  private userDocuments: Map<string, Set<string>> = new Map();

  async joinDocument(userId: string, documentId: string): Promise<void> {
    const connectionId = generateId('conn');
    this.connections.set(userId, {
      connectionId,
      userId,
      documentId,
      connectedAt: new Date(),
      lastActivityAt: new Date(),
    });

    const docs = this.userDocuments.get(userId) || new Set();
    docs.add(documentId);
    this.userDocuments.set(userId, docs);
  }

  async leaveDocument(userId: string, documentId: string): Promise<void> {
    const connection = this.connections.get(userId);
    if (connection && connection.documentId === documentId) {
      this.connections.delete(userId);
    }

    const docs = this.userDocuments.get(userId);
    if (docs) {
      docs.delete(documentId);
    }
  }

  async getActiveDocuments(userId: string): Promise<string[]> {
    const docs = this.userDocuments.get(userId);
    return docs ? Array.from(docs) : [];
  }

  async getConnectionInfo(userId: string): Promise<WebSocketConnection | null> {
    return this.connections.get(userId) || null;
  }
}

export class RealTimeCollaboration {
  private presenceService: PresenceService;
  private selectionService: SelectionService;
  private documentService: DocumentService;
  private conflictService: ConflictResolutionService;
  private notificationService: NotificationService;
  private collaborationService: CollaborationService;
  private config: CollaborationConfig;

  constructor(config: Partial<CollaborationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.presenceService = new PresenceServiceImpl();
    this.selectionService = new SelectionServiceImpl();
    this.documentService = new DocumentServiceImpl();
    this.conflictService = new ConflictResolutionServiceImpl();
    this.notificationService = new NotificationServiceImpl();
    this.collaborationService = new CollaborationServiceImpl();
  }

  getPresenceService(): PresenceService {
    return this.presenceService;
  }

  getSelectionService(): SelectionService {
    return this.selectionService;
  }

  getDocumentService(): DocumentService {
    return this.documentService;
  }

  getConflictService(): ConflictResolutionService {
    return this.conflictService;
  }

  getNotificationService(): NotificationService {
    return this.notificationService;
  }

  getCollaborationService(): CollaborationService {
    return this.collaborationService;
  }

  async setUserPresence(
    userId: string,
    documentId: string,
    presence: PresenceState,
    statusMessage?: string
  ): Promise<void> {
    await this.presenceService.setPresence(userId, documentId, presence, statusMessage);
    const event = this.createEvent('presence_change', documentId, userId, { presence, statusMessage });
    await this.notificationService.createNotification(userId, event);
  }

  async updateCursor(
    userId: string,
    documentId: string,
    type: CursorType,
    position: { start: number; end?: number },
    color: string,
    label: string
  ): Promise<CursorPosition> {
    const cursor = await this.presenceService.updateCursor(userId, documentId, {
      type,
      position,
      documentId,
      color,
      label,
    });
    const event = this.createEvent('cursor_move', documentId, userId, cursor);
    const presence = await this.presenceService.getPresence(userId);
    if (presence) {
      await this.notificationService.createNotification(userId, event);
    }
    return cursor;
  }

  async setUserSelection(
    userId: string,
    documentId: string,
    start: number,
    end: number,
    color: string
  ): Promise<Selection> {
    const selection = await this.selectionService.setSelection(userId, documentId, {
      documentId,
      start,
      end,
      color,
    });
    const event = this.createEvent('selection_change', documentId, userId, selection);
    await this.notificationService.createNotification(userId, event);
    return selection;
  }

  async createDocument(title: string, content?: string, conflictStrategy?: ConflictResolutionStrategy): Promise<CollaborativeDocument> {
    return this.documentService.createDocument(title, content, conflictStrategy);
  }

  async applyDocumentOperation(
    documentId: string,
    userId: string,
    type: OperationType,
    position: number,
    content?: string,
    length?: number
  ): Promise<DocumentOperation> {
    const operation = await this.documentService.applyOperation(documentId, {
      documentId,
      userId,
      type,
      position,
      content,
      length,
    });

    const event = this.createEvent('operation', documentId, userId, operation);
    await this.notificationService.createNotification(userId, event);

    return operation;
  }

  async getDocument(documentId: string): Promise<CollaborativeDocument | null> {
    return this.documentService.getDocument(documentId);
  }

  async getDocumentPresence(documentId: string): Promise<UserPresence[]> {
    return this.presenceService.getDocumentPresence(documentId);
  }

  async getDocumentCursors(documentId: string): Promise<CursorPosition[]> {
    return this.presenceService.getCursors(documentId);
  }

  async getDocumentSelections(documentId: string): Promise<Selection[]> {
    return this.selectionService.getDocumentSelections(documentId);
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return this.notificationService.getNotifications(userId);
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    return this.notificationService.markAsRead(notificationId);
  }

  async joinDocument(userId: string, documentId: string): Promise<void> {
    await this.collaborationService.joinDocument(userId, documentId);
    await this.setUserPresence(userId, documentId, 'online');
  }

  async leaveDocument(userId: string, documentId: string): Promise<void> {
    await this.presenceService.removeCursor(userId, documentId);
    await this.selectionService.clearSelection(userId, documentId);
    await this.collaborationService.leaveDocument(userId, documentId);
    await this.setUserPresence(userId, documentId, 'offline');
  }

  async getActiveDocuments(userId: string): Promise<string[]> {
    return this.collaborationService.getActiveDocuments(userId);
  }

  private createEvent(
    type: CollaborationEvent['type'],
    documentId: string,
    userId: string,
    payload: unknown
  ): CollaborationEvent {
    return {
      eventId: generateId('evt'),
      type,
      documentId,
      userId,
      payload,
      timestamp: new Date(),
    };
  }

  async detectAndResolveConflict(
    documentId: string,
    operation1: DocumentOperation,
    operation2: DocumentOperation
  ): Promise<Conflict | null> {
    if (!this.conflictService.detectConflict(operation1, operation2)) {
      return null;
    }

    const doc = await this.documentService.getDocument(documentId);
    if (!doc) {
      return null;
    }

    const conflict: Conflict = {
      conflictId: generateId('conf'),
      documentId,
      operation1,
      operation2,
      resolution: doc.conflictStrategy,
      timestamp: new Date(),
    };

    const resolved = this.conflictService.resolve(operation1, operation2, doc.conflictStrategy);
    conflict.resolvedOperation = resolved;

    (this.conflictService as ConflictResolutionServiceImpl).addConflict(conflict);

    const event = this.createEvent('conflict', documentId, operation1.userId, conflict);
    await this.notificationService.createNotification(operation1.userId, event);

    return conflict;
  }
}

export function createRealTimeCollaboration(config?: Partial<CollaborationConfig>): RealTimeCollaboration {
  return new RealTimeCollaboration(config);
}
