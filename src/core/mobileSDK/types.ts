/**
 * Mobile App SDK Types
 * Platform abstraction for iOS, Android, React Native, and Flutter
 */

export type MobilePlatform = 'ios' | 'android' | 'react_native' | 'flutter';
export type SyncMode = 'full' | 'incremental' | 'delta';
export type AuthMethod = 'biometric' | 'pin' | 'password';
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'completed';
export type NetworkStatus = 'online' | 'offline' | 'metered';
export type NotificationType = 'push' | 'local';

export interface PlatformConfig {
  platform: MobilePlatform;
  apiKey: string;
  apiEndpoint: string;
  appVersion: string;
  environment: 'development' | 'production' | 'staging';
  timeout?: number;
  retryAttempts?: number;
}

export interface DeviceInfo {
  deviceId: string;
  platform: MobilePlatform;
  osVersion: string;
  appVersion: string;
  manufacturer?: string;
  model?: string;
  locale: string;
  timezone: string;
  screenResolution?: string;
  isEmulator?: boolean;
}

export interface MobileSession {
  sessionId: string;
  userId: string;
  deviceId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  authMethod: AuthMethod;
  createdAt: Date;
}

export interface SyncableData<T = unknown> {
  id: string;
  type: string;
  payload: T;
  version: number;
  lastModified: Date;
  syncState: 'pending' | 'synced' | 'conflict';
  checksum?: string;
}

export interface SyncQueueItem {
  id: string;
  dataId: string;
  operation: 'create' | 'update' | 'delete';
  data: unknown;
  timestamp: Date;
  retryCount: number;
  lastError?: string;
}

export interface SyncResult {
  success: boolean;
  syncedItems: number;
  failedItems: number;
  conflicts: SyncConflict[];
  durationMs: number;
}

export interface SyncConflict {
  id: string;
  localVersion: unknown;
  remoteVersion: unknown;
  resolution: 'local' | 'remote' | 'merged';
  resolvedAt?: Date;
}

export interface SyncOptions {
  mode: SyncMode;
  batchSize?: number;
  compressData?: boolean;
  encryptData?: boolean;
  conflictResolution?: 'local' | 'remote' | 'ask';
}

export interface SyncProgress {
  totalItems: number;
  syncedItems: number;
  failedItems: number;
  currentItem?: string;
  status: SyncStatus;
  startedAt: Date;
  completedAt?: Date;
}

export interface PushNotification {
  notificationId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: string;
  category?: string;
  priority?: 'low' | 'normal' | 'high';
  collapseKey?: string;
  channelId?: string;
  icon?: string;
  color?: string;
  tag?: string;
  receivedAt: Date;
  actionTaken?: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: string;
  category?: string;
  priority?: 'low' | 'normal' | 'high';
  collapseKey?: string;
  icon?: string;
  color?: string;
  tag?: string;
}

export interface LocalNotification {
  notificationId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  triggerTime: Date;
  repeatInterval?: 'minute' | 'hour' | 'day' | 'week';
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  title: string;
  icon?: string;
  foreground?: boolean;
}

export interface NotificationPermission {
  granted: boolean;
  provisional?: boolean;
  status: 'granted' | 'denied' | 'notDetermined' | 'provisional';
}

export interface AnalyticsEvent {
  eventId: string;
  eventName: string;
  properties: Record<string, unknown>;
  timestamp: Date;
  platform: MobilePlatform;
  deviceId: string;
  sessionId: string;
}

export interface AnalyticsTracker {
  trackScreen(name: string, properties?: Record<string, unknown>): Promise<void>;
  trackEvent(name: string, properties?: Record<string, unknown>): Promise<void>;
  trackUserAction(action: string, properties?: Record<string, unknown>): Promise<void>;
  trackError(error: Error, context?: Record<string, unknown>): Promise<void>;
  setUserProperties(properties: Record<string, unknown>): Promise<void>;
}

export interface BiometricAuth {
  isAvailable(): Promise<boolean>;
  authenticate(reason: string): Promise<boolean>;
  getSupportedTypes(): Promise<BiometricType[]>;
}

export type BiometricType = 'fingerprint' | 'face' | 'iris';

export interface AuthCallback {
  onSuccess(session: MobileSession): void;
  onError(error: Error): void;
  onMFARequired(method: AuthMethod): void;
}

export interface TokenRefreshCallback {
  onSuccess(newToken: string): void;
  onError(error: Error): void;
}

export interface OfflineStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  has(key: string): Promise<boolean>;
}

export interface NetworkInfo {
  status: NetworkStatus;
  isConnected: boolean;
  isMetered?: boolean;
  effectiveType?: '2g' | '3g' | '4g' | '5g' | 'unknown';
  downlink?: number;
  rtt?: number;
}

export interface DeepLinkData {
  url: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
}

export interface MobileSDKConfig extends PlatformConfig {
  enableOfflineSync?: boolean;
  enablePushNotifications?: boolean;
  enableAnalytics?: boolean;
  enableBiometricAuth?: boolean;
  autoRefreshToken?: boolean;
  syncOptions?: SyncOptions;
  notificationChannels?: string[];
}

export interface MobileSDK {
  initialize(config: MobileSDKConfig): Promise<void>;
  authenticate(credentials: AuthCredentials): Promise<MobileSession>;
  authenticateWithBiometric(deviceId: string, reason: string): Promise<MobileSession>;
  refreshToken(): Promise<string>;
  sync(): Promise<SyncResult>;
  getSyncStatus(): Promise<SyncProgress>;
  sendPushNotification(pushPayload: PushNotificationPayload): Promise<void>;
  scheduleLocalNotification(notification: LocalNotification): Promise<void>;
  trackAnalytics(event: Omit<AnalyticsEvent, 'eventId' | 'timestamp'>): Promise<void>;
  getOfflineData<T>(key: string): Promise<T | null>;
  setOfflineData<T>(key: string, value: T): Promise<void>;
  clearOfflineData(): Promise<void>;
  getDeviceInfo(): DeviceInfo;
  getNetworkStatus(): Promise<NetworkInfo>;
  handleDeepLink(url: string): Promise<DeepLinkData | null>;
  setAuthCallback(callback: AuthCallback): void;
  setTokenRefreshCallback(callback: TokenRefreshCallback): void;
}

export interface AuthCredentials {
  email: string;
  password: string;
  deviceId: string;
  deviceInfo?: Partial<DeviceInfo>;
}

export interface AuthResult {
  success: boolean;
  session?: MobileSession;
  mfaRequired?: boolean;
  mfaToken?: string;
  error?: string;
}

export interface SyncService {
  sync(): Promise<SyncResult>;
  getStatus(): Promise<SyncProgress>;
  addToQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void>;
  resolveConflict(conflictId: string, resolution: 'local' | 'remote'): Promise<void>;
  cancelSync(): Promise<void>;
}

export interface NotificationService {
  requestPermission(): Promise<NotificationPermission>;
  getPermission(): Promise<NotificationPermission>;
  onPushReceived(callback: (notification: PushNotification) => void): void;
  onNotificationOpened(callback: (notification: PushNotification) => void): void;
  setBadgeCount(count: number): Promise<void>;
  clearBadge(): Promise<void>;
  subscribeToTopic(topic: string): Promise<void>;
  unsubscribeFromTopic(topic: string): Promise<void>;
}

export interface StorageService {
  getData<T>(key: string): Promise<T | null>;
  setData<T>(key: string, value: T): Promise<void>;
  removeData(key: string): Promise<void>;
  clearAll(): Promise<void>;
  getAllKeys(): Promise<string[]>;
}

export interface PlatformBridge {
  getPlatform(): MobilePlatform;
  getDeviceInfo(): Promise<DeviceInfo>;
  getNetworkStatus(): Promise<NetworkInfo>;
  showAlert(title: string, message: string): Promise<void>;
  vibrate(pattern?: number[]): Promise<void>;
  getAppVersion(): Promise<string>;
  openURL(url: string): Promise<void>;
  canOpenURL(url: string): Promise<boolean>;
}