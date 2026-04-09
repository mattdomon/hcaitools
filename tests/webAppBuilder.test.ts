import { buildFromPrompt, getSupportedAppTypes } from '../src/core/webAppBuilder';
import { analyzePrompt } from '../src/core/webAppBuilder/promptAnalyzer';
import {
  generateDatabaseSchema,
  generateSQLMigration,
  generateDockerConfig,
} from '../src/core/webAppBuilder/codeGenerator';
import { AppRequirements } from '../src/core/webAppBuilder/types';

describe('US-CORE-001: Web App Builder', () => {
  describe('analyzePrompt', () => {
    it('detects e-commerce app type from prompt', () => {
      const result = analyzePrompt('I want to build an online store to sell handmade products');
      expect(result.appType).toBe('e-commerce');
    });

    it('detects saas-dashboard app type from prompt', () => {
      const result = analyzePrompt('Build a SaaS dashboard for analytics and team management');
      expect(result.appType).toBe('saas-dashboard');
    });

    it('detects booking-system app type from prompt', () => {
      const result = analyzePrompt('I need a booking system for appointment scheduling');
      expect(result.appType).toBe('booking-system');
    });

    it('detects community-platform app type from prompt', () => {
      const result = analyzePrompt('Create a community forum for developers to discuss topics');
      expect(result.appType).toBe('community-platform');
    });

    it('detects landing-page app type from prompt', () => {
      const result = analyzePrompt('Build a landing page for my product marketing campaign');
      expect(result.appType).toBe('landing-page');
    });

    it('defaults to custom for unknown app types', () => {
      const result = analyzePrompt('Build something unique and special for my business');
      expect(result.appType).toBe('custom');
    });

    it('detects auth requirement from prompt keywords', () => {
      const result = analyzePrompt('Build a dashboard with user login and authentication');
      expect(result.requiresAuth).toBe(true);
    });

    it('detects payment requirement from prompt keywords', () => {
      const result = analyzePrompt('I need payment processing and billing features');
      expect(result.requiresPayments).toBe(true);
    });

    it('suggests postgresql as default database', () => {
      const result = analyzePrompt('Build a simple task management app');
      expect(result.suggestedDatabase).toBe('postgresql');
    });

    it('suggests mongodb for flexible data requirements', () => {
      const result = analyzePrompt('Build a flexible document storage system with nested data');
      expect(result.suggestedDatabase).toBe('mongodb');
    });

    it('detects react as default frontend framework', () => {
      const result = analyzePrompt('Build a web application');
      expect(result.suggestedFrontend).toBe('react');
    });

    it('detects vue when explicitly mentioned', () => {
      const result = analyzePrompt('Build a web app using Vue framework');
      expect(result.suggestedFrontend).toBe('vue');
    });

    it('returns features array for e-commerce', () => {
      const result = analyzePrompt('Build an e-commerce store with user registration');
      expect(result.features).toContain('product-catalog');
      expect(result.features).toContain('shopping-cart');
    });
  });

  describe('buildFromPrompt', () => {
    it('generates a complete application from a prompt', () => {
      const app = buildFromPrompt('MyShop', 'Build an online store with user accounts');
      expect(app.requirements.name).toBe('MyShop');
      expect(app.requirements.appType).toBe('e-commerce');
      expect(app.files.length).toBeGreaterThan(0);
    });

    it('generates frontend files', () => {
      const app = buildFromPrompt('TestApp', 'Build a SaaS dashboard');
      const frontendFiles = app.files.filter((f) => f.path.startsWith('frontend/'));
      expect(frontendFiles.length).toBeGreaterThan(0);
    });

    it('generates backend files', () => {
      const app = buildFromPrompt('TestApp', 'Build a SaaS dashboard');
      const backendFiles = app.files.filter((f) => f.path.startsWith('backend/'));
      expect(backendFiles.length).toBeGreaterThan(0);
    });

    it('generates database migration file', () => {
      const app = buildFromPrompt('TestApp', 'Build a booking system');
      const dbFiles = app.files.filter((f) => f.path.includes('migrations'));
      expect(dbFiles.length).toBeGreaterThan(0);
      expect(dbFiles[0].content).toContain('CREATE TABLE IF NOT EXISTS');
    });

    it('includes docker config when includeDocker is true', () => {
      const app = buildFromPrompt('TestApp', 'Build an app', { includeDocker: true });
      expect(app.dockerConfig).toBeDefined();
      expect(app.dockerConfig?.dockerfileContent).toContain('FROM node');
      expect(app.dockerConfig?.dockerComposeContent).toContain('services:');
    });

    it('includes auth config when includeAuth is true', () => {
      const app = buildFromPrompt('TestApp', 'Build an app', { includeAuth: true });
      expect(app.authConfig).toBeDefined();
      expect(app.authConfig?.strategy).toBe('jwt');
      expect(app.authConfig?.endpoints).toContain('/api/auth/login');
    });

    it('generates auth backend routes when auth is included', () => {
      const app = buildFromPrompt('TestApp', 'Build an app with login', { includeAuth: true });
      const authRouteFile = app.files.find((f) => f.path.includes('routes/auth'));
      expect(authRouteFile).toBeDefined();
    });

    it('generates auth frontend components when auth is included', () => {
      const app = buildFromPrompt('TestApp', 'Build an app with login', { includeAuth: true });
      const authProviderFile = app.files.find((f) => f.path.includes('AuthProvider'));
      expect(authProviderFile).toBeDefined();
    });

    it('allows overriding database type', () => {
      const app = buildFromPrompt('TestApp', 'Build a community platform', {
        database: 'postgresql',
      });
      expect(app.requirements.database).toBe('postgresql');
    });

    it('returns app structure with categorized file paths', () => {
      const app = buildFromPrompt('TestApp', 'Build a booking system');
      expect(app.structure.frontend.length).toBeGreaterThan(0);
      expect(app.structure.backend.length).toBeGreaterThan(0);
      expect(app.structure.database.length).toBeGreaterThan(0);
    });

    it('throws error when appName is empty', () => {
      expect(() => buildFromPrompt('', 'Build something')).toThrow('App name is required');
    });

    it('throws error when prompt is empty', () => {
      expect(() => buildFromPrompt('MyApp', '')).toThrow('Prompt is required');
    });

    it('supports all app types from getSupportedAppTypes', () => {
      const supportedTypes = getSupportedAppTypes();
      expect(supportedTypes).toContain('saas-dashboard');
      expect(supportedTypes).toContain('landing-page');
      expect(supportedTypes).toContain('e-commerce');
      expect(supportedTypes).toContain('portfolio');
      expect(supportedTypes).toContain('booking-system');
      expect(supportedTypes).toContain('community-platform');
      expect(supportedTypes).toContain('membership-site');
      expect(supportedTypes).toContain('custom');
    });
  });

  describe('generateDatabaseSchema', () => {
    const baseRequirements: AppRequirements = {
      name: 'TestApp',
      description: 'Test application',
      appType: 'e-commerce',
      features: [],
      database: 'postgresql',
      frontend: 'react',
      backend: 'nodejs',
      includeAuth: true,
      includeDocker: true,
    };

    it('generates schema with tables for e-commerce', () => {
      const schema = generateDatabaseSchema(baseRequirements);
      expect(schema.type).toBe('postgresql');
      expect(schema.tables.length).toBeGreaterThan(0);
      const tableNames = schema.tables.map((t) => t.name);
      expect(tableNames).toContain('users');
    });

    it('generates schema with orders table for e-commerce', () => {
      const schema = generateDatabaseSchema(baseRequirements);
      const tableNames = schema.tables.map((t) => t.name);
      expect(tableNames).toContain('orders');
    });

    it('generates schema with users table that has required columns', () => {
      const schema = generateDatabaseSchema(baseRequirements);
      const usersTable = schema.tables.find((t) => t.name === 'users');
      expect(usersTable).toBeDefined();
      const columnNames = usersTable!.columns.map((c) => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('password_hash');
    });
  });

  describe('generateSQLMigration', () => {
    it('generates valid SQL CREATE TABLE statements', () => {
      const requirements: AppRequirements = {
        name: 'TestApp',
        description: 'Test',
        appType: 'e-commerce',
        features: [],
        database: 'postgresql',
        frontend: 'react',
        backend: 'nodejs',
        includeAuth: true,
        includeDocker: false,
      };
      const schema = generateDatabaseSchema(requirements);
      const sql = generateSQLMigration(schema);
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS users');
      expect(sql).toContain('PRIMARY KEY');
    });
  });

  describe('generateDockerConfig', () => {
    it('generates Dockerfile with Node.js base image', () => {
      const requirements: AppRequirements = {
        name: 'TestApp',
        description: 'Test',
        appType: 'saas-dashboard',
        features: [],
        database: 'postgresql',
        frontend: 'react',
        backend: 'nodejs',
        includeAuth: false,
        includeDocker: true,
      };
      const docker = generateDockerConfig(requirements);
      expect(docker.dockerfileContent).toContain('FROM node:20-alpine');
    });

    it('generates docker-compose with PostgreSQL service', () => {
      const requirements: AppRequirements = {
        name: 'TestApp',
        description: 'Test',
        appType: 'saas-dashboard',
        features: [],
        database: 'postgresql',
        frontend: 'react',
        backend: 'nodejs',
        includeAuth: false,
        includeDocker: true,
      };
      const docker = generateDockerConfig(requirements);
      expect(docker.dockerComposeContent).toContain('postgres:15-alpine');
    });

    it('generates docker-compose with MongoDB service for mongodb apps', () => {
      const requirements: AppRequirements = {
        name: 'TestApp',
        description: 'Test',
        appType: 'community-platform',
        features: [],
        database: 'mongodb',
        frontend: 'react',
        backend: 'nodejs',
        includeAuth: false,
        includeDocker: true,
      };
      const docker = generateDockerConfig(requirements);
      expect(docker.dockerComposeContent).toContain('mongo:7');
    });
  });
});
