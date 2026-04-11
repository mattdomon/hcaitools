/**
 * Chatbot Service Tests
 */

import { ChatbotServiceImpl } from '../src/core/chatbot/chatbot';
import { ChatbotManus } from '../src/core/chatbot';

describe('ChatbotServiceImpl', () => {
  let service: ChatbotServiceImpl;

  beforeEach(() => {
    service = new ChatbotServiceImpl();
  });

  describe('Conversation Management', () => {
    test('should create a new conversation', async () => {
      const conversation = await service.createConversation('user123', { source: 'web' });

      expect(conversation.conversationId).toBeDefined();
      expect(conversation.userId).toBe('user123');
      expect(conversation.state).toBe('initial');
      expect(conversation.context.turnCount).toBe(0);
      expect(conversation.metadata?.source).toBe('web');
    });

    test('should get conversation by ID', async () => {
      const created = await service.createConversation('user123');
      const retrieved = await service.getConversation(created.conversationId);

      expect(retrieved?.conversationId).toBe(created.conversationId);
      expect(retrieved?.userId).toBe('user123');
    });

    test('should return null for non-existent conversation', async () => {
      const retrieved = await service.getConversation('non_existent');
      expect(retrieved).toBeNull();
    });

    test('should get conversations with filter', async () => {
      await service.createConversation('user1');
      await service.createConversation('user2');
      await service.createConversation('user1');

      const user1Convs = await service.getConversations({ userId: 'user1' });
      expect(user1Convs.length).toBe(2);
    });

    test('should update conversation state', async () => {
      const conversation = await service.createConversation('user123');
      const updated = await service.updateConversationState(conversation.conversationId, 'in_progress');

      expect(updated.state).toBe('in_progress');
    });

    test('should throw error for non-existent conversation state update', async () => {
      await expect(service.updateConversationState('non_existent', 'in_progress')).rejects.toThrow();
    });
  });

  describe('Messaging', () => {
    test('should send message and receive response', async () => {
      const conversation = await service.createConversation('user123');
      const response = await service.sendMessage(conversation.conversationId, 'hello');

      expect(response.message.conversationId).toBe(conversation.conversationId);
      expect(response.message.role).toBe('assistant');
      expect(response.message.content).toBeTruthy();
    });

    test('should increment turn count', async () => {
      const conversation = await service.createConversation('user123');
      await service.sendMessage(conversation.conversationId, 'hello');
      await service.sendMessage(conversation.conversationId, 'help');

      const updated = await service.getConversation(conversation.conversationId);
      expect(updated?.context.turnCount).toBe(2);
    });

    test('should throw error when sending to completed conversation', async () => {
      const conversation = await service.createConversation('user123');
      await service.endConversation(conversation.conversationId);

      await expect(service.sendMessage(conversation.conversationId, 'hello')).rejects.toThrow();
    });

    test('should throw error when sending to escalated conversation', async () => {
      const conversation = await service.createConversation('user123');
      await service.escalateConversation(conversation.conversationId, 'user request');

      await expect(service.sendMessage(conversation.conversationId, 'hello')).rejects.toThrow();
    });

    test('should get messages with limit', async () => {
      const conversation = await service.createConversation('user123');
      await service.sendMessage(conversation.conversationId, 'msg1');
      await service.sendMessage(conversation.conversationId, 'msg2');
      await service.sendMessage(conversation.conversationId, 'msg3');

      const messages = await service.getMessages(conversation.conversationId, 2);
      expect(messages.length).toBeLessThanOrEqual(4);
    });

    test('should change state from initial to in_progress after first message', async () => {
      const conversation = await service.createConversation('user123');
      expect(conversation.state).toBe('initial');

      await service.sendMessage(conversation.conversationId, 'hello');

      const updated = await service.getConversation(conversation.conversationId);
      expect(updated?.state).toBe('in_progress');
    });
  });

  describe('Intent Recognition', () => {
    test('should recognize greeting intent', async () => {
      const conversation = await service.createConversation('user123');
      const result = await service.recognizeIntent('hello', conversation.context);

      expect(result.intent.name).toBe('greeting');
      expect(result.intent.confidence).toBeGreaterThan(0.5);
    });

    test('should recognize farewell intent', async () => {
      const conversation = await service.createConversation('user123');
      const result = await service.recognizeIntent('goodbye', conversation.context);

      expect(result.intent.name).toBe('farewell');
    });

    test('should recognize help request intent', async () => {
      const conversation = await service.createConversation('user123');
      const result = await service.recognizeIntent('I need help', conversation.context);

      expect(result.intent.name).toBe('help_request');
    });

    test('should recognize booking intent', async () => {
      const conversation = await service.createConversation('user123');
      const result = await service.recognizeIntent('I want to book a table', conversation.context);

      expect(result.intent.name).toBe('booking');
    });

    test('should recognize unknown intent for random text', async () => {
      const conversation = await service.createConversation('user123');
      const result = await service.recognizeIntent('asdfghjkl', conversation.context);

      expect(result.intent.name).toBe('unknown');
    });

    test('should provide alternative intents', async () => {
      const conversation = await service.createConversation('user123');
      const result = await service.recognizeIntent('hello', conversation.context);

      expect(result.alternativeIntents.length).toBeGreaterThan(0);
    });
  });

  describe('Entity Extraction', () => {
    test('should extract email entity', async () => {
      const result = await service.extractEntities('Contact me at john@example.com');

      expect(result.entities.some((e) => e.entityType === 'email')).toBe(true);
    });

    test('should extract phone entity', async () => {
      const result = await service.extractEntities('Call me at 555-123-4567');

      expect(result.entities.some((e) => e.entityType === 'phone')).toBe(true);
    });

    test('should extract number entity', async () => {
      const result = await service.extractEntities('I need 5 items');

      expect(result.entities.some((e) => e.entityType === 'number')).toBe(true);
    });

    test('should extract currency entity', async () => {
      const result = await service.extractEntities('The price is $99.99');

      expect(result.entities.some((e) => e.entityType === 'currency')).toBe(true);
    });

    test('should map entities to slots', async () => {
      const result = await service.extractEntities('Email john@example.com');

      expect(result.slots.email).toBeDefined();
      expect(result.slots.email?.value).toBe('john@example.com');
    });
  });

  describe('Sentiment Analysis', () => {
    test('should detect positive sentiment', async () => {
      const result = await service.analyzeSentiment('Thank you so much! You are amazing!');

      expect(result.sentiment).toBe('positive');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should detect negative sentiment', async () => {
      const result = await service.analyzeSentiment('This is terrible! I hate it!');

      expect(result.sentiment).toBe('negative');
    });

    test('should detect neutral sentiment', async () => {
      const result = await service.analyzeSentiment('The meeting is at 3pm.');

      expect(result.sentiment).toBe('neutral');
    });

    test('should return sentiment scores', async () => {
      const result = await service.analyzeSentiment('Great service!');

      expect(result.scores.positive).toBeGreaterThan(0);
      expect(result.scores.neutral).toBeGreaterThanOrEqual(0);
      expect(result.scores.negative).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Tool Management', () => {
    test('should register a tool', async () => {
      const tool = await service.registerTool({
        name: 'weather',
        description: 'Get weather information',
        parameters: [
          { name: 'location', type: 'string', description: 'City name', required: true },
        ],
        returns: { type: 'string', description: 'Weather info' },
        isAsync: true,
      });

      expect(tool.toolId).toBeDefined();
      expect(tool.name).toBe('weather');
    });

    test('should get registered tools', async () => {
      await service.registerTool({
        name: 'search',
        description: 'Search something',
        parameters: [],
        returns: { type: 'void', description: '' },
        isAsync: false,
      });

      const tools = await service.getTools();
      expect(tools.length).toBeGreaterThan(0);
    });

    test('should unregister a tool', async () => {
      const tool = await service.registerTool({
        name: 'temp_tool',
        description: 'Temporary',
        parameters: [],
        returns: { type: 'void', description: '' },
        isAsync: false,
      });

      await service.unregisterTool(tool.toolId);

      const tools = await service.getTools();
      expect(tools.some((t) => t.toolId === tool.toolId)).toBe(false);
    });

    test('should execute tool with handler', async () => {
      const tool = await service.registerTool({
        name: 'calculator',
        description: 'Add two numbers',
        parameters: [
          { name: 'a', type: 'number', description: 'First number', required: true },
          { name: 'b', type: 'number', description: 'Second number', required: true },
        ],
        returns: { type: 'number', description: 'Sum' },
        isAsync: true,
      });

      service.registerToolHandler('calculator', async (args) => {
        return (args.a as number) + (args.b as number);
      });

      const result = await service.executeTool(tool.toolId, { a: 5, b: 3 });

      expect(result.success).toBe(true);
      expect(result.output).toBe(8);
    });

    test('should throw error for tool without handler', async () => {
      const tool = await service.registerTool({
        name: 'orphan',
        description: 'No handler',
        parameters: [],
        returns: { type: 'void', description: '' },
        isAsync: false,
      });

      await expect(service.executeTool(tool.toolId, {})).rejects.toThrow('No handler registered');
    });
  });

  describe('Conversation Branches', () => {
    test('should create a branch', async () => {
      const conversation = await service.createConversation('user123');
      const branch = await service.createBranch(conversation.conversationId, 'alternative_path');

      expect(branch.branchId).toBeDefined();
      expect(branch.name).toBe('alternative_path');
    });

    test('should switch to a branch', async () => {
      const conversation = await service.createConversation('user123');
      const branch = await service.createBranch(conversation.conversationId, 'new_path');

      const updated = await service.switchBranch(conversation.conversationId, branch.branchId);

      expect(updated.activeBranchId).toBe(branch.branchId);
    });

    test('should throw error for non-existent branch', async () => {
      const conversation = await service.createConversation('user123');

      await expect(service.switchBranch(conversation.conversationId, 'non_existent')).rejects.toThrow();
    });

    test('should merge branches', async () => {
      const conversation = await service.createConversation('user123');
      const branch = await service.createBranch(conversation.conversationId, 'mergeable');

      const updated = await service.mergeBranch(conversation.conversationId, branch.branchId);

      expect(updated.branches).not.toContain(branch.branchId);
    });

    test('should throw error when max branches reached', async () => {
      const conversation = await service.createConversation('user123');

      for (let i = 0; i < 5; i++) {
        await service.createBranch(conversation.conversationId, `branch_${i}`);
      }

      await expect(service.createBranch(conversation.conversationId, 'overflow')).rejects.toThrow();
    });
  });

  describe('Conversation Ending', () => {
    test('should end conversation', async () => {
      const conversation = await service.createConversation('user123');
      const ended = await service.endConversation(conversation.conversationId);

      expect(ended.state).toBe('completed');
    });

    test('should escalate conversation', async () => {
      const conversation = await service.createConversation('user123');
      const escalated = await service.escalateConversation(conversation.conversationId, 'user requested human');

      expect(escalated.state).toBe('escalated');
    });

    test('should add system message when escalating', async () => {
      const conversation = await service.createConversation('user123');
      await service.escalateConversation(conversation.conversationId, 'reason');

      const messages = await service.getMessages(conversation.conversationId);
      const systemMessages = messages.filter((m) => m.role === 'system');

      expect(systemMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Analytics', () => {
    test('should track sentiment history', async () => {
      const conversation = await service.createConversation('user123');
      await service.sendMessage(conversation.conversationId, 'I love this service!');

      const analytics = await service.getAnalytics(conversation.conversationId);

      expect(analytics.sentimentHistory.length).toBeGreaterThan(0);
    });

    test('should track turn count', async () => {
      const conversation = await service.createConversation('user123');
      await service.sendMessage(conversation.conversationId, 'hello');
      await service.sendMessage(conversation.conversationId, 'help');

      const analytics = await service.getAnalytics(conversation.conversationId);

      expect(analytics.turnCount).toBe(2);
    });

    test('should track message count', async () => {
      const conversation = await service.createConversation('user123');
      await service.sendMessage(conversation.conversationId, 'hello');

      const analytics = await service.getAnalytics(conversation.conversationId);

      expect(analytics.messageCount).toBeGreaterThan(0);
    });

    test('should get aggregate analytics', async () => {
      await service.createConversation('user1');
      await service.createConversation('user2');

      const aggregate = await service.getAggregateAnalytics({
        period: { start: new Date(0), end: new Date() },
        metrics: ['turnCount', 'messageCount'],
      });

      expect(aggregate.totalConversations).toBeGreaterThan(0);
    });
  });

  describe('Context Window', () => {
    test('should return context window', async () => {
      const conversation = await service.createConversation('user123');
      await service.sendMessage(conversation.conversationId, 'hello');

      const window = service.getContextWindow(conversation.conversationId);

      expect(window.conversationId).toBe(conversation.conversationId);
      expect(window.messages).toBeDefined();
      expect(window.totalTokens).toBeGreaterThanOrEqual(0);
    });

    test('should indicate overflow', async () => {
      const customService = new ChatbotServiceImpl({ maxContextWindow: 3 });
      const conversation = await customService.createConversation('user123');

      for (let i = 0; i < 5; i++) {
        await customService.sendMessage(conversation.conversationId, `message ${i}`);
      }

      const window = customService.getContextWindow(conversation.conversationId);
      expect(window.isOverflowing).toBe(true);
    });
  });
});

describe('ChatbotManus', () => {
  let manus: ChatbotManus;

  beforeEach(() => {
    manus = new ChatbotManus();
  });

  test('should start a conversation', async () => {
    const conversation = await manus.startConversation('user123');
    expect(conversation.conversationId).toBeDefined();
  });

  test('should send chat message', async () => {
    const conversation = await manus.startConversation('user123');
    const response = await manus.chat(conversation.conversationId, 'hello');

    expect(response.message.content).toBeTruthy();
  });

  test('should get conversation history', async () => {
    const conversation = await manus.startConversation('user123');
    await manus.chat(conversation.conversationId, 'hello');

    const history = await manus.getHistory(conversation.conversationId);
    expect(history.length).toBeGreaterThan(0);
  });

  test('should end conversation', async () => {
    const conversation = await manus.startConversation('user123');
    const ended = await manus.endConversation(conversation.conversationId);

    expect(ended.state).toBe('completed');
  });

  test('should escalate conversation', async () => {
    const conversation = await manus.startConversation('user123');
    const escalated = await manus.escalate(conversation.conversationId, 'need help');

    expect(escalated.state).toBe('escalated');
  });

  test('should analyze sentiment', async () => {
    const result = await manus.analyzeSentiment('This is great!');
    expect(result.sentiment).toBe('positive');
  });

  test('should extract entities', async () => {
    const result = await manus.extractEntities('Email me at test@example.com');
    expect(result.entities.length).toBeGreaterThan(0);
  });

  test('should create branch', async () => {
    const conversation = await manus.startConversation('user123');
    const branch = await manus.createBranch(conversation.conversationId, 'alt_path');

    expect(branch.branchId).toBeDefined();
  });

  test('should switch branch', async () => {
    const conversation = await manus.startConversation('user123');
    const branch = await manus.createBranch(conversation.conversationId, 'path');
    await manus.switchBranch(conversation.conversationId, branch.branchId);

    const updated = await manus.getConversation(conversation.conversationId);
    expect(updated?.activeBranchId).toBe(branch.branchId);
  });

  test('should get analytics', async () => {
    const conversation = await manus.startConversation('user123');
    await manus.chat(conversation.conversationId, 'hello');

    const analytics = await manus.getAnalytics(conversation.conversationId);
    expect(analytics.conversationId).toBe(conversation.conversationId);
  });

  test('should greet', async () => {
    const conversation = await manus.startConversation('user123');
    const response = await manus.greet(conversation.conversationId);

    expect(response.message.role).toBe('assistant');
  });

  test('should request help', async () => {
    const conversation = await manus.startConversation('user123');
    const response = await manus.requestHelp(conversation.conversationId);

    expect(response.message.content).toBeTruthy();
  });

  test('should say goodbye', async () => {
    const conversation = await manus.startConversation('user123');
    const response = await manus.sayGoodbye(conversation.conversationId);

    expect(response.message.content).toBeTruthy();
  });
});
