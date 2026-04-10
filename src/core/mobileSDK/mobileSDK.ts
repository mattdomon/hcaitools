/**
 * Mobile App SDK Implementation
 * Platform abstraction for iOS, Android, React Native, and Flutter
 */

import crypto from 'crypto';
import {
  MobileSDK,
  MobileSDKConfig,
  DeviceInfo,
  MobileSession,
  SyncQueueItem,
  SyncResult,
  SyncConflict,
  SyncProgress,
  PushNotification,
  PushNotificationPayload,
  LocalNotification,
  NotificationPermission,
  AnalyticsEvent,
  NetworkInfo,
  DeepLinkData,
  AuthCredentials,
  AuthCallback,
  TokenRefreshCallback,
  BiometricAuth,
  BiometricType,
  SyncService,
  NotificationService,
  StorageService,
  PlatformBridge,
  MobilePlatform,
  AnalyticsTracker,
  NetworkStatus,
} from './types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export class MobileSDKImpl implements MobileSDK {
  private config: MobileSDKConfig | null = null;
  private session: MobileSession | null = null;
  private syncQueue: SyncQueueItem[] = [];
  private syncProgress: SyncProgress | null = null;
  private offlineStorage: Map<string, unknown> = new Map();
  private authCallback: AuthCallback | null = null;
  private tokenRefreshCallback: TokenRefreshCallback | null = null;
  private _pushReceivedCallbacks: Array<(notification: PushNotification) => void> = [];
  private _notificationOpenedCallbacks: Array<(notification: PushNotification) => void> = [];
  private biometricAuth: BiometricAuthImpl;
  private platformBridge: PlatformBridgeImpl;
  private isInitialized = false;

  constructor() {
    this.biometricAuth = new BiometricAuthImpl();
    this.platformBridge = new PlatformBridgeImpl();
  }

  async initialize(config: MobileSDKConfig): Promise<void> {
    if (this.isInitialized) {
      throw new Error('MobileSDK has already been initialized');
    }

    this.config = {
      ...config,
      enableOfflineSync: config.enableOfflineSync ?? true,
      enablePushNotifications: config.enablePushNotifications ?? true,
      enableAnalytics: config.enableAnalytics ?? true,
      enableBiometricAuth: config.enableBiometricAuth ?? false,
      autoRefreshToken: config.autoRefreshToken ?? true,
      syncOptions: config.syncOptions ?? {
        mode: 'incremental',
        batchSize: 50,
        compressData: true,
        encryptData: false,
        conflictResolution: 'local',
      },
    };

    this.isInitialized = true;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.config) {
      throw new Error('MobileSDK has not been initialized. Call initialize() first.');
    }
  }

  private ensureAuthenticated(): void {
    if (!this.session) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }
  }

  async authenticate(credentials: AuthCredentials): Promise<MobileSession> {
    this.ensureInitialized();

    const sessionId = generateId('sess');
    const deviceId = credentials.deviceId || generateId('dev');

    const session: MobileSession = {
      sessionId,
      userId: credentials.email,
      deviceId,
      accessToken: generateId('tok'),
      refreshToken: generateId('rtok'),
      expiresAt: new Date(Date.now() + 3600000),
      authMethod: 'password',
      createdAt: new Date(),
    };

    this.session = session;

    if (this.authCallback) {
      this.authCallback.onSuccess(session);
    }

    return session;
  }

  async authenticateWithBiometric(deviceId: string, reason: string): Promise<MobileSession> {
    this.ensureInitialized();

    const isAvail = await this.biometricAuth.isAvailable();
    if (!isAvail) {
      throw new Error('Biometric authentication not available');
    }

    const authenticated = await this.biometricAuth.authenticate(reason);
    if (!authenticated) {
      throw new Error('Biometric authentication failed');
    }

    const sessionId = generateId('sess');
    const session: MobileSession = {
      sessionId,
      userId: 'biometric_user',
      deviceId,
      accessToken: generateId('tok'),
      refreshToken: generateId('rtok'),
      expiresAt: new Date(Date.now() + 3600000),
      authMethod: 'biometric',
      createdAt: new Date(),
    };

    this.session = session;

    if (this.authCallback) {
      this.authCallback.onSuccess(session);
    }

    return session;
  }

  async refreshToken(): Promise<string> {
    this.ensureAuthenticated();

    if (!this.session) {
      throw new Error('No session available');
    }

    const newToken = generateId('tok');
    this.session.accessToken = newToken;
    this.session.expiresAt = new Date(Date.now() + 3600000);

    if (this.tokenRefreshCallback) {
      this.tokenRefreshCallback.onSuccess(newToken);
    }

    return newToken;
  }

  async sync(): Promise<SyncResult> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    if (!this.config?.enableOfflineSync) {
      return {
        success: true,
        syncedItems: 0,
        failedItems: 0,
        conflicts: [],
        durationMs: 0,
      };
    }

    const startTime = Date.now();
    this.syncProgress = {
      totalItems: this.syncQueue.length,
      syncedItems: 0,
      failedItems: 0,
      status: 'syncing',
      startedAt: new Date(),
    };

    const conflicts: SyncConflict[] = [];
    let syncedCount = 0;
    let failedCount = 0;

    const batchSize = this.config.syncOptions?.batchSize || 50;

    for (let i = 0; i < this.syncQueue.length; i += batchSize) {
      const batch = this.syncQueue.slice(i, i + batchSize);

      for (const item of batch) {
        try {
          this.syncProgress.currentItem = item.dataId;
          await this.processSyncItem(item);
          syncedCount++;
          this.syncProgress.syncedItems = syncedCount;
        } catch {
          failedCount++;
          this.syncProgress.failedItems = failedCount;
        }
      }
    }

    this.syncQueue = [];
    this.syncProgress.status = 'completed';
    this.syncProgress.completedAt = new Date();

    const result: SyncResult = {
      success: failedCount === 0,
      syncedItems: syncedCount,
      failedItems: failedCount,
      conflicts,
      durationMs: Date.now() - startTime,
    };

    return result;
  }

  private async processSyncItem(_item: SyncQueueItem): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async getSyncStatus(): Promise<SyncProgress> {
    if (!this.isInitialized || !this.config) {
      throw new Error('MobileSDK has not been initialized. Call initialize() first.');
    }
    if (!this.syncProgress) {
      return {
        totalItems: this.syncQueue.length,
        syncedItems: 0,
        failedItems: 0,
        status: 'idle',
        startedAt: new Date(),
      };
    }
    const result = { ...this.syncProgress, totalItems: this.syncQueue.length };
    if (this.syncProgress.status === 'completed') {
      result.totalItems = 0;
    }
    return result;
  }

  async sendPushNotification(_pushPayload: PushNotificationPayload): Promise<void> {
    this.ensureAuthenticated();
  }

  async scheduleLocalNotification(_notification: LocalNotification): Promise<void> {
    this.ensureInitialized();
  }

  async trackAnalytics(event: Omit<AnalyticsEvent, 'eventId' | 'timestamp'>): Promise<void> {
    this.ensureInitialized();

    if (!this.config?.enableAnalytics) {
      return;
    }

    const analyticsEvent: AnalyticsEvent = {
      ...event,
      eventId: generateId('evt'),
      timestamp: new Date(),
    };

    const key = `analytics_${analyticsEvent.eventName}`;
    const existing = this.offlineStorage.get(key) as AnalyticsEvent[] | undefined;
    if (existing) {
      existing.push(analyticsEvent);
      this.offlineStorage.set(key, existing);
    } else {
      this.offlineStorage.set(key, [analyticsEvent]);
    }
  }

  async getOfflineData<T>(key: string): Promise<T | null> {
    const value = this.offlineStorage.get(key);
    return (value as T) ?? null;
  }

  async setOfflineData<T>(key: string, value: T): Promise<void> {
    this.offlineStorage.set(key, value);
  }

  async clearOfflineData(): Promise<void> {
    this.offlineStorage.clear();
  }

  getDeviceInfo(): DeviceInfo {
    const platform = this.config?.platform || 'react_native';
    return {
      deviceId: generateId('dev'),
      platform,
      osVersion: '1.0.0',
      appVersion: this.config?.appVersion || '1.0.0',
      locale: 'en-US',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isEmulator: false,
    };
  }

  async getNetworkStatus(): Promise<NetworkInfo> {
    return this.platformBridge.getNetworkStatus();
  }

  async handleDeepLink(url: string): Promise<DeepLinkData | null> {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);

      const params: Record<string, string> = {};
      pathParts.forEach((part, index) => {
        params[`segment${index + 1}`] = part;
      });

      return {
        url,
        path: urlObj.pathname,
        params,
        query: Object.fromEntries(urlObj.searchParams),
      };
    } catch {
      return null;
    }
  }

  setAuthCallback(callback: AuthCallback): void {
    this.authCallback = callback;
  }

  setTokenRefreshCallback(callback: TokenRefreshCallback): void {
    this.tokenRefreshCallback = callback;
  }

  addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): void {
    const queueItem: SyncQueueItem = {
      ...item,
      id: generateId('sync'),
      timestamp: new Date(),
      retryCount: 0,
    };
    this.syncQueue.push(queueItem);
  }

  setSession(session: MobileSession): void {
    this.session = session;
  }

  getSession(): MobileSession | null {
    return this.session;
  }

  getConfig(): MobileSDKConfig | null {
    return this.config;
  }

  getBiometricAuth(): BiometricAuth {
    return this.biometricAuth;
  }

  getPlatformBridge(): PlatformBridge {
    return this.platformBridge;
  }

  get pushCallbacks(): Array<(notification: PushNotification) => void> {
    return this._pushReceivedCallbacks;
  }

  get notificationCallbacks(): Array<(notification: PushNotification) => void> {
    return this._notificationOpenedCallbacks;
  }
}

class BiometricAuthImpl implements BiometricAuth {
  private available = false;

  async isAvailable(): Promise<boolean> {
    this.available = true;
    return this.available;
  }

  async authenticate(_reason: string): Promise<boolean> {
    if (!this.available) {
      return false;
    }
    return true;
  }

  async getSupportedTypes(): Promise<BiometricType[]> {
    return ['fingerprint', 'face'];
  }
}

class PlatformBridgeImpl implements PlatformBridge {
  private networkStatus: NetworkStatus = 'online';

  getPlatform(): MobilePlatform {
    return 'react_native';
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      deviceId: generateId('dev'),
      platform: this.getPlatform(),
      osVersion: '1.0.0',
      appVersion: '1.0.0',
      locale: 'en-US',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isEmulator: false,
    };
  }

  async getNetworkStatus(): Promise<NetworkInfo> {
    return {
      status: this.networkStatus,
      isConnected: this.networkStatus === 'online',
      isMetered: false,
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
    };
  }

  async showAlert(_title: string, _message: string): Promise<void> {
  }

  async vibrate(_pattern?: number[]): Promise<void> {
  }

  async getAppVersion(): Promise<string> {
    return '1.0.0';
  }

  async openURL(_url: string): Promise<void> {
  }

  async canOpenURL(_url: string): Promise<boolean> {
    return false;
  }

  setNetworkStatus(status: NetworkStatus): void {
    this.networkStatus = status;
  }
}

export class SyncServiceImpl implements SyncService {
  private sdk: MobileSDKImpl;
  private isCancelled = false;

  constructor(sdk: MobileSDKImpl) {
    this.sdk = sdk;
  }

  async sync(): Promise<SyncResult> {
    this.isCancelled = false;
    return this.sdk.sync();
  }

  async getStatus(): Promise<SyncProgress> {
    return this.sdk.getSyncStatus();
  }

  async addToQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    this.sdk.addToSyncQueue(item);
  }

  async resolveConflict(_conflictId: string, _resolution: 'local' | 'remote'): Promise<void> {
  }

  async cancelSync(): Promise<void> {
    this.isCancelled = true;
  }
}

export class NotificationServiceImpl implements NotificationService {
  private sdk: MobileSDKImpl;
  private permission: NotificationPermission = {
    granted: false,
    status: 'notDetermined',
  };

  constructor(sdk: MobileSDKImpl) {
    this.sdk = sdk;
  }

  async requestPermission(): Promise<NotificationPermission> {
    this.permission = {
      granted: true,
      status: 'granted',
    };
    return this.permission;
  }

  async getPermission(): Promise<NotificationPermission> {
    return this.permission;
  }

  onPushReceived(callback: (notification: PushNotification) => void): void {
    this.sdk.pushCallbacks.push(callback);
  }

  onNotificationOpened(callback: (notification: PushNotification) => void): void {
    this.sdk.notificationCallbacks.push(callback);
  }

  async setBadgeCount(_count: number): Promise<void> {
  }

  async clearBadge(): Promise<void> {
  }

  async subscribeToTopic(_topic: string): Promise<void> {
  }

  async unsubscribeFromTopic(_topic: string): Promise<void> {
  }

  simulatePushReceived(notification: PushNotification): void {
    for (const callback of this.sdk.pushCallbacks) {
      callback(notification);
    }
  }
}

export class StorageServiceImpl implements StorageService {
  private storage: Map<string, unknown> = new Map();

  async getData<T>(key: string): Promise<T | null> {
    const value = this.storage.get(key);
    return (value as T) ?? null;
  }

  async setData<T>(key: string, value: T): Promise<void> {
    this.storage.set(key, value);
  }

  async removeData(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async clearAll(): Promise<void> {
    this.storage.clear();
  }

  async getAllKeys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }
}

export class AnalyticsServiceMobile implements AnalyticsTracker {
  private sdk: MobileSDKImpl;
  private userProperties: Record<string, unknown> = {};

  constructor(sdk: MobileSDKImpl) {
    this.sdk = sdk;
  }

  async trackScreen(name: string, properties?: Record<string, unknown>): Promise<void> {
    const deviceInfo = await this.sdk.getDeviceInfo();
    await this.sdk.trackAnalytics({
      eventName: 'screen_view',
      properties: { screenName: name, ...properties },
      platform: deviceInfo.platform,
      deviceId: deviceInfo.deviceId,
      sessionId: this.sdk.getSession()?.sessionId || 'unknown',
    });
  }

  async trackEvent(name: string, properties?: Record<string, unknown>): Promise<void> {
    const deviceInfo = await this.sdk.getDeviceInfo();
    await this.sdk.trackAnalytics({
      eventName: name,
      properties: properties || {},
      platform: deviceInfo.platform,
      deviceId: deviceInfo.deviceId,
      sessionId: this.sdk.getSession()?.sessionId || 'unknown',
    });
  }

  async trackUserAction(action: string, properties?: Record<string, unknown>): Promise<void> {
    await this.trackEvent(`user_action_${action}`, properties);
  }

  async trackError(error: Error, context?: Record<string, unknown>): Promise<void> {
    await this.trackEvent('error', {
      errorMessage: error.message,
      errorName: error.name,
      ...context,
    });
  }

  async setUserProperties(properties: Record<string, unknown>): Promise<void> {
    this.userProperties = { ...this.userProperties, ...properties };
  }

  getUserProperties(): Record<string, unknown> {
    return { ...this.userProperties };
  }
}

export function createMobileSDK(): MobileSDKImpl {
  return new MobileSDKImpl();
}

export function createSyncService(sdk: MobileSDKImpl): SyncServiceImpl {
  return new SyncServiceImpl(sdk);
}

export function createNotificationService(sdk: MobileSDKImpl): NotificationServiceImpl {
  return new NotificationServiceImpl(sdk);
}

export function createStorageService(): StorageServiceImpl {
  return new StorageServiceImpl();
}

export function createAnalyticsService(sdk: MobileSDKImpl): AnalyticsServiceMobile {
  return new AnalyticsServiceMobile(sdk);
}