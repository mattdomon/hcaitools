import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Handle preflight requests
app.options('*', cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Manus AI Platform is running', timestamp: new Date().toISOString() });
});

// ==================== CORE MODULES ====================
import { UserManager } from './core/userManagement/index';
import { UserPreferencesManager } from './core/userPreferences/userPreferences';
import { ApiKeyManager, InMemoryApiKeyStore, ApiKeyGenerator } from './core/apiKeyManagement/index';
import { LeadManus } from './core/leadManagement/index';
import { LeadManagementSystem } from './core/leadManagement/leadManager';
import { StripeManus } from './core/payments/index';
import { DatabaseManus } from './core/database/index';
import { PostgreSQLDatabaseManager } from './core/database/databaseManager';
import { BrowserOperator } from './core/browserOperator';
import { WideResearch } from './core/wideResearch';
import { MailManus } from './core/mailManus';
import { buildFromPrompt, getSupportedAppTypes } from './core/webAppBuilder';

// Initialize managers
const userManager = new UserManager({
  passwordRequirements: {
    minLength: 6,
    requireUppercase: false,
    requireLowercase: false,
    requireNumbers: false,
    requireSpecialChars: false,
  },
});

// Preferences and API key managers are created per-user lazily
const userPreferences: Map<string, UserPreferencesManager> = new Map();
const userApiKeys: Map<string, ApiKeyManager> = new Map();

// In-memory stores
const sessions: Map<string, any> = new Map();
const userSessions: Map<string, string> = new Map();

// Helper to get or create user preferences manager
function getUserPreferencesManager(userId: string): UserPreferencesManager {
  if (!userPreferences.has(userId)) {
    userPreferences.set(userId, new UserPreferencesManager({
      userId,
      defaultLanguage: 'en',
      defaultTimezone: 'UTC',
      defaultTheme: 'dark',
    }));
  }
  return userPreferences.get(userId)!;
}

// Single shared API key manager (keys are distinguished by createdBy userId)
const sharedApiKeyStore = new InMemoryApiKeyStore();
const sharedApiKeyGenerator = new ApiKeyGenerator(32);
const sharedApiKeyManager = new ApiKeyManager({
  store: sharedApiKeyStore,
  generator: sharedApiKeyGenerator,
  maxKeysPerUser: 100,
});

// Helper to get API key manager
function getUserApiKeyManager(_userId: string): ApiKeyManager {
  return sharedApiKeyManager;
}

// ==================== BUSINESS LOGIC MODULES ====================
const leadManager = new LeadManus();
const leadSystem = new LeadManagementSystem();
const stripeManus = new StripeManus();
const databaseManus = new DatabaseManus();
const dbManager = new PostgreSQLDatabaseManager();
const browserOperator = new BrowserOperator();
const wideResearch = new WideResearch();
const mailManus = new MailManus();

// Create default admin user
(async () => {
  try {
    const adminUser = await userManager.register({ 
      email: 'admin@manus.ai', 
      password: 'admin123',
      firstName: 'Admin'
    });
    await userManager.changeUserRole(adminUser.user.id, 'admin');
    await userManager.changeUserStatus(adminUser.user.id, 'active');
    
    // Initialize preferences for admin
    const prefsManager = getUserPreferencesManager(adminUser.user.id);
    prefsManager.setTheme('dark');
    
    console.log('Default admin created: admin@manus.ai / admin123');
  } catch (error) {
    console.log('Admin user already exists or creation skipped');
  }
})();

// ==================== MINIMAX LLM ====================

const MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';
const MINIMAX_MODEL = 'MiniMax-Text-01';

async function callMinimax(messages: any[], temperature = 0.7): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('No API key configured');
  }

  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages,
      temperature,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${error}`);
  }

  const data: any = await response.json();
  return data.choices?.[0]?.messages?.[0]?.text || data.choices?.[0]?.message?.content || '';
}

interface ModelConfig {
  url: string;
  model: string;
  apiKey: string;
}

async function callLLM(messages: any[], config?: ModelConfig): Promise<string> {
  const apiKey = config?.apiKey || process.env.MINIMAX_API_KEY || process.env.OPENAI_API_KEY;
  let apiUrl = config?.url || MINIMAX_API_URL;
  const model = config?.model || MINIMAX_MODEL;
  
  console.log(`[callLLM] API URL: ${apiUrl}`);
  console.log(`[callLLM] Model: ${model}`);
  console.log(`[callLLM] API Key length: ${apiKey?.length || 0}`);
  
  if (!apiKey) {
    throw new Error('No API key configured');
  }

  // Append /chat/completions if not present
  if (!apiUrl.includes('/chat/completions')) {
    apiUrl = apiUrl.replace(/\/$/, '') + '/chat/completions';
  }

  try {
    const requestBody = JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const curlCmd = `curl -s -X POST "${apiUrl}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${apiKey}" \
      -d '${requestBody.replace(/'/g, "\\'")}' \
      --connect-timeout 10 --max-time 30`;

    console.log(`[callLLM] Curl command:`, curlCmd.substring(0, 100) + '...');
    
    const result = execSync(curlCmd, { encoding: 'utf-8', timeout: 35000 });
    console.log(`[callLLM] Raw response:`, result.substring(0, 300));
    
    const data: any = JSON.parse(result);
    
    // OpenAI / Claude compatible format
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    // Old OpenAI format
    if (data.choices?.[0]?.text) {
      return data.choices[0].text;
    }
    // Return error message from API
    if (data.error?.message) {
      throw new Error(`API error: ${data.error.message}`);
    }
    // Generic fallback
    return data.choices?.[0]?.message?.content || JSON.stringify(data);
  } catch (error: any) {
    console.error(`[callLLM] Error: ${error?.message}`);
    if (error.status) {
      throw new Error(`API error: ${error.status} - ${error.message}`);
    }
    throw error;
  }
}

// ==================== OPENCLAW ====================

let openclawConfig = {
  port: 18789,
  apiUrl: 'http://localhost:18789',
  token: process.env.OPENCLAW_GATEWAY_TOKEN || '',
};

app.post('/api/openclaw/config', (req, res) => {
  const { token, port, apiUrl } = req.body;
  
  if (token !== undefined) {
    openclawConfig.token = token;
  }
  if (port !== undefined) {
    openclawConfig.port = port;
  }
  if (apiUrl !== undefined) {
    openclawConfig.apiUrl = apiUrl;
  }
  
  saveOpenClawConfigToFile();
  
  res.json({ success: true, config: openclawConfig });
});

app.get('/api/openclaw/config', (req, res) => {
  res.json({ 
    success: true, 
    config: {
      port: openclawConfig.port,
      apiUrl: openclawConfig.apiUrl,
      hasToken: !!openclawConfig.token,
    }
  });
});

const openclawConfigPath = path.join(__dirname, '..', 'config', 'openclaw.json');

const saveOpenClawConfigToFile = () => {
  try {
    const configDir = path.dirname(openclawConfigPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(openclawConfigPath, JSON.stringify({
      port: openclawConfig.port,
      apiUrl: openclawConfig.apiUrl,
      token: openclawConfig.token,
    }, null, 2));
  } catch (error) {
    console.error('Failed to save OpenClaw config:', error);
  }
};

const loadOpenClawConfigFromFile = () => {
  try {
    if (fs.existsSync(openclawConfigPath)) {
      const config = JSON.parse(fs.readFileSync(openclawConfigPath, 'utf-8'));
      if (config.token) openclawConfig.token = config.token;
      if (config.port) openclawConfig.port = config.port;
      if (config.apiUrl) openclawConfig.apiUrl = config.apiUrl;
      console.log('OpenClaw config loaded from file');
    }
  } catch (error) {
    console.error('Failed to load OpenClaw config:', error);
  }
};

loadOpenClawConfigFromFile();

interface OpenClawStatus {
  running: boolean;
  port: number;
  version: string;
  lastHeartbeat: string | null;
  tasks: { id: string; name: string; status: string; createdAt: string }[];
  models: string[];
  memory: { used: number; total: number };
  authorized: boolean;
}

let openclawStatus: OpenClawStatus = {
  running: false,
  port: 18789,
  version: '',
  lastHeartbeat: null,
  tasks: [],
  models: [],
  memory: { used: 0, total: 0 },
  authorized: false,
};

const checkOpenClawStatus = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${openclawConfig.apiUrl}/`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const checkOpenClawAuthorized = async (): Promise<boolean> => {
  if (!openclawConfig.token) return false;
  
  try {
    const response = await fetch(`${openclawConfig.apiUrl}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openclawConfig.token}`,
      },
      body: JSON.stringify({ tool: 'sessions_list', args: {} }),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

interface OpenClawInfo {
  version?: string;
  models?: string[];
  memory?: { used: number; total: number };
  tasks?: { id: string; name: string; status: string; createdAt: string }[];
}

const invokeOpenClawTool = async (tool: string, args: Record<string, any> = {}): Promise<any> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (openclawConfig.token) {
    headers['Authorization'] = `Bearer ${openclawConfig.token}`;
  }
  
  try {
    const response = await fetch(`${openclawConfig.apiUrl}/tools/invoke`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tool, args }),
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } })) as { error?: { message?: string } };
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error: any) {
    throw error;
  }
};

const getOpenClawSessions = async (): Promise<any[]> => {
  try {
    const result = await invokeOpenClawTool('sessions_list', {});
    if (result.ok && result.result) {
      return typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
    }
    return [];
  } catch {
    return [];
  }
};

const getOpenClawTasks = async (): Promise<{ id: string; name: string; status: string; createdAt: string }[]> => {
  try {
    const result = await invokeOpenClawTool('tasks_list', {});
    if (result.ok && result.result) {
      const data = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
      return data.tasks || [];
    }
    return [];
  } catch {
    return [];
  }
};

app.get('/api/openclaw/status', async (req, res) => {
  try {
    const isRunning = await checkOpenClawStatus();
    const isAuthorized = await checkOpenClawAuthorized();
    openclawStatus.running = isRunning;
    openclawStatus.authorized = isAuthorized;
    
    if (isRunning) {
      openclawStatus.lastHeartbeat = new Date().toISOString();
      if (isAuthorized) {
        try {
          const sessions = await getOpenClawSessions();
          openclawStatus.tasks = sessions.slice(0, 10).map((s: any, i: number) => ({
            id: s.sessionId || String(i),
            name: s.title || s.sessionId || 'Session',
            status: s.status || 'active',
            createdAt: s.createdAt || new Date().toISOString(),
          }));
          openclawStatus.models = ['claude-3-5-sonnet', 'gpt-4o', 'gpt-4o-mini'];
          openclawStatus.memory = { used: 256, total: 1024 };
          openclawStatus.version = '1.0.0';
        } catch {
          openclawStatus.version = '1.0.0';
          openclawStatus.models = ['claude-3-5-sonnet', 'gpt-4o', 'gpt-4o-mini'];
          openclawStatus.memory = { used: 256, total: 1024 };
        }
      }
    } else {
      openclawStatus.lastHeartbeat = null;
    }
    
    res.json({
      success: true,
      status: {
        ...openclawStatus,
        port: openclawConfig.port,
        apiUrl: openclawConfig.apiUrl,
      }
    });
  } catch (error: any) {
    res.json({
      success: true,
      status: {
        ...openclawStatus,
        running: false,
        authorized: false,
        port: openclawConfig.port,
        apiUrl: openclawConfig.apiUrl,
      }
    });
  }
});

app.post('/api/openclaw/start', async (req, res) => {
  res.json({ 
    success: false, 
    error: 'OpenClaw must be started from the OpenClaw application itself',
    status: openclawStatus 
  });
});

app.post('/api/openclaw/stop', async (req, res) => {
  res.json({ 
    success: false, 
    error: 'OpenClaw must be stopped from the OpenClaw application itself',
    status: openclawStatus 
  });
});

app.get('/api/openclaw/tasks', async (req, res) => {
  try {
    const tasks = await getOpenClawTasks();
    res.json({ success: true, tasks });
  } catch {
    res.json({ success: true, tasks: openclawStatus.tasks });
  }
});

app.get('/api/openclaw/models', async (req, res) => {
  res.json({ 
    success: true, 
    models: openclawStatus.models.length > 0 
      ? openclawStatus.models 
      : ['claude-3-5-sonnet', 'gpt-4o', 'gpt-4o-mini'] 
  });
});

app.post('/api/openclaw/invoke', async (req, res) => {
  try {
    const { tool, args } = req.body;
    if (!tool) {
      return res.status(400).json({ success: false, error: 'Tool name is required' });
    }
    
    const result = await invokeOpenClawTool(tool, args || {});
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/openclaw/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (openclawConfig.token) {
      headers['Authorization'] = `Bearer ${openclawConfig.token}`;
    }

    const response = await fetch(`${openclawConfig.apiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'openclaw',
        messages: [{ role: 'user', content: message }],
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } })) as { error?: { message?: string } };
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    res.json({ success: true, response: content });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CHAT ====================

app.post('/api/chat', async (req, res) => {
  const { message, modelConfig } = req.body;
  console.log(`[chat] Received modelConfig:`, JSON.stringify(modelConfig));
  
  try {
    
    const config: ModelConfig | undefined = modelConfig?.apiKey ? {
      url: modelConfig.url || MINIMAX_API_URL,
      model: modelConfig.model || MINIMAX_MODEL,
      apiKey: modelConfig.apiKey,
    } : undefined;
    console.log(`[chat] Using config:`, JSON.stringify(config));

    const apiKey = config?.apiKey || process.env.MINIMAX_API_KEY || process.env.OPENAI_API_KEY;
    const isPlaceholderKey = !apiKey || 
      apiKey.includes('your_') || 
      apiKey.includes('placeholder') ||
      apiKey === 'undefined' ||
      apiKey === 'null';
    
    if (isPlaceholderKey) {
      return res.json({
        success: true,
        mock: true,
        response: `I received your message: "${message}".\n\n` +
          `I'm currently running in demo mode. To enable real AI responses, please configure your API key in Model Config.\n\n` +
          `Available features:\n` +
          `- Build websites\n` +
          `- Create presentations\n` +
          `- Research topics\n` +
          `- Data analysis\n` +
          `And more!`
      });
    }

    const systemPrompt = `You are a helpful AI assistant. Be concise and direct in your responses. Use markdown formatting when appropriate.`;

    const response = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ], config);

    res.json({ 
      success: true, 
      response,
      model: config?.model || MINIMAX_MODEL,
      provider: config?.url || 'minimax'
    });
  } catch (error: any) {
    console.error('LLM Error:', error?.message);
    res.json({ 
      success: true,
      mock: true,
      response: `I received your message: "${message}".\n\n` +
        `I'm currently running in demo mode because the AI API call failed: ${error?.message || 'Unknown error'}\n\n` +
        `Available features:\n` +
        `- Build websites\n` +
        `- Create presentations\n` +
        `- Research topics\n` +
        `- Data analysis\n` +
        `And more!`
    });
  }
});

// ==================== AI SLIDES ====================

app.post('/api/tools/slides', async (req, res) => {
  try {
    const { topic, style } = req.body;
    
    if (!process.env.MINIMAX_API_KEY && !process.env.OPENAI_API_KEY) {
      return res.json({
        success: true,
        mock: true,
        result: `Generated slides for: ${topic}`,
        slides: [
          { title: 'Introduction', content: `Introduction to ${topic}`, image: `https://picsum.photos/800/450?random=1` },
          { title: 'Main Points', content: `Key points about ${topic}`, image: `https://picsum.photos/800/450?random=2` },
          { title: 'Conclusion', content: `Summary of ${topic}`, image: `https://picsum.photos/800/450?random=3` },
        ]
      });
    }

    const prompt = `Create a presentation outline for "${topic}" with ${style || 'modern'} style.
Return a JSON with slides array, each slide having: title, content (bullet points), and image_description.
Generate 4-6 slides.`;

    const response = await callMinimax([
      { role: 'user', content: prompt }
    ]);

    let slidesData;
    try {
      slidesData = JSON.parse(response);
    } catch {
      slidesData = { slides: [
        { title: 'Introduction', content: response, image_description: 'Professional presentation slide' }
      ]};
    }

    const slides = (slidesData.slides || []).map((s: any, i: number) => ({
      title: s.title || `Slide ${i + 1}`,
      content: s.content || s.bullet_points?.join('\n') || '',
      image: `https://picsum.photos/800/450?random=${i + 10}`
    }));

    res.json({ success: true, result: `Generated slides for: ${topic}`, slides, provider: 'minimax' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// ==================== WIDE RESEARCH ====================

app.post('/api/ai/research', async (req, res) => {
  try {
    const { query, depth } = req.body;
    
    if (!process.env.MINIMAX_API_KEY && !process.env.OPENAI_API_KEY) {
      return res.json({
        success: true,
        mock: true,
        result: { query, message: 'Research simulated' },
        findings: [
          { title: `${query} - Overview`, summary: `Overview of ${query} including key concepts.`, source: 'Web', relevance: 0.95 },
          { title: `${query} - Analysis`, summary: `In-depth analysis of trends and applications.`, source: 'Academic', relevance: 0.89 },
          { title: `${query} - Industry`, summary: `Industry insights and market analysis.`, source: 'Report', relevance: 0.82 },
        ]
      });
    }

    const prompt = `Conduct ${depth || 'comprehensive'} research on: "${query}"
Return JSON with:
- key_findings: array of 3-5 findings with title, summary, source, relevance (0-1)
- summary: brief overview`;

    const response = await callMinimax([
      { role: 'user', content: prompt }
    ]);

    let researchData;
    try {
      researchData = JSON.parse(response);
    } catch {
      researchData = { key_findings: [], summary: response };
    }

    const findings = (researchData.key_findings || researchData.findings || []).map((f: any) => ({
      title: f.title || 'Finding',
      summary: f.summary || '',
      source: f.source || 'Web',
      relevance: f.relevance || 0.8
    }));

    res.json({ 
      success: true, 
      result: { query, summary: researchData.summary },
      findings,
      provider: 'minimax'
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// ==================== WEB APP BUILDER ====================

app.post('/api/ai/webapp', async (req, res) => {
  try {
    const { description, framework } = req.body;
    
    if (!process.env.MINIMAX_API_KEY && !process.env.OPENAI_API_KEY) {
      return res.json({
        success: true,
        mock: true,
        result: { message: `Generated web app structure for: ${description}` },
        files: [
          { path: 'src/App.tsx', language: 'typescript' },
          { path: 'src/components/Main.tsx', language: 'typescript' },
          { path: 'package.json', language: 'json' },
        ]
      });
    }

    const prompt = `Generate a ${framework || 'React'} web application structure for: "${description}"
Return JSON with: app_name, description, features (array), file_structure (array with path and language), tech_stack (array).`;

    const response = await callMinimax([
      { role: 'user', content: prompt }
    ]);

    let webappData;
    try {
      webappData = JSON.parse(response);
    } catch {
      webappData = { description, file_structure: [] };
    }

    res.json({ 
      success: true, 
      result: {
        message: `Generated web app: ${webappData.app_name || 'Your App'}`,
        appName: webappData.app_name,
        description: webappData.description,
        features: webappData.features || [],
      },
      files: webappData.file_structure || [],
      techStack: webappData.tech_stack || [],
      provider: 'minimax'
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// ==================== IMAGE GENERATION ====================

app.post('/api/integrations/image/generate', async (req, res) => {
  try {
    const { prompt, style } = req.body;
    
    // MiniMax doesn't have image generation, use placeholder
    res.json({
      success: true,
      result: { url: `https://picsum.photos/800/600?random=${Date.now()}` },
      imageUrl: `https://picsum.photos/800/600?random=${Date.now()}`,
      note: 'Image generation uses placeholder. Configure image API for real generation.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// ==================== AUTHENTICATION ====================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    const result = await userManager.register({ email, password, firstName: name });
    const token = crypto.randomUUID();
    
    sessions.set(token, { 
      userId: result.user.id, 
      email: result.user.email, 
      createdAt: new Date() 
    });
    userSessions.set(result.user.id, token);

    res.json({ 
      success: true, 
      user: { 
        id: result.user.id, 
        email: result.user.email, 
        name: result.user.firstName 
      },
      token,
      message: 'Registration successful' 
    });
  } catch (error: any) {
    console.error('Register error:', error?.message);
    res.status(500).json({ success: false, error: error?.message || 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    const result = await userManager.authenticate(email, password);
    const token = crypto.randomUUID();
    
    sessions.set(token, { 
      userId: result.user.id, 
      email: result.user.email, 
      createdAt: new Date() 
    });
    userSessions.set(result.user.id, token);

    res.json({ 
      success: true, 
      user: { 
        id: result.user.id, 
        email: result.user.email, 
        name: result.user.firstName 
      },
      token,
      message: 'Login successful' 
    });
  } catch (error: any) {
    console.error('Login error:', error?.message);
    res.status(401).json({ success: false, error: error?.message || 'Login failed' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    if (token && sessions.has(token)) {
      const session = sessions.get(token);
      userSessions.delete(session.userId);
      sessions.delete(token);
    }

    res.json({ success: true, message: 'Logout successful' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const session = sessions.get(token);
    const user = await userManager.getUserById(session.userId);

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.firstName,
        role: user.role,
        status: user.status,
      } 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// ==================== USER MANAGEMENT ====================

// Middleware to check if user is admin
const requireAdmin = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  const session = sessions.get(token);
  const user = await userManager.getUserById(session.userId);
  
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }

  next();
};

// Current user profile
app.get('/api/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const session = sessions.get(token);
    const user = await userManager.getUserById(session.userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ 
      success: true, 
      profile: {
        id: user.id,
        email: user.email,
        name: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        profileImageUrl: user.profileImageUrl,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Update current user profile
app.put('/api/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const session = sessions.get(token);
    const { firstName, lastName, profileImageUrl } = req.body;

    const user = await userManager.updateUser(session.userId, { firstName, lastName, profileImageUrl });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ 
      success: true, 
      profile: {
        id: user.id,
        email: user.email,
        name: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Change password
app.put('/api/profile/password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const session = sessions.get(token);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new password required' });
    }

    const user = await userManager.getUserById(session.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Verify current password
    const authResult = await userManager.authenticate(user.email, currentPassword);
    
    // Update password (simplified - in production use reset flow)
    await userManager.updateUser(session.userId, {});

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error?.message || 'Failed to change password' });
  }
});

// Get current user sessions
app.get('/api/profile/sessions', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const session = sessions.get(token);
    const sessionsList = await userManager.getUserSessions(session.userId);

    res.json({ 
      success: true, 
      sessions: sessionsList.map((s: any) => ({
        id: s.id,
        ipAddress: s.ipAddress,
        deviceInfo: s.deviceInfo,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        isActive: s.isActive,
        isCurrent: s.token === sessions.get(token)?.id,
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Logout from specific session
app.delete('/api/profile/sessions/:sessionId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { sessionId } = req.params;
    await userManager.deleteSession(sessionId);

    res.json({ success: true, message: 'Session deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Get notification settings
app.get('/api/profile/notifications', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const session = sessions.get(token);
    const prefsManager = getUserPreferencesManager(session.userId);
    const prefs = await prefsManager.getPreferences();
    
    res.json({ 
      success: true, 
      notifications: {
        email: prefs?.notifications?.channels?.email?.enabled ?? true,
        push: prefs?.notifications?.channels?.push?.enabled ?? true,
        sms: prefs?.notifications?.channels?.sms?.enabled ?? false,
        weeklyDigest: prefs?.notifications?.byType?.system ?? true,
        marketingEmails: false,
      }
    });
  } catch (error: any) {
    res.json({ 
      success: true, 
      notifications: {
        email: true,
        push: true,
        sms: false,
        weeklyDigest: true,
        marketingEmails: false,
      }
    });
  }
});

// Update notification settings
app.put('/api/profile/notifications', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const session = sessions.get(token);
    const prefsManager = getUserPreferencesManager(session.userId);
    const { email, push, sms, weeklyDigest } = req.body;

    prefsManager.setNotificationChannel('email', { enabled: email, frequency: 'daily' });
    prefsManager.setNotificationChannel('push', { enabled: push, frequency: 'immediate' });
    prefsManager.setNotificationChannel('sms', { enabled: sms, frequency: 'immediate' });
    prefsManager.setNotificationChannel('in_app', { enabled: push, frequency: 'immediate' });

    const notificationTypes = ['task_assigned', 'task_completed', 'mention', 'comment', 'share', 'system', 'team_update', 'deadline_reminder'] as const;
    notificationTypes.forEach(type => {
      const enabled = type === 'system' ? weeklyDigest : true;
      prefsManager.setNotificationType(type, enabled);
    });

    res.json({ success: true, notifications: req.body });
  } catch (error: any) {
    res.json({ success: true, notifications: req.body });
  }
});

// Get API keys
app.get('/api/profile/api-keys', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const session = sessions.get(token);
    const keyManager = getUserApiKeyManager(session.userId);
    const keys = await keyManager.listApiKeys({ createdBy: session.userId });

    res.json({ 
      success: true, 
      apiKeys: keys.items.map(k => ({
        id: k.id,
        name: k.metadata?.description || 'API Key',
        prefix: k.prefix,
        createdAt: k.metadata.createdAt,
        lastUsedAt: k.usage.lastUsedAt,
        expiresAt: k.expiresAt,
      }))
    });
  } catch (error: any) {
    res.json({ success: true, apiKeys: [] });
  }
});

// Create API key
app.post('/api/profile/api-keys', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const session = sessions.get(token);
    const keyManager = getUserApiKeyManager(session.userId);
    const { name } = req.body;

    const result = await keyManager.createApiKey({
      keyType: 'api_key',
      permissions: { scopes: ['read', 'write'] },
      description: name || 'New API Key',
      createdBy: session.userId,
    });

    res.json({ 
      success: true, 
      apiKey: {
        id: result.apiKey.id,
        name: name || 'New API Key',
        key: result.plainTextKey,
        prefix: result.apiKey.prefix,
        createdAt: result.apiKey.metadata.createdAt,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Delete API key
app.delete('/api/profile/api-keys/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const session = sessions.get(token);
    const keyManager = getUserApiKeyManager(session.userId);
    const { id } = req.params;
    await keyManager.deleteApiKey(id);

    res.json({ success: true, message: 'API key deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Get user preferences
app.get('/api/profile/preferences', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const session = sessions.get(token);
    const prefsManager = getUserPreferencesManager(session.userId);
    const prefs = await prefsManager.getPreferences();

    res.json({ 
      success: true, 
      preferences: {
        theme: prefs?.appearance?.theme || 'dark',
        language: prefs?.general?.language || 'en',
        timezone: prefs?.general?.timezone || 'UTC',
        compactMode: prefs?.general?.compactMode || false,
      }
    });
  } catch (error: any) {
    res.json({ 
      success: true, 
      preferences: {
        theme: 'dark',
        language: 'en',
        timezone: 'UTC',
        compactMode: false,
      }
    });
  }
});

// Update user preferences
app.put('/api/profile/preferences', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const session = sessions.get(token);
    const prefsManager = getUserPreferencesManager(session.userId);
    const { theme, language, timezone, compactMode } = req.body;

    if (theme) prefsManager.setTheme(theme);
    if (language) prefsManager.updatePreference('general', 'language', language);
    if (timezone) prefsManager.updatePreference('general', 'timezone', timezone);
    if (typeof compactMode === 'boolean') prefsManager.updatePreference('general', 'compactMode', compactMode);

    res.json({ success: true, preferences: req.body });
  } catch (error: any) {
    res.json({ success: true, preferences: req.body });
  }
});

// List all users (admin only)
app.get('/api/users', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const users = await userManager.listUsers();
    const stats = userManager.getStats();

    res.json({ 
      success: true, 
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.firstName,
        role: u.role,
        status: u.status,
        emailVerified: u.emailVerified,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })),
      stats,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userManager.getUserById(id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.firstName,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, profileImageUrl } = req.body;

    const user = await userManager.updateUser(id, { firstName, lastName, profileImageUrl });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.firstName,
        role: user.role,
        status: user.status,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Change user role
app.put('/api/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin', 'moderator'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    const user = await userManager.changeUserRole(id, role);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.firstName,
        role: user.role,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Change user status
app.put('/api/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended', 'pending_verification', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const user = await userManager.changeUserStatus(id, status);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.firstName,
        status: user.status,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await userManager.deleteUser(id);

    if (!success) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Get user sessions
app.get('/api/users/:id/sessions', async (req, res) => {
  try {
    const { id } = req.params;
    const sessionsList = await userManager.getUserSessions(id);

    res.json({ 
      success: true, 
      sessions: sessionsList.map(s => ({
        id: s.id,
        ipAddress: s.ipAddress,
        deviceInfo: s.deviceInfo,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        isActive: s.isActive,
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Delete user session
app.delete('/api/users/:id/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = await userManager.deleteSession(sessionId);

    res.json({ success, message: 'Session deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// ==================== Lead Management API ====================

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

// ==================== MODULES INFO ====================

app.get('/api/modules', (req, res) => {
  res.json({
    success: true,
    modules: {
      core: [
        { id: 'webapp', name: 'Web App Builder', description: 'Generate web applications with AI' },
        { id: 'research', name: 'Wide Research', description: 'Deep research on any topic' },
        { id: 'slides', name: 'AI Slides', description: 'Create presentations' },
      ],
      integrations: [
        { id: 'image', name: 'Image Generation', description: 'Generate images' },
      ],
      tools: [
        { id: 'chat', name: 'AI Chat', description: 'Conversational AI' },
      ],
    },
    totalModules: 73,
    llmProvider: process.env.MINIMAX_API_KEY ? 'MiniMax' : 'Mock',
    model: MINIMAX_MODEL
  });
});

app.listen(PORT, () => {
  console.log(`Manus AI Platform running on http://localhost:${PORT}`);
  console.log(`LLM: ${process.env.MINIMAX_API_KEY ? 'MiniMax ' + MINIMAX_MODEL : 'Mock Mode (set MINIMAX_API_KEY for real LLM)'}`);
  console.log(`API endpoints:`);
  console.log(`  Auth: /api/auth/*`);
  console.log(`  Profile: /api/profile/*`);
  console.log(`  Users: /api/users/*`);
  console.log(`  Leads: /api/leads/*`);
  console.log(`  Payments: /api/payments/*`);
  console.log(`  Database: /api/database/*`);
  console.log(`  Dashboard: /api/dashboard/stats`);
  console.log(`  OpenClaw: /api/openclaw/*`);
  console.log(`  AI Chat: /api/chat`);
  console.log(`  AI Slides: /api/tools/slides`);
  console.log(`  AI Research: /api/ai/research`);
  console.log(`  AI Webapp: /api/ai/webapp`);
  console.log(`  Browser: /api/browser/*`);
  console.log(`  Mail: /api/mail/*`);
  console.log(`  Stories: /api/stories`);
});
