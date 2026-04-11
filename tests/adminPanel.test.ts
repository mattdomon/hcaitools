import {
  AdminPanel,
  createAdminPanel,
  generateId,
  hashPassword,
  verifyPassword,
  isValidEmail,
  AdminSection,
  AuditAction,
  RoleType,
  ActivityStatus,
  Permission,
  SYSTEM_ROLES,
  DEFAULT_ADMIN_CONFIG,
} from '../src/core/adminPanel';

describe('AdminPanel', () => {
  let adminPanel: AdminPanel;
  let adminUserId: string;

  beforeEach(async () => {
    adminPanel = createAdminPanel({
      sessionTimeout: 3600,
      maxLoginAttempts: 5,
      auditLogRetentionDays: 90,
    });
    await adminPanel.initialize();
    const result = await adminPanel.login('admin@manus-ai.com', 'admin');
    adminUserId = result.user.id;
  });

  describe('Initialization', () => {
    it('should create admin panel with default config', () => {
      const panel = createAdminPanel();
      expect(panel).toBeDefined();
    });

    it('should create admin panel with custom config', () => {
      const panel = createAdminPanel({
        maintenanceMode: true,
        allowRegistration: false,
      });
      expect(panel).toBeDefined();
    });

    it('should initialize with system roles', async () => {
      const roles = await adminPanel.getRoles();
      expect(roles.length).toBeGreaterThanOrEqual(4);
    });

    it('should have default admin user after initialization', async () => {
      const result = await adminPanel.login('admin@manus-ai.com', 'admin');
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('admin@manus-ai.com');
      expect(result.user.role).toBe('admin');
    });
  });

  describe('Authentication', () => {
    it('should login with valid credentials', async () => {
      const result = await adminPanel.login('admin@manus-ai.com', 'admin');
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should throw error for invalid email', async () => {
      await expect(
        adminPanel.login('invalid-email', 'password')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for invalid password', async () => {
      await expect(
        adminPanel.login('admin@manus-ai.com', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should track failed login attempts', async () => {
      for (let i = 0; i < 4; i++) {
        try {
          await adminPanel.login('admin@manus-ai.com', 'wrongpassword');
        } catch {
        }
      }
      await expect(
        adminPanel.login('admin@manus-ai.com', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should lock account after max failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await adminPanel.login('admin@manus-ai.com', 'wrongpassword');
        } catch {
        }
      }
      await expect(
        adminPanel.login('admin@manus-ai.com', 'wrongpassword')
      ).rejects.toThrow('Account temporarily locked');
    });

    it('should logout successfully', async () => {
      await expect(adminPanel.logout(adminUserId)).resolves.not.toThrow();
    });
  });

  describe('User Management', () => {
    it('should create a new user', async () => {
      const user = await adminPanel.createUser(adminUserId, {
        email: 'newuser@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
        role: 'user',
      });

      expect(user).toBeDefined();
      expect(user.email).toBe('newuser@example.com');
      expect(user.firstName).toBe('New');
      expect(user.lastName).toBe('User');
      expect(user.role).toBe('user');
    });

    it('should throw error for invalid email when creating user', async () => {
      await expect(
        adminPanel.createUser(adminUserId, {
          email: 'invalid-email',
          password: 'Password123!',
        })
      ).rejects.toThrow('Invalid email format');
    });

    it('should throw error for duplicate email when creating user', async () => {
      await adminPanel.createUser(adminUserId, {
        email: 'duplicate@example.com',
        password: 'Password123!',
      });

      await expect(
        adminPanel.createUser(adminUserId, {
          email: 'duplicate@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('Email already registered');
    });

    it('should throw error for short password', async () => {
      await expect(
        adminPanel.createUser(adminUserId, {
          email: 'test@example.com',
          password: 'short',
        })
      ).rejects.toThrow(/at least 8 characters/);
    });

    it('should get user by id', async () => {
      const created = await adminPanel.createUser(adminUserId, {
        email: 'getuser@example.com',
        password: 'Password123!',
      });

      const user = await adminPanel.getUser(adminUserId, created.id);
      expect(user).toBeDefined();
      expect(user!.email).toBe('getuser@example.com');
    });

    it('should return null for non-existent user', async () => {
      const user = await adminPanel.getUser(adminUserId, 'non-existent-id');
      expect(user).toBeNull();
    });

    it('should update user', async () => {
      const created = await adminPanel.createUser(adminUserId, {
        email: 'update@example.com',
        password: 'Password123!',
      });

      const updated = await adminPanel.updateUser(adminUserId, created.id, {
        firstName: 'Updated',
        lastName: 'Name',
      });

      expect(updated).toBeDefined();
      expect(updated!.firstName).toBe('Updated');
      expect(updated!.lastName).toBe('Name');
    });

    it('should delete user', async () => {
      const created = await adminPanel.createUser(adminUserId, {
        email: 'delete@example.com',
        password: 'Password123!',
      });

      const result = await adminPanel.deleteUser(adminUserId, created.id);
      expect(result).toBe(true);

      const user = await adminPanel.getUser(adminUserId, created.id);
      expect(user).toBeNull();
    });

    it('should throw error when deleting admin user', async () => {
      const adminToDelete = await adminPanel.createUser(adminUserId, {
        email: 'anotheradmin@example.com',
        password: 'Password123!',
        role: 'admin',
      });

      await expect(
        adminPanel.deleteUser(adminUserId, adminToDelete.id)
      ).rejects.toThrow('Cannot delete admin users');
    });

    it('should throw error when deleting yourself', async () => {
      const nonAdminUser = await adminPanel.createUser(adminUserId, {
        email: 'selfdelete@example.com',
        password: 'Password123!',
        role: 'moderator',
      });

      await expect(
        adminPanel.deleteUser(nonAdminUser.id, nonAdminUser.id)
      ).rejects.toThrow('Cannot delete yourself');
    });

    it('should suspend user', async () => {
      const created = await adminPanel.createUser(adminUserId, {
        email: 'suspend@example.com',
        password: 'Password123!',
      });

      const suspended = await adminPanel.suspendUser(adminUserId, created.id);
      expect(suspended).toBeDefined();
      expect(suspended!.status).toBe('suspended');
    });

    it('should reactivate user', async () => {
      const created = await adminPanel.createUser(adminUserId, {
        email: 'reactivate@example.com',
        password: 'Password123!',
      });

      await adminPanel.suspendUser(adminUserId, created.id);
      const reactivated = await adminPanel.reactivateUser(adminUserId, created.id);
      expect(reactivated).toBeDefined();
      expect(reactivated!.status).toBe('active');
    });

    it('should change user role', async () => {
      const created = await adminPanel.createUser(adminUserId, {
        email: 'rolechange@example.com',
        password: 'Password123!',
        role: 'user',
      });

      const updated = await adminPanel.changeUserRole(adminUserId, created.id, 'moderator');
      expect(updated).toBeDefined();
      expect(updated!.role).toBe('moderator');
    });

    it('should list users with filter', async () => {
      await adminPanel.createUser(adminUserId, {
        email: 'listuser1@example.com',
        password: 'Password123!',
        role: 'user',
      });
      await adminPanel.createUser(adminUserId, {
        email: 'listuser2@example.com',
        password: 'Password123!',
        role: 'moderator',
      });

      const result = await adminPanel.listUsers({ role: 'user' });
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.every(u => u.role === 'user')).toBe(true);
    });

    it('should list users with search', async () => {
      await adminPanel.createUser(adminUserId, {
        email: 'searchuser@example.com',
        password: 'Password123!',
        firstName: 'Search',
      });

      const result = await adminPanel.listUsers({ search: 'searchuser' });
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('should paginate users', async () => {
      for (let i = 0; i < 15; i++) {
        await adminPanel.createUser(adminUserId, {
          email: `pageuser${i}@example.com`,
          password: 'Password123!',
        });
      }

      const result = await adminPanel.listUsers({ limit: 10, offset: 0 });
      expect(result.items.length).toBe(10);
      expect(result.total).toBeGreaterThan(10);
      expect(result.totalPages).toBeGreaterThan(1);
    });
  });

  describe('Role Management', () => {
    it('should get all roles', async () => {
      const roles = await adminPanel.getRoles();
      expect(roles.length).toBeGreaterThan(0);
    });

    it('should get role by name', async () => {
      const role = await adminPanel.getRoleByName('admin');
      expect(role).toBeDefined();
      expect(role!.name).toBe('admin');
    });

    it('should return null for non-existent role', async () => {
      const role = await adminPanel.getRoleByName('nonexistent' as RoleType);
      expect(role).toBeNull();
    });

    it('should create custom role', async () => {
      const role = await adminPanel.createRole(adminUserId, 'editor', 'Custom role description', [
        { resource: 'custom', actions: ['read', 'create'] },
      ]);

      expect(role).toBeDefined();
      expect(role.name).toBe('editor');
      expect(role.description).toBe('Custom role description');
      expect(role.isSystem).toBe(false);
    });

    it('should throw error when creating duplicate role', async () => {
      await adminPanel.createRole(adminUserId, 'viewer', 'Description', []);

      await expect(
        adminPanel.createRole(adminUserId, 'viewer', 'Description', [])
      ).rejects.toThrow('Role already exists');
    });

    it('should update custom role', async () => {
      const role = await adminPanel.createRole(adminUserId, 'reviewer', 'Original description', []);

      const updated = await adminPanel.updateRole(adminUserId, role.id, {
        description: 'Updated description',
      });

      expect(updated).toBeDefined();
      expect(updated!.description).toBe('Updated description');
    });

    it('should throw error when updating system role', async () => {
      const adminRole = await adminPanel.getRoleByName('admin');
      await expect(
        adminPanel.updateRole(adminUserId, adminRole!.id, { description: 'Hacked' })
      ).rejects.toThrow('Cannot modify system roles');
    });

    it('should delete custom role', async () => {
      const role = await adminPanel.createRole(adminUserId, 'contributor', 'To be deleted', []);
      const result = await adminPanel.deleteRole(adminUserId, role.id);
      expect(result).toBe(true);
    });

    it('should throw error when deleting system role', async () => {
      const adminRole = await adminPanel.getRoleByName('admin');
      await expect(
        adminPanel.deleteRole(adminUserId, adminRole!.id)
      ).rejects.toThrow('Cannot delete system roles');
    });

    it('should throw error when deleting role with assigned users', async () => {
      const role = await adminPanel.createRole(adminUserId, 'analyst', 'Assigned to user', []);
      await adminPanel.createUser(adminUserId, {
        email: 'assigned@example.com',
        password: 'Password123!',
        role: 'analyst' as RoleType,
      });

      await expect(
        adminPanel.deleteRole(adminUserId, role.id)
      ).rejects.toThrow('Cannot delete role that is assigned to users');
    });
  });

  describe('Permission Management', () => {
    it('should grant permission to role', async () => {
      const role = await adminPanel.createRole(adminUserId, 'supporter', 'Permission test', []);
      const permission: Permission = { resource: 'test_resource', actions: ['read'] };

      const updated = await adminPanel.grantPermission(adminUserId, role.id, permission);
      expect(updated).toBeDefined();
      expect(updated!.permissions.some(p => p.resource === 'test_resource')).toBe(true);
    });

    it('should revoke permission from role', async () => {
      const role = await adminPanel.createRole(adminUserId, 'member', 'Revoke test', [
        { resource: 'revoke_resource', actions: ['read', 'update'] },
      ]);

      const updated = await adminPanel.revokePermission(adminUserId, role.id, 'revoke_resource', 'read');
      expect(updated).toBeDefined();
      const perm = updated!.permissions.find(p => p.resource === 'revoke_resource');
      expect(perm).toBeDefined();
      expect(perm!.actions).not.toContain('read');
      expect(perm!.actions).toContain('update');
    });

    it('should throw error when revoking from system role', async () => {
      const userRole = await adminPanel.getRoleByName('user');
      await expect(
        adminPanel.revokePermission(adminUserId, userRole!.id, 'content', 'read')
      ).rejects.toThrow('Cannot modify system roles');
    });
  });

  describe('Audit Log', () => {
    it('should record audit log entries', async () => {
      await adminPanel.createUser(adminUserId, {
        email: 'audit@example.com',
        password: 'Password123!',
      });

      const auditLog = await adminPanel.getAuditLog();
      expect(auditLog.items.length).toBeGreaterThan(0);
    });

    it('should filter audit log by action', async () => {
      await adminPanel.createUser(adminUserId, {
        email: 'auditfilter@example.com',
        password: 'Password123!',
      });

      const auditLog = await adminPanel.getAuditLog({ action: 'user_created' });
      expect(auditLog.items.every(e => e.action === 'user_created')).toBe(true);
    });

    it('should filter audit log by date range', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const auditLog = await adminPanel.getAuditLog({ startDate });
      expect(auditLog.items.every(e => e.timestamp >= startDate)).toBe(true);
    });

    it('should filter audit log by status', async () => {
      const auditLog = await adminPanel.getAuditLog({ status: 'success' });
      expect(auditLog.items.every(e => e.status === 'success')).toBe(true);
    });

    it('should paginate audit log', async () => {
      const auditLog = await adminPanel.getAuditLog({ limit: 5, offset: 0 });
      expect(auditLog.items.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Dashboard', () => {
    it('should get dashboard stats', async () => {
      await adminPanel.createUser(adminUserId, {
        email: 'stats@example.com',
        password: 'Password123!',
      });

      const stats = await adminPanel.getDashboardStats();
      expect(stats).toBeDefined();
      expect(stats.totalUsers).toBeGreaterThan(0);
      expect(stats.activeUsers).toBeGreaterThanOrEqual(0);
      expect(stats.suspendedUsers).toBeGreaterThanOrEqual(0);
    });

    it('should track new users by time period', async () => {
      const beforeStats = await adminPanel.getDashboardStats();
      await adminPanel.createUser(adminUserId, {
        email: 'newuserstats@example.com',
        password: 'Password123!',
      });
      const afterStats = await adminPanel.getDashboardStats();

      expect(afterStats.newUsersToday).toBeGreaterThanOrEqual(beforeStats.newUsersToday);
    });

    it('should get system metrics', async () => {
      const metrics = await adminPanel.getSystemMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.cpu).toBeDefined();
      expect(metrics.memory).toBeDefined();
      expect(metrics.disk).toBeDefined();
      expect(metrics.network).toBeDefined();
    });
  });

  describe('Settings', () => {
    it('should get settings', async () => {
      const settings = await adminPanel.getSettings(adminUserId);
      expect(settings).toBeDefined();
      expect(settings.maintenanceMode).toBe(false);
      expect(settings.allowRegistration).toBe(true);
    });

    it('should update settings', async () => {
      const settings = await adminPanel.updateSettings(adminUserId, {
        maintenanceMode: true,
      });
      expect(settings.maintenanceMode).toBe(true);
    });

    it('should update multiple settings', async () => {
      const settings = await adminPanel.updateSettings(adminUserId, {
        allowRegistration: false,
        requireEmailVerification: false,
        sessionTimeout: 7200,
      });
      expect(settings.allowRegistration).toBe(false);
      expect(settings.requireEmailVerification).toBe(false);
      expect(settings.sessionTimeout).toBe(7200);
    });
  });

  describe('Notifications', () => {
    it('should create notification', async () => {
      const notification = await adminPanel.createNotification(adminUserId, {
        type: 'info',
        title: 'Test Notification',
        message: 'This is a test',
      });

      expect(notification).toBeDefined();
      expect(notification.title).toBe('Test Notification');
      expect(notification.read).toBe(false);
    });

    it('should get unread notifications', async () => {
      await adminPanel.createNotification(adminUserId, {
        type: 'success',
        title: 'Success',
        message: 'Operation completed',
      });

      const notifications = await adminPanel.getNotifications(adminUserId);
      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should mark notification as read', async () => {
      const notification = await adminPanel.createNotification(adminUserId, {
        type: 'warning',
        title: 'Warning',
        message: 'Check this',
      });

      const result = await adminPanel.markNotificationAsRead(adminUserId, notification.id);
      expect(result).toBe(true);
    });

    it('should mark all notifications as read', async () => {
      await adminPanel.createNotification(adminUserId, {
        type: 'error',
        title: 'Error 1',
        message: 'Error',
      });
      await adminPanel.createNotification(adminUserId, {
        type: 'error',
        title: 'Error 2',
        message: 'Error',
      });

      const count = await adminPanel.markAllNotificationsAsRead(adminUserId);
      expect(count).toBeGreaterThan(0);
    });

    it('should delete notification', async () => {
      const notification = await adminPanel.createNotification(adminUserId, {
        type: 'info',
        title: 'To Delete',
        message: 'Will be deleted',
      });

      const result = await adminPanel.deleteNotification(adminUserId, notification.id);
      expect(result).toBe(true);
    });
  });

  describe('Permissions', () => {
    it('should check permission for admin role', () => {
      expect(adminPanel.hasPermission('admin', 'users', 'delete')).toBe(true);
    });

    it('should check permission for user role', () => {
      expect(adminPanel.hasPermission('user', 'profile', 'read')).toBe(true);
    });

    it('should deny permission for guest role', () => {
      expect(adminPanel.hasPermission('guest', 'users', 'delete')).toBe(false);
    });

    it('should check section access for admin', () => {
      expect(adminPanel.canAccessSection('admin', 'dashboard')).toBe(true);
      expect(adminPanel.canAccessSection('admin', 'users')).toBe(true);
      expect(adminPanel.canAccessSection('admin', 'settings')).toBe(true);
    });

    it('should deny settings access for regular user', () => {
      expect(adminPanel.canAccessSection('user', 'settings')).toBe(false);
    });
  });

  describe('Event Listeners', () => {
    it('should emit and receive events', async () => {
      let eventReceived = false;
      adminPanel.onEvent((event) => {
        if (event.type === 'admin.user.created') {
          eventReceived = true;
        }
      });

      await adminPanel.createUser(adminUserId, {
        email: 'eventtest@example.com',
        password: 'Password123!',
      });

      expect(eventReceived).toBe(true);
    });

    it('should remove event listener', async () => {
      let eventCount = 0;
      const listener = () => {
        eventCount++;
      };

      adminPanel.onEvent(listener);
      await adminPanel.createUser(adminUserId, {
        email: 'event1@example.com',
        password: 'Password123!',
      });

      adminPanel.offEvent(listener);
      await adminPanel.createUser(adminUserId, {
        email: 'event2@example.com',
        password: 'Password123!',
      });

      expect(eventCount).toBe(1);
    });
  });

  describe('Utility Functions', () => {
    describe('generateId', () => {
      it('should generate unique IDs with prefix', () => {
        const id1 = generateId('usr');
        const id2 = generateId('usr');
        expect(id1).toMatch(/^usr_[a-f0-9]{16}$/);
        expect(id2).toMatch(/^usr_[a-f0-9]{16}$/);
        expect(id1).not.toBe(id2);
      });
    });

    describe('hashPassword and verifyPassword', () => {
      it('should hash and verify password correctly', () => {
        const hash = hashPassword('TestPassword123!');
        expect(verifyPassword('TestPassword123!', hash)).toBe(true);
        expect(verifyPassword('WrongPassword', hash)).toBe(false);
      });
    });

    describe('isValidEmail', () => {
      it('should validate correct email formats', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
        expect(isValidEmail('user+tag@domain.com')).toBe(true);
      });

      it('should reject invalid email formats', () => {
        expect(isValidEmail('invalid')).toBe(false);
        expect(isValidEmail('invalid@')).toBe(false);
        expect(isValidEmail('@example.com')).toBe(false);
        expect(isValidEmail('test@')).toBe(false);
      });
    });
  });

  describe('Statistics', () => {
    it('should return correct stats', async () => {
      const stats = adminPanel.getStats();
      expect(stats.totalUsers).toBeGreaterThan(0);
      expect(stats.totalRoles).toBeGreaterThan(0);
      expect(stats.totalAuditEntries).toBeGreaterThanOrEqual(0);
    });
  });
});
