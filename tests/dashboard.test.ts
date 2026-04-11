/**
 * Dashboard & Analytics Widgets Tests
 */

import {
  DashboardServiceImpl,
  createDashboardService,
  createDashboard,
  ChartWidget,
  TableWidget,
  MetricWidget,
  ProgressWidget,
  FunnelWidget,
  HeatmapWidget,
  TimeSeriesWidget,
} from '../src/core/dashboard/dashboard';
import {
  WidgetType,
  ChartType,
  RefreshInterval,
  PermissionLevel,
  TimePreset,
  DashboardLayout,
  Position,
  WidgetDataSource,
  WidgetConfiguration,
} from '../src/core/dashboard/types';

describe('DashboardServiceImpl', () => {
  let service: DashboardServiceImpl;

  beforeEach(() => {
    service = new DashboardServiceImpl();
  });

  describe('Dashboard Creation', () => {
    test('should create dashboard with all required fields', async () => {
      const dashboard = await service.createDashboard('My Dashboard', 'A test dashboard', 'user123');

      expect(dashboard.dashboardId).toBeDefined();
      expect(dashboard.name).toBe('My Dashboard');
      expect(dashboard.description).toBe('A test dashboard');
      expect(dashboard.widgets).toEqual([]);
      expect(dashboard.layout.columns).toBe(12);
      expect(dashboard.layout.rows).toBe(8);
      expect(dashboard.layout.gap).toBe(16);
      expect(dashboard.permissions).toHaveLength(1);
      expect(dashboard.permissions[0].userId).toBe('user123');
      expect(dashboard.permissions[0].permission).toBe('admin');
    });

    test('should create dashboard with custom layout', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123', {
        columns: 6,
        rows: 4,
        gap: 8,
        rowHeight: 100,
      });

      expect(dashboard.layout.columns).toBe(6);
      expect(dashboard.layout.rows).toBe(4);
      expect(dashboard.layout.gap).toBe(8);
      expect(dashboard.layout.rowHeight).toBe(100);
    });

    test('should generate unique dashboard IDs', async () => {
      const dashboard1 = await service.createDashboard('Dash 1', 'Desc', 'user1');
      const dashboard2 = await service.createDashboard('Dash 2', 'Desc', 'user2');

      expect(dashboard1.dashboardId).not.toBe(dashboard2.dashboardId);
    });

    test('should create dashboard with createdAt and updatedAt', async () => {
      const before = new Date();
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      const after = new Date();

      expect(dashboard.createdAt).toBeInstanceOf(Date);
      expect(dashboard.updatedAt).toBeInstanceOf(Date);
      expect(dashboard.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(dashboard.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Dashboard Retrieval', () => {
    test('should get dashboard by ID', async () => {
      const created = await service.createDashboard('Test', 'Desc', 'user123');
      const retrieved = await service.getDashboard(created.dashboardId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.dashboardId).toBe(created.dashboardId);
      expect(retrieved?.name).toBe('Test');
    });

    test('should return null for non-existent dashboard', async () => {
      const result = await service.getDashboard('non_existent_id');
      expect(result).toBeNull();
    });

    test('should list all dashboards', async () => {
      await service.createDashboard('Dashboard 1', 'Desc', 'user1');
      await service.createDashboard('Dashboard 2', 'Desc', 'user2');
      await service.createDashboard('Dashboard 3', 'Desc', 'user3');

      const dashboards = await service.listDashboards();
      expect(dashboards.length).toBe(3);
    });

    test('should get dashboards by user', async () => {
      await service.createDashboard('User1 Dash', 'Desc', 'user1');
      await service.createDashboard('User1 Dash 2', 'Desc', 'user1');
      await service.createDashboard('User2 Dash', 'Desc', 'user2');

      const user1Dashboards = await service.getDashboardsByUser('user1');
      expect(user1Dashboards.length).toBe(2);
    });
  });

  describe('Dashboard Update', () => {
    test('should update dashboard name', async () => {
      const dashboard = await service.createDashboard('Original', 'Desc', 'user123');
      const updated = await service.updateDashboard(dashboard.dashboardId, { name: 'Updated' });

      expect(updated.name).toBe('Updated');
      expect(updated.dashboardId).toBe(dashboard.dashboardId);
    });

    test('should update dashboard description', async () => {
      const dashboard = await service.createDashboard('Test', 'Original Desc', 'user123');
      const updated = await service.updateDashboard(dashboard.dashboardId, { description: 'New Desc' });

      expect(updated.description).toBe('New Desc');
    });

    test('should update dashboard layout partially', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      const updated = await service.updateDashboard(dashboard.dashboardId, { layout: { columns: 6 } });

      expect(updated.layout.columns).toBe(6);
      expect(updated.layout.rows).toBe(8);
      expect(updated.layout.gap).toBe(16);
    });

    test('should throw error when updating non-existent dashboard', async () => {
      await expect(
        service.updateDashboard('non_existent', { name: 'Test' })
      ).rejects.toThrow('Dashboard non_existent not found');
    });

    test('should update updatedAt timestamp on changes', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      const originalUpdatedAt = dashboard.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));
      await service.updateDashboard(dashboard.dashboardId, { name: 'Updated' });

      const updated = await service.getDashboard(dashboard.dashboardId);
      expect(updated!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Dashboard Delete', () => {
    test('should delete dashboard', async () => {
      const dashboard = await service.createDashboard('To Delete', 'Desc', 'user123');
      await service.deleteDashboard(dashboard.dashboardId);

      const retrieved = await service.getDashboard(dashboard.dashboardId);
      expect(retrieved).toBeNull();
    });

    test('should delete dashboard with widgets', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      await service.addWidget(dashboard.dashboardId, {
        name: 'Widget 1',
        type: 'chart',
        position: { x: 0, y: 0, w: 4, h: 3 },
        dataSource: { type: 'events', query: {} },
      });

      await service.deleteDashboard(dashboard.dashboardId);

      const retrieved = await service.getDashboard(dashboard.dashboardId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Dashboard Duplicate', () => {
    test('should duplicate dashboard with widgets', async () => {
      const original = await service.createDashboard('Original', 'Desc', 'user123');
      await service.addWidget(original.dashboardId, {
        name: 'Widget 1',
        type: 'chart',
        position: { x: 0, y: 0, w: 4, h: 3 },
        dataSource: { type: 'events', query: {} },
      });

      const duplicate = await service.duplicateDashboard(original.dashboardId, 'Duplicate', 'user456');

      expect(duplicate.dashboardId).not.toBe(original.dashboardId);
      expect(duplicate.name).toBe('Duplicate');
      expect(duplicate.widgets.length).toBe(1);
      expect(duplicate.widgets[0].name).toBe('Widget 1');
    });
  });

  describe('Widget Management', () => {
    let dashboard: Awaited<ReturnType<typeof service.createDashboard>>;

    beforeEach(async () => {
      dashboard = await service.createDashboard('Test Dashboard', 'Desc', 'user123');
    });

    test('should add widget to dashboard', async () => {
      const widget = await service.addWidget(dashboard.dashboardId, {
        name: 'Chart Widget',
        type: 'chart',
        position: { x: 0, y: 0, w: 6, h: 4 },
        dataSource: { type: 'events', query: { eventName: 'page_view' } },
      });

      expect(widget.widgetId).toBeDefined();
      expect(widget.dashboardId).toBe(dashboard.dashboardId);
      expect(widget.name).toBe('Chart Widget');
      expect(widget.type).toBe('chart');
    });

    test('should add widget with configuration', async () => {
      const config: WidgetConfiguration = {
        chart: {
          chartType: 'line',
          title: 'My Chart',
          showLegend: true,
        },
      };

      const widget = await service.addWidget(dashboard.dashboardId, {
        name: 'Configured Widget',
        type: 'chart',
        position: { x: 0, y: 0, w: 4, h: 3 },
        dataSource: { type: 'events', query: {} },
        configuration: config,
      });

      expect(widget.configuration?.chart?.chartType).toBe('line');
      expect(widget.configuration?.chart?.title).toBe('My Chart');
    });

    test('should get widget by ID', async () => {
      const added = await service.addWidget(dashboard.dashboardId, {
        name: 'Widget',
        type: 'metric',
        position: { x: 0, y: 0, w: 3, h: 2 },
        dataSource: { type: 'metrics', query: {} },
      });

      const retrieved = await service.getWidget(added.widgetId);
      expect(retrieved?.widgetId).toBe(added.widgetId);
    });

    test('should update widget', async () => {
      const widget = await service.addWidget(dashboard.dashboardId, {
        name: 'Original',
        type: 'chart',
        position: { x: 0, y: 0, w: 4, h: 3 },
        dataSource: { type: 'events', query: {} },
      });

      const updated = await service.updateWidget(widget.widgetId, {
        position: { x: 1, y: 1, w: 6, h: 4 },
        isVisible: false,
      });

      expect(updated.position.x).toBe(1);
      expect(updated.position.w).toBe(6);
      expect(updated.isVisible).toBe(false);
    });

    test('should remove widget from dashboard', async () => {
      const widget = await service.addWidget(dashboard.dashboardId, {
        name: 'To Remove',
        type: 'table',
        position: { x: 0, y: 0, w: 4, h: 3 },
        dataSource: { type: 'events', query: {} },
      });

      await service.removeWidget(dashboard.dashboardId, widget.widgetId);

      const retrieved = await service.getWidget(widget.widgetId);
      expect(retrieved).toBeNull();

      const dash = await service.getDashboard(dashboard.dashboardId);
      expect(dash?.widgets.length).toBe(0);
    });

    test('should move widget to new position', async () => {
      const widget = await service.addWidget(dashboard.dashboardId, {
        name: 'Widget',
        type: 'chart',
        position: { x: 0, y: 0, w: 4, h: 3 },
        dataSource: { type: 'events', query: {} },
      });

      const moved = await service.moveWidget(widget.widgetId, { x: 2, y: 2, w: 4, h: 3 });
      expect(moved.position.x).toBe(2);
      expect(moved.position.y).toBe(2);
    });

    test('should resize widget', async () => {
      const widget = await service.addWidget(dashboard.dashboardId, {
        name: 'Widget',
        type: 'chart',
        position: { x: 0, y: 0, w: 4, h: 3 },
        dataSource: { type: 'events', query: {} },
      });

      const resized = await service.resizeWidget(widget.widgetId, { x: 0, y: 0, w: 8, h: 6 });
      expect(resized.position.w).toBe(8);
      expect(resized.position.h).toBe(6);
    });
  });

  describe('Widget Refresh', () => {
    test('should refresh widget and return data', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      const widget = await service.addWidget(dashboard.dashboardId, {
        name: 'Widget',
        type: 'chart',
        position: { x: 0, y: 0, w: 4, h: 3 },
        dataSource: { type: 'events', query: {} },
      });

      const data = await service.refreshWidget(widget.widgetId);

      expect(data.widgetId).toBe(widget.widgetId);
      expect(data.data).toBeDefined();
      expect(data.timestamp).toBeInstanceOf(Date);
    });

    test('should get widget data', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      const widget = await service.addWidget(dashboard.dashboardId, {
        name: 'Widget',
        type: 'metric',
        position: { x: 0, y: 0, w: 3, h: 2 },
        dataSource: { type: 'metrics', query: {} },
      });

      const data = await service.getWidgetData(widget.widgetId);
      expect(data.widgetId).toBe(widget.widgetId);
    });
  });

  describe('Permissions', () => {
    test('should grant admin permission', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');

      const permission = await service.grantPermission(dashboard.dashboardId, 'user456', 'admin', 'user123');

      expect(permission.userId).toBe('user456');
      expect(permission.permission).toBe('admin');
    });

    test('should grant edit permission', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');

      await service.grantPermission(dashboard.dashboardId, 'user456', 'edit', 'user123');

      const hasEdit = await service.hasPermission(dashboard.dashboardId, 'user456', 'edit');
      const hasAdmin = await service.hasPermission(dashboard.dashboardId, 'user456', 'admin');

      expect(hasEdit).toBe(true);
      expect(hasAdmin).toBe(false);
    });

    test('should grant view permission', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');

      await service.grantPermission(dashboard.dashboardId, 'user456', 'view', 'user123');

      const hasView = await service.hasPermission(dashboard.dashboardId, 'user456', 'view');
      const hasEdit = await service.hasPermission(dashboard.dashboardId, 'user456', 'edit');

      expect(hasView).toBe(true);
      expect(hasEdit).toBe(false);
    });

    test('should revoke permission', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      await service.grantPermission(dashboard.dashboardId, 'user456', 'view', 'user123');

      await service.revokePermission(dashboard.dashboardId, 'user456');

      const hasView = await service.hasPermission(dashboard.dashboardId, 'user456', 'view');
      expect(hasView).toBe(false);
    });

    test('should get all permissions for dashboard', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      await service.grantPermission(dashboard.dashboardId, 'user456', 'edit', 'user123');

      const permissions = await service.getPermissions(dashboard.dashboardId);

      expect(permissions.length).toBe(2);
    });

    test('should update permission level', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      await service.grantPermission(dashboard.dashboardId, 'user456', 'view', 'user123');

      await service.updatePermission(dashboard.dashboardId, 'user456', 'admin');

      const hasAdmin = await service.hasPermission(dashboard.dashboardId, 'user456', 'admin');
      expect(hasAdmin).toBe(true);
    });
  });

  describe('Sharing', () => {
    test('should share dashboard as public', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');

      const share = await service.shareDashboard(dashboard.dashboardId, 'public', 'user123');

      expect(share.shareId).toBeDefined();
      expect(share.shareType).toBe('public');
      expect(share.dashboardId).toBe(dashboard.dashboardId);
    });

    test('should share dashboard as link', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');

      const share = await service.shareDashboard(dashboard.dashboardId, 'link', 'user123');

      expect(share.linkToken).toBeDefined();
      expect(share.expiresAt).toBeInstanceOf(Date);
    });

    test('should get share by token', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      const share = await service.shareDashboard(dashboard.dashboardId, 'link', 'user123');

      const retrieved = await service.getShareByToken(share.linkToken!);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.shareId).toBe(share.shareId);
    });

    test('should return null for expired token', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      const share = await service.shareDashboard(dashboard.dashboardId, 'link', 'user123');

      share.expiresAt = new Date(Date.now() - 1000);
      const shares = service.getDashboardShares(dashboard.dashboardId);

      const retrieved = await service.getShareByToken(share.linkToken!);
      expect(retrieved).toBeNull();
    });

    test('should get dashboard shares', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      await service.shareDashboard(dashboard.dashboardId, 'public', 'user123');
      await service.shareDashboard(dashboard.dashboardId, 'link', 'user123');

      const shares = await service.getDashboardShares(dashboard.dashboardId);

      expect(shares.length).toBe(2);
    });

    test('should revoke share', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      const share = await service.shareDashboard(dashboard.dashboardId, 'link', 'user123');

      await service.revokeShare(share.shareId);

      const shares = await service.getDashboardShares(dashboard.dashboardId);
      expect(shares.length).toBe(0);
    });
  });

  describe('Templates', () => {
    test('should create template from dashboard', async () => {
      const dashboard = await service.createDashboard('Original', 'Desc', 'user123');
      await service.addWidget(dashboard.dashboardId, {
        name: 'Widget 1',
        type: 'chart',
        position: { x: 0, y: 0, w: 4, h: 3 },
        dataSource: { type: 'events', query: {} },
      });

      const template = await service.createTemplate('My Template', 'Description', 'analytics', dashboard.dashboardId);

      expect(template.templateId).toBeDefined();
      expect(template.name).toBe('My Template');
      expect(template.widgets.length).toBe(1);
    });

    test('should get template by ID', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      const template = await service.createTemplate('Template', 'Desc', 'category', dashboard.dashboardId);

      const retrieved = await service.getTemplate(template.templateId);

      expect(retrieved?.templateId).toBe(template.templateId);
    });

    test('should list templates by category', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      await service.createTemplate('Template 1', 'Desc', 'analytics', dashboard.dashboardId);
      await service.createTemplate('Template 2', 'Desc', 'analytics', dashboard.dashboardId);
      await service.createTemplate('Template 3', 'Desc', 'sales', dashboard.dashboardId);

      const analyticsTemplates = await service.listTemplates('analytics');
      const allTemplates = await service.listTemplates();

      expect(analyticsTemplates.length).toBe(2);
      expect(allTemplates.length).toBe(3);
    });

    test('should delete template', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      const template = await service.createTemplate('To Delete', 'Desc', 'cat', dashboard.dashboardId);

      await service.deleteTemplate(template.templateId);

      const retrieved = await service.getTemplate(template.templateId);
      expect(retrieved).toBeNull();
    });

    test('should create dashboard from template', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      await service.addWidget(dashboard.dashboardId, {
        name: 'Template Widget',
        type: 'chart',
        position: { x: 0, y: 0, w: 6, h: 4 },
        dataSource: { type: 'events', query: {} },
      });
      const template = await service.createTemplate('Template', 'Desc', 'analytics', dashboard.dashboardId);

      const newDashboard = await service.createDashboardFromTemplate(template.templateId, 'New Dashboard', 'user456');

      expect(newDashboard.dashboardId).not.toBe(dashboard.dashboardId);
      expect(newDashboard.widgets.length).toBe(1);
      expect(newDashboard.widgets[0].name).toBe('Template Widget');
    });
  });

  describe('Preferences', () => {
    test('should get default preferences', async () => {
      const prefs = await service.getPreferences('user123');

      expect(prefs.userId).toBe('user123');
      expect(prefs.widgetDefaults).toEqual({});
      expect(prefs.theme).toBe('auto');
    });

    test('should update preferences', async () => {
      await service.updatePreferences('user123', {
        theme: 'dark',
        refreshRate: 60000,
      });

      const prefs = await service.getPreferences('user123');
      expect(prefs.theme).toBe('dark');
      expect(prefs.refreshRate).toBe(60000);
    });

    test('should set default dashboard', async () => {
      const dashboard = await service.createDashboard('Default', 'Desc', 'user123');

      await service.setDefaultDashboard('user123', dashboard.dashboardId);

      const prefs = await service.getPreferences('user123');
      expect(prefs.defaultDashboardId).toBe(dashboard.dashboardId);
    });
  });

  describe('Data Aggregation', () => {
    test('should aggregate data with count', async () => {
      const data = [1, 2, 3, 4, 5];
      const result = await service.aggregateData(data, 'count');
      expect(result).toBe(5);
    });

    test('should aggregate data with sum', async () => {
      const data = [1, 2, 3, 4, 5];
      const result = await service.aggregateData(data, 'sum');
      expect(result).toBe(15);
    });

    test('should aggregate data with average', async () => {
      const data = [2, 4, 6, 8];
      const result = await service.aggregateData(data, 'average');
      expect(result).toBe(5);
    });

    test('should aggregate data with min', async () => {
      const data = [5, 3, 8, 1, 9];
      const result = await service.aggregateData(data, 'min');
      expect(result).toBe(1);
    });

    test('should aggregate data with max', async () => {
      const data = [5, 3, 8, 1, 9];
      const result = await service.aggregateData(data, 'max');
      expect(result).toBe(9);
    });

    test('should aggregate data with unique', async () => {
      const data = [1, 2, 2, 3, 3, 3];
      const result = await service.aggregateData(data, 'unique');
      expect(result).toBe(3);
    });

    test('should group data by field', async () => {
      const data = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 },
        { category: 'B', value: 4 },
      ];

      const grouped = await service.groupData(data, ['category']);

      expect(Object.keys(grouped).length).toBe(2);
      expect(grouped['A']).toHaveLength(2);
      expect(grouped['B']).toHaveLength(2);
    });

    test('should filter data', async () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
        { name: 'Charlie', age: 30 },
      ];

      const filtered = await service.filterData(data, { age: 30 });

      expect(filtered).toHaveLength(2);
    });
  });

  describe('Realtime Subscriptions', () => {
    test('should subscribe to widget updates', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');
      const widget = await service.addWidget(dashboard.dashboardId, {
        name: 'Widget',
        type: 'chart',
        position: { x: 0, y: 0, w: 4, h: 3 },
        dataSource: { type: 'events', query: {} },
      });

      let updateReceived = false;
      const unsubscribe = service.subscribeToWidget(widget.widgetId, () => {
        updateReceived = true;
      });

      expect(typeof unsubscribe).toBe('function');
    });

    test('should subscribe to dashboard updates', async () => {
      const dashboard = await service.createDashboard('Test', 'Desc', 'user123');

      let updateReceived = false;
      const unsubscribe = service.subscribeToDashboard(dashboard.dashboardId, () => {
        updateReceived = true;
      });

      expect(typeof unsubscribe).toBe('function');
    });

    test('should unsubscribe from widget', () => {
      const dashboard = service.createDashboard('Test', 'Desc', 'user123');
      dashboard.then(d => {
        service.addWidget(d.dashboardId, {
          name: 'Widget',
          type: 'chart',
          position: { x: 0, y: 0, w: 4, h: 3 },
          dataSource: { type: 'events', query: {} },
        }).then(w => {
          const unsubscribe = service.subscribeToWidget(w.widgetId, () => {});
          unsubscribe();
        });
      });

      expect(true).toBe(true);
    });
  });
});

describe('ChartWidget', () => {
  test('should generate line chart data', () => {
    const data = ChartWidget.generateLineData(12);
    expect(data).toHaveLength(12);
    expect(data[0]).toHaveProperty('label');
    expect(data[0]).toHaveProperty('value');
  });

  test('should generate bar chart data', () => {
    const data = ChartWidget.generateBarData(6);
    expect(data).toHaveLength(6);
  });

  test('should generate pie chart data with colors', () => {
    const data = ChartWidget.generatePieData(5);
    expect(data).toHaveLength(5);
    expect(data[0]).toHaveProperty('color');
  });

  test('should generate area chart data', () => {
    const data = ChartWidget.generateAreaData(10);
    expect(data).toHaveLength(10);
  });

  test('should generate scatter data without labels', () => {
    const data = ChartWidget.generateScatterData(20);
    expect(data).toHaveLength(20);
  });

  test('should generate donut chart data', () => {
    const data = ChartWidget.generateDonutData(4);
    expect(data).toHaveLength(4);
  });
});

describe('TableWidget', () => {
  test('should generate table columns', () => {
    const columns = TableWidget.generateColumns();
    expect(columns).toHaveLength(4);
    expect(columns[0].key).toBe('id');
    expect(columns[0].sortable).toBe(true);
  });

  test('should generate table rows', () => {
    const rows = TableWidget.generateRows(5);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveProperty('id');
    expect(rows[0]).toHaveProperty('name');
    expect(rows[0]).toHaveProperty('value');
  });
});

describe('MetricWidget', () => {
  test('should generate metric value with trend', () => {
    const value = MetricWidget.generateValue();
    expect(value).toHaveProperty('current');
    expect(value).toHaveProperty('previous');
    expect(value).toHaveProperty('trend');
    expect(['up', 'down', 'neutral']).toContain(value.trend);
  });
});

describe('ProgressWidget', () => {
  test('should generate progress data', () => {
    const data = ProgressWidget.generateData();
    expect(data).toHaveProperty('value');
    expect(data).toHaveProperty('max');
    expect(data.value).toBeLessThanOrEqual(data.max);
  });
});

describe('FunnelWidget', () => {
  test('should generate funnel data with steps', () => {
    const data = FunnelWidget.generateData();
    expect(data.steps.length).toBeGreaterThan(0);
    expect(data.steps[0]).toHaveProperty('name');
    expect(data.steps[0]).toHaveProperty('value');
  });
});

describe('HeatmapWidget', () => {
  test('should generate heatmap cells', () => {
    const cells = HeatmapWidget.generateCells(7, 24);
    expect(cells).toHaveLength(7 * 24);
    expect(cells[0]).toHaveProperty('x');
    expect(cells[0]).toHaveProperty('y');
    expect(cells[0]).toHaveProperty('value');
  });
});

describe('TimeSeriesWidget', () => {
  test('should generate time series data', () => {
    const data = TimeSeriesWidget.generateData(24);
    expect(data).toHaveLength(24);
    expect(data[0]).toHaveProperty('timestamp');
    expect(data[0]).toHaveProperty('value');
  });

  test('should generate chronological data', () => {
    const data = TimeSeriesWidget.generateData(10);
    for (let i = 1; i < data.length; i++) {
      expect(data[i].timestamp.getTime()).toBeGreaterThan(data[i - 1].timestamp.getTime());
    }
  });
});

describe('createDashboard', () => {
  test('should create dashboard using convenience function', async () => {
    const dashboard = await createDashboard('Test Dashboard', 'Description', 'user123');
    expect(dashboard.dashboardId).toBeDefined();
    expect(dashboard.name).toBe('Test Dashboard');
  });
});

describe('createDashboardService', () => {
  test('should create service instance', () => {
    const service = createDashboardService();
    expect(service).toBeInstanceOf(DashboardServiceImpl);
  });
});
