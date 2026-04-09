/**
 * Types for the AI Web App Builder module
 */

export type AppType =
  | 'saas-dashboard'
  | 'landing-page'
  | 'e-commerce'
  | 'portfolio'
  | 'booking-system'
  | 'community-platform'
  | 'membership-site'
  | 'custom';

export type DatabaseType = 'postgresql' | 'mongodb';
export type FrontendFramework = 'react' | 'vue';
export type BackendFramework = 'nodejs' | 'python';

export interface AppRequirements {
  name: string;
  description: string;
  appType: AppType;
  features: string[];
  database: DatabaseType;
  frontend: FrontendFramework;
  backend: BackendFramework;
  includeAuth: boolean;
  includeDocker: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
}

export interface GeneratedApp {
  requirements: AppRequirements;
  files: GeneratedFile[];
  structure: AppStructure;
  dockerConfig?: DockerConfig;
  authConfig?: AuthConfig;
  databaseSchema?: DatabaseSchema;
}

export interface AppStructure {
  frontend: string[];
  backend: string[];
  database: string[];
  config: string[];
}

export interface DockerConfig {
  dockerfileContent: string;
  dockerComposeContent: string;
}

export interface AuthConfig {
  strategy: 'jwt';
  tokenExpiry: string;
  endpoints: string[];
}

export interface DatabaseSchema {
  type: DatabaseType;
  tables: TableDefinition[];
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  relationships: Relationship[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  defaultValue?: string;
}

export interface Relationship {
  type: 'one-to-many' | 'many-to-one' | 'many-to-many' | 'one-to-one';
  targetTable: string;
  foreignKey: string;
}

export interface PromptAnalysisResult {
  appType: AppType;
  features: string[];
  entities: string[];
  requiresAuth: boolean;
  requiresPayments: boolean;
  suggestedDatabase: DatabaseType;
  suggestedFrontend: FrontendFramework;
  suggestedBackend: BackendFramework;
}
