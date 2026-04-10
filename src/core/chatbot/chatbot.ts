/**
 * AI Chatbot Implementation
 * Conversational AI with LLM integration, intent recognition, and tool calling
 */

import crypto from 'crypto';
import {
  Conversation,
  ConversationState,
  Message,
  MessageType,
  ConversationContext,
  Intent,
  IntentRecognitionResult,
  ExtractedEntity,
  EntityExtractionResult,
  ToolDefinition,
  ToolCall,
  ToolExecutionResult,
  ToolHandler,
  ConversationBranch,
  ConversationAnalytics,
  ChatResponse,
  ChatbotConfig,
  ContextWindow,
  SentimentAnalysisResult,
  Sentiment,
  ChatSession,
  ConversationFilter,
  AnalyticsQuery,
  SlotValue,
  IntentConfidence,
  SentimentHistoryEntry,
} from './types';

const DEFAULT_CONFIG: ChatbotConfig = {
  maxContextWindow: 10,
  maxBranches: 5,
  defaultIntentThreshold: 0.7,
  sentimentAnalysisEnabled: true,
  entityExtractionEnabled: true,
  toolCallingEnabled: true,
  contextRetentionMinutes: 30,
  escalationThreshold: 3,
};

const POSITIVE_KEYWORDS = ['thank', 'great', 'excellent', 'amazing', 'good', 'wonderful', 'helpful', 'perfect', 'love', 'awesome'];
const NEGATIVE_KEYWORDS = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disappointed', 'frustrated', 'angry', 'poor'];

export class ChatbotServiceImpl {
  private conversations: Map<string, Conversation> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private tools: Map<string, ToolDefinition> = new Map();
  private toolHandlers: Map<string, ToolHandler> = new Map();
  private branches: Map<string, ConversationBranch> = new Map();
  private sessions: Map<string, ChatSession> = new Map();
  private analytics: Map<string, ConversationAnalytics> = new Map();
  private config: ChatbotConfig;
  private pendingToolCalls: Map<string, ToolCall> = new Map();

  constructor(config: Partial<ChatbotConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async createConversation(userId: string, metadata?: Record<string, unknown>): Promise<Conversation> {
    const conversationId = this.generateId('conv');
    const contextId = this.generateId('ctx');

    const context: ConversationContext = {
      contextId,
      conversationId,
      turnCount: 0,
      lastEntities: [],
      slots: {},
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const conversation: Conversation = {
      conversationId,
      userId,
      state: 'initial',
      context,
      branches: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessageAt: new Date(),
      metadata,
    };

    this.conversations.set(conversationId, conversation);
    this.messages.set(conversationId, []);

    await this.initializeAnalytics(conversationId, userId);

    return conversation;
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.conversations.get(conversationId) || null;
  }

  async getConversations(filter?: ConversationFilter): Promise<Conversation[]> {
    let results = Array.from(this.conversations.values());

    if (filter?.userId) {
      results = results.filter((c) => c.userId === filter.userId);
    }

    if (filter?.state) {
      results = results.filter((c) => c.state === filter.state);
    }

    if (filter?.since) {
      results = results.filter((c) => c.createdAt >= filter.since!);
    }

    if (filter?.until) {
      results = results.filter((c) => c.createdAt <= filter.until!);
    }

    results.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());

    if (filter?.offset) {
      results = results.slice(filter.offset);
    }

    if (filter?.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  async updateConversationState(conversationId: string, state: ConversationState): Promise<Conversation> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.state = state;
    conversation.updatedAt = new Date();

    if (state === 'in_progress' && conversation.state === 'initial') {
      conversation.context.turnCount = 0;
    }

    return conversation;
  }

  async sendMessage(
    conversationId: string,
    content: string,
    messageType: MessageType = 'text'
  ): Promise<ChatResponse> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    if (conversation.state === 'completed' || conversation.state === 'escalated') {
      throw new Error(`Cannot send message to conversation in ${conversation.state} state`);
    }

    const userMessage = await this.createMessage(conversationId, 'user', messageType, content);
    const conversationMessages = this.messages.get(conversationId) || [];
    conversationMessages.push(userMessage);
    this.messages.set(conversationId, conversationMessages);

    if (conversation.state === 'initial') {
      conversation.state = 'in_progress';
    }

    conversation.context.turnCount++;
    conversation.updatedAt = new Date();
    conversation.lastMessageAt = new Date();

    const intentResult = await this.recognizeIntent(content, conversation.context);

    if (intentResult.intent) {
      conversation.currentIntent = intentResult.intent.name;
      conversation.context.lastIntent = intentResult.intent.name;
      conversation.context.lastEntities = intentResult.intent.entities;
      Object.assign(conversation.context.slots, intentResult.contextUpdate.slots || {});
    }

    const sentimentResult = await this.analyzeSentiment(content);
    await this.recordSentiment(conversationId, sentimentResult);

    const contextUpdate = intentResult.contextUpdate;
    conversation.context.updatedAt = new Date();

    const toolCalls: ToolCall[] = [];
    if (this.config.toolCallingEnabled && intentResult.intent?.confidence >= this.config.defaultIntentThreshold) {
      const matchingTool = this.findMatchingTool(intentResult.intent.name);
      if (matchingTool) {
        const toolCall = await this.executeToolFromIntent(matchingTool, intentResult.intent.slots);
        if (toolCall) {
          toolCalls.push(toolCall);
        }
      }
    }

    const responseContent = await this.generateResponse(conversation, intentResult, toolCalls);
    const assistantMessage = await this.createMessage(conversationId, 'assistant', 'text', responseContent);
    const updatedMessages = this.messages.get(conversationId) || [];
    updatedMessages.push(assistantMessage);
    this.messages.set(conversationId, updatedMessages);

    await this.updateAnalyticsTurn(conversationId);

    if (conversation.context.turnCount >= this.config.escalationThreshold && conversation.state === 'in_progress') {
      conversation.state = 'waiting';
    }

    return {
      message: assistantMessage,
      intent: intentResult.intent,
      suggestedActions: this.generateSuggestedActions(intentResult),
      quickReplies: this.generateQuickReplies(intentResult),
      contextUpdate,
    };
  }

  async getMessages(conversationId: string, limit: number = 50, before?: string): Promise<Message[]> {
    const messages = this.messages.get(conversationId) || [];

    if (before) {
      const beforeIndex = messages.findIndex((m) => m.messageId === before);
      if (beforeIndex > 0) {
        return messages.slice(Math.max(0, beforeIndex - limit), beforeIndex);
      }
    }

    return messages.slice(-limit);
  }

  async recognizeIntent(message: string, _context: ConversationContext): Promise<IntentRecognitionResult> {
    const lowerMessage = message.toLowerCase();
    const intent = this.classifyIntent(lowerMessage);
    const entities = this.extractBasicEntities(lowerMessage);
    const slots = this.mapEntitiesToSlots(entities);

    const alternativeIntents = this.getAlternativeIntents(intent.name, lowerMessage);

    return {
      intent,
      alternativeIntents,
      contextUpdate: {
        lastIntent: intent.name,
        lastEntities: entities,
        slots,
        updatedAt: new Date(),
      },
    };
  }

  async extractEntities(message: string, _context?: ConversationContext): Promise<EntityExtractionResult> {
    const lowerMessage = message.toLowerCase();
    const entities = this.extractBasicEntities(lowerMessage);
    const slots = this.mapEntitiesToSlots(entities);

    return {
      entities,
      slots,
      rawText: message,
    };
  }

  async analyzeSentiment(message: string): Promise<SentimentAnalysisResult> {
    const lowerMessage = message.toLowerCase();
    const words = lowerMessage.split(/\s+/);

    let positiveScore = 0;
    let negativeScore = 0;
    const positiveFound: string[] = [];
    const negativeFound: string[] = [];

    for (const word of words) {
      if (POSITIVE_KEYWORDS.some((k) => word.includes(k))) {
        positiveScore++;
        positiveFound.push(word);
      }
      if (NEGATIVE_KEYWORDS.some((k) => word.includes(k))) {
        negativeScore++;
        negativeFound.push(word);
      }
    }

    const total = positiveScore + negativeScore + 1;
    const positiveRatio = positiveScore / total;
    const negativeRatio = negativeScore / total;

    let sentiment: Sentiment;
    let confidence: number;

    if (positiveScore > negativeScore) {
      sentiment = 'positive';
      confidence = positiveRatio;
    } else if (negativeScore > positiveScore) {
      sentiment = 'negative';
      confidence = negativeRatio;
    } else {
      sentiment = 'neutral';
      confidence = 0.5;
    }

    return {
      sentiment,
      confidence,
      scores: {
        positive: positiveRatio,
        neutral: 1 - positiveRatio - negativeRatio,
        negative: negativeRatio,
      },
      keywords: [...positiveFound, ...negativeFound],
    };
  }

  async executeTool(toolId: string, arguments_: Record<string, unknown>): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    const handler = this.toolHandlers.get(tool.name);
    if (!handler) {
      throw new Error(`No handler registered for tool ${tool.name}`);
    }

    const toolCall: ToolCall = {
      callId: this.generateId('call'),
      toolId,
      toolName: tool.name,
      arguments: arguments_,
      startedAt: new Date(),
      status: 'executing',
    };

    this.pendingToolCalls.set(toolCall.callId, toolCall);
    const startTime = Date.now();

    try {
      const result = await handler(arguments_);
      toolCall.status = 'completed';
      toolCall.completedAt = new Date();
      toolCall.result = result;

      await this.recordToolUsage(toolCall.callId);

      return {
        success: true,
        toolCall,
        output: result,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      toolCall.status = 'failed';
      toolCall.completedAt = new Date();
      toolCall.error = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        toolCall,
        errorMessage: toolCall.error,
        executionTimeMs: Date.now() - startTime,
      };
    } finally {
      this.pendingToolCalls.delete(toolCall.callId);
    }
  }

  async registerTool(tool: Omit<ToolDefinition, 'toolId'>): Promise<ToolDefinition> {
    const toolId = this.generateId('tool');
    const fullTool: ToolDefinition = { ...tool, toolId };
    this.tools.set(toolId, fullTool);
    return fullTool;
  }

  async unregisterTool(toolId: string): Promise<void> {
    const tool = this.tools.get(toolId);
    if (tool) {
      this.toolHandlers.delete(tool.name);
      this.tools.delete(toolId);
    }
  }

  async getTools(): Promise<ToolDefinition[]> {
    return Array.from(this.tools.values());
  }

  registerToolHandler(toolName: string, handler: ToolHandler): void {
    this.toolHandlers.set(toolName, handler);
  }

  async createBranch(
    conversationId: string,
    name: string,
    triggerIntent?: string
  ): Promise<ConversationBranch> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    if (conversation.branches.length >= this.config.maxBranches) {
      throw new Error(`Maximum branches (${this.config.maxBranches}) reached`);
    }

    const branchId = this.generateId('branch');
    const branch: ConversationBranch = {
      branchId,
      conversationId,
      name,
      triggerIntent,
      messages: [],
      createdAt: new Date(),
    };

    this.branches.set(branchId, branch);
    conversation.branches.push(branchId);

    return branch;
  }

  async switchBranch(conversationId: string, branchId: string): Promise<Conversation> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const branch = this.branches.get(branchId);
    if (!branch || branch.conversationId !== conversationId) {
      throw new Error(`Branch ${branchId} not found`);
    }

    conversation.activeBranchId = branchId;
    conversation.updatedAt = new Date();

    return conversation;
  }

  async mergeBranch(conversationId: string, branchId: string): Promise<Conversation> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const branch = this.branches.get(branchId);
    if (!branch || branch.conversationId !== conversationId) {
      throw new Error(`Branch ${branchId} not found`);
    }

    const branchMessages = this.messages.get(branchId) || [];
    const mainMessages = this.messages.get(conversationId) || [];

    for (const msg of branchMessages) {
      mainMessages.push(msg);
    }

    this.messages.set(conversationId, mainMessages);
    conversation.branches = conversation.branches.filter((b) => b !== branchId);
    conversation.activeBranchId = undefined;

    this.branches.delete(branchId);
    conversation.updatedAt = new Date();

    return conversation;
  }

  async getAnalytics(conversationId: string): Promise<ConversationAnalytics> {
    const analytics = this.analytics.get(conversationId);
    if (!analytics) {
      throw new Error(`Analytics for conversation ${conversationId} not found`);
    }
    return analytics;
  }

  async getAggregateAnalytics(_query: AnalyticsQuery): Promise<Record<string, unknown>> {
    const allAnalytics = Array.from(this.analytics.values());

    const totalConversations = allAnalytics.length;
    const totalTurns = allAnalytics.reduce((sum, a) => sum + a.turnCount, 0);
    const totalMessages = allAnalytics.reduce((sum, a) => sum + a.messageCount, 0);
    const avgResponseTime =
      totalConversations > 0 ? allAnalytics.reduce((sum, a) => sum + a.averageResponseTimeMs, 0) / totalConversations : 0;

    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    for (const a of allAnalytics) {
      if (a.sentimentHistory.length > 0) {
        const lastSentiment = a.sentimentHistory[a.sentimentHistory.length - 1];
        sentimentCounts[lastSentiment.sentiment]++;
      }
    }

    return {
      totalConversations,
      totalTurns,
      totalMessages,
      averageResponseTimeMs: avgResponseTime,
      sentimentDistribution: sentimentCounts,
    };
  }

  async escalateConversation(conversationId: string, _reason: string): Promise<Conversation> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.state = 'escalated';
    conversation.updatedAt = new Date();

    const analytics = this.analytics.get(conversationId);
    if (analytics) {
      analytics.escalationCount++;
      analytics.completionStatus = 'escalated';
    }

    const systemMessage = await this.createMessage(
      conversationId,
      'system',
      'text',
      'This conversation has been escalated to a human agent.'
    );
    const messages = this.messages.get(conversationId) || [];
    messages.push(systemMessage);
    this.messages.set(conversationId, messages);

    return conversation;
  }

  async endConversation(conversationId: string): Promise<Conversation> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.state = 'completed';
    conversation.updatedAt = new Date();

    const analytics = this.analytics.get(conversationId);
    if (analytics) {
      analytics.lastActivityAt = new Date();
      analytics.totalDurationMs = analytics.lastActivityAt.getTime() - analytics.startedAt.getTime();
    }

    return conversation;
  }

  getContextWindow(conversationId: string): ContextWindow {
    void this.conversations.get(conversationId);
    const messages = this.messages.get(conversationId) || [];

    const recentMessages = messages.slice(-this.config.maxContextWindow);
    const totalTokens = this.estimateTokens(recentMessages);

    return {
      windowId: this.generateId('win'),
      conversationId,
      messages: recentMessages,
      totalTokens,
      maxTokens: this.config.maxContextWindow * 100,
      isOverflowing: recentMessages.length >= this.config.maxContextWindow,
    };
  }

  private async createMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    type: MessageType,
    content: string
  ): Promise<Message> {
    return {
      messageId: this.generateId('msg'),
      conversationId,
      role,
      type,
      content,
      createdAt: new Date(),
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private classifyIntent(text: string): Intent {
    const intentRules: Array<{ pattern: RegExp | string; name: string; confidence: number }> = [
      { pattern: /^(hi|hello|hey|start)/i, name: 'greeting', confidence: 0.9 },
      { pattern: /^(bye|goodbye|exit|quit|end)/i, name: 'farewell', confidence: 0.9 },
      { pattern: /help|assist|support/i, name: 'help_request', confidence: 0.85 },
      { pattern: /what|how|why|when|where|can you|tell me/i, name: 'question', confidence: 0.8 },
      { pattern: /book|reserve|schedule/i, name: 'booking', confidence: 0.85 },
      { pattern: /search|find|look for/i, name: 'search', confidence: 0.8 },
      { pattern: /order|purchase|buy/i, name: 'order', confidence: 0.85 },
      { pattern: /cancel|delete|remove/i, name: 'cancellation', confidence: 0.8 },
      { pattern: /payment|bill|invoice|charge/i, name: 'payment', confidence: 0.85 },
      { pattern: /thanks?|thank you|appreciate/i, name: 'thanks', confidence: 0.9 },
      { pattern: /complaint|problem|issue|broken|not working/i, name: 'complaint', confidence: 0.85 },
      { pattern: /feedback|suggest|recommend/i, name: 'feedback', confidence: 0.8 },
      { pattern: /weather/i, name: 'weather_query', confidence: 0.9 },
      { pattern: /news|headlines/i, name: 'news_query', confidence: 0.85 },
      { pattern: /translate|translation/i, name: 'translation', confidence: 0.85 },
      { pattern: /remind|reminder|schedule/i, name: 'reminder', confidence: 0.85 },
    ];

    for (const rule of intentRules) {
      if (typeof rule.pattern === 'string') {
        if (text.includes(rule.pattern.toLowerCase())) {
          return this.createIntent(rule.name, rule.confidence, []);
        }
      } else if (rule.pattern.test(text)) {
        return this.createIntent(rule.name, rule.confidence, []);
      }
    }

    return this.createIntent('unknown', 0.5, []);
  }

  private createIntent(name: string, confidence: number, entities: ExtractedEntity[]): Intent {
    let confidenceLevel: IntentConfidence;
    if (confidence >= 0.8) {
      confidenceLevel = 'high';
    } else if (confidence >= 0.5) {
      confidenceLevel = 'medium';
    } else {
      confidenceLevel = 'low';
    }

    return {
      name,
      confidence,
      confidenceLevel,
      entities,
      slots: {},
    };
  }

  private getAlternativeIntents(primaryIntent: string, _text: string): Intent[] {
    const alternatives: Intent[] = [];
    const allIntents = [
      'greeting',
      'farewell',
      'help_request',
      'question',
      'booking',
      'search',
      'order',
      'cancellation',
      'payment',
      'thanks',
      'complaint',
      'feedback',
    ];

    for (const intentName of allIntents) {
      if (intentName !== primaryIntent) {
        alternatives.push(this.createIntent(intentName, 0.3, []));
      }
    }

    return alternatives.slice(0, 3);
  }

  private extractBasicEntities(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = text.match(emailRegex);
    if (emailMatches) {
      for (const match of emailMatches) {
        entities.push({
          entityType: 'email',
          value: match,
          confidence: 0.95,
        });
      }
    }

    const phoneRegex = /(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phoneMatches = text.match(phoneRegex);
    if (phoneMatches) {
      for (const match of phoneMatches) {
        entities.push({
          entityType: 'phone',
          value: match.trim(),
          confidence: 0.9,
        });
      }
    }

    const numberRegex = /\b\d+\b/g;
    const numberMatches = text.match(numberRegex);
    if (numberMatches) {
      for (const match of numberMatches) {
        const num = parseInt(match, 10);
        if (!isNaN(num) && num > 0) {
          entities.push({
            entityType: 'number',
            value: num,
            confidence: 0.8,
          });
        }
      }
    }

    const dateRegex = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday))/gi;
    const dateMatches = text.match(dateRegex);
    if (dateMatches) {
      for (const match of dateMatches) {
        entities.push({
          entityType: 'date',
          value: match,
          confidence: 0.8,
        });
      }
    }

    const currencyRegex = /\$\d+(?:\.\d{2})?/g;
    const currencyMatches = text.match(currencyRegex);
    if (currencyMatches) {
      for (const match of currencyMatches) {
        entities.push({
          entityType: 'currency',
          value: match,
          confidence: 0.95,
        });
      }
    }

    return entities;
  }

  private mapEntitiesToSlots(entities: ExtractedEntity[]): Record<string, SlotValue> {
    const slots: Record<string, SlotValue> = {};

    for (const entity of entities) {
      const slotName = entity.entityType;
      slots[slotName] = {
        name: slotName,
        value: entity.value,
        confidence: entity.confidence,
        source: 'extracted',
        updatedAt: new Date(),
      };
    }

    return slots;
  }

  private findMatchingTool(intentName: string): ToolDefinition | undefined {
    const toolMappings: Record<string, string[]> = {
      weather_query: ['weather'],
      search: ['search'],
      booking: ['calendar', 'booking'],
      order: ['ecommerce'],
      payment: ['payment'],
      reminder: ['calendar'],
    };

    const toolNames = toolMappings[intentName] || [];
    for (const toolName of toolNames) {
      for (const tool of this.tools.values()) {
        if (tool.name.toLowerCase().includes(toolName)) {
          return tool;
        }
      }
    }

    return undefined;
  }

  private async executeToolFromIntent(
    tool: ToolDefinition,
    slots: Record<string, SlotValue>
  ): Promise<ToolCall | null> {
    const args: Record<string, unknown> = {};

    for (const param of tool.parameters) {
      if (slots[param.name]) {
        args[param.name] = slots[param.name].value;
      } else if (param.default !== undefined) {
        args[param.name] = param.default;
      }
    }

    try {
      const result = await this.executeTool(tool.toolId, args);
      return result.toolCall;
    } catch {
      return null;
    }
  }

  private async generateResponse(
    conversation: Conversation,
    intentResult: IntentRecognitionResult,
    toolCalls: ToolCall[]
  ): Promise<string> {
    const intentName = intentResult.intent?.name || 'unknown';
    const turnCount = conversation.context.turnCount;

    if (toolCalls.length > 0 && toolCalls[0].status === 'completed') {
      const toolResult = toolCalls[0].result;
      return `I've completed that ${intentName} for you. The result is: ${JSON.stringify(toolResult)}. Is there anything else I can help you with?`;
    }

    const responses: Record<string, string[]> = {
      greeting: [
        "Hello! How can I assist you today?",
        "Hi there! What can I help you with?",
        "Hey! I'm here to help. What do you need?",
      ],
      farewell: [
        "Goodbye! Have a great day!",
        "Bye! Feel free to come back if you need anything.",
        "Take care! Let me know if you need help in the future.",
      ],
      help_request: [
        "I'd be happy to help! What do you need assistance with?",
        "I'm here to help! Please tell me what you need.",
        "How can I assist you today?",
      ],
      question: [
        "That's a great question. Let me provide more information.",
        "I'd be happy to answer that for you.",
        "Based on my knowledge, here is what I can tell you:",
      ],
      booking: [
        "I can help you with that booking. Let me gather the details.",
        "Sure, let me assist you with the reservation.",
        "I can set that up for you. What date and time works for you?",
      ],
      search: [
        "Let me search for that for you.",
        "I'll look that up right away.",
        "Searching now... Here is what I found:",
      ],
      order: [
        "I can help you place that order.",
        "Let me get that order started for you.",
        "I'll assist you with your purchase.",
      ],
      cancellation: [
        "I understand you need to cancel. Let me process that.",
        "I can help you with the cancellation.",
        "Let me take care of that cancellation for you.",
      ],
      payment: [
        "I can help you with your payment.",
        "Let me assist you with the billing.",
        "I'll look into the payment for you.",
      ],
      thanks: [
        "You're welcome! Is there anything else I can help with?",
        "Happy to help! Let me know if you need anything else.",
        "My pleasure! Feel free to ask if you have more questions.",
      ],
      complaint: [
        "I'm sorry to hear you're having an issue. Let me help resolve this.",
        "I apologize for the inconvenience. Let me look into this for you.",
        "I understand your frustration. I'll do my best to help.",
      ],
      feedback: [
        "Thank you for your feedback! We appreciate it.",
        "Thanks for sharing that with us.",
        "We value your input. Thank you for your suggestions.",
      ],
      unknown: [
        "I'm not quite sure I understood that. Could you rephrase?",
        "I'd like to help, but I need more information.",
        "Could you tell me more about what you're looking for?",
      ],
    };

    const intentResponses = responses[intentName] || responses.unknown;
    const responseIndex = (turnCount - 1) % intentResponses.length;

    return intentResponses[responseIndex];
  }

  private generateSuggestedActions(intentResult: IntentRecognitionResult): string[] {
    const intentName = intentResult.intent?.name || 'unknown';

    const suggestions: Record<string, string[]> = {
      greeting: ['Get started', 'Learn more', 'Contact support'],
      farewell: ['End conversation', 'Start new topic'],
      help_request: ['FAQ', 'Contact human agent', 'Browse topics'],
      question: ['Get more details', 'Related questions', 'Contact support'],
      booking: ['View my bookings', 'Modify booking', 'Cancel booking'],
      search: ['Refine search', 'Save search', 'Clear filters'],
      order: ['Track order', 'View order history', 'Return item'],
      cancellation: ['View cancellation policy', 'Contact support'],
      payment: ['View billing history', 'Update payment method', 'Contact billing'],
      thanks: ['Rate service', 'Give feedback', 'End chat'],
      complaint: ['Track issue', 'Request callback', 'View help center'],
      feedback: ['Take survey', 'View status', 'Contact team'],
      unknown: ['Try again', 'Contact support', 'Browse topics'],
    };

    return suggestions[intentName] || suggestions.unknown;
  }

  private generateQuickReplies(intentResult: IntentRecognitionResult): string[] {
    const intentName = intentResult.intent?.name || 'unknown';

    const quickReplies: Record<string, string[]> = {
      greeting: ['Help me start', 'Show features', 'Talk to support'],
      help_request: ['Yes, I need help', 'Browse topics', 'Contact agent'],
      question: ['Yes, continue', 'More information', 'Talk to human'],
      unknown: ['Help me', 'Start over', 'Contact support'],
    };

    return quickReplies[intentName] || [];
  }

  private async initializeAnalytics(conversationId: string, userId: string): Promise<void> {
    const analytics: ConversationAnalytics = {
      conversationId,
      userId,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      turnCount: 0,
      messageCount: 0,
      averageResponseTimeMs: 0,
      totalDurationMs: 0,
      sentimentHistory: [],
      intentDistribution: {},
      toolUsageCount: {},
      branchCount: 0,
      escalationCount: 0,
      completionStatus: 'completed',
    };

    this.analytics.set(conversationId, analytics);
  }

  private async recordSentiment(conversationId: string, result: SentimentAnalysisResult): Promise<void> {
    const analytics = this.analytics.get(conversationId);
    if (!analytics) return;

    const entry: SentimentHistoryEntry = {
      timestamp: new Date(),
      sentiment: result.sentiment,
      confidence: result.confidence,
    };

    analytics.sentimentHistory.push(entry);
    analytics.lastActivityAt = new Date();
  }

  private async recordToolUsage(callId: string): Promise<void> {
    for (const analytics of this.analytics.values()) {
      const toolCall = this.pendingToolCalls.get(callId);
      if (toolCall) {
        analytics.toolUsageCount[toolCall.toolName] = (analytics.toolUsageCount[toolCall.toolName] || 0) + 1;
        break;
      }
    }
  }

  private async updateAnalyticsTurn(conversationId: string): Promise<void> {
    const analytics = this.analytics.get(conversationId);
    if (!analytics) return;

    analytics.turnCount++;
    analytics.messageCount += 2;
    analytics.lastActivityAt = new Date();
  }

  private estimateTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
      total += Math.ceil(msg.content.length / 4);
    }
    return total;
  }
}

export function createChatbotService(config?: Partial<ChatbotConfig>): ChatbotServiceImpl {
  return new ChatbotServiceImpl(config);
}
