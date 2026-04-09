/**
 * WebAppBuilder - Main orchestrator for generating full-stack web applications from natural language
 */

import { analyzePrompt } from './promptAnalyzer';
import {
  generateFrontendCode,
  generateBackendCode,
  generateDatabaseSchema,
  generateSQLMigration,
  generateDockerConfig,
  generateAuthConfig,
} from './codeGenerator';
import {
  AppRequirements,
  GeneratedApp,
  AppStructure,
  DatabaseType,
  FrontendFramework,
  BackendFramework,
} from './types';

export { AppRequirements, GeneratedApp } from './types';

export interface BuildFromPromptOptions {
  database?: DatabaseType;
  frontend?: FrontendFramework;
  backend?: BackendFramework;
  includeAuth?: boolean;
  includeDocker?: boolean;
}

/**
 * Builds a full-stack web application from a natural language prompt.
 * Parses the prompt, generates frontend, backend, database, and optional auth/docker configs.
 */
export function buildFromPrompt(
  appName: string,
  prompt: string,
  options: BuildFromPromptOptions = {},
): GeneratedApp {
  if (!appName || !appName.trim()) {
    throw new Error('App name is required');
  }
  if (!prompt || !prompt.trim()) {
    throw new Error('Prompt is required');
  }

  const analysis = analyzePrompt(prompt);

  const requirements: AppRequirements = {
    name: appName.trim(),
    description: prompt.trim(),
    appType: analysis.appType,
    features: analysis.features,
    database: options.database ?? analysis.suggestedDatabase,
    frontend: options.frontend ?? analysis.suggestedFrontend,
    backend: options.backend ?? analysis.suggestedBackend,
    includeAuth: options.includeAuth ?? analysis.requiresAuth,
    includeDocker: options.includeDocker ?? true,
  };

  const frontendFiles = generateFrontendCode(requirements);
  const backendFiles = generateBackendCode(requirements);
  const databaseSchema = generateDatabaseSchema(requirements);

  const sqlMigration = generateSQLMigration(databaseSchema);
  const migrationFile = {
    path: 'database/migrations/001_initial.sql',
    content: sqlMigration,
    language: 'sql',
  };

  const allFiles = [...frontendFiles, ...backendFiles, migrationFile];

  const structure: AppStructure = {
    frontend: frontendFiles.map((f) => f.path),
    backend: backendFiles.map((f) => f.path),
    database: [migrationFile.path],
    config: [],
  };

  const result: GeneratedApp = {
    requirements,
    files: allFiles,
    structure,
    databaseSchema,
  };

  if (requirements.includeDocker) {
    const dockerConfig = generateDockerConfig(requirements);
    result.dockerConfig = dockerConfig;
    const dockerFiles = [
      {
        path: 'docker/Dockerfile',
        content: dockerConfig.dockerfileContent,
        language: 'dockerfile',
      },
      {
        path: 'docker/docker-compose.yml',
        content: dockerConfig.dockerComposeContent,
        language: 'yaml',
      },
    ];
    result.files.push(...dockerFiles);
    result.structure.config.push(...dockerFiles.map((f) => f.path));
  }

  if (requirements.includeAuth) {
    result.authConfig = generateAuthConfig();
  }

  return result;
}

/**
 * Returns the list of supported application types
 */
export function getSupportedAppTypes(): string[] {
  return [
    'saas-dashboard',
    'landing-page',
    'e-commerce',
    'portfolio',
    'booking-system',
    'community-platform',
    'membership-site',
    'custom',
  ];
}
