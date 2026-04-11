export type PreferenceCategory =
  | 'general'
  | 'appearance'
  | 'notifications'
  | 'privacy'
  | 'security'
  | 'workspace';

export type ThemeMode = 'light' | 'dark' | 'system';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

export type NotificationType =
  | 'task_assigned'
  | 'task_completed'
  | 'mention'
  | 'comment'
  | 'share'
  | 'system'
  | 'team_update'
  | 'deadline_reminder';

export type ProfileVisibility = 'public' | 'private' | 'team_only';

export type ActivityStatus = 'enabled' | 'disabled';

export type DataSharing = 'enabled' | 'disabled';

export interface GeneralPreferences {
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  defaultWorkspace?: string;
  autoSave: boolean;
  compactMode: boolean;
}

export interface AppearancePreferences {
  theme: ThemeMode;
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  reducedMotion: boolean;
  highContrast: boolean;
  sidebarPosition: 'left' | 'right';
}

export interface NotificationChannelSettings {
  enabled: boolean;
  frequency?: 'immediate' | 'daily' | 'weekly';
  quietHours?: {
    start: string;
    end: string;
  };
}

export interface NotificationPreferences {
  channels: Record<NotificationChannel, NotificationChannelSettings>;
  byType: Record<NotificationType, boolean>;
  mentionAll: boolean;
  mentionTeam: boolean;
}

export interface PrivacyPreferences {
  profileVisibility: ProfileVisibility;
  activityStatus: ActivityStatus;
  dataSharing: DataSharing;
  showEmail: boolean;
  showPhone: boolean;
  allowSearchIndexing: boolean;
}

export interface SecurityPreferences {
  twoFactorEnabled: boolean;
  sessionTimeoutMinutes: number;
  apiKeyRotationDays: number;
  loginAlerts: boolean;
  trustedDevices: boolean;
  ipAllowlist: string[];
}

export interface WorkspaceMember {
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  joinedAt: Date;
}

export interface WorkspacePreferences {
  defaultWorkspaceId: string;
  workspaceName: string;
  defaultProject?: string;
  defaultView: 'list' | 'board' | 'calendar' | 'timeline';
  notificationsForWorkspace: NotificationPreferences;
  teamMembers: WorkspaceMember[];
  allowGuestAccess: boolean;
  defaultTeamRole: WorkspaceMember['role'];
}

export interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  category: PreferenceCategory;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserPreferences {
  id: string;
  userId: string;
  general: GeneralPreferences;
  appearance: AppearancePreferences;
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
  security: SecurityPreferences;
  workspace: WorkspacePreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface PreferenceUpdate<T> {
  category: PreferenceCategory;
  key: string;
  value: T;
  previousValue?: T;
}

export interface NotificationSettings {
  channel: NotificationChannel;
  settings: NotificationChannelSettings;
}

export type PreferenceValidator<T> = (
  category: PreferenceCategory,
  key: string,
  value: T
) => boolean;

export interface UserPreferencesOptions {
  userId: string;
  defaultLanguage?: string;
  defaultTimezone?: string;
  defaultTheme?: ThemeMode;
}
