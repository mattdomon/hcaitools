/**
 * Mobile App SDK Module
 * Platform abstraction for iOS, Android, React Native, and Flutter
 */

export * from './types';
export * from './mobileSDK';

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
} from './mobileSDK';

export {
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
};