export type AdminSection = 'dashboard' | 'users' | 'roles' | 'permissions' | 'audit_log' | 'settings';

export type UserManagementAction = 'create' | 'read' | 'update' | 'delete' | 'suspend' | 'reactivate';

export type SystemRoleType = 'admin' | 'moderator' | 'user' | 'guest';

export type RoleType = SystemRoleType | string;

export type AuditAction = 
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'user_suspended'
  | 'user_reactivated'
  | 'role_changed'
  | 'permission_granted'
  | 'permission_revoked'
  | 'settings_changed'
  | 'login_success'
  | 'login_failed'
  | 'logout';

export type ActivityStatus = 'active' | 'inactive' | 'suspended';

export type SystemMetricType = 'cpu' | 'memory' | 'disk' | 'network';

export interface AdminUser {
  id: string;
  email: string;
  passwordHash?: string;
  firstName?: string;
  lastName?: string;
  role: RoleType;
  status: ActivityStatus;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface AdminUserProfile extends Omit<AdminUser, 'passwordHash'> {
  passwordHash?: never;
}

export interface AdminUserCreate {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: RoleType;
}

export interface AdminUserUpdate {
  firstName?: string;
  lastName?: string;
  metadata?: Record<string, unknown>;
}

export interface AdminRole {
  id: string;
  name: RoleType;
  description: string;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
  isSystem: boolean;
}

export interface Permission {
  resource: string;
  actions: PermissionAction[];
}

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'admin';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: AuditAction;
  actorId: string;
  actorEmail: string;
  targetId?: string;
  targetType?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
}

export interface SystemMetrics {
  timestamp: Date;
  cpu: MetricValue;
  memory: MetricValue;
  disk: MetricValue;
  network: MetricValue;
  uptime: number;
  requestCount: number;
  errorCount: number;
}

export interface MetricValue {
  value: number;
  unit: string;
  percentage?: number;
}

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  suspendedUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  totalRoles: number;
  totalPermissions: number;
  auditLogEntriesToday: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditLogFilter {
  startDate?: Date;
  endDate?: Date;
  action?: AuditAction;
  actorId?: string;
  targetId?: string;
  status?: 'success' | 'failure';
  limit?: number;
  offset?: number;
}

export interface UserFilter {
  role?: RoleType;
  status?: ActivityStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface RoleFilter {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AdminSettings {
  maintenanceMode: boolean;
  allowRegistration: boolean;
  requireEmailVerification: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  passwordMinLength: number;
  allowedOAuthProviders?: string[];
}

export interface NotificationChannel {
  type: 'email' | 'sms' | 'push';
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface AdminNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

export interface AdminPanelConfig {
  sessionTimeout: number;
  maxLoginAttempts: number;
  auditLogRetentionDays: number;
  maintenanceMode: boolean;
  allowRegistration: boolean;
  requireEmailVerification: boolean;
}

export const DEFAULT_ADMIN_CONFIG: AdminPanelConfig = {
  sessionTimeout: 3600,
  maxLoginAttempts: 5,
  auditLogRetentionDays: 90,
  maintenanceMode: false,
  allowRegistration: true,
  requireEmailVerification: true,
};

export const SYSTEM_ROLES: AdminRole[] = [
  {
    id: 'role_admin',
    name: 'admin',
    description: 'Full system access with all permissions',
    permissions: [
      { resource: '*', actions: ['admin'] },
    ],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    isSystem: true,
  },
  {
    id: 'role_moderator',
    name: 'moderator',
    description: 'Moderate content and manage users',
    permissions: [
      { resource: 'users', actions: ['read', 'update'] },
      { resource: 'content', actions: ['read', 'update', 'delete'] },
      { resource: 'audit_log', actions: ['read'] },
    ],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    isSystem: true,
  },
  {
    id: 'role_user',
    name: 'user',
    description: 'Standard user access',
    permissions: [
      { resource: 'profile', actions: ['read', 'update'] },
      { resource: 'content', actions: ['create', 'read'] },
    ],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    isSystem: true,
  },
  {
    id: 'role_guest',
    name: 'guest',
    description: 'Limited read-only access',
    permissions: [
      { resource: 'content', actions: ['read'] },
    ],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    isSystem: true,
  },
];

export type AdminEventType =
  | 'admin.user.created'
  | 'admin.user.updated'
  | 'admin.user.deleted'
  | 'admin.user.suspended'
  | 'admin.user.reactivated'
  | 'admin.role.created'
  | 'admin.role.updated'
  | 'admin.role.deleted'
  | 'admin.permission.granted'
  | 'admin.permission.revoked'
  | 'admin.settings.changed'
  | 'admin.audit.viewed';

export interface AdminEvent {
  type: AdminEventType;
  adminId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  };
}

export type AdminEventListener = (event: AdminEvent) => void | Promise<void>;
