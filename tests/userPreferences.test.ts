import {
  UserPreferencesManager,
  createUserPreferences,
  generateId,
  createDefaultGeneralPreferences,
  createDefaultAppearancePreferences,
  createDefaultNotificationPreferences,
  createDefaultPrivacyPreferences,
  createDefaultSecurityPreferences,
  createDefaultWorkspacePreferences,
} from '../src/core/userPreferences/userPreferences';
import type {
  UserPreferences,
  PreferenceCategory,
  ThemeMode,
  NotificationChannel,
  NotificationType,
  GeneralPreferences,
  AppearancePreferences,
  NotificationPreferences,
  PrivacyPreferences,
  SecurityPreferences,
  WorkspacePreferences,
  ActivityLogEntry,
} from '../src/core/userPreferences/types';

describe('UserPreferences', () => {
  let manager: UserPreferencesManager;
  const testUserId = 'user_12345';

  beforeEach(() => {
    manager = createUserPreferences({ userId: testUserId });
  });

  describe('createUserPreferences', () => {
    it('should create a new UserPreferencesManager instance', () => {
      expect(manager).toBeInstanceOf(UserPreferencesManager);
    });

    it('should create preferences with default values', () => {
      const prefs = manager.getPreferences();
      expect(prefs.userId).toBe(testUserId);
      expect(prefs.general).toBeDefined();
      expect(prefs.appearance).toBeDefined();
      expect(prefs.notifications).toBeDefined();
      expect(prefs.privacy).toBeDefined();
      expect(prefs.security).toBeDefined();
      expect(prefs.workspace).toBeDefined();
    });

    it('should accept custom default values', () => {
      const customManager = createUserPreferences({
        userId: testUserId,
        defaultLanguage: 'es',
        defaultTimezone: 'America/New_York',
        defaultTheme: 'dark',
      });
      const prefs = customManager.getPreferences();
      expect(prefs.general.language).toBe('es');
      expect(prefs.general.timezone).toBe('America/New_York');
      expect(prefs.appearance.theme).toBe('dark');
    });
  });

  describe('generateId', () => {
    it('should generate IDs with correct format', () => {
      const id = generateId('test');
      expect(id).toMatch(/^test_[a-f0-9]{16}$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');
      expect(id1).not.toBe(id2);
    });
  });

  describe('Default preference creators', () => {
    it('should create default general preferences', () => {
      const general = createDefaultGeneralPreferences(testUserId);
      expect(general.language).toBe('en');
      expect(general.timezone).toBe('UTC');
      expect(general.autoSave).toBe(true);
      expect(general.compactMode).toBe(false);
    });

    it('should create default appearance preferences', () => {
      const appearance = createDefaultAppearancePreferences(testUserId, 'light');
      expect(appearance.theme).toBe('light');
      expect(appearance.accentColor).toBe('#3B82F6');
      expect(appearance.fontSize).toBe('medium');
      expect(appearance.sidebarPosition).toBe('left');
    });

    it('should create default notification preferences', () => {
      const notifications = createDefaultNotificationPreferences(testUserId);
      expect(notifications.channels.email.enabled).toBe(true);
      expect(notifications.channels.sms.enabled).toBe(false);
      expect(notifications.byType.task_assigned).toBe(true);
      expect(notifications.byType.mention).toBe(true);
    });

    it('should create default privacy preferences', () => {
      const privacy = createDefaultPrivacyPreferences(testUserId);
      expect(privacy.profileVisibility).toBe('team_only');
      expect(privacy.activityStatus).toBe('enabled');
      expect(privacy.dataSharing).toBe('disabled');
    });

    it('should create default security preferences', () => {
      const security = createDefaultSecurityPreferences(testUserId);
      expect(security.twoFactorEnabled).toBe(false);
      expect(security.sessionTimeoutMinutes).toBe(30);
      expect(security.ipAllowlist).toEqual([]);
    });

    it('should create default workspace preferences', () => {
      const workspace = createDefaultWorkspacePreferences(testUserId, 'Test Workspace');
      expect(workspace.workspaceName).toBe('Test Workspace');
      expect(workspace.defaultView).toBe('list');
      expect(workspace.allowGuestAccess).toBe(false);
    });
  });

  describe('getPreferences', () => {
    it('should return all preferences', () => {
      const prefs = manager.getPreferences();
      expect(prefs).toHaveProperty('general');
      expect(prefs).toHaveProperty('appearance');
      expect(prefs).toHaveProperty('notifications');
      expect(prefs).toHaveProperty('privacy');
      expect(prefs).toHaveProperty('security');
      expect(prefs).toHaveProperty('workspace');
    });

    it('should return a copy, not the original', () => {
      const prefs1 = manager.getPreferences();
      const prefs2 = manager.getPreferences();
      expect(prefs1).not.toBe(prefs2);
      expect(prefs1).not.toBe(manager.getPreferences());
    });
  });

  describe('getPreferencesByCategory', () => {
    it('should return preferences for each category', () => {
      const categories: PreferenceCategory[] = [
        'general',
        'appearance',
        'notifications',
        'privacy',
        'security',
        'workspace',
      ];

      categories.forEach(category => {
        const prefs = manager.getPreferencesByCategory(category);
        expect(prefs).toBeDefined();
        expect(typeof prefs).toBe('object');
      });
    });
  });

  describe('Theme management', () => {
    it('should set theme to light', () => {
      manager.setTheme('light');
      expect(manager.getTheme()).toBe('light');
    });

    it('should set theme to dark', () => {
      manager.setTheme('dark');
      expect(manager.getTheme()).toBe('dark');
    });

    it('should set theme to system', () => {
      manager.setTheme('system');
      expect(manager.getTheme()).toBe('system');
    });
  });

  describe('updatePreference', () => {
    it('should update a preference successfully', () => {
      const result = manager.updatePreference('general', 'language', 'es');
      expect(result.category).toBe('general');
      expect(result.key).toBe('language');
      expect(result.value).toBe('es');
      expect(result.previousValue).toBe('en');
    });

    it('should update appearance accent color', () => {
      const result = manager.updatePreference('appearance', 'accentColor', '#FF5733');
      expect(result.value).toBe('#FF5733');
    });

    it('should reject invalid theme value', () => {
      expect(() => {
        manager.updatePreference('appearance', 'theme', 'invalid' as ThemeMode);
      }).toThrow('Invalid value for appearance.theme');
    });

    it('should reject invalid accent color format', () => {
      expect(() => {
        manager.updatePreference('appearance', 'accentColor', 'red');
      }).toThrow('Invalid value for appearance.accentColor');
    });

    it('should reject invalid privacy visibility', () => {
      expect(() => {
        manager.updatePreference('privacy', 'profileVisibility', 'invalid' as never);
      }).toThrow('Invalid value for privacy.profileVisibility');
    });

    it('should log activity on update', () => {
      manager.updatePreference('general', 'language', 'fr');
      const log = manager.getActivityLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log[log.length - 1].action).toBe('update');
    });
  });

  describe('Notification management', () => {
    it('should set notification channel settings', () => {
      manager.setNotificationChannel('email', { enabled: false, frequency: 'weekly' });
      const settings = manager.getNotificationChannel('email');
      expect(settings.enabled).toBe(false);
      expect(settings.frequency).toBe('weekly');
    });

    it('should set notification type enabled state', () => {
      manager.setNotificationType('task_assigned', false);
      expect(manager.getNotificationType('task_assigned')).toBe(false);
    });

    it('should get all notification types', () => {
      const prefs = manager.getPreferences();
      expect(prefs.notifications.byType.task_completed).toBe(true);
      expect(prefs.notifications.byType.mention).toBe(true);
    });
  });

  describe('Privacy settings', () => {
    it('should set profile visibility', () => {
      manager.setPrivacySetting('profileVisibility', 'public');
      expect(manager.getPrivacySetting('profileVisibility')).toBe('public');
    });

    it('should set activity status', () => {
      manager.setPrivacySetting('activityStatus', 'disabled');
      expect(manager.getPrivacySetting('activityStatus')).toBe('disabled');
    });

    it('should set data sharing', () => {
      manager.setPrivacySetting('dataSharing', 'enabled');
      expect(manager.getPrivacySetting('dataSharing')).toBe('enabled');
    });
  });

  describe('Security settings', () => {
    it('should set two factor enabled', () => {
      manager.setSecuritySetting('twoFactorEnabled', true);
      expect(manager.getSecuritySetting('twoFactorEnabled')).toBe(true);
    });

    it('should set session timeout', () => {
      manager.setSecuritySetting('sessionTimeoutMinutes', 60);
      expect(manager.getSecuritySetting('sessionTimeoutMinutes')).toBe(60);
    });

    it('should add trusted IP', () => {
      manager.addTrustedIp('192.168.1.1');
      expect(manager.getSecuritySetting('ipAllowlist')).toContain('192.168.1.1');
    });

    it('should not add duplicate IP', () => {
      manager.addTrustedIp('192.168.1.1');
      manager.addTrustedIp('192.168.1.1');
      const list = manager.getSecuritySetting('ipAllowlist');
      expect(list.filter(ip => ip === '192.168.1.1').length).toBe(1);
    });

    it('should remove trusted IP', () => {
      manager.addTrustedIp('192.168.1.1');
      manager.removeTrustedIp('192.168.1.1');
      expect(manager.getSecuritySetting('ipAllowlist')).not.toContain('192.168.1.1');
    });
  });

  describe('Activity logging', () => {
    it('should log activity with category', () => {
      manager.updatePreference('general', 'language', 'de');
      const logs = manager.getActivityLogByCategory('general');
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should filter activity log by date range', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      manager.updatePreference('general', 'language', 'it');
      const logs = manager.getActivityLogByDateRange(yesterday, tomorrow);
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should clear activity log', () => {
      manager.updatePreference('general', 'language', 'pt');
      manager.clearActivityLog();
      expect(manager.getActivityLog().length).toBe(0);
    });
  });

  describe('Reset functionality', () => {
    it('should reset a specific category', () => {
      manager.updatePreference('appearance', 'theme', 'dark');
      manager.resetCategory('appearance');
      expect(manager.getTheme()).toBe('system');
    });

    it('should reset all preferences', () => {
      manager.updatePreference('appearance', 'theme', 'dark');
      manager.updatePreference('general', 'language', 'ja');
      manager.resetAllPreferences();
      expect(manager.getTheme()).toBe('system');
      expect(manager.getPreferences().general.language).toBe('en');
    });
  });

  describe('Import/Export', () => {
    it('should export preferences as JSON', () => {
      const exported = manager.exportPreferences();
      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(parsed.userId).toBe(testUserId);
    });

    it('should import valid preferences', () => {
      manager.setTheme('dark');
      const exported = manager.exportPreferences();
      const newManager = createUserPreferences({ userId: 'user_new' });
      const result = newManager.importPreferences(exported);
      expect(result).toBe(true);
      expect(newManager.getTheme()).toBe('dark');
    });

    it('should reject invalid JSON on import', () => {
      const result = manager.importPreferences('not valid json');
      expect(result).toBe(false);
    });

    it('should reject invalid preferences structure on import', () => {
      const result = manager.importPreferences('{"id": "test"}');
      expect(result).toBe(false);
    });
  });

  describe('Getters', () => {
    it('should get user ID', () => {
      expect(manager.getUserId()).toBe(testUserId);
    });

    it('should get preferences ID', () => {
      expect(manager.getPreferencesId()).toMatch(/^pref_[a-f0-9]{16}$/);
    });

    it('should get created at date', () => {
      expect(manager.getCreatedAt()).toBeInstanceOf(Date);
    });

    it('should get updated at date', () => {
      expect(manager.getUpdatedAt()).toBeInstanceOf(Date);
    });
  });

  describe('Validator management', () => {
    it('should add custom validator', () => {
      manager.addValidator('general', (_cat, key, value) => {
        if (key === 'language') return value === 'valid';
        return true;
      });

      expect(() => {
        manager.updatePreference('general', 'language', 'invalid');
      }).toThrow('Invalid value for general.language');
    });
  });
});
