/**
 * Real-time Collaboration Types
 * Presence awareness, cursor sharing, document editing, and conflict resolution
 */

export type PresenceState = 'online' | 'away' | 'busy' | 'offline';
export type CursorType = 'pointer' | 'selection' | 'text';
export type ConflictResolutionStrategy = 'last_write_wins' | 'operational_transform' | 'merge';
export type OperationType = 'insert' | 'delete' | 'update';

export interface CursorPosition {
  cursorId: string;
  userId: string;
  type: CursorType;
  position: {
    start: number;
    end?: number;
  };
  documentId: string;
  color: string;
  label: string;
  timestamp: Date;
}

export interface UserPresence {
  userId: string;
  presence: PresenceState;
  lastSeenAt: Date;
  statusMessage?: string;
  documentId?: string;
  cursor?: CursorPosition;
}

export interface Selection {
  selectionId: string;
  userId: string;
  documentId: string;
  start: number;
  end: number;
  color: string;
  timestamp: Date;
}

export interface DocumentOperation {
  operationId: string;
  documentId: string;
  userId: string;
  type: OperationType;
  position: number;
  content?: string;
  length?: number;
  timestamp: Date;
  version: number;
}

export interface DocumentVersion {
  version: number;
  operations: DocumentOperation[];
  timestamp: Date;
  userId: string;
}

export interface CollaborativeDocument {
  documentId: string;
  title: string;
  content: string;
  version: number;
  activeUsers: string[];
  selections: Selection[];
  cursors: Map<string, CursorPosition>;
  conflictStrategy: ConflictResolutionStrategy;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conflict {
  conflictId: string;
  documentId: string;
  operation1: DocumentOperation;
  operation2: DocumentOperation;
  resolvedOperation?: DocumentOperation;
  resolution: ConflictResolutionStrategy;
  timestamp: Date;
}

export interface CollaborationEvent {
  eventId: string;
  type: 'presence_change' | 'cursor_move' | 'selection_change' | 'operation' | 'conflict' | 'sync';
  documentId: string;
  userId: string;
  payload: unknown;
  timestamp: Date;
}

export interface NotificationPreferences {
  userId: string;
  emailOnJoin: boolean;
  emailOnLeave: boolean;
  emailOnEdit: boolean;
  pushOnJoin: boolean;
  pushOnLeave: boolean;
  pushOnEdit: boolean;
  inAppOnJoin: boolean;
  inAppOnLeave: boolean;
  inAppOnEdit: boolean;
}

export interface Notification {
  notificationId: string;
  userId: string;
  event: CollaborationEvent;
  read: boolean;
  createdAt: Date;
}

export interface WebSocketMessage {
  messageId: string;
  type: 'presence' | 'cursor' | 'selection' | 'operation' | 'sync' | 'conflict' | 'ack' | 'error';
  payload: unknown;
  timestamp: Date;
}

export interface WebSocketConnection {
  connectionId: string;
  userId: string;
  documentId?: string;
  connectedAt: Date;
  lastActivityAt: Date;
}

export interface PresenceService {
  setPresence(userId: string, documentId: string, presence: PresenceState, statusMessage?: string): Promise<void>;
  getPresence(userId: string): Promise<UserPresence | null>;
  getDocumentPresence(documentId: string): Promise<UserPresence[]>;
  updateCursor(userId: string, documentId: string, cursor: Omit<CursorPosition, 'cursorId' | 'userId' | 'timestamp'>): Promise<CursorPosition>;
  removeCursor(userId: string, documentId: string): Promise<void>;
  getCursors(documentId: string): Promise<CursorPosition[]>;
}

export interface SelectionService {
  setSelection(userId: string, documentId: string, selection: Omit<Selection, 'selectionId' | 'userId' | 'timestamp'>): Promise<Selection>;
  getSelection(userId: string, documentId: string): Promise<Selection | null>;
  clearSelection(userId: string, documentId: string): Promise<void>;
  getDocumentSelections(documentId: string): Promise<Selection[]>;
}

export interface DocumentService {
  createDocument(title: string, content?: string, conflictStrategy?: ConflictResolutionStrategy): Promise<CollaborativeDocument>;
  getDocument(documentId: string): Promise<CollaborativeDocument | null>;
  updateDocument(documentId: string, content: string): Promise<CollaborativeDocument>;
  applyOperation(documentId: string, operation: Omit<DocumentOperation, 'operationId' | 'timestamp' | 'version'>): Promise<DocumentOperation>;
  getHistory(documentId: string, limit?: number): Promise<DocumentVersion[]>;
  resolveConflict(conflictId: string, resolution: ConflictResolutionStrategy): Promise<Conflict>;
}

export interface ConflictResolutionService {
  detectConflict(operation1: DocumentOperation, operation2: DocumentOperation): boolean;
  resolve(operation1: DocumentOperation, operation2: DocumentOperation, strategy: ConflictResolutionStrategy): DocumentOperation;
  getConflicts(documentId: string): Promise<Conflict[]>;
  applyOperationalTransform(op1: DocumentOperation, op2: DocumentOperation): DocumentOperation;
  applyMerge(op1: DocumentOperation, op2: DocumentOperation): DocumentOperation;
}

export interface NotificationService {
  createNotification(userId: string, event: CollaborationEvent): Promise<Notification>;
  getNotifications(userId: string, unreadOnly?: boolean): Promise<Notification[]>;
  markAsRead(notificationId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
}

export interface CollaborationService {
  joinDocument(userId: string, documentId: string): Promise<void>;
  leaveDocument(userId: string, documentId: string): Promise<void>;
  getActiveDocuments(userId: string): Promise<string[]>;
  getConnectionInfo(userId: string): Promise<WebSocketConnection | null>;
}

export interface CollaborationState {
  documents: Map<string, CollaborativeDocument>;
  presence: Map<string, UserPresence>;
  selections: Map<string, Selection>;
  cursors: Map<string, Map<string, CursorPosition>>;
  conflicts: Map<string, Conflict>;
  notifications: Map<string, Notification[]>;
  connections: Map<string, WebSocketConnection>;
}

export interface CollaborationConfig {
  maxPresenceAge: number;
  cursorThrottleMs: number;
  selectionThrottleMs: number;
  operationThrottleMs: number;
  conflictDetectionWindow: number;
  heartbeatIntervalMs: number;
  notificationRetentionDays: number;
}

export const DEFAULT_CONFIG: CollaborationConfig = {
  maxPresenceAge: 300000,
  cursorThrottleMs: 50,
  selectionThrottleMs: 100,
  operationThrottleMs: 50,
  conflictDetectionWindow: 1000,
  heartbeatIntervalMs: 30000,
  notificationRetentionDays: 7,
};
