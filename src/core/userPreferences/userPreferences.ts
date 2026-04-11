import crypto from 'crypto';
import type {
  UserPreferences,
  PreferenceCategory,
  ThemeMode,
  NotificationChannel,
  NotificationType,
  ProfileVisibility,
  ActivityStatus,
  DataSharing,
  GeneralPreferences,
  AppearancePreferences,
  NotificationPreferences,
  PrivacyPreferences,
  SecurityPreferences,
  WorkspacePreferences,
  ActivityLogEntry,
  PreferenceUpdate,
  UserPreferencesOptions,
  PreferenceValidator,
} from './types';

const generateId = (prefix: string): string => {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
};

const createDefaultGeneralPreferences = (
  _userId: string,
  defaultLanguage = 'en',
  defaultTimezone = 'UTC'
): GeneralPreferences => ({
  language: defaultLanguage,
  timezone: defaultTimezone,
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '24h',
  autoSave: true,
  compactMode: false,
});

const createDefaultAppearancePreferences = (
  _userId: string,
  defaultTheme: ThemeMode = 'system'
): AppearancePreferences => ({
  theme: defaultTheme,
  accentColor: '#3B82F6',
  fontSize: 'medium',
  reducedMotion: false,
  highContrast: false,
  sidebarPosition: 'left',
});

const createDefaultNotificationChannelSettings = (): NotificationPreferences['channels'] => ({
  email: { enabled: true, frequency: 'daily' },
  sms: { enabled: false, frequency: 'immediate' },
  push: { enabled: true, frequency: 'immediate' },
  in_app: { enabled: true, frequency: 'immediate' },
});

const createDefaultNotificationPreferences = (
  _userId: string
): NotificationPreferences => ({
  channels: createDefaultNotificationChannelSettings(),
  byType: {
    task_assigned: true,
    task_completed: true,
    mention: true,
    comment: true,
    share: true,
    system: true,
    team_update: true,
    deadline_reminder: true,
  },
  mentionAll: true,
  mentionTeam: true,
});

const createDefaultPrivacyPreferences = (_userId: string): PrivacyPreferences => ({
  profileVisibility: 'team_only',
  activityStatus: 'enabled',
  dataSharing: 'disabled',
  showEmail: false,
  showPhone: false,
  allowSearchIndexing: false,
});

const createDefaultSecurityPreferences = (_userId: string): SecurityPreferences => ({
  twoFactorEnabled: false,
  sessionTimeoutMinutes: 30,
  apiKeyRotationDays: 90,
  loginAlerts: true,
  trustedDevices: true,
  ipAllowlist: [],
});

const createDefaultWorkspacePreferences = (
  userId: string,
  workspaceName = 'My Workspace'
): WorkspacePreferences => ({
  defaultWorkspaceId: generateId('ws'),
  workspaceName,
  defaultView: 'list',
  notificationsForWorkspace: createDefaultNotificationPreferences(userId),
  teamMembers: [],
  allowGuestAccess: false,
  defaultTeamRole: 'member',
});

export class UserPreferencesManager {
  private preferences: UserPreferences;
  private activityLog: ActivityLogEntry[] = [];
  private validators: Map<PreferenceCategory, PreferenceValidator<unknown>[]> = new Map();

  constructor(options: UserPreferencesOptions) {
    this.preferences = this.createDefaultPreferences(options);
    this.initializeValidators();
  }

  private createDefaultPreferences(options: UserPreferencesOptions): UserPreferences {
    const now = new Date();
    const userId = options.userId;

    return {
      id: generateId('pref'),
      userId,
      general: createDefaultGeneralPreferences(userId, options.defaultLanguage, options.defaultTimezone),
      appearance: createDefaultAppearancePreferences(userId, options.defaultTheme),
      notifications: createDefaultNotificationPreferences(userId),
      privacy: createDefaultPrivacyPreferences(userId),
      security: createDefaultSecurityPreferences(userId),
      workspace: createDefaultWorkspacePreferences(userId),
      createdAt: now,
      updatedAt: now,
    };
  }

  private initializeValidators(): void {
    this.validators.set('general', [
      (_cat, key, value) => {
        if (key === 'language') return typeof value === 'string' && value.length === 2;
        if (key === 'timezone') return typeof value === 'string' && value.length > 0;
        if (key === 'timeFormat') return value === '12h' || value === '24h';
        if (key === 'autoSave' || key === 'compactMode') return typeof value === 'boolean';
        return true;
      },
    ]);

    this.validators.set('appearance', [
      (_cat, key, value) => {
        if (key === 'theme') return ['light', 'dark', 'system'].includes(value as string);
        if (key === 'accentColor') return /^#[0-9A-Fa-f]{6}$/.test(value as string);
        if (key === 'fontSize') return ['small', 'medium', 'large'].includes(value as string);
        if (key === 'reducedMotion' || key === 'highContrast') return typeof value === 'boolean';
        if (key === 'sidebarPosition') return ['left', 'right'].includes(value as string);
        return true;
      },
    ]);

    this.validators.set('notifications', [
      (_cat, _key, _value) => true,
    ]);

    this.validators.set('privacy', [
      (_cat, key, value) => {
        if (key === 'profileVisibility') return ['public', 'private', 'team_only'].includes(value as string);
        if (key === 'activityStatus' || key === 'dataSharing') {
          return value === 'enabled' || value === 'disabled';
        }
        if (key === 'showEmail' || key === 'showPhone' || key === 'allowSearchIndexing') {
          return typeof value === 'boolean';
        }
        return true;
      },
    ]);

    this.validators.set('security', [
      (_cat, key, value) => {
        if (key === 'twoFactorEnabled' || key === 'loginAlerts' || key === 'trustedDevices') {
          return typeof value === 'boolean';
        }
        if (key === 'sessionTimeoutMinutes' || key === 'apiKeyRotationDays') {
          return typeof value === 'number' && value > 0;
        }
        if (key === 'ipAllowlist') return Array.isArray(value);
        return true;
      },
    ]);

    this.validators.set('workspace', [
      (_cat, _key, _value) => true,
    ]);
  }

  private logActivity(
    action: string,
    category: PreferenceCategory,
    details: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): void {
    const entry: ActivityLogEntry = {
      id: generateId('log'),
      timestamp: new Date(),
      action,
      category,
      details,
      ipAddress,
      userAgent,
    };
    this.activityLog.push(entry);
  }

  private getCategoryPreferences(category: PreferenceCategory): {
    [key: string]: unknown;
  } {
    switch (category) {
      case 'general':
        return this.preferences.general as unknown as { [key: string]: unknown };
      case 'appearance':
        return this.preferences.appearance as unknown as { [key: string]: unknown };
      case 'notifications':
        return this.preferences.notifications as unknown as { [key: string]: unknown };
      case 'privacy':
        return this.preferences.privacy as unknown as { [key: string]: unknown };
      case 'security':
        return this.preferences.security as unknown as { [key: string]: unknown };
      case 'workspace':
        return this.preferences.workspace as unknown as { [key: string]: unknown };
    }
  }

  private setCategoryPreference(
    category: PreferenceCategory,
    key: string,
    value: unknown
  ): boolean {
    const categoryPrefs = this.getCategoryPreferences(category);
    const previousValue = categoryPrefs[key];
    categoryPrefs[key] = value;
    this.preferences.updatedAt = new Date();

    this.logActivity('update', category, { key, value, previousValue });

    return true;
  }

  private validatePreference(
    category: PreferenceCategory,
    key: string,
    value: unknown
  ): boolean {
    const categoryValidators = this.validators.get(category);
    if (!categoryValidators) return false;

    return categoryValidators.every(validator => validator(category, key, value));
  }

  public getPreferences(): UserPreferences {
    return { ...this.preferences };
  }

  public getPreferencesByCategory(category: PreferenceCategory): Record<string, unknown> {
    return { ...this.getCategoryPreferences(category) };
  }

  public getPreference<K extends keyof UserPreferences>(
    key: K
  ): UserPreferences[K] {
    return this.preferences[key];
  }

  public updatePreference<T>(
    category: PreferenceCategory,
    key: string,
    value: T,
    _ipAddress?: string,
    _userAgent?: string
  ): PreferenceUpdate<T> {
    const categoryPrefs = this.getCategoryPreferences(category);
    const previousValue = categoryPrefs[key] as T | undefined;

    if (!this.validatePreference(category, key, value)) {
      throw new Error(`Invalid value for ${category}.${key}`);
    }

    this.setCategoryPreference(category, key, value);

    return {
      category,
      key,
      value,
      previousValue,
    };
  }

  public resetCategory(category: PreferenceCategory, _ipAddress?: string): void {
    const userId = this.preferences.userId;

    switch (category) {
      case 'general':
        this.preferences.general = createDefaultGeneralPreferences(userId);
        break;
      case 'appearance':
        this.preferences.appearance = createDefaultAppearancePreferences(userId);
        break;
      case 'notifications':
        this.preferences.notifications = createDefaultNotificationPreferences(userId);
        break;
      case 'privacy':
        this.preferences.privacy = createDefaultPrivacyPreferences(userId);
        break;
      case 'security':
        this.preferences.security = createDefaultSecurityPreferences(userId);
        break;
      case 'workspace':
        this.preferences.workspace = createDefaultWorkspacePreferences(userId);
        break;
    }

    this.preferences.updatedAt = new Date();
    this.logActivity('reset', category, { resetCategory: category });
  }

  public resetAllPreferences(_ipAddress?: string): void {
    const categories: PreferenceCategory[] = [
      'general',
      'appearance',
      'notifications',
      'privacy',
      'security',
      'workspace',
    ];

    categories.forEach(category => {
      this.resetCategory(category, _ipAddress);
    });

    this.logActivity('reset_all', 'general', { resetAll: true });
  }

  public getActivityLog(limit = 100): ActivityLogEntry[] {
    return this.activityLog.slice(-limit);
  }

  public getActivityLogByCategory(category: PreferenceCategory): ActivityLogEntry[] {
    return this.activityLog.filter(entry => entry.category === category);
  }

  public getActivityLogByDateRange(start: Date, end: Date): ActivityLogEntry[] {
    return this.activityLog.filter(
      entry => entry.timestamp >= start && entry.timestamp <= end
    );
  }

  public setTheme(theme: ThemeMode, _ipAddress?: string): void {
    this.updatePreference('appearance', 'theme', theme, _ipAddress);
  }

  public getTheme(): ThemeMode {
    return this.preferences.appearance.theme;
  }

  public setNotificationChannel(
    channel: NotificationChannel,
    settings: { enabled?: boolean; frequency?: 'immediate' | 'daily' | 'weekly' },
    _ipAddress?: string
  ): void {
    const currentSettings = { ...this.preferences.notifications.channels[channel] };
    if (settings.enabled !== undefined) {
      currentSettings.enabled = settings.enabled;
    }
    if (settings.frequency !== undefined) {
      currentSettings.frequency = settings.frequency;
    }
    this.updatePreference(
      'notifications',
      'channels',
      {
        ...this.preferences.notifications.channels,
        [channel]: currentSettings,
      },
      _ipAddress
    );
  }

  public getNotificationChannel(channel: NotificationChannel) {
    return { ...this.preferences.notifications.channels[channel] };
  }

  public setNotificationType(
    type: NotificationType,
    enabled: boolean,
    _ipAddress?: string
  ): void {
    this.updatePreference('notifications', 'byType', {
      ...this.preferences.notifications.byType,
      [type]: enabled,
    }, _ipAddress);
  }

  public getNotificationType(type: NotificationType): boolean {
    return this.preferences.notifications.byType[type];
  }

  public setPrivacySetting(
    setting: 'profileVisibility' | 'activityStatus' | 'dataSharing' | 'showEmail' | 'showPhone' | 'allowSearchIndexing',
    value: ProfileVisibility | ActivityStatus | DataSharing | boolean,
    _ipAddress?: string
  ): void {
    this.updatePreference('privacy', setting, value, _ipAddress);
  }

  public getPrivacySetting(
    setting: 'profileVisibility' | 'activityStatus' | 'dataSharing'
  ): ProfileVisibility | ActivityStatus | DataSharing {
    return this.preferences.privacy[setting] as ProfileVisibility | ActivityStatus | DataSharing;
  }

  public setSecuritySetting(
    setting: keyof SecurityPreferences,
    value: boolean | number | string[],
    _ipAddress?: string
  ): void {
    this.updatePreference('security', setting, value, _ipAddress);
  }

  public getSecuritySetting<K extends keyof SecurityPreferences>(
    setting: K
  ): SecurityPreferences[K] {
    return this.preferences.security[setting];
  }

  public addTrustedIp(ip: string, _ipAddress?: string): void {
    const currentList = [...this.preferences.security.ipAllowlist];
    if (!currentList.includes(ip)) {
      currentList.push(ip);
      this.updatePreference('security', 'ipAllowlist', currentList, _ipAddress);
    }
  }

  public removeTrustedIp(ip: string, _ipAddress?: string): void {
    const currentList = [...this.preferences.security.ipAllowlist];
    const index = currentList.indexOf(ip);
    if (index > -1) {
      currentList.splice(index, 1);
      this.updatePreference('security', 'ipAllowlist', currentList, _ipAddress);
    }
  }

  public addValidator(category: PreferenceCategory, validator: PreferenceValidator<unknown>): void {
    const existing = this.validators.get(category) || [];
    this.validators.set(category, [...existing, validator]);
  }

  public clearActivityLog(): void {
    this.activityLog = [];
  }

  public exportPreferences(): string {
    return JSON.stringify(this.preferences, null, 2);
  }

  public importPreferences(
    data: string,
    _ipAddress?: string,
    _userAgent?: string
  ): boolean {
    try {
      const parsed = JSON.parse(data) as UserPreferences;
      if (!this.validateImportedPreferences(parsed)) {
        throw new Error('Invalid preferences structure');
      }
      this.preferences = { ...parsed, updatedAt: new Date() };
      this.logActivity('import', 'general', { importedAt: new Date().toISOString() }, _ipAddress, _userAgent);
      return true;
    } catch {
      return false;
    }
  }

  private validateImportedPreferences(data: unknown): data is UserPreferences {
    if (typeof data !== 'object' || data === null) return false;
    const prefs = data as Record<string, unknown>;
    return (
      typeof prefs.id === 'string' &&
      typeof prefs.userId === 'string' &&
      typeof prefs.general === 'object' &&
      typeof prefs.appearance === 'object' &&
      typeof prefs.notifications === 'object' &&
      typeof prefs.privacy === 'object' &&
      typeof prefs.security === 'object' &&
      typeof prefs.workspace === 'object'
    );
  }

  public getUserId(): string {
    return this.preferences.userId;
  }

  public getPreferencesId(): string {
    return this.preferences.id;
  }

  public getCreatedAt(): Date {
    return this.preferences.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.preferences.updatedAt;
  }
}

export const createUserPreferences = (options: UserPreferencesOptions): UserPreferencesManager => {
  return new UserPreferencesManager(options);
};

export {
  generateId,
  createDefaultGeneralPreferences,
  createDefaultAppearancePreferences,
  createDefaultNotificationPreferences,
  createDefaultPrivacyPreferences,
  createDefaultSecurityPreferences,
  createDefaultWorkspacePreferences,
};
