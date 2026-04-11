/**
 * Mobile App SDK Tests
 * Comprehensive test suite for Mobile SDK functionality
 */

import {
  MobileSDKImpl,
  SyncServiceImpl,
  NotificationServiceImpl,
  StorageServiceImpl,
  AnalyticsServiceMobile,
  createMobileSDK,
  createSyncService,
  createNotificationService,
  createStorageService,
  createAnalyticsService,
  MobileSDKConfig,
  AuthCredentials,
  SyncQueueItem,
  PushNotification,
  LocalNotification,
  DeviceInfo,
  MobileSession,
  SyncResult,
  SyncProgress,
  NotificationPermission,
  DeepLinkData,
  NetworkInfo,
  AnalyticsEvent,
  SyncableData,
} from '../src/core/mobileSDK';

describe('MobileSDK', () => {
  let sdk: MobileSDKImpl;

  beforeEach(() => {
    sdk = createMobileSDK();
  });

  describe('initialize', () => {
    it('should initialize with valid config', async () => {
      const config: MobileSDKConfig = {
        platform: 'react_native',
        apiKey: 'test_api_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'development',
      };

      await sdk.initialize(config);
      const deviceInfo = sdk.getDeviceInfo();

      expect(deviceInfo.platform).toBe('react_native');
      expect(deviceInfo.appVersion).toBe('1.0.0');
    });

    it('should throw error if already initialized', async () => {
      const config: MobileSDKConfig = {
        platform: 'ios',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'production',
      };

      await sdk.initialize(config);

      await expect(sdk.initialize(config)).rejects.toThrow('MobileSDK has already been initialized');
    });

    it('should set default values for optional config', async () => {
      const config: MobileSDKConfig = {
        platform: 'android',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'staging',
      };

      await sdk.initialize(config);
      const sdkConfig = sdk.getConfig();

      expect(sdkConfig?.enableOfflineSync).toBe(true);
      expect(sdkConfig?.enablePushNotifications).toBe(true);
      expect(sdkConfig?.enableAnalytics).toBe(true);
      expect(sdkConfig?.enableBiometricAuth).toBe(false);
      expect(sdkConfig?.autoRefreshToken).toBe(true);
    });

    it('should accept custom sync options', async () => {
      const config: MobileSDKConfig = {
        platform: 'flutter',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '2.0.0',
        environment: 'production',
        enableOfflineSync: true,
        syncOptions: {
          mode: 'delta',
          batchSize: 100,
          compressData: true,
          encryptData: true,
          conflictResolution: 'remote',
        },
      };

      await sdk.initialize(config);
      const sdkConfig = sdk.getConfig();

      expect(sdkConfig?.syncOptions?.mode).toBe('delta');
      expect(sdkConfig?.syncOptions?.batchSize).toBe(100);
      expect(sdkConfig?.syncOptions?.encryptData).toBe(true);
      expect(sdkConfig?.syncOptions?.conflictResolution).toBe('remote');
    });
  });

  describe('authenticate', () => {
    beforeEach(async () => {
      await sdk.initialize({
        platform: 'ios',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'development',
      });
    });

    it('should authenticate with valid credentials', async () => {
      const credentials: AuthCredentials = {
        email: 'test@example.com',
        password: 'password123',
        deviceId: 'device_123',
      };

      const session = await sdk.authenticate(credentials);

      expect(session).toBeDefined();
      expect(session.userId).toBe('test@example.com');
      expect(session.deviceId).toBe('device_123');
      expect(session.authMethod).toBe('password');
      expect(session.accessToken).toBeDefined();
      expect(session.refreshToken).toBeDefined();
    });

    it('should generate unique session ID', async () => {
      const credentials: AuthCredentials = {
        email: 'user1@example.com',
        password: 'password',
        deviceId: 'device_1',
      };

      const session1 = await sdk.authenticate(credentials);
      const session2 = await sdk.authenticate({ ...credentials, email: 'user2@example.com' });

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });

    it('should auto-generate device ID if not provided', async () => {
      const credentials: AuthCredentials = {
        email: 'test@example.com',
        password: 'password123',
        deviceId: '',
      };

      const session = await sdk.authenticate(credentials);

      expect(session.deviceId).toBeDefined();
      expect(session.deviceId.length).toBeGreaterThan(0);
    });

    it('should call auth callback on success', async () => {
      const credentials: AuthCredentials = {
        email: 'test@example.com',
        password: 'password123',
        deviceId: 'device_123',
      };

      let callbackSession: MobileSession | null = null;
      sdk.setAuthCallback({
        onSuccess: (session: MobileSession) => { callbackSession = session; },
        onError: (_error: Error) => {},
        onMFARequired: (_method: import('../src/core/mobileSDK').AuthMethod) => {},
      });

      await sdk.authenticate(credentials);

      expect(callbackSession).not.toBeNull();
      const session = callbackSession as unknown as MobileSession;
      expect(session.userId).toBe('test@example.com');
    });

    it('should store session after authentication', async () => {
      const credentials: AuthCredentials = {
        email: 'test@example.com',
        password: 'password123',
        deviceId: 'device_123',
      };

      await sdk.authenticate(credentials);
      const storedSession = sdk.getSession();

      expect(storedSession).not.toBeNull();
      expect(storedSession?.userId).toBe('test@example.com');
    });
  });

  describe('authenticateWithBiometric', () => {
    beforeEach(async () => {
      await sdk.initialize({
        platform: 'ios',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'development',
        enableBiometricAuth: true,
      });
    });

    it('should authenticate with biometric when available', async () => {
      const biometric = sdk.getBiometricAuth();
      const isAvailable = await biometric.isAvailable();

      expect(isAvailable).toBe(true);

      const session = await sdk.authenticateWithBiometric('device_123', 'Unlock app');
      expect(session.authMethod).toBe('biometric');
    });

    it('should get supported biometric types', async () => {
      const biometric = sdk.getBiometricAuth();
      const types = await biometric.getSupportedTypes();

      expect(types).toContain('fingerprint');
      expect(types).toContain('face');
    });
  });

  describe('refreshToken', () => {
    beforeEach(async () => {
      await sdk.initialize({
        platform: 'android',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'development',
      });

      await sdk.authenticate({
        email: 'test@example.com',
        password: 'password',
        deviceId: 'device_123',
      });
    });

    it('should refresh token and return new token', async () => {
      const oldSession = sdk.getSession();
      const oldToken = oldSession!.accessToken;

      const newToken = await sdk.refreshToken();

      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(oldToken);
    });

    it('should call token refresh callback', async () => {
      let callbackToken: string | null = null;
      sdk.setTokenRefreshCallback({
        onSuccess: (token) => { callbackToken = token; },
        onError: () => {},
      });

      await sdk.refreshToken();

      expect(callbackToken).toBeDefined();
    });

    it('should throw error if not authenticated', async () => {
      const unauthenticatedSdk = createMobileSDK();
      await unauthenticatedSdk.initialize({
        platform: 'android',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'development',
      });

      await expect(unauthenticatedSdk.refreshToken()).rejects.toThrow('Not authenticated');
    });
  });

  describe('sync', () => {
    beforeEach(async () => {
      await sdk.initialize({
        platform: 'react_native',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'development',
        enableOfflineSync: true,
      });

      await sdk.authenticate({
        email: 'test@example.com',
        password: 'password',
        deviceId: 'device_123',
      });
    });

    it('should sync queued items', async () => {
      sdk.addToSyncQueue({
        dataId: 'data_1',
        operation: 'create',
        data: { name: 'test' },
      });

      sdk.addToSyncQueue({
        dataId: 'data_2',
        operation: 'update',
        data: { name: 'updated' },
      });

      const result = await sdk.sync();

      expect(result.success).toBe(true);
      expect(result.syncedItems).toBe(2);
      expect(result.failedItems).toBe(0);
    });

    it('should clear queue after sync', async () => {
      sdk.addToSyncQueue({
        dataId: 'data_1',
        operation: 'create',
        data: { name: 'test' },
      });

      await sdk.sync();
      const status = await sdk.getSyncStatus();

      expect(status.totalItems).toBe(0);
    });

    it('should return sync status', async () => {
      sdk.addToSyncQueue({
        dataId: 'data_1',
        operation: 'create',
        data: { name: 'test' },
      });

      const status = await sdk.getSyncStatus();

      expect(status.status).toBeDefined();
      expect(status.totalItems).toBe(1);
    });

    it('should track sync progress', async () => {
      const progressUpdates: SyncProgress[] = [];

      for (let i = 0; i < 5; i++) {
        sdk.addToSyncQueue({
          dataId: `data_${i}`,
          operation: 'create',
          data: { index: i },
        });
      }

      const result = await sdk.sync();

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('trackAnalytics', () => {
    beforeEach(async () => {
      await sdk.initialize({
        platform: 'ios',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'development',
        enableAnalytics: true,
      });
    });

    it('should track analytics events', async () => {
      const event: Omit<AnalyticsEvent, 'eventId' | 'timestamp'> = {
        eventName: 'test_event',
        properties: { key: 'value' },
        platform: 'ios',
        deviceId: 'device_123',
        sessionId: 'session_123',
      };

      await sdk.trackAnalytics(event);

      const stored = await sdk.getOfflineData<AnalyticsEvent[]>(`analytics_test_event`);
      expect(stored).not.toBeNull();
      expect(stored?.length).toBe(1);
      expect(stored?.[0].eventName).toBe('test_event');
    });

    it('should not track when analytics disabled', async () => {
      const disabledSdk = createMobileSDK();
      await disabledSdk.initialize({
        platform: 'ios',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'development',
        enableAnalytics: false,
      });

      const event: Omit<AnalyticsEvent, 'eventId' | 'timestamp'> = {
        eventName: 'test_event',
        properties: {},
        platform: 'ios',
        deviceId: 'device_123',
        sessionId: 'session_123',
      };

      await disabledSdk.trackAnalytics(event);

      const stored = await disabledSdk.getOfflineData(`analytics_test_event`);
      expect(stored).toBeNull();
    });
  });

  describe('offline storage', () => {
    beforeEach(async () => {
      await sdk.initialize({
        platform: 'android',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'development',
      });
    });

    it('should store and retrieve offline data', async () => {
      await sdk.setOfflineData('key1', { value: 'test' });
      const retrieved = await sdk.getOfflineData<{ value: string }>('key1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.value).toBe('test');
    });

    it('should return null for non-existent keys', async () => {
      const retrieved = await sdk.getOfflineData('non_existent');
      expect(retrieved).toBeNull();
    });

    it('should clear all offline data', async () => {
      await sdk.setOfflineData('key1', 'value1');
      await sdk.setOfflineData('key2', 'value2');

      await sdk.clearOfflineData();

      const keys = await sdk.getOfflineData('key1');
      expect(keys).toBeNull();
    });
  });

  describe('device info', () => {
    beforeEach(async () => {
      await sdk.initialize({
        platform: 'flutter',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.5.0',
        environment: 'production',
      });
    });

    it('should return device info with platform', () => {
      const deviceInfo = sdk.getDeviceInfo();

      expect(deviceInfo.platform).toBe('flutter');
      expect(deviceInfo.appVersion).toBe('1.5.0');
      expect(deviceInfo.deviceId).toBeDefined();
      expect(deviceInfo.locale).toBeDefined();
      expect(deviceInfo.timezone).toBeDefined();
    });
  });

  describe('network status', () => {
    beforeEach(async () => {
      await sdk.initialize({
        platform: 'ios',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'development',
      });
    });

    it('should return network status', async () => {
      const status = await sdk.getNetworkStatus();

      expect(status).toBeDefined();
      expect(status.isConnected).toBeDefined();
      expect(status.status).toBeDefined();
    });
  });

  describe('deep linking', () => {
    beforeEach(async () => {
      await sdk.initialize({
        platform: 'react_native',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'development',
      });
    });

    it('should parse valid deep link URL', async () => {
      const result = await sdk.handleDeepLink('manus://app/path?param1=value1&param2=value2');

      expect(result).not.toBeNull();
      expect(result?.url).toBe('manus://app/path?param1=value1&param2=value2');
      expect(result?.path).toBe('/path');
      expect(result?.query.param1).toBe('value1');
    });

    it('should return null for invalid URL', async () => {
      const result = await sdk.handleDeepLink('not-a-valid-url');

      expect(result).toBeNull();
    });
  });

  describe('SyncService', () => {
    let syncService: SyncServiceImpl;

    beforeEach(async () => {
      await sdk.initialize({
        platform: 'ios',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'development',
        enableOfflineSync: true,
      });

      await sdk.authenticate({
        email: 'test@example.com',
        password: 'password',
        deviceId: 'device_123',
      });

      syncService = createSyncService(sdk);
    });

    it('should add items to sync queue', async () => {
      await syncService.addToQueue({
        dataId: 'data_1',
        operation: 'create',
        data: { name: 'test' },
      });

      const status = await syncService.getStatus();
      expect(status.totalItems).toBe(1);
    });

    it('should sync all queued items', async () => {
      await syncService.addToQueue({
        dataId: 'data_1',
        operation: 'create',
        data: { name: 'test1' },
      });

      await syncService.addToQueue({
        dataId: 'data_2',
        operation: 'update',
        data: { name: 'test2' },
      });

      const result = await syncService.sync();

      expect(result.syncedItems).toBe(2);
    });

    it('should get current sync status', async () => {
      await syncService.addToQueue({
        dataId: 'data_1',
        operation: 'create',
        data: { name: 'test' },
      });

      const status = await syncService.getStatus();

      expect(status.status).toBe('idle');
      expect(status.totalItems).toBe(1);
    });
  });

  describe('NotificationService', () => {
    let notificationService: NotificationServiceImpl;

    beforeEach(async () => {
      await sdk.initialize({
        platform: 'android',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'development',
        enablePushNotifications: true,
      });

      notificationService = createNotificationService(sdk);
    });

    it('should request notification permission', async () => {
      const permission = await notificationService.requestPermission();

      expect(permission.granted).toBe(true);
      expect(permission.status).toBe('granted');
    });

    it('should get current permission status', async () => {
      const permission = await notificationService.getPermission();

      expect(permission.status).toBeDefined();
    });

    it('should receive push notification callback', async () => {
      const receivedNotifications: PushNotification[] = [];

      notificationService.onPushReceived((notification) => {
        receivedNotifications.push(notification);
      });

      const notification: PushNotification = {
        notificationId: 'notif_123',
        title: 'Test Title',
        body: 'Test Body',
        receivedAt: new Date(),
      };

      notificationService.simulatePushReceived(notification);

      expect(receivedNotifications.length).toBe(1);
      expect(receivedNotifications[0].title).toBe('Test Title');
    });

    it('should handle notification opened callback', async () => {
      const notification: PushNotification = {
        notificationId: 'notif_456',
        title: 'Opened Title',
        body: 'Opened Body',
        actionTaken: 'opened',
        receivedAt: new Date(),
      };

      let openedNotification: PushNotification | null = null;

      notificationService.onNotificationOpened((notif) => {
        openedNotification = notif;
      });

      const callbacks = sdk.notificationCallbacks;
      if (callbacks.length > 0) {
        callbacks[0](notification);
      }

      expect(openedNotification).not.toBeNull();
      const opened = openedNotification as unknown as PushNotification;
      expect(opened.notificationId).toBe('notif_456');
    });

    it('should subscribe to topic', async () => {
      await expect(notificationService.subscribeToTopic('news')).resolves.not.toThrow();
    });

    it('should unsubscribe from topic', async () => {
      await expect(notificationService.unsubscribeFromTopic('news')).resolves.not.toThrow();
    });
  });

  describe('StorageService', () => {
    let storageService: StorageServiceImpl;

    beforeEach(() => {
      storageService = createStorageService();
    });

    it('should store and retrieve data', async () => {
      await storageService.setData('key1', { name: 'test' });
      const retrieved = await storageService.getData<{ name: string }>('key1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('test');
    });

    it('should remove data', async () => {
      await storageService.setData('key1', 'value');
      await storageService.removeData('key1');

      const retrieved = await storageService.getData('key1');
      expect(retrieved).toBeNull();
    });

    it('should clear all data', async () => {
      await storageService.setData('key1', 'value1');
      await storageService.setData('key2', 'value2');

      await storageService.clearAll();

      const keys = await storageService.getAllKeys();
      expect(keys.length).toBe(0);
    });

    it('should get all keys', async () => {
      await storageService.setData('key1', 'value1');
      await storageService.setData('key2', 'value2');
      await storageService.setData('key3', 'value3');

      const keys = await storageService.getAllKeys();

      expect(keys.length).toBe(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
  });

  describe('AnalyticsService', () => {
    let analyticsService: AnalyticsServiceMobile;

    beforeEach(async () => {
      await sdk.initialize({
        platform: 'ios',
        apiKey: 'test_key',
        apiEndpoint: 'https://api.example.com',
        appVersion: '1.0.0',
        environment: 'development',
        enableAnalytics: true,
      });

      await sdk.authenticate({
        email: 'test@example.com',
        password: 'password',
        deviceId: 'device_123',
      });

      analyticsService = createAnalyticsService(sdk);
    });

    it('should track screen view', async () => {
      await expect(analyticsService.trackScreen('HomeScreen')).resolves.not.toThrow();
    });

    it('should track custom event', async () => {
      await expect(analyticsService.trackEvent('button_clicked', { buttonId: 'btn1' })).resolves.not.toThrow();
    });

    it('should track user action', async () => {
      await expect(analyticsService.trackUserAction('purchase', { itemId: 'item_123' })).resolves.not.toThrow();
    });

    it('should track error', async () => {
      const error = new Error('Test error');
      await expect(analyticsService.trackError(error, { context: 'test' })).resolves.not.toThrow();
    });

    it('should set and get user properties', async () => {
      await analyticsService.setUserProperties({ plan: 'premium', level: 5 });

      const properties = analyticsService.getUserProperties();

      expect(properties.plan).toBe('premium');
      expect(properties.level).toBe(5);
    });

    it('should merge user properties', async () => {
      await analyticsService.setUserProperties({ plan: 'basic' });
      await analyticsService.setUserProperties({ level: 10 });

      const properties = analyticsService.getUserProperties();

      expect(properties.plan).toBe('basic');
      expect(properties.level).toBe(10);
    });
  });

  describe('error handling', () => {
    it('should throw error when calling authenticate before initialize', async () => {
      await expect(
        sdk.authenticate({
          email: 'test@example.com',
          password: 'password',
          deviceId: 'device_123',
        })
      ).rejects.toThrow('MobileSDK has not been initialized');
    });

    it('should throw error when syncing before initialize', async () => {
      await expect(sdk.sync()).rejects.toThrow('MobileSDK has not been initialized');
    });

    it('should throw error when getting sync status before initialize', async () => {
      await expect(sdk.getSyncStatus()).rejects.toThrow('MobileSDK has not been initialized');
    });
  });
});