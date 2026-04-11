import {
  InMemoryEventStore,
  InMemorySnapshotStore,
  EventVersionManager,
  AggregateRepository,
  ProjectionBuilder,
  ProjectionEngine,
  CommandBus,
  QueryBus,
  EventReplayService,
  CQRSService,
  createCQRSService,
  DomainEvent,
  Command,
  Query,
  Snapshot,
  AggregateType,
  AccountAggregate,
  OrderAggregate,
  InventoryAggregate,
  AccountCreated,
  AccountUpdated,
  isAggregateType,
  isEventType,
  isDomainEvent,
  isCommand,
  isQuery,
  isSnapshot,
  generateEventId,
  getAccountInitialState,
  getOrderInitialState,
  getInventoryInitialState,
  getInitialStateForAggregate,
  DEFAULT_EVENT_STORE_CONFIG,
} from '../src/core/eventSourcing';

describe('EventSourcing Module', () => {
  describe('Type Guards', () => {
    test('isAggregateType validates correct aggregate types', () => {
      expect(isAggregateType('account')).toBe(true);
      expect(isAggregateType('order')).toBe(true);
      expect(isAggregateType('inventory')).toBe(true);
    });

    test('isAggregateType rejects invalid aggregate types', () => {
      expect(isAggregateType('user')).toBe(false);
      expect(isAggregateType('')).toBe(false);
      expect(isAggregateType(null)).toBe(false);
      expect(isAggregateType(undefined)).toBe(false);
    });

    test('isEventType validates correct event types', () => {
      expect(isEventType('created')).toBe(true);
      expect(isEventType('updated')).toBe(true);
      expect(isEventType('deleted')).toBe(true);
    });

    test('isEventType rejects invalid event types', () => {
      expect(isEventType('modified')).toBe(false);
      expect(isEventType('')).toBe(false);
      expect(isEventType(null)).toBe(false);
    });

    test('isDomainEvent validates correct domain events', () => {
      const event: DomainEvent = {
        id: 'EVT_test123',
        aggregateId: 'AGG_123',
        aggregateType: 'account',
        eventType: 'created',
        eventVersion: 1,
        payload: { accountId: 'ACC_123', name: 'Test', email: 'test@test.com', initialBalance: 100 },
        timestamp: new Date(),
      };
      expect(isDomainEvent(event)).toBe(true);
    });

    test('isDomainEvent rejects invalid domain events', () => {
      expect(isDomainEvent(null)).toBe(false);
      expect(isDomainEvent({})).toBe(false);
      expect(isDomainEvent({ id: 'test' })).toBe(false);
    });

    test('isCommand validates correct commands', () => {
      const command: Command = {
        id: 'CMD_test123',
        aggregateId: 'AGG_123',
        aggregateType: 'account',
        commandType: 'CreateAccount',
        payload: { name: 'Test' },
        timestamp: new Date(),
      };
      expect(isCommand(command)).toBe(true);
    });

    test('isCommand rejects invalid commands', () => {
      expect(isCommand(null)).toBe(false);
      expect(isCommand({})).toBe(false);
    });

    test('isQuery validates correct queries', () => {
      const query: Query = {
        id: 'QRY_test123',
        queryType: 'GetAccount',
        timestamp: new Date(),
      };
      expect(isQuery(query)).toBe(true);
    });

    test('isQuery rejects invalid queries', () => {
      expect(isQuery(null)).toBe(false);
      expect(isQuery({})).toBe(false);
    });

    test('isSnapshot validates correct snapshots', () => {
      const snapshot: Snapshot = {
        id: 'SNAP_test123',
        aggregateId: 'AGG_123',
        aggregateType: 'account',
        version: 1,
        state: { accountId: 'ACC_123', name: 'Test', email: 'test@test.com', balance: 100, version: 1, createdAt: new Date(), updatedAt: new Date() },
        timestamp: new Date(),
      };
      expect(isSnapshot(snapshot)).toBe(true);
    });
  });

  describe('ID Generation', () => {
    test('generateEventId creates unique IDs with prefix', () => {
      const id1 = generateEventId('EVT');
      const id2 = generateEventId('EVT');
      expect(id1.startsWith('EVT_')).toBe(true);
      expect(id2.startsWith('EVT_')).toBe(true);
      expect(id1).not.toBe(id2);
    });

    test('generateEventId creates IDs with correct length', () => {
      const id = generateEventId('TEST');
      const parts = id.split('_');
      expect(parts[0]).toBe('TEST');
      expect(parts[1].length).toBe(16);
    });
  });

  describe('Initial State Functions', () => {
    test('getAccountInitialState returns correct initial state', () => {
      const state = getAccountInitialState();
      expect(state.accountId).toBe('');
      expect(state.name).toBe('');
      expect(state.email).toBe('');
      expect(state.balance).toBe(0);
      expect(state.version).toBe(0);
    });

    test('getOrderInitialState returns correct initial state', () => {
      const state = getOrderInitialState();
      expect(state.orderId).toBe('');
      expect(state.productId).toBe('');
      expect(state.quantity).toBe(0);
      expect(state.price).toBe(0);
      expect(state.status).toBe('pending');
      expect(state.version).toBe(0);
    });

    test('getInventoryInitialState returns correct initial state', () => {
      const state = getInventoryInitialState();
      expect(state.inventoryId).toBe('');
      expect(state.productId).toBe('');
      expect(state.productName).toBe('');
      expect(state.quantity).toBe(0);
      expect(state.warehouseId).toBe('');
      expect(state.version).toBe(0);
    });

    test('getInitialStateForAggregate returns correct state for each aggregate type', () => {
      const accountState = getInitialStateForAggregate('account') as AccountAggregate;
      expect(accountState.accountId).toBe('');
      expect(accountState.name).toBe('');
      expect(accountState.email).toBe('');
      expect(accountState.balance).toBe(0);
      expect(accountState.version).toBe(0);

      const orderState = getInitialStateForAggregate('order') as OrderAggregate;
      expect(orderState.orderId).toBe('');
      expect(orderState.productId).toBe('');
      expect(orderState.quantity).toBe(0);
      expect(orderState.status).toBe('pending');
      expect(orderState.version).toBe(0);

      const inventoryState = getInitialStateForAggregate('inventory') as InventoryAggregate;
      expect(inventoryState.inventoryId).toBe('');
      expect(inventoryState.productId).toBe('');
      expect(inventoryState.productName).toBe('');
      expect(inventoryState.quantity).toBe(0);
      expect(inventoryState.version).toBe(0);
    });

    test('getInitialStateForAggregate throws for unknown aggregate type', () => {
      expect(() => getInitialStateForAggregate('user' as AggregateType)).toThrow('Unknown aggregate type');
    });
  });

  describe('InMemoryEventStore', () => {
    let eventStore: InMemoryEventStore;

    beforeEach(() => {
      eventStore = new InMemoryEventStore();
    });

    test('append adds event to store', () => {
      const event: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'created',
        eventVersion: 1,
        payload: { accountId: 'ACC_123', name: 'Test', email: 'test@test.com', initialBalance: 100 },
        timestamp: new Date(),
      };
      eventStore.append(event);
      expect(eventStore.size()).toBe(1);
    });

    test('getEvents returns events for aggregate in order', () => {
      const event1: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'created',
        eventVersion: 1,
        payload: {},
        timestamp: new Date('2024-01-01'),
      };
      const event2: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'updated',
        eventVersion: 2,
        payload: {},
        timestamp: new Date('2024-01-02'),
      };
      eventStore.append(event2);
      eventStore.append(event1);
      const events = eventStore.getEvents('ACC_123');
      expect(events.length).toBe(2);
      expect(events[0].eventVersion).toBe(1);
      expect(events[1].eventVersion).toBe(2);
    });

    test('getEventById returns correct event', () => {
      const event: DomainEvent = {
        id: 'EVT_test123',
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'created',
        eventVersion: 1,
        payload: {},
        timestamp: new Date(),
      };
      eventStore.append(event);
      const found = eventStore.getEventById('EVT_test123');
      expect(found).not.toBeNull();
      expect(found?.id).toBe('EVT_test123');
    });

    test('getEventById returns null for non-existent event', () => {
      const found = eventStore.getEventById('NON_EXISTENT');
      expect(found).toBeNull();
    });

    test('getEventsByCorrelationId returns correlated events', () => {
      const event: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'created',
        eventVersion: 1,
        payload: {},
        timestamp: new Date(),
        correlationId: 'CORR_123',
      };
      eventStore.append(event);
      const events = eventStore.getEventsByCorrelationId('CORR_123');
      expect(events.length).toBe(1);
    });

    test('clear removes all events', () => {
      const event: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'created',
        eventVersion: 1,
        payload: {},
        timestamp: new Date(),
      };
      eventStore.append(event);
      eventStore.clear();
      expect(eventStore.size()).toBe(0);
    });
  });

  describe('InMemorySnapshotStore', () => {
    let snapshotStore: InMemorySnapshotStore;

    beforeEach(() => {
      snapshotStore = new InMemorySnapshotStore(3);
    });

    test('save adds snapshot to store', () => {
      const snapshot: Snapshot = {
        id: generateEventId('SNAP'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        version: 1,
        state: { accountId: 'ACC_123', name: 'Test', email: 'test@test.com', balance: 100, version: 1, createdAt: new Date(), updatedAt: new Date() },
        timestamp: new Date(),
      };
      snapshotStore.save(snapshot);
      const found = snapshotStore.get('ACC_123');
      expect(found).not.toBeNull();
      expect(found?.version).toBe(1);
    });

    test('get returns latest snapshot when no version specified', () => {
      const snapshot1: Snapshot = {
        id: generateEventId('SNAP'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        version: 1,
        state: {},
        timestamp: new Date('2024-01-01'),
      };
      const snapshot2: Snapshot = {
        id: generateEventId('SNAP'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        version: 2,
        state: {},
        timestamp: new Date('2024-01-02'),
      };
      snapshotStore.save(snapshot1);
      snapshotStore.save(snapshot2);
      const latest = snapshotStore.getLatest('ACC_123');
      expect(latest?.version).toBe(2);
    });

    test('prune removes old snapshots when limit exceeded', () => {
      for (let i = 1; i <= 5; i++) {
        const snapshot: Snapshot = {
          id: generateEventId('SNAP'),
          aggregateId: 'ACC_123',
          aggregateType: 'account',
          version: i,
          state: {},
          timestamp: new Date(),
        };
        snapshotStore.save(snapshot);
      }
      const latest = snapshotStore.getLatest('ACC_123');
      expect(latest?.version).toBe(5);
      const allSnapshots: Snapshot[] = [];
      let snap = snapshotStore.get('ACC_123', 1);
      while (snap) {
        allSnapshots.push(snap);
        snap = snapshotStore.get('ACC_123', snap.version + 1);
      }
      expect(allSnapshots.length).toBeLessThanOrEqual(3);
    });

    test('clearForAggregate removes all snapshots for aggregate', () => {
      const snapshot: Snapshot = {
        id: generateEventId('SNAP'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        version: 1,
        state: {},
        timestamp: new Date(),
      };
      snapshotStore.save(snapshot);
      snapshotStore.clearForAggregate('ACC_123');
      const found = snapshotStore.get('ACC_123');
      expect(found).toBeNull();
    });
  });

  describe('EventVersionManager', () => {
    let versionManager: EventVersionManager;

    beforeEach(() => {
      versionManager = new EventVersionManager();
    });

    test('registerUpgrader stores upgrader function', () => {
      const upgrader = (event: DomainEvent): DomainEvent => ({
        ...event,
        eventVersion: event.eventVersion + 1,
      });
      versionManager.registerUpgrader('account', 2, upgrader);
    });

    test('upgrade applies upgraders in sequence', () => {
      let upgradeCount = 0;
      const upgrader1 = (event: DomainEvent): DomainEvent => {
        upgradeCount++;
        return { ...event, eventVersion: event.eventVersion + 1 };
      };
      versionManager.registerUpgrader('account', 2, upgrader1);
      const event: DomainEvent = {
        id: 'EVT_test',
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'created',
        eventVersion: 1,
        payload: {},
        timestamp: new Date(),
      };
      const upgraded = versionManager.upgrade(event, 2);
      expect(upgradeCount).toBe(1);
      expect(upgraded.eventVersion).toBe(2);
    });

    test('upgrade returns original event if no upgraders registered', () => {
      const event: DomainEvent = {
        id: 'EVT_test',
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'created',
        eventVersion: 1,
        payload: {},
        timestamp: new Date(),
      };
      const upgraded = versionManager.upgrade(event, 2);
      expect(upgraded.eventVersion).toBe(1);
    });
  });

  describe('AggregateRepository', () => {
    let eventStore: InMemoryEventStore;
    let snapshotStore: InMemorySnapshotStore;
    let versionManager: EventVersionManager;
    let repository: AggregateRepository;

    beforeEach(() => {
      eventStore = new InMemoryEventStore();
      snapshotStore = new InMemorySnapshotStore(10);
      versionManager = new EventVersionManager();
      repository = new AggregateRepository(eventStore, snapshotStore, versionManager, 5);
    });

    test('save stores events and creates snapshot at interval', () => {
      const accountState: AccountAggregate = {
        accountId: 'ACC_123',
        name: 'Test',
        email: 'test@test.com',
        balance: 100,
        version: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const event: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'updated',
        eventVersion: 5,
        payload: {},
        timestamp: new Date(),
      };
      eventStore.append(event);
      repository.save(accountState, [event]);
      const snapshot = snapshotStore.getLatest('ACC_123');
      expect(snapshot).not.toBeNull();
      expect(snapshot?.version).toBe(5);
    });

    test('getById rebuilds aggregate from events', () => {
      const createdEvent: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'created',
        eventVersion: 1,
        payload: { accountId: 'ACC_123', name: 'Test', email: 'test@test.com', initialBalance: 100 } as AccountCreated,
        timestamp: new Date(),
      };
      const updatedEvent: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'updated',
        eventVersion: 2,
        payload: { name: 'Updated' } as AccountUpdated,
        timestamp: new Date(),
      };
      eventStore.append(createdEvent);
      eventStore.append(updatedEvent);
      const aggregate = repository.getById('ACC_123', 'account');
      expect(aggregate).not.toBeNull();
      expect((aggregate as AccountAggregate).name).toBe('Updated');
    });

    test('exists returns true for existing aggregate', () => {
      const event: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'created',
        eventVersion: 1,
        payload: {},
        timestamp: new Date(),
      };
      eventStore.append(event);
      expect(repository.exists('ACC_123')).toBe(true);
    });

    test('exists returns false for non-existing aggregate', () => {
      expect(repository.exists('NON_EXISTENT')).toBe(false);
    });
  });

  describe('ProjectionBuilder', () => {
    test('build creates handler function', () => {
      const builder = new ProjectionBuilder<AccountAggregate>('testProjection');
      const handler = builder.on('created', (state, event) => ({
        ...state,
        name: (event.payload as AccountCreated).name,
      })).build();
      expect(typeof handler).toBe('function');
    });

    test('on chains multiple event handlers', () => {
      const builder = new ProjectionBuilder<AccountAggregate>('testProjection');
      builder.on('created', (_state, _event) => getAccountInitialState());
      builder.on('updated', (_state, _event) => getAccountInitialState());
      expect(builder.getProjectionId()).toBe('testProjection');
    });
  });

  describe('ProjectionEngine', () => {
    let engine: ProjectionEngine;

    beforeEach(() => {
      engine = new ProjectionEngine();
    });

    test('registerProjection stores projection handler', () => {
      engine.registerProjection('testProjection', (state, _event) => state);
      const result = engine.getState('testProjection', 'AGG_123');
      expect(result).toBeNull();
    });

    test('project updates state for all projections', () => {
      const projectedEvents: DomainEvent[] = [];
      engine.registerProjection('testProjection', (state, event) => {
        projectedEvents.push(event);
        return state;
      });
      const event: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'created',
        eventVersion: 1,
        payload: {},
        timestamp: new Date(),
      };
      engine.project(event);
      expect(projectedEvents.length).toBe(1);
    });

    test('replay resets and replays events', () => {
      const projectedEvents: DomainEvent[] = [];
      engine.registerProjection('testProjection', (state, event) => {
        projectedEvents.push(event);
        return state;
      });
      const events: DomainEvent[] = [
        {
          id: generateEventId('EVT'),
          aggregateId: 'ACC_123',
          aggregateType: 'account',
          eventType: 'created',
          eventVersion: 1,
          payload: {},
          timestamp: new Date(),
        },
        {
          id: generateEventId('EVT'),
          aggregateId: 'ACC_123',
          aggregateType: 'account',
          eventType: 'updated',
          eventVersion: 2,
          payload: {},
          timestamp: new Date(),
        },
      ];
      engine.replay(events, 0);
      expect(projectedEvents.length).toBe(2);
    });
  });

  describe('CommandBus', () => {
    let commandBus: CommandBus;

    beforeEach(() => {
      commandBus = new CommandBus();
    });

    test('registerHandler stores command handler', () => {
      commandBus.registerHandler('CreateAccount', (_cmd) => []);
      expect(commandBus.hasHandler('CreateAccount')).toBe(true);
    });

    test('execute calls registered handler', () => {
      let handlerCalled = false;
      commandBus.registerHandler('CreateAccount', (_cmd) => {
        handlerCalled = true;
        return [];
      });
      const command: Command = {
        id: generateEventId('CMD'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        commandType: 'CreateAccount',
        payload: {},
        timestamp: new Date(),
      };
      commandBus.execute(command);
      expect(handlerCalled).toBe(true);
    });

    test('execute throws for unregistered handler', () => {
      const command: Command = {
        id: generateEventId('CMD'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        commandType: 'NonExistent',
        payload: {},
        timestamp: new Date(),
      };
      expect(() => commandBus.execute(command)).toThrow('No handler for command type');
    });
  });

  describe('QueryBus', () => {
    let queryBus: QueryBus;

    beforeEach(() => {
      queryBus = new QueryBus();
    });

    test('registerHandler stores query handler', () => {
      queryBus.registerHandler('GetAccount', (_query) => ({}));
      expect(queryBus.hasHandler('GetAccount')).toBe(true);
    });

    test('execute calls registered handler and returns result', () => {
      queryBus.registerHandler('GetAccount', (_query) => ({ name: 'Test' }));
      const query: Query = {
        id: generateEventId('QRY'),
        queryType: 'GetAccount',
        timestamp: new Date(),
      };
      const result = queryBus.execute(query);
      expect(result).toEqual({ name: 'Test' });
    });

    test('execute throws for unregistered query', () => {
      const query: Query = {
        id: generateEventId('QRY'),
        queryType: 'NonExistent',
        timestamp: new Date(),
      };
      expect(() => queryBus.execute(query)).toThrow('No handler for query type');
    });
  });

  describe('EventReplayService', () => {
    let eventStore: InMemoryEventStore;
    let versionManager: EventVersionManager;
    let replayService: EventReplayService;

    beforeEach(() => {
      eventStore = new InMemoryEventStore();
      versionManager = new EventVersionManager();
      replayService = new EventReplayService(eventStore, versionManager);
    });

    test('replayToVersion returns events up to target version', () => {
      const event1: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'created',
        eventVersion: 1,
        payload: {},
        timestamp: new Date(),
      };
      const event2: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'updated',
        eventVersion: 2,
        payload: {},
        timestamp: new Date(),
      };
      eventStore.append(event1);
      eventStore.append(event2);
      const events = replayService.replayToVersion('ACC_123', 1);
      expect(events.length).toBe(1);
      expect(events[0].eventVersion).toBe(1);
    });

    test('replayFromDate returns events from specified date', () => {
      const oldEvent: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'created',
        eventVersion: 1,
        payload: {},
        timestamp: new Date('2024-01-01'),
      };
      const newEvent: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'updated',
        eventVersion: 2,
        payload: {},
        timestamp: new Date('2024-01-15'),
      };
      eventStore.append(oldEvent);
      eventStore.append(newEvent);
      const events = replayService.replayFromDate('ACC_123', new Date('2024-01-10'));
      expect(events.length).toBe(1);
      expect(events[0].eventVersion).toBe(2);
    });

    test('getVersionAtDate returns correct version', () => {
      const event1: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'created',
        eventVersion: 1,
        payload: {},
        timestamp: new Date('2024-01-01'),
      };
      const event2: DomainEvent = {
        id: generateEventId('EVT'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        eventType: 'updated',
        eventVersion: 2,
        payload: {},
        timestamp: new Date('2024-01-15'),
      };
      eventStore.append(event1);
      eventStore.append(event2);
      const version = replayService.getVersionAtDate('ACC_123', new Date('2024-01-10'));
      expect(version).toBe(1);
    });
  });

  describe('CQRSService Integration', () => {
    let cqrsService: CQRSService;

    beforeEach(() => {
      cqrsService = createCQRSService({ snapshotInterval: 3, enableSnapshots: true });
    });

    afterEach(() => {
      cqrsService.clear();
    });

    test('createCQRSService creates service with default config', () => {
      const service = createCQRSService();
      expect(service).toBeInstanceOf(CQRSService);
      service.clear();
    });

    test('registerCommandHandler and executeCommand work together', () => {
      cqrsService.registerCommandHandler('CreateAccount', (cmd) => {
        const payload = cmd.payload as AccountCreated;
        return [{
          id: generateEventId('EVT'),
          aggregateId: cmd.aggregateId,
          aggregateType: cmd.aggregateType,
          eventType: 'created',
          eventVersion: 1,
          payload,
          timestamp: new Date(),
        }];
      });
      const command: Command = {
        id: generateEventId('CMD'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        commandType: 'CreateAccount',
        payload: { accountId: 'ACC_123', name: 'Test', email: 'test@test.com', initialBalance: 100 },
        timestamp: new Date(),
      };
      const events = cqrsService.executeCommand(command);
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('created');
    });

    test('registerQueryHandler and executeQuery work together', () => {
      cqrsService.registerQueryHandler('GetAccount', (_query) => ({ name: 'Test Account' }));
      const query: Query = {
        id: generateEventId('QRY'),
        queryType: 'GetAccount',
        timestamp: new Date(),
      };
      const result = cqrsService.executeQuery(query);
      expect(result).toEqual({ name: 'Test Account' });
    });

    test('getAggregate retrieves rebuilt aggregate', () => {
      cqrsService.registerCommandHandler('CreateAccount', (cmd) => {
        const payload = cmd.payload as AccountCreated;
        return [{
          id: generateEventId('EVT'),
          aggregateId: cmd.aggregateId,
          aggregateType: cmd.aggregateType,
          eventType: 'created',
          eventVersion: 1,
          payload,
          timestamp: new Date(),
        }];
      });
      const command: Command = {
        id: generateEventId('CMD'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        commandType: 'CreateAccount',
        payload: { accountId: 'ACC_123', name: 'Test', email: 'test@test.com', initialBalance: 100 },
        timestamp: new Date(),
      };
      cqrsService.executeCommand(command);
      const aggregate = cqrsService.getAggregate<AccountAggregate>('ACC_123', 'account');
      expect(aggregate).not.toBeNull();
      expect(aggregate?.name).toBe('Test');
    });

    test('getEvents returns events for aggregate', () => {
      cqrsService.registerCommandHandler('CreateAccount', (cmd) => {
        return [{
          id: generateEventId('EVT'),
          aggregateId: cmd.aggregateId,
          aggregateType: cmd.aggregateType,
          eventType: 'created',
          eventVersion: 1,
          payload: {},
          timestamp: new Date(),
        }];
      });
      const command: Command = {
        id: generateEventId('CMD'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        commandType: 'CreateAccount',
        payload: {},
        timestamp: new Date(),
      };
      cqrsService.executeCommand(command);
      const events = cqrsService.getEvents('ACC_123');
      expect(events.length).toBe(1);
    });

    test('registerEventUpgrader stores upgrader', () => {
      cqrsService.registerEventUpgrader('account', 2, (event) => ({
        ...event,
        eventVersion: event.eventVersion + 1,
      }));
    });

    test('registerProjection stores and executes projection', () => {
      let projectedEvent: DomainEvent | null = null;
      cqrsService.registerProjection<AccountAggregate>('testProjection', (state, event) => {
        projectedEvent = event;
        return state;
      });
      cqrsService.registerCommandHandler('CreateAccount', (cmd) => [{
        id: generateEventId('EVT'),
        aggregateId: cmd.aggregateId,
        aggregateType: cmd.aggregateType,
        eventType: 'created',
        eventVersion: 1,
        payload: {},
        timestamp: new Date(),
      }]);
      const command: Command = {
        id: generateEventId('CMD'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        commandType: 'CreateAccount',
        payload: {},
        timestamp: new Date(),
      };
      cqrsService.executeCommand(command);
      expect(projectedEvent).not.toBeNull();
    });

    test('getConfig returns configuration', () => {
      const config = cqrsService.getConfig();
      expect(config.snapshotInterval).toBe(3);
      expect(config.enableSnapshots).toBe(true);
    });

    test('replay rebuilds projections', () => {
      cqrsService.registerCommandHandler('CreateAccount', (cmd) => [{
        id: generateEventId('EVT'),
        aggregateId: cmd.aggregateId,
        aggregateType: cmd.aggregateType,
        eventType: 'created',
        eventVersion: 1,
        payload: {},
        timestamp: new Date(),
      }]);
      const command: Command = {
        id: generateEventId('CMD'),
        aggregateId: 'ACC_123',
        aggregateType: 'account',
        commandType: 'CreateAccount',
        payload: {},
        timestamp: new Date(),
      };
      cqrsService.executeCommand(command);
      cqrsService.replay('ACC_123');
    });
  });

  describe('DEFAULT_EVENT_STORE_CONFIG', () => {
    test('has correct default values', () => {
      expect(DEFAULT_EVENT_STORE_CONFIG.maxSnapshotsPerAggregate).toBe(10);
      expect(DEFAULT_EVENT_STORE_CONFIG.snapshotInterval).toBe(10);
      expect(DEFAULT_EVENT_STORE_CONFIG.eventRetentionDays).toBe(365);
      expect(DEFAULT_EVENT_STORE_CONFIG.enableSnapshots).toBe(true);
      expect(DEFAULT_EVENT_STORE_CONFIG.enableEventVersioning).toBe(true);
    });
  });

  describe('CQRSService getters', () => {
    test('getEventStore returns event store instance', () => {
      const service = createCQRSService();
      expect(service.getEventStore()).toBeInstanceOf(InMemoryEventStore);
      service.clear();
    });

    test('getSnapshotStore returns snapshot store instance', () => {
      const service = createCQRSService();
      expect(service.getSnapshotStore()).toBeInstanceOf(InMemorySnapshotStore);
      service.clear();
    });

    test('getCommandBus returns command bus instance', () => {
      const service = createCQRSService();
      expect(service.getCommandBus()).toBeInstanceOf(CommandBus);
      service.clear();
    });

    test('getQueryBus returns query bus instance', () => {
      const service = createCQRSService();
      expect(service.getQueryBus()).toBeInstanceOf(QueryBus);
      service.clear();
    });
  });
});
