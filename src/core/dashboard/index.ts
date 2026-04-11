/**
 * Dashboard & Analytics Widgets Module
 * Comprehensive dashboard system for Manus AI Platform
 */

export * from './types';
export * from './dashboard';

import { DashboardServiceImpl, createDashboardService, createDashboard } from './dashboard';

export const dashboardService = createDashboardService();

export { DashboardServiceImpl, createDashboardService, createDashboard };
