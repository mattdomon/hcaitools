/**
 * AI Chatbot Integration Types
 * Conversational AI with LLM integration, intent recognition, and tool calling
 */

export type ConversationState = 'initial' | 'in_progress' | 'waiting' | 'completed' | 'escalated';
export type Sentiment = 'positive' | 'neutral' | 'negative';
export type MessageType = 'text' | 'image' | 'file' | 'action' | 'system';
export type IntentConfidence = 'high' | 'medium' | 'low';

export interface Message {
  messageId: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  type: MessageType;
  content: string;
  metadata?: Record<string, unknown>;
  attachments?: Attachment[];
  createdAt: Date;
}

export interface Attachment {
  attachmentId: string;
  type: 'image' | 'file' | 'audio' | 'video';
  url: string;
  name: string;
  mimeType: string;
  size?: number;
}

export interface ConversationContext {
  contextId: string;
  conversationId: string;
  turnCount: number;
  lastIntent?: string;
  lastEntities: ExtractedEntity[];
  slots: Record<string, SlotValue>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlotValue {
  name: string;
  value: unknown;
  confidence: number;
  source: 'extracted' | 'provided' | 'default';
  updatedAt: Date;
}

export interface Intent {
  name: string;
  confidence: number;
  confidenceLevel: IntentConfidence;
  entities: ExtractedEntity[];
  slots: Record<string, SlotValue>;
  reasoning?: string;
}

export interface ExtractedEntity {
  entityType: string;
  value: string | number | boolean | object;
  confidence: number;
  startIndex?: number;
  endIndex?: number;
  metadata?: Record<string, unknown>;
}

export interface ToolDefinition {
  toolId: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
  returns: ToolReturnType;
  isAsync: boolean;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
  enum?: string[];
}

export interface ToolReturnType {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'void';
  description: string;
}

export interface ToolCall {
  callId: string;
  toolId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

export interface ConversationBranch {
  branchId: string;
  parentBranchId?: string;
  conversationId: string;
  name: string;
  triggerIntent?: string;
  triggerCondition?: string;
  messages: string[];
  createdAt: Date;
}

export interface ConversationAnalytics {
  conversationId: string;
  userId: string;
  startedAt: Date;
  lastActivityAt: Date;
  turnCount: number;
  messageCount: number;
  averageResponseTimeMs: number;
  totalDurationMs: number;
  sentimentHistory: SentimentHistoryEntry[];
  intentDistribution: Record<string, number>;
  toolUsageCount: Record<string, number>;
  branchCount: number;
  escalationCount: number;
  completionStatus: 'completed' | 'abandoned' | 'escalated';
}

export interface SentimentHistoryEntry {
  timestamp: Date;
  sentiment: Sentiment;
  confidence: number;
  triggerMessage?: string;
}

export interface Conversation {
  conversationId: string;
  userId: string;
  state: ConversationState;
  currentIntent?: string;
  context: ConversationContext;
  branches: string[];
  activeBranchId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
}

export interface IntentRecognitionResult {
  intent: Intent;
  alternativeIntents: Intent[];
  contextUpdate: Partial<ConversationContext>;
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  slots: Record<string, SlotValue>;
  rawText: string;
}

export interface ToolExecutionResult {
  success: boolean;
  toolCall: ToolCall;
  output?: unknown;
  errorMessage?: string;
  executionTimeMs: number;
}

export interface ChatResponse {
  message: Message;
  intent?: Intent;
  suggestedActions?: string[];
  quickReplies?: string[];
  contextUpdate: Partial<ConversationContext>;
}

export interface ChatbotConfig {
  maxContextWindow: number;
  maxBranches: number;
  defaultIntentThreshold: number;
  sentimentAnalysisEnabled: boolean;
  entityExtractionEnabled: boolean;
  toolCallingEnabled: boolean;
  contextRetentionMinutes: number;
  escalationThreshold: number;
}

export interface ContextWindow {
  windowId: string;
  conversationId: string;
  messages: Message[];
  totalTokens: number;
  maxTokens: number;
  isOverflowing: boolean;
}

export interface SentimentAnalysisResult {
  sentiment: Sentiment;
  confidence: number;
  scores: {
    positive: number;
    neutral: number;
    negative: number;
  };
  keywords: string[];
}

export interface LLMRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: string;
}

export interface LLMResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'tool_use' | 'content_filter';
  toolCalls?: ToolCallRequest[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ToolCallRequest {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatSession {
  sessionId: string;
  userId: string;
  conversationId: string;
  startedAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
}

export interface ConversationFilter {
  userId?: string;
  state?: ConversationState;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

export interface AnalyticsQuery {
  conversationId?: string;
  userId?: string;
  period: { start: Date; end: Date };
  metrics: Array<'turnCount' | 'messageCount' | 'avgResponseTime' | 'sentiment' | 'toolUsage'>;
}

export interface ChatbotService {
  createConversation(userId: string, metadata?: Record<string, unknown>): Promise<Conversation>;
  getConversation(conversationId: string): Promise<Conversation | null>;
  getConversations(filter?: ConversationFilter): Promise<Conversation[]>;
  updateConversationState(conversationId: string, state: ConversationState): Promise<Conversation>;
  
  sendMessage(conversationId: string, content: string, messageType?: MessageType): Promise<ChatResponse>;
  getMessages(conversationId: string, limit?: number, before?: string): Promise<Message[]>;
  
  recognizeIntent(message: string, context: ConversationContext): Promise<IntentRecognitionResult>;
  extractEntities(message: string, context?: ConversationContext): Promise<EntityExtractionResult>;
  analyzeSentiment(message: string): Promise<SentimentAnalysisResult>;
  
  executeTool(toolId: string, arguments_: Record<string, unknown>): Promise<ToolExecutionResult>;
  registerTool(tool: Omit<ToolDefinition, 'toolId'>): Promise<ToolDefinition>;
  unregisterTool(toolId: string): Promise<void>;
  getTools(): Promise<ToolDefinition[]>;
  
  createBranch(conversationId: string, name: string, triggerIntent?: string): Promise<ConversationBranch>;
  switchBranch(conversationId: string, branchId: string): Promise<Conversation>;
  mergeBranch(conversationId: string, branchId: string): Promise<Conversation>;
  
  getAnalytics(conversationId: string): Promise<ConversationAnalytics>;
  getAggregateAnalytics(query: AnalyticsQuery): Promise<Record<string, unknown>>;
  
  escalateConversation(conversationId: string, reason: string): Promise<Conversation>;
  endConversation(conversationId: string): Promise<Conversation>;
}

export interface IntentClassifier {
  classify(text: string, availableIntents: string[]): Promise<IntentRecognitionResult>;
  train(examples: IntentTrainingExample[]): Promise<void>;
}

export interface IntentTrainingExample {
  text: string;
  intent: string;
  entities?: ExtractedEntity[];
}

export interface EntityExtractor {
  extract(text: string, entityTypes?: string[]): Promise<EntityExtractionResult>;
  addEntityPattern(entityType: string, pattern: string | RegExp): void;
}

export interface ToolExecutor {
  execute(toolCall: ToolCall): Promise<ToolExecutionResult>;
  registerHandler(toolName: string, handler: ToolHandler): void;
  unregisterHandler(toolName: string): void;
}

export interface ToolHandler {
  (arguments_: Record<string, unknown>): Promise<unknown>;
}

export interface SentimentAnalyzer {
  analyze(text: string): Promise<SentimentAnalysisResult>;
  calibrate(examples: SentimentTrainingExample[]): Promise<void>;
}

export interface SentimentTrainingExample {
  text: string;
  sentiment: Sentiment;
}
