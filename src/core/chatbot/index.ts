/**
 * AI Chatbot Integration
 * Conversational AI with LLM integration, intent recognition, and tool calling
 */

export {
  ConversationState,
  Sentiment,
  MessageType,
  IntentConfidence,
  Message,
  Attachment,
  ConversationContext,
  SlotValue,
  Intent,
  ExtractedEntity,
  ToolDefinition,
  ToolParameter,
  ToolReturnType,
  ToolCall,
  ConversationBranch,
  ConversationAnalytics,
  SentimentHistoryEntry,
  Conversation,
  IntentRecognitionResult,
  EntityExtractionResult,
  ToolExecutionResult,
  ChatResponse,
  ChatbotConfig,
  ContextWindow,
  SentimentAnalysisResult,
  LLMRequest,
  LLMResponse,
  ToolCallRequest,
  ChatSession,
  ConversationFilter,
  AnalyticsQuery,
  ChatbotService,
  IntentClassifier,
  IntentTrainingExample,
  EntityExtractor,
  ToolExecutor,
  ToolHandler,
  SentimentAnalyzer,
  SentimentTrainingExample,
} from './types';

export { ChatbotServiceImpl, createChatbotService } from './chatbot';

import { ChatbotServiceImpl } from './chatbot';

/**
 * ChatbotManus
 * Main class for AI chatbot integration
 */
export class ChatbotManus {
  private service: ChatbotServiceImpl;

  constructor(config?: Partial<import('./types').ChatbotConfig>) {
    this.service = new ChatbotServiceImpl(config);
  }

  /**
   * Start a new conversation
   */
  async startConversation(userId: string, metadata?: Record<string, unknown>) {
    return this.service.createConversation(userId, metadata);
  }

  /**
   * Get existing conversation
   */
  async getConversation(conversationId: string) {
    return this.service.getConversation(conversationId);
  }

  /**
   * Send a message and get response
   */
  async chat(conversationId: string, message: string, messageType: import('./types').MessageType = 'text') {
    return this.service.sendMessage(conversationId, message, messageType);
  }

  /**
   * Get conversation history
   */
  async getHistory(conversationId: string, limit: number = 50) {
    return this.service.getMessages(conversationId, limit);
  }

  /**
   * End a conversation
   */
  async endConversation(conversationId: string) {
    return this.service.endConversation(conversationId);
  }

  /**
   * Escalate to human agent
   */
  async escalate(conversationId: string, reason: string) {
    return this.service.escalateConversation(conversationId, reason);
  }

  /**
   * Register a tool/function
   */
  async registerTool(name: string, description: string, parameters: import('./types').ToolParameter[], handler: import('./types').ToolHandler) {
    const tool = await this.service.registerTool({
      name,
      description,
      parameters,
      returns: { type: 'void', description: 'Tool execution result' },
      isAsync: true,
    });
    this.service.registerToolHandler(name, handler);
    return tool;
  }

  /**
   * Get conversation analytics
   */
  async getAnalytics(conversationId: string) {
    return this.service.getAnalytics(conversationId);
  }

  /**
   * Analyze sentiment of text
   */
  async analyzeSentiment(text: string) {
    return this.service.analyzeSentiment(text);
  }

  /**
   * Extract entities from text
   */
  async extractEntities(text: string) {
    return this.service.extractEntities(text, undefined);
  }

  /**
   * Create conversation branch
   */
  async createBranch(conversationId: string, name: string, triggerIntent?: string) {
    return this.service.createBranch(conversationId, name, triggerIntent);
  }

  /**
   * Switch to different branch
   */
  async switchBranch(conversationId: string, branchId: string) {
    return this.service.switchBranch(conversationId, branchId);
  }

  /**
   * Example: Greeting intent
   */
  async greet(conversationId: string) {
    return this.service.sendMessage(conversationId, 'hello');
  }

  /**
   * Example: Help request
   */
  async requestHelp(conversationId: string) {
    return this.service.sendMessage(conversationId, 'I need help');
  }

  /**
   * Example: Farewell
   */
  async sayGoodbye(conversationId: string) {
    return this.service.sendMessage(conversationId, 'goodbye');
  }
}
