/**
 * hcaitools - Manus AI Platform
 * Main entry point with API routes
 */

import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'hcaitools is running', timestamp: new Date().toISOString() });
});

// ==================== Lead Management API ====================
import { LeadManus } from './core/leadManagement/index';
import { LeadManagementSystem } from './core/leadManagement/leadManager';

const leadManager = new LeadManus();
const leadSystem = new LeadManagementSystem();

app.post('/api/leads/forms', async (req, res) => {
  try {
    const { name, fields } = req.body;
    const form = await leadManager.createForm(name, fields);
    res.json(form);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create form', details: String(error) });
  }
});

app.post('/api/leads/capture', async (req, res) => {
  try {
    const { formId, data } = req.body;
    const lead = await leadManager.captureLead(formId, data);
    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: 'Failed to capture lead', details: String(error) });
  }
});

app.get('/api/leads', async (req, res) => {
  try {
    const { stage, quality } = req.query;
    const filters: { stage?: string; quality?: string } = {};
    if (stage) filters.stage = stage as string;
    if (quality) filters.quality = quality as string;
    const leads = Object.keys(filters).length > 0 
      ? await leadSystem.listLeads(filters as any)
      : await leadSystem.listLeads();
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get leads', details: String(error) });
  }
});

app.post('/api/leads/:id/advance', async (req, res) => {
  try {
    const { id } = req.params;
    const { newStage } = req.body;
    const result = await leadManager.advanceLead(id, newStage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to advance lead', details: String(error) });
  }
});

app.get('/api/leads/report', async (req, res) => {
  try {
    const report = await leadManager.generateReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report', details: String(error) });
  }
});

app.get('/api/leads/metrics', async (req, res) => {
  try {
    const metrics = await leadManager.getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics', details: String(error) });
  }
});

// ==================== Payments API ====================
import { StripeManus } from './core/payments/index';
import { StripePaymentProcessor } from './core/payments/stripeProcessor';

const stripeManus = new StripeManus();
const stripeProcessor = new StripePaymentProcessor();

app.post('/api/payments/customers', async (req, res) => {
  try {
    const { email, name, phone } = req.body;
    const customer = await stripeManus.createCustomer(email, name, phone);
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create customer', details: String(error) });
  }
});

app.get('/api/payments/customers', async (req, res) => {
  try {
    const metrics = await stripeManus.getMetrics();
    res.json({
      mrr: metrics.mrr,
      arr: metrics.arr,
      ltv: metrics.ltv,
      churnRate: metrics.churnRate,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get customers', details: String(error) });
  }
});

app.post('/api/payments/subscriptions', async (req, res) => {
  try {
    const { customerId, priceId } = req.body;
    const subscription = await stripeManus.createSubscription(customerId, priceId);
    res.json(subscription);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create subscription', details: String(error) });
  }
});

app.post('/api/payments/charges', async (req, res) => {
  try {
    const { customerId, amount, description } = req.body;
    const charge = await stripeManus.createCharge(customerId, amount, description);
    res.json(charge);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create charge', details: String(error) });
  }
});

app.post('/api/payments/refunds', async (req, res) => {
  try {
    const { chargeId, amount, reason } = req.body;
    const refund = await stripeManus.refundCharge(chargeId, amount, reason);
    res.json(refund);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create refund', details: String(error) });
  }
});

app.get('/api/payments/metrics', async (req, res) => {
  try {
    const metrics = await stripeManus.getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics', details: String(error) });
  }
});

app.get('/api/payments/report', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await stripeManus.generateReport(
      new Date(startDate as string || Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(endDate as string || Date.now())
    );
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report', details: String(error) });
  }
});

// ==================== Database API ====================
import { DatabaseManus } from './core/database/index';
import { PostgreSQLDatabaseManager } from './core/database/databaseManager';

const databaseManus = new DatabaseManus();
const dbManager = new PostgreSQLDatabaseManager();

app.get('/api/database/tables', async (req, res) => {
  try {
    const tables = await databaseManus.listTables();
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list tables', details: String(error) });
  }
});

app.post('/api/database/tables', async (req, res) => {
  try {
    const { modelName, tableName, fields, options } = req.body;
    const model = databaseManus.createModel(modelName, tableName, fields, options);
    const result = await databaseManus.createTable(model);
    res.json({ model, result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create table', details: String(error) });
  }
});

app.delete('/api/database/tables/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { cascade } = req.query;
    const result = await databaseManus.dropTable(name, cascade === 'true');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to drop table', details: String(error) });
  }
});

app.post('/api/database/seed', async (req, res) => {
  try {
    const { tableName, count } = req.body;
    const seedData = databaseManus.generateSeedData(tableName, count);
    res.json(seedData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate seed data', details: String(error) });
  }
});

app.post('/api/database/crud', async (req, res) => {
  try {
    const { modelName, tableName, fields, options } = req.body;
    const model = databaseManus.createModel(modelName, tableName, fields, options);
    const crud = databaseManus.generateCRUD(model);
    res.json(crud);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate CRUD', details: String(error) });
  }
});

app.get('/api/database/crud/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { filters, options } = req.query;
    const result = await databaseManus.select(
      table,
      filters ? JSON.parse(filters as string) : undefined,
      options ? JSON.parse(options as string) : undefined
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to select data', details: String(error) });
  }
});

app.post('/api/database/crud/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const data = req.body;
    const result = await databaseManus.insert(table, data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to insert data', details: String(error) });
  }
});

app.put('/api/database/crud/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const data = req.body;
    const result = await databaseManus.update(table, id, data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update data', details: String(error) });
  }
});

app.delete('/api/database/crud/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const result = await databaseManus.delete(table, id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete data', details: String(error) });
  }
});

// ==================== Dashboard Stats API ====================
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [leadMetrics, paymentMetrics] = await Promise.all([
      leadManager.getMetrics().catch(() => ({ total: 0 })),
      stripeManus.getMetrics().catch(() => ({ total: 0 })),
    ]);
    
    const tables = await databaseManus.listTables().catch(() => []);
    
    res.json({
      leads: leadMetrics,
      payments: paymentMetrics,
      database: { tableCount: Array.isArray(tables) ? tables.length : 0 },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get dashboard stats', details: String(error) });
  }
});

// ==================== Web App Builder API ====================
import { buildFromPrompt, getSupportedAppTypes } from './core/webAppBuilder';

app.get('/api/webapp/types', async (req, res) => {
  try {
    const types = getSupportedAppTypes();
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get app types', details: String(error) });
  }
});

app.post('/api/webapp/build', async (req, res) => {
  try {
    const { appName, prompt, options } = req.body;
    if (!appName || !prompt) {
      return res.status(400).json({ error: 'appName and prompt are required' });
    }
    const result = buildFromPrompt(appName, prompt, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to build app', details: String(error) });
  }
});

// ==================== Browser Operator API ====================
import { BrowserOperator } from './core/browserOperator';

const browserOperator = new BrowserOperator();

app.get('/api/browser/sessions', async (req, res) => {
  try {
    const count = await browserOperator.getSessionCount();
    res.json({ activeSessions: count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sessions', details: String(error) });
  }
});

app.get('/api/browser/concurrency', async (req, res) => {
  try {
    const status = browserOperator.getConcurrencyStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get concurrency status', details: String(error) });
  }
});

// ==================== Wide Research API ====================
import { WideResearch } from './core/wideResearch';

const wideResearch = new WideResearch();

app.post('/api/research/start', async (req, res) => {
  try {
    const { query, objectives } = req.body;
    const result = await wideResearch.conductResearch(query, objectives);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start research', details: String(error) });
  }
});

// ==================== Mail Manus API ====================
import { MailManus } from './core/mailManus';

const mailManus = new MailManus();

app.get('/api/mail/tasks', async (req, res) => {
  try {
    const { status } = req.query;
    const tasks = mailManus.listTasks(status as string | undefined);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tasks', details: String(error) });
  }
});

// ==================== PRD Stories API ====================
import * as fs from 'fs';
import * as path from 'path';

app.get('/api/stories', async (req, res) => {
  try {
    const prdPath = path.join(__dirname, '..', 'prd.json');
    const prd = JSON.parse(fs.readFileSync(prdPath, 'utf-8'));
    res.json(prd);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read stories', details: String(error) });
  }
});

app.patch('/api/stories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { passes } = req.body;
    const prdPath = path.join(__dirname, '..', 'prd.json');
    const prd = JSON.parse(fs.readFileSync(prdPath, 'utf-8'));
    
    const storyIndex = prd.findIndex((s: any) => s.id === id);
    if (storyIndex === -1) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    prd[storyIndex].passes = passes;
    fs.writeFileSync(prdPath, JSON.stringify(prd, null, 2));
    
    res.json(prd[storyIndex]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update story', details: String(error) });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`hcaitools API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoints:`);
  console.log(`  - GET/POST /api/leads`);
  console.log(`  - POST /api/payments/customers`);
  console.log(`  - GET  /api/payments/customers`);
  console.log(`  - GET  /api/database/tables`);
  console.log(`  - GET  /api/dashboard/stats`);
  console.log(`  - GET  /api/stories`);
});

export { app };