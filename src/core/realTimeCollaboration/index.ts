/**
 * Real-time Collaboration Module
 * Presence awareness, cursor sharing, document editing, and conflict resolution
 */

export {
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
  NotificationPreferences,
  Notification,
  WebSocketMessage,
  WebSocketConnection,
  PresenceService,
  SelectionService,
  DocumentService,
  ConflictResolutionService,
  NotificationService,
  CollaborationService,
  CollaborationState,
  CollaborationConfig,
  DEFAULT_CONFIG,
} from './types';

export {
  RealTimeCollaboration,
  createRealTimeCollaboration,
  PresenceServiceImpl,
  SelectionServiceImpl,
  DocumentServiceImpl,
  ConflictResolutionServiceImpl,
  NotificationServiceImpl,
  CollaborationServiceImpl,
} from './realTimeCollaboration';
