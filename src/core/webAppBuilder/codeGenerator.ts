/**
 * Code Generator - Generates frontend, backend, and database code for web applications
 */

import {
  AppRequirements,
  GeneratedFile,
  DockerConfig,
  AuthConfig,
  DatabaseSchema,
  TableDefinition,
  ColumnDefinition,
} from './types';

/**
 * Generates React frontend components based on app requirements
 */
export function generateFrontendCode(requirements: AppRequirements): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Main App component
  files.push({
    path: 'frontend/src/App.tsx',
    language: 'tsx',
    content: generateAppComponent(requirements),
  });

  // Package.json
  files.push({
    path: 'frontend/package.json',
    language: 'json',
    content: generateFrontendPackageJson(requirements),
  });

  // Main entry point
  files.push({
    path: 'frontend/src/main.tsx',
    language: 'tsx',
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
  });

  // CSS
  files.push({
    path: 'frontend/src/index.css',
    language: 'css',
    content: generateBaseCSS(),
  });

  // Auth components if needed
  if (requirements.includeAuth) {
    files.push(...generateAuthComponents());
  }

  return files;
}

function generateAppComponent(requirements: AppRequirements): string {
  const appName = requirements.name;
  const hasAuth = requirements.includeAuth;

  return `import React from 'react';
${hasAuth ? "import { AuthProvider } from './components/auth/AuthProvider';\nimport { Router } from './components/Router';" : "import { Router } from './components/Router';"}

function App() {
  return (
    ${hasAuth ? '<AuthProvider>\n      <Router />\n    </AuthProvider>' : '<Router />'}
  );
}

export default App;

// Generated for: ${appName}
// App Type: ${requirements.appType}
`;
}

function generateFrontendPackageJson(requirements: AppRequirements): string {
  const deps: Record<string, string> = {
    react: '^18.2.0',
    'react-dom': '^18.2.0',
    'react-router-dom': '^6.0.0',
    axios: '^1.6.0',
  };

  if (requirements.includeAuth) {
    deps['jwt-decode'] = '^4.0.0';
  }

  return JSON.stringify(
    {
      name: requirements.name.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      private: true,
      dependencies: deps,
      devDependencies: {
        '@types/react': '^18.0.0',
        '@types/react-dom': '^18.0.0',
        '@vitejs/plugin-react': '^4.0.0',
        typescript: '^5.0.0',
        vite: '^5.0.0',
      },
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
      },
    },
    null,
    2,
  );
}

function generateBaseCSS(): string {
  return `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #4f46e5;
  color: white;
}

.btn-primary:hover {
  background-color: #4338ca;
}
`;
}

function generateAuthComponents(): GeneratedFile[] {
  return [
    {
      path: 'frontend/src/components/auth/AuthProvider.tsx',
      language: 'tsx',
      content: `import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  token: string | null;
  user: Record<string, unknown> | null;
  login: (token: string, user: Record<string, unknown>) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<Record<string, unknown> | null>(null);

  const login = (newToken: string, userData: Record<string, unknown>) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
`,
    },
    {
      path: 'frontend/src/components/auth/LoginForm.tsx',
      language: 'tsx',
      content: `import React, { useState } from 'react';
import { useAuth } from './AuthProvider';

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Invalid credentials');
      const { token, user } = await res.json();
      login(token, user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      {error && <div className="error-message">{error}</div>}
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="Email" required />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
        placeholder="Password" required />
      <button type="submit" className="btn btn-primary">Sign In</button>
    </form>
  );
}
`,
    },
  ];
}

/**
 * Generates Node.js/Express backend API code
 */
export function generateBackendCode(requirements: AppRequirements): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  files.push({
    path: 'backend/src/index.ts',
    language: 'typescript',
    content: generateBackendEntry(requirements),
  });

  files.push({
    path: 'backend/src/routes/index.ts',
    language: 'typescript',
    content: generateRoutes(requirements),
  });

  files.push({
    path: 'backend/src/middleware/errorHandler.ts',
    language: 'typescript',
    content: generateErrorHandler(),
  });

  files.push({
    path: 'backend/package.json',
    language: 'json',
    content: generateBackendPackageJson(requirements),
  });

  if (requirements.includeAuth) {
    files.push(...generateAuthBackend());
  }

  return files;
}

function generateBackendEntry(requirements: AppRequirements): string {
  return `import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';
${requirements.includeAuth ? "import { authRouter } from './routes/auth';" : ''}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', router);
${requirements.includeAuth ? "app.use('/api/auth', authRouter);" : ''}
app.use(errorHandler);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(\`${requirements.name} API running on port \${PORT}\`);
});

export { app };
`;
}

function generateRoutes(requirements: AppRequirements): string {
  const appType = requirements.appType;

  const routesByType: Record<string, string> = {
    'e-commerce': `
router.get('/products', async (req, res) => {
  const { page = 1, limit = 20, category } = req.query;
  res.json({ products: [], total: 0, page: Number(page), limit: Number(limit) });
});

router.get('/products/:id', async (req, res) => {
  res.json({ id: req.params.id, name: '', price: 0, description: '' });
});

router.post('/orders', async (req, res) => {
  const { items, customerId } = req.body;
  res.status(201).json({ orderId: 'ord_' + Date.now(), items, customerId, status: 'pending' });
});`,
    'saas-dashboard': `
router.get('/dashboard/stats', async (req, res) => {
  res.json({ totalUsers: 0, activeSubscriptions: 0, revenue: 0, growth: 0 });
});

router.get('/reports', async (req, res) => {
  res.json({ reports: [] });
});`,
    'booking-system': `
router.get('/availability', async (req, res) => {
  const { date, serviceId } = req.query;
  res.json({ date, serviceId, slots: [] });
});

router.post('/bookings', async (req, res) => {
  const { serviceId, date, time, customerId } = req.body;
  res.status(201).json({ bookingId: 'bk_' + Date.now(), serviceId, date, time, customerId });
});`,
  };

  return `import { Router } from 'express';

export const router = Router();

// Generated routes for ${requirements.appType} application
${routesByType[appType] || `
router.get('/items', async (req, res) => {
  res.json({ items: [] });
});

router.post('/items', async (req, res) => {
  res.status(201).json({ id: Date.now().toString(), ...req.body });
});
`}
`;
}

function generateErrorHandler(): string {
  return `import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(\`[Error] \${statusCode}: \${message}\`);

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
    },
  });
}
`;
}

function generateBackendPackageJson(requirements: AppRequirements): string {
  return JSON.stringify(
    {
      name: `${requirements.name.toLowerCase().replace(/\s+/g, '-')}-api`,
      version: '1.0.0',
      main: 'dist/index.js',
      dependencies: {
        express: '^4.18.0',
        cors: '^2.8.5',
        dotenv: '^16.0.0',
        ...(requirements.includeAuth && {
          jsonwebtoken: '^9.0.0',
          bcryptjs: '^2.4.3',
        }),
      },
      devDependencies: {
        '@types/express': '^4.17.0',
        '@types/cors': '^2.8.0',
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
        'ts-node': '^10.9.0',
        nodemon: '^3.0.0',
      },
      scripts: {
        start: 'node dist/index.js',
        dev: 'nodemon src/index.ts',
        build: 'tsc',
      },
    },
    null,
    2,
  );
}

function generateAuthBackend(): GeneratedFile[] {
  return [
    {
      path: 'backend/src/routes/auth.ts',
      language: 'typescript',
      content: `import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-in-production';
const TOKEN_EXPIRY = '7d';

authRouter.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = { id: Date.now().toString(), email, name, passwordHash: hashedPassword };
  const token = jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  return res.status(201).json({ token, user: { id: user.id, email, name } });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  // NOTE: In production, lookup user from database
  const user = { id: '1', email, name: 'User', passwordHash: '' };
  const token = jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  return res.json({ token, user: { id: user.id, email, name: user.name } });
});

authRouter.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});
`,
    },
    {
      path: 'backend/src/middleware/authenticate.ts',
      language: 'typescript',
      content: `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-in-production';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
`,
    },
  ];
}

/**
 * Generates database schema based on requirements
 */
export function generateDatabaseSchema(requirements: AppRequirements): DatabaseSchema {
  const commonUserTable: TableDefinition = {
    name: 'users',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, primaryKey: true, defaultValue: 'gen_random_uuid()' },
      { name: 'email', type: 'VARCHAR(255)', nullable: false, unique: true },
      { name: 'name', type: 'VARCHAR(255)', nullable: false },
      { name: 'password_hash', type: 'VARCHAR(255)', nullable: false },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'NOW()' },
      { name: 'updated_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'NOW()' },
    ],
    relationships: [],
  };

  const tablesByAppType: Record<string, TableDefinition[]> = {
    'e-commerce': [
      commonUserTable,
      {
        name: 'products',
        columns: [
          { name: 'id', type: 'UUID', nullable: false, primaryKey: true, defaultValue: 'gen_random_uuid()' },
          { name: 'name', type: 'VARCHAR(255)', nullable: false },
          { name: 'description', type: 'TEXT', nullable: true },
          { name: 'price', type: 'DECIMAL(10,2)', nullable: false },
          { name: 'stock', type: 'INTEGER', nullable: false, defaultValue: '0' },
          { name: 'category', type: 'VARCHAR(100)', nullable: true },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'NOW()' },
        ],
        relationships: [],
      },
      {
        name: 'orders',
        columns: [
          { name: 'id', type: 'UUID', nullable: false, primaryKey: true, defaultValue: 'gen_random_uuid()' },
          { name: 'user_id', type: 'UUID', nullable: false },
          { name: 'status', type: 'VARCHAR(50)', nullable: false, defaultValue: "'pending'" },
          { name: 'total', type: 'DECIMAL(10,2)', nullable: false },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'NOW()' },
        ],
        relationships: [
          { type: 'many-to-one', targetTable: 'users', foreignKey: 'user_id' },
        ],
      },
    ],
    'saas-dashboard': [
      commonUserTable,
      {
        name: 'organizations',
        columns: [
          { name: 'id', type: 'UUID', nullable: false, primaryKey: true, defaultValue: 'gen_random_uuid()' },
          { name: 'name', type: 'VARCHAR(255)', nullable: false },
          { name: 'plan', type: 'VARCHAR(50)', nullable: false, defaultValue: "'free'" },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'NOW()' },
        ],
        relationships: [],
      },
    ],
    'booking-system': [
      commonUserTable,
      {
        name: 'services',
        columns: [
          { name: 'id', type: 'UUID', nullable: false, primaryKey: true, defaultValue: 'gen_random_uuid()' },
          { name: 'name', type: 'VARCHAR(255)', nullable: false },
          { name: 'duration_minutes', type: 'INTEGER', nullable: false },
          { name: 'price', type: 'DECIMAL(10,2)', nullable: true },
        ],
        relationships: [],
      },
      {
        name: 'bookings',
        columns: [
          { name: 'id', type: 'UUID', nullable: false, primaryKey: true, defaultValue: 'gen_random_uuid()' },
          { name: 'user_id', type: 'UUID', nullable: false },
          { name: 'service_id', type: 'UUID', nullable: false },
          { name: 'start_time', type: 'TIMESTAMP', nullable: false },
          { name: 'end_time', type: 'TIMESTAMP', nullable: false },
          { name: 'status', type: 'VARCHAR(50)', nullable: false, defaultValue: "'pending'" },
          { name: 'notes', type: 'TEXT', nullable: true },
        ],
        relationships: [
          { type: 'many-to-one', targetTable: 'users', foreignKey: 'user_id' },
          { type: 'many-to-one', targetTable: 'services', foreignKey: 'service_id' },
        ],
      },
    ],
  };

  const tables = tablesByAppType[requirements.appType] || [commonUserTable];

  return {
    type: requirements.database,
    tables,
  };
}

/**
 * Generates SQL migration from a database schema
 */
export function generateSQLMigration(schema: DatabaseSchema): string {
  const statements: string[] = [
    '-- Auto-generated database migration',
    '-- Generated by hcaitools Web App Builder',
    '',
  ];

  for (const table of schema.tables) {
    const columnDefs = table.columns.map((col: ColumnDefinition) => {
      let def = `  ${col.name} ${col.type}`;
      if (col.primaryKey) def += ' PRIMARY KEY';
      if (!col.nullable) def += ' NOT NULL';
      if (col.unique) def += ' UNIQUE';
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
      return def;
    });

    // Add foreign key constraints
    const fkConstraints = table.relationships
      .filter((r) => r.type === 'many-to-one' || r.type === 'one-to-one')
      .map((r) => `  FOREIGN KEY (${r.foreignKey}) REFERENCES ${r.targetTable}(id) ON DELETE CASCADE`);

    statements.push(`CREATE TABLE IF NOT EXISTS ${table.name} (`);
    statements.push([...columnDefs, ...fkConstraints].join(',\n'));
    statements.push(');');
    statements.push('');
  }

  return statements.join('\n');
}

/**
 * Generates Docker configuration for containerization
 */
export function generateDockerConfig(requirements: AppRequirements): DockerConfig {
  const appNameSlug = requirements.name.toLowerCase().replace(/\s+/g, '-');
  const dbType = requirements.database;

  const dockerfileContent = `# Multi-stage build for ${requirements.name}
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001
CMD ["node", "dist/index.js"]
`;

  const dbService =
    dbType === 'postgresql'
      ? `  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${appNameSlug}
      POSTGRES_USER: \${DB_USER:-app}
      POSTGRES_PASSWORD: \${DB_PASSWORD:-changeme}
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 10s
      retries: 5`
      : `  db:
    image: mongo:7
    environment:
      MONGO_INITDB_DATABASE: ${appNameSlug}
    volumes:
      - db_data:/data/db`;

  const dockerComposeContent = `version: '3.8'

services:
  api:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=\${DATABASE_URL}
      - JWT_SECRET=\${JWT_SECRET}
      - NODE_ENV=production
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

${dbService}

${
  requirements.frontend === 'react'
    ? `  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - api
    restart: unless-stopped`
    : ''
}

volumes:
  db_data:
`;

  return { dockerfileContent, dockerComposeContent };
}

/**
 * Generates authentication configuration
 */
export function generateAuthConfig(): AuthConfig {
  return {
    strategy: 'jwt',
    tokenExpiry: '7d',
    endpoints: ['/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/auth/refresh'],
  };
}
