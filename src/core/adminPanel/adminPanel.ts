import * as crypto from 'crypto';
import {
  AdminSection,
  AdminUser,
  AdminUserProfile,
  AdminUserCreate,
  AdminUserUpdate,
  AdminRole,
  Permission,
  PermissionAction,
  AuditLogEntry,
  SystemMetrics,
  AdminDashboardStats,
  PaginatedResult,
  AuditLogFilter,
  UserFilter,
  RoleFilter,
  AdminSettings,
  AdminNotification,
  AdminPanelConfig,
  DEFAULT_ADMIN_CONFIG,
  SYSTEM_ROLES,
  AdminEvent,
  AdminEventListener,
  AuditAction,
  RoleType,
  AdminEventType,
} from './types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function toAdminUserProfile(user: AdminUser): AdminUserProfile {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
    metadata: user.metadata,
  };
}

function getSystemMetrics(): SystemMetrics {
  return {
    timestamp: new Date(),
    cpu: { value: Math.random() * 100, unit: '%', percentage: Math.random() * 100 },
    memory: { value: Math.random() * 16, unit: 'GB', percentage: Math.random() * 100 },
    disk: { value: Math.random() * 500, unit: 'GB', percentage: Math.random() * 100 },
    network: { value: Math.random() * 1000, unit: 'Mbps', percentage: Math.random() * 100 },
    uptime: Date.now() / 1000,
    requestCount: Math.floor(Math.random() * 10000),
    errorCount: Math.floor(Math.random() * 100),
  };
}

export class AdminPanel {
  private users: Map<string, AdminUser> = new Map();
  private usersByEmail: Map<string, string> = new Map();
  private roles: Map<string, AdminRole> = new Map();
  private auditLog: AuditLogEntry[] = [];
  private notifications: Map<string, AdminNotification> = new Map();
  private settings: AdminSettings;
  private eventListeners: AdminEventListener[] = [];
  private config: AdminPanelConfig;
  private failedLoginAttempts: Map<string, { count: number; lastAttempt: Date }> = new Map();

  constructor(config: Partial<AdminPanelConfig> = {}) {
    this.config = { ...DEFAULT_ADMIN_CONFIG, ...config };
    this.settings = {
      maintenanceMode: this.config.maintenanceMode,
      allowRegistration: this.config.allowRegistration,
      requireEmailVerification: this.config.requireEmailVerification,
      sessionTimeout: this.config.sessionTimeout,
      maxLoginAttempts: this.config.maxLoginAttempts,
      passwordMinLength: 8,
    };

    for (const role of SYSTEM_ROLES) {
      this.roles.set(role.id, role);
    }
  }

  private emit(type: AdminEventType, adminId: string, data?: Record<string, unknown>, metadata?: AdminEvent['metadata']): void {
    const event: AdminEvent = {
      type,
      adminId,
      timestamp: new Date(),
      data,
      metadata,
    };
    this.eventListeners.forEach(listener => {
      try {
        const result = listener(event);
        if (result instanceof Promise) {
          result.catch(() => {});
        }
      } catch {
      }
    });
  }

  private addAuditLog(
    action: AuditAction,
    actorId: string,
    actorEmail: string,
    status: 'success' | 'failure',
    options?: {
      targetId?: string;
      targetType?: string;
      details?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
      errorMessage?: string;
    }
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: generateId('audit'),
      timestamp: new Date(),
      action,
      actorId,
      actorEmail,
      targetId: options?.targetId,
      targetType: options?.targetType,
      details: options?.details,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      status,
      errorMessage: options?.errorMessage,
    };

    this.auditLog.unshift(entry);
    return entry;
  }

  onEvent(listener: AdminEventListener): void {
    this.eventListeners.push(listener);
  }

  offEvent(listener: AdminEventListener): void {
    this.eventListeners = this.eventListeners.filter(l => l !== listener);
  }

  async initialize(): Promise<void> {
    const adminUser: AdminUser = {
      id: generateId('usr'),
      email: 'admin@manus-ai.com',
      passwordHash: hashPassword('admin'),
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin',
      status: 'active',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { isSystemAdmin: true },
    };

    this.users.set(adminUser.id, adminUser);
    this.usersByEmail.set(adminUser.email, adminUser.id);
  }

  async login(email: string, password: string, _notification?: unknown): Promise<{ user: AdminUserProfile; token: string }> {
    const userId = this.usersByEmail.get(email.toLowerCase());
    if (!userId) {
      this.addAuditLog('login_failed', 'unknown', email, 'failure', { errorMessage: 'User not found' });
      throw new Error('Invalid credentials');
    }

    const user = this.users.get(userId);
    if (!user) {
      this.addAuditLog('login_failed', 'unknown', email, 'failure', { errorMessage: 'User not found' });
      throw new Error('Invalid credentials');
    }

    if (user.role !== 'admin' && user.role !== 'moderator') {
      this.addAuditLog('login_failed', user.id, email, 'failure', { errorMessage: 'Insufficient permissions' });
      throw new Error('Insufficient permissions');
    }

    const loginKey = `${email}_${userId}`;
    const attempts = this.failedLoginAttempts.get(loginKey);
    if (attempts && attempts.count >= this.settings.maxLoginAttempts) {
      const cooldownMs = 15 * 60 * 1000;
      if (Date.now() - attempts.lastAttempt.getTime() < cooldownMs) {
        this.addAuditLog('login_failed', user.id, email, 'failure', { errorMessage: 'Account locked due to too many attempts' });
        throw new Error('Account temporarily locked');
      }
      this.failedLoginAttempts.delete(loginKey);
    }

    if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      const currentAttempts = this.failedLoginAttempts.get(loginKey) || { count: 0, lastAttempt: new Date() };
      this.failedLoginAttempts.set(loginKey, { count: currentAttempts.count + 1, lastAttempt: new Date() });
      this.addAuditLog('login_failed', user.id, email, 'failure', { errorMessage: 'Invalid password' });
      throw new Error('Invalid credentials');
    }

    if (user.status === 'suspended') {
      this.addAuditLog('login_failed', user.id, email, 'failure', { errorMessage: 'Account suspended' });
      throw new Error('Account suspended');
    }

    this.failedLoginAttempts.delete(loginKey);
    user.lastLoginAt = new Date();
    user.updatedAt = new Date();

    const token = crypto.randomBytes(32).toString('hex');
    this.addAuditLog('login_success', user.id, email, 'success');

    return { user: toAdminUserProfile(user), token };
  }

  async logout(adminId: string, _notification?: unknown): Promise<void> {
    const user = this.users.get(adminId);
    if (user) {
      this.addAuditLog('logout', adminId, user.email, 'success');
    }
  }

  async createUser(adminId: string, data: AdminUserCreate, _notification?: unknown): Promise<AdminUserProfile> {
    if (!isValidEmail(data.email)) {
      throw new Error('Invalid email format');
    }

    if (this.usersByEmail.has(data.email.toLowerCase())) {
      throw new Error('Email already registered');
    }

    if (data.password.length < this.settings.passwordMinLength) {
      throw new Error(`Password must be at least ${this.settings.passwordMinLength} characters`);
    }

    const now = new Date();
    const user: AdminUser = {
      id: generateId('usr'),
      email: data.email.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || 'user',
      status: 'active',
      emailVerified: !this.settings.requireEmailVerification,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user.id);

    const admin = this.users.get(adminId);
    this.addAuditLog('user_created', adminId, admin?.email || 'unknown', 'success', {
      targetId: user.id,
      targetType: 'user',
      details: { email: user.email, role: user.role },
    });

    this.emit('admin.user.created', adminId, { userId: user.id, email: user.email });

    return toAdminUserProfile(user);
  }

  async getUser(adminId: string, userId: string): Promise<AdminUserProfile | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const admin = this.users.get(adminId);
    this.addAuditLog('user_updated', adminId, admin?.email || 'unknown', 'success', {
      targetId: userId,
      targetType: 'user',
    });

    return toAdminUserProfile(user);
  }

  async updateUser(adminId: string, userId: string, data: AdminUserUpdate): Promise<AdminUserProfile | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    if (data.firstName !== undefined) {
      user.firstName = data.firstName;
    }
    if (data.lastName !== undefined) {
      user.lastName = data.lastName;
    }
    if (data.metadata !== undefined) {
      user.metadata = { ...user.metadata, ...data.metadata };
    }

    user.updatedAt = new Date();

    const admin = this.users.get(adminId);
    this.addAuditLog('user_updated', adminId, admin?.email || 'unknown', 'success', {
      targetId: userId,
      targetType: 'user',
      details: data as Record<string, unknown>,
    });

    this.emit('admin.user.updated', adminId, { userId, updates: data });

    return toAdminUserProfile(user);
  }

  async deleteUser(adminId: string, userId: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) {
      return false;
    }

    const admin = this.users.get(adminId);
    if (userId === adminId) {
      throw new Error('Cannot delete yourself');
    }

    if (user.role === 'admin') {
      throw new Error('Cannot delete admin users');
    }

    this.usersByEmail.delete(user.email);
    this.users.delete(userId);

    this.addAuditLog('user_deleted', adminId, admin?.email || 'unknown', 'success', {
      targetId: userId,
      targetType: 'user',
      details: { email: user.email },
    });

    this.emit('admin.user.deleted', adminId, { userId, email: user.email });

    return true;
  }

  async suspendUser(adminId: string, userId: string, _notification?: unknown): Promise<AdminUserProfile | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    if (user.role === 'admin') {
      throw new Error('Cannot suspend admin users');
    }

    user.status = 'suspended';
    user.updatedAt = new Date();

    const admin = this.users.get(adminId);
    this.addAuditLog('user_suspended', adminId, admin?.email || 'unknown', 'success', {
      targetId: userId,
      targetType: 'user',
      details: { email: user.email },
    });

    this.emit('admin.user.suspended', adminId, { userId, email: user.email });

    return toAdminUserProfile(user);
  }

  async reactivateUser(adminId: string, userId: string): Promise<AdminUserProfile | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    user.status = 'active';
    user.updatedAt = new Date();

    const admin = this.users.get(adminId);
    this.addAuditLog('user_reactivated', adminId, admin?.email || 'unknown', 'success', {
      targetId: userId,
      targetType: 'user',
      details: { email: user.email },
    });

    this.emit('admin.user.reactivated', adminId, { userId, email: user.email });

    return toAdminUserProfile(user);
  }

  async changeUserRole(adminId: string, userId: string, newRole: RoleType): Promise<AdminUserProfile | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const oldRole = user.role;
    user.role = newRole;
    user.updatedAt = new Date();

    const admin = this.users.get(adminId);
    this.addAuditLog('role_changed', adminId, admin?.email || 'unknown', 'success', {
      targetId: userId,
      targetType: 'user',
      details: { oldRole, newRole },
    });

    this.emit('admin.role.created', adminId, { userId, oldRole, newRole });

    return toAdminUserProfile(user);
  }

  async listUsers(filter?: UserFilter): Promise<PaginatedResult<AdminUserProfile>> {
    let users = Array.from(this.users.values());

    if (filter?.role) {
      users = users.filter(u => u.role === filter.role);
    }
    if (filter?.status) {
      users = users.filter(u => u.status === filter.status);
    }
    if (filter?.search) {
      const search = filter.search.toLowerCase();
      users = users.filter(u =>
        u.email.toLowerCase().includes(search) ||
        (u.firstName && u.firstName.toLowerCase().includes(search)) ||
        (u.lastName && u.lastName.toLowerCase().includes(search))
      );
    }

    const total = users.length;
    const page = filter?.offset ? Math.floor(filter.offset / (filter?.limit || 10)) + 1 : 1;
    const pageSize = filter?.limit || 10;
    const totalPages = Math.ceil(total / pageSize);

    const startIndex = (page - 1) * pageSize;
    const paginatedUsers = users.slice(startIndex, startIndex + pageSize);

    return {
      items: paginatedUsers.map(toAdminUserProfile),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getRoles(_filter?: RoleFilter): Promise<AdminRole[]> {
    return Array.from(this.roles.values());
  }

  async getRoleByName(name: RoleType): Promise<AdminRole | null> {
    const role = Array.from(this.roles.values()).find(r => r.name === name);
    return role || null;
  }

  async createRole(adminId: string, name: RoleType, description: string, permissions: Permission[]): Promise<AdminRole> {
    const existingRole = Array.from(this.roles.values()).find(r => r.name === name);
    if (existingRole) {
      throw new Error('Role already exists');
    }

    const now = new Date();
    const role: AdminRole = {
      id: generateId('role'),
      name,
      description,
      permissions,
      createdAt: now,
      updatedAt: now,
      isSystem: false,
    };

    this.roles.set(role.id, role);

    const admin = this.users.get(adminId);
    this.addAuditLog('permission_granted', adminId, admin?.email || 'unknown', 'success', {
      targetId: role.id,
      targetType: 'role',
      details: { name, permissions },
    });

    this.emit('admin.role.created', adminId, { roleId: role.id, name });

    return role;
  }

  async updateRole(adminId: string, roleId: string, updates: { description?: string; permissions?: Permission[] }): Promise<AdminRole | null> {
    const role = this.roles.get(roleId);
    if (!role) {
      return null;
    }

    if (role.isSystem) {
      throw new Error('Cannot modify system roles');
    }

    if (updates.description !== undefined) {
      role.description = updates.description;
    }
    if (updates.permissions !== undefined) {
      role.permissions = updates.permissions;
    }
    role.updatedAt = new Date();

    const admin = this.users.get(adminId);
    this.addAuditLog('permission_granted', adminId, admin?.email || 'unknown', 'success', {
      targetId: roleId,
      targetType: 'role',
      details: updates,
    });

    this.emit('admin.role.updated', adminId, { roleId, updates });

    return role;
  }

  async deleteRole(adminId: string, roleId: string): Promise<boolean> {
    const role = this.roles.get(roleId);
    if (!role) {
      return false;
    }

    if (role.isSystem) {
      throw new Error('Cannot delete system roles');
    }

    const usersWithRole = Array.from(this.users.values()).filter(u => u.role === role.name);
    if (usersWithRole.length > 0) {
      throw new Error('Cannot delete role that is assigned to users');
    }

    this.roles.delete(roleId);

    const admin = this.users.get(adminId);
    this.addAuditLog('permission_revoked', adminId, admin?.email || 'unknown', 'success', {
      targetId: roleId,
      targetType: 'role',
      details: { name: role.name },
    });

    this.emit('admin.role.created', adminId, { roleId });

    return true;
  }

  async grantPermission(adminId: string, roleId: string, permission: Permission): Promise<AdminRole | null> {
    const role = this.roles.get(roleId);
    if (!role) {
      return null;
    }

    if (role.isSystem && role.name === 'admin') {
      return role;
    }

    const existingPermIndex = role.permissions.findIndex(p => p.resource === permission.resource);
    if (existingPermIndex >= 0) {
      const existingPerm = role.permissions[existingPermIndex];
      for (const action of permission.actions) {
        if (!existingPerm.actions.includes(action)) {
          existingPerm.actions.push(action);
        }
      }
    } else {
      role.permissions.push({ ...permission });
    }

    role.updatedAt = new Date();

    const admin = this.users.get(adminId);
    this.addAuditLog('permission_granted', adminId, admin?.email || 'unknown', 'success', {
      targetId: roleId,
      targetType: 'role',
      details: { permission },
    });

    this.emit('admin.permission.granted', adminId, { roleId, permission });

    return role;
  }

  async revokePermission(adminId: string, roleId: string, resource: string, action: string): Promise<AdminRole | null> {
    const role = this.roles.get(roleId);
    if (!role) {
      return null;
    }

    if (role.isSystem) {
      throw new Error('Cannot modify system roles');
    }

    const permIndex = role.permissions.findIndex(p => p.resource === resource);
    if (permIndex >= 0) {
      role.permissions[permIndex].actions = role.permissions[permIndex].actions.filter(a => a !== action);
      if (role.permissions[permIndex].actions.length === 0) {
        role.permissions.splice(permIndex, 1);
      }
    }

    role.updatedAt = new Date();

    const admin = this.users.get(adminId);
    this.addAuditLog('permission_revoked', adminId, admin?.email || 'unknown', 'success', {
      targetId: roleId,
      targetType: 'role',
      details: { resource, action },
    });

    this.emit('admin.permission.revoked', adminId, { roleId, resource, action });

    return role;
  }

  async getAuditLog(filter?: AuditLogFilter): Promise<PaginatedResult<AuditLogEntry>> {
    let entries = [...this.auditLog];

    if (filter?.startDate) {
      entries = entries.filter(e => e.timestamp >= filter.startDate!);
    }
    if (filter?.endDate) {
      entries = entries.filter(e => e.timestamp <= filter.endDate!);
    }
    if (filter?.action) {
      entries = entries.filter(e => e.action === filter.action);
    }
    if (filter?.actorId) {
      entries = entries.filter(e => e.actorId === filter.actorId);
    }
    if (filter?.targetId) {
      entries = entries.filter(e => e.targetId === filter.targetId);
    }
    if (filter?.status) {
      entries = entries.filter(e => e.status === filter.status);
    }

    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = entries.length;
    const limit = filter?.limit || 50;
    const offset = filter?.offset || 0;
    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    const paginatedEntries = entries.slice(offset, offset + limit);

    return {
      items: paginatedEntries,
      total,
      page,
      pageSize: limit,
      totalPages,
    };
  }

  async getDashboardStats(): Promise<AdminDashboardStats> {
    const users = Array.from(this.users.values());
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const newUsersToday = users.filter(u => u.createdAt >= startOfDay).length;
    const newUsersThisWeek = users.filter(u => u.createdAt >= startOfWeek).length;
    const newUsersThisMonth = users.filter(u => u.createdAt >= startOfMonth).length;

    const todayAuditEntries = this.auditLog.filter(e => e.timestamp >= startOfDay).length;

    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.status === 'active').length,
      inactiveUsers: users.filter(u => u.status === 'inactive').length,
      suspendedUsers: users.filter(u => u.status === 'suspended').length,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      totalRoles: this.roles.size,
      totalPermissions: Array.from(this.roles.values()).reduce((sum, r) => sum + r.permissions.length, 0),
      auditLogEntriesToday: todayAuditEntries,
    };
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    return getSystemMetrics();
  }

  async getSettings(_adminId: string): Promise<AdminSettings> {
    return { ...this.settings };
  }

  async updateSettings(adminId: string, updates: Partial<AdminSettings>): Promise<AdminSettings> {
    if (updates.maintenanceMode !== undefined) {
      this.settings.maintenanceMode = updates.maintenanceMode;
    }
    if (updates.allowRegistration !== undefined) {
      this.settings.allowRegistration = updates.allowRegistration;
    }
    if (updates.requireEmailVerification !== undefined) {
      this.settings.requireEmailVerification = updates.requireEmailVerification;
    }
    if (updates.sessionTimeout !== undefined) {
      this.settings.sessionTimeout = updates.sessionTimeout;
    }
    if (updates.maxLoginAttempts !== undefined) {
      this.settings.maxLoginAttempts = updates.maxLoginAttempts;
    }
    if (updates.passwordMinLength !== undefined) {
      this.settings.passwordMinLength = updates.passwordMinLength;
    }

    const admin = this.users.get(adminId);
    this.addAuditLog('settings_changed', adminId, admin?.email || 'unknown', 'success', {
      details: updates,
    });

    this.emit('admin.settings.changed', adminId, { updates });

    return { ...this.settings };
  }

  async createNotification(adminId: string, notification: Omit<AdminNotification, 'id' | 'timestamp' | 'read'>): Promise<AdminNotification> {
    const notif: AdminNotification = {
      id: generateId('notif'),
      timestamp: new Date(),
      read: false,
      ...notification,
    };

    this.notifications.set(notif.id, notif);
    return notif;
  }

  async getNotifications(_adminId: string, _filter?: unknown): Promise<AdminNotification[]> {
    return Array.from(this.notifications.values()).filter(n => n.read === false);
  }

  async markNotificationAsRead(_adminId: string, notificationId: string): Promise<boolean> {
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      return false;
    }
    notification.read = true;
    return true;
  }

  async markAllNotificationsAsRead(_adminId: string): Promise<number> {
    let count = 0;
    for (const notification of this.notifications.values()) {
      if (!notification.read) {
        notification.read = true;
        count++;
      }
    }
    return count;
  }

  async deleteNotification(adminId: string, notificationId: string): Promise<boolean> {
    return this.notifications.delete(notificationId);
  }

  hasPermission(role: RoleType, resource: string, action: string): boolean {
    const roleData = Array.from(this.roles.values()).find(r => r.name === role);
    if (!roleData) {
      return false;
    }

    for (const perm of roleData.permissions) {
      if (perm.resource === '*' && perm.actions.includes('admin')) {
        return true;
      }
      if (perm.resource === resource) {
        if (perm.actions.includes('admin') || perm.actions.includes(action as PermissionAction)) {
          return true;
        }
      }
    }

    return false;
  }

  canAccessSection(role: RoleType, section: AdminSection): boolean {
    const sectionPermissions: Record<AdminSection, { resource: string; action: string }[]> = {
      dashboard: [{ resource: 'dashboard', action: 'read' }],
      users: [{ resource: 'users', action: 'read' }],
      roles: [{ resource: 'roles', action: 'read' }],
      permissions: [{ resource: 'permissions', action: 'read' }],
      audit_log: [{ resource: 'audit_log', action: 'read' }],
      settings: [{ resource: 'settings', action: 'read' }],
    };

    const required = sectionPermissions[section];
    for (const perm of required) {
      if (!this.hasPermission(role, perm.resource, perm.action)) {
        return false;
      }
    }

    return true;
  }

  getStats(): { totalUsers: number; totalRoles: number; totalAuditEntries: number } {
    return {
      totalUsers: this.users.size,
      totalRoles: this.roles.size,
      totalAuditEntries: this.auditLog.length,
    };
  }
}

export const createAdminPanel = (config?: Partial<AdminPanelConfig>): AdminPanel => {
  return new AdminPanel(config);
};

export {
  generateId,
  hashPassword,
  verifyPassword,
  isValidEmail,
};
