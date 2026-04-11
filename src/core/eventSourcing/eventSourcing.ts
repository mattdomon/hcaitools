import {
  AggregateType,
  AggregateState,
  Command,
  DomainEvent,
  EventStoreConfig,
  EventUpgrader,
  EventVersion,
  EventStoreError,
  EVENT_STORE_ERROR_CODES,
  OrderAggregate,
  OrderCreated,
  OrderUpdated,
  Query,
  Snapshot,
  AccountCreated,
  AccountUpdated,
  AccountAggregate,
  InventoryCreated,
  InventoryUpdated,
  InventoryAggregate,
  DEFAULT_EVENT_STORE_CONFIG,
  generateEventId,
  getInitialStateForAggregate,
} from './types';

export class InMemoryEventStore {
  private events: DomainEvent[] = [];
  private config: EventStoreConfig;

  constructor(config: Partial<EventStoreConfig> = {}) {
    this.config = { ...DEFAULT_EVENT_STORE_CONFIG, ...config };
  }

  append(event: DomainEvent): void {
    const newEvent: DomainEvent = {
      ...event,
      id: event.id || generateEventId('EVT'),
      timestamp: event.timestamp || new Date(),
    };
    this.events.push(newEvent);
  }

  getEvents(aggregateId: string): DomainEvent[] {
    return this.events.filter(e => e.aggregateId === aggregateId).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  getEventsByType(aggregateId: string, eventType: string): DomainEvent[] {
    return this.events.filter(e => e.aggregateId === aggregateId && e.eventType === eventType);
  }

  getEventById(id: string): DomainEvent | null {
    return this.events.find(e => e.id === id) || null;
  }

  getAllEvents(): DomainEvent[] {
    return [...this.events];
  }

  getEventsByCorrelationId(correlationId: string): DomainEvent[] {
    return this.events.filter(e => e.correlationId === correlationId);
  }

  getEventsByCausationId(causationId: string): DomainEvent[] {
    return this.events.filter(e => e.causationId === causationId);
  }

  clear(): void {
    this.events = [];
  }

  size(): number {
    return this.events.length;
  }
}

export class InMemorySnapshotStore {
  private snapshots: Snapshot[] = [];
  private maxSnapshots: number;

  constructor(maxSnapshotsPerAggregate: number = 10) {
    this.maxSnapshots = maxSnapshotsPerAggregate;
  }

  save(snapshot: Snapshot): void {
    const existingIndex = this.snapshots.findIndex(s => s.aggregateId === snapshot.aggregateId && s.version === snapshot.version);
    if (existingIndex >= 0) {
      this.snapshots[existingIndex] = snapshot;
    } else {
      this.snapshots.push(snapshot);
    }
    this.prune(snapshot.aggregateId);
  }

  get(aggregateId: string, version?: number): Snapshot | null {
    const aggregateSnapshots = this.snapshots.filter(s => s.aggregateId === aggregateId);
    if (aggregateSnapshots.length === 0) {
      return null;
    }
    if (version !== undefined) {
      return aggregateSnapshots.find(s => s.version === version) || null;
    }
    return aggregateSnapshots.sort((a, b) => b.version - a.version)[0];
  }

  getLatest(aggregateId: string): Snapshot | null {
    return this.get(aggregateId);
  }

  private prune(aggregateId: string): void {
    const aggregateSnapshots = this.snapshots.filter(s => s.aggregateId === aggregateId);
    if (aggregateSnapshots.length > this.maxSnapshots) {
      aggregateSnapshots.sort((a, b) => a.version - b.version);
      const toRemove = aggregateSnapshots.slice(0, aggregateSnapshots.length - this.maxSnapshots);
      this.snapshots = this.snapshots.filter(s => !toRemove.includes(s));
    }
  }

  clear(): void {
    this.snapshots = [];
  }

  clearForAggregate(aggregateId: string): void {
    this.snapshots = this.snapshots.filter(s => s.aggregateId !== aggregateId);
  }
}

export class EventVersionManager {
  private upgraders: Map<string, Map<number, EventUpgrader>> = new Map();

  registerUpgrader(aggregateType: AggregateType, fromVersion: number, upgrader: EventUpgrader): void {
    if (!this.upgraders.has(aggregateType)) {
      this.upgraders.set(aggregateType, new Map());
    }
    this.upgraders.get(aggregateType)!.set(fromVersion, upgrader);
  }

  upgrade(event: DomainEvent, toVersion: number = 1): DomainEvent {
    if (event.eventVersion >= toVersion) {
      return event;
    }
    const aggregateUpgraders = this.upgraders.get(event.aggregateType);
    if (!aggregateUpgraders) {
      return event;
    }
    let currentEvent = event;
    for (let v = event.eventVersion + 1; v <= toVersion; v++) {
      const upgrader = aggregateUpgraders.get(v);
      if (upgrader) {
        currentEvent = upgrader(currentEvent);
      }
    }
    return currentEvent;
  }

  getVersionHistory(_aggregateType: AggregateType): EventVersion[] {
    return [];
  }
}

export class AggregateRepository {
  private eventStore: InMemoryEventStore;
  private snapshotStore: InMemorySnapshotStore;
  private snapshotInterval: number;
  private eventVersionManager: EventVersionManager;

  constructor(
    eventStore: InMemoryEventStore,
    snapshotStore: InMemorySnapshotStore,
    eventVersionManager: EventVersionManager,
    snapshotInterval: number = 10
  ) {
    this.eventStore = eventStore;
    this.snapshotStore = snapshotStore;
    this.snapshotInterval = snapshotInterval;
    this.eventVersionManager = eventVersionManager;
  }

  save(aggregate: AggregateState, events: DomainEvent[]): void {
    if (events.length > 0) {
      const latestEvent = events[events.length - 1];
      if (latestEvent.eventVersion % this.snapshotInterval === 0) {
        this.snapshotStore.save({
          id: generateEventId('SNAP'),
          aggregateId: (aggregate as { accountId?: string; orderId?: string; inventoryId?: string }).accountId ||
            (aggregate as { accountId?: string; orderId?: string; inventoryId?: string }).orderId ||
            (aggregate as { accountId?: string; orderId?: string; inventoryId?: string }).inventoryId ||
            '',
          aggregateType: (aggregate as AggregateState & { aggregateType: AggregateType }).aggregateType || 'account',
          version: aggregate.version,
          state: aggregate,
          timestamp: new Date(),
        });
      }
    }
  }

  getById(aggregateId: string, aggregateType: AggregateType): AggregateState | null {
    const snapshot = this.snapshotStore.getLatest(aggregateId);
    let events: DomainEvent[];
    if (snapshot) {
      events = this.eventStore.getEvents(aggregateId).filter(e => e.timestamp > snapshot.timestamp);
    } else {
      events = this.eventStore.getEvents(aggregateId);
    }
    if (events.length === 0) {
      return null;
    }
    return this.rebuildAggregate(aggregateType, events, snapshot);
  }

  private rebuildAggregate(aggregateType: AggregateType, events: DomainEvent[], snapshot: Snapshot | null): AggregateState {
    let state: AggregateState;
    if (snapshot) {
      state = snapshot.state as AggregateState;
    } else {
      state = getInitialStateForAggregate(aggregateType);
    }
    for (const event of events) {
      const upgradedEvent = this.eventVersionManager.upgrade(event);
      state = this.applyEvent(state, upgradedEvent);
    }
    return state;
  }

  private applyEvent(state: AggregateState, event: DomainEvent): AggregateState {
    switch (event.aggregateType) {
      case 'account':
        return this.applyAccountEvent(state as AccountAggregate, event);
      case 'order':
        return this.applyOrderEvent(state as OrderAggregate, event);
      case 'inventory':
        return this.applyInventoryEvent(state as InventoryAggregate, event);
      default:
        return state;
    }
  }

  private applyAccountEvent(state: AccountAggregate, event: DomainEvent): AccountAggregate {
    const payload = event.payload as AccountCreated | AccountUpdated;
    switch (event.eventType) {
      case 'created':
        return { ...state, ...payload, version: event.eventVersion, createdAt: event.timestamp, updatedAt: event.timestamp };
      case 'updated':
        return { ...state, ...payload, version: event.eventVersion, updatedAt: event.timestamp };
      case 'deleted':
        return { ...state, version: event.eventVersion, updatedAt: event.timestamp };
      default:
        return state;
    }
  }

  private applyOrderEvent(state: OrderAggregate, event: DomainEvent): OrderAggregate {
    const payload = event.payload as OrderCreated | OrderUpdated;
    switch (event.eventType) {
      case 'created':
        return { ...state, ...payload, version: event.eventVersion, createdAt: event.timestamp, updatedAt: event.timestamp };
      case 'updated':
        return { ...state, ...payload, version: event.eventVersion, updatedAt: event.timestamp };
      case 'deleted':
        return { ...state, version: event.eventVersion, updatedAt: event.timestamp };
      default:
        return state;
    }
  }

  private applyInventoryEvent(state: InventoryAggregate, event: DomainEvent): InventoryAggregate {
    const payload = event.payload as InventoryCreated | InventoryUpdated;
    switch (event.eventType) {
      case 'created':
        return { ...state, ...payload, version: event.eventVersion, createdAt: event.timestamp, updatedAt: event.timestamp };
      case 'updated':
        return { ...state, ...payload, version: event.eventVersion, updatedAt: event.timestamp };
      case 'deleted':
        return { ...state, version: event.eventVersion, updatedAt: event.timestamp };
      default:
        return state;
    }
  }

  exists(aggregateId: string): boolean {
    return this.eventStore.getEvents(aggregateId).length > 0;
  }

  delete(aggregateId: string): void {
    const events = this.eventStore.getEvents(aggregateId);
    for (const event of events) {
      const index = this.eventStore.getAllEvents().findIndex(e => e.id === event.id);
      if (index >= 0) {
        this.eventStore.getAllEvents().splice(index, 1);
      }
    }
    this.snapshotStore.clearForAggregate(aggregateId);
  }
}

export class ProjectionBuilder<T extends AggregateState> {
  private projectionId: string;
  private handlers: Map<string, (state: T, event: DomainEvent) => T> = new Map();

  constructor(projectionId: string) {
    this.projectionId = projectionId;
  }

  on(eventType: string, handler: (state: T, event: DomainEvent) => T): this {
    this.handlers.set(eventType, handler);
    return this;
  }

  build(): (state: T, event: DomainEvent) => T {
    return (state: T, event: DomainEvent) => {
      const handler = this.handlers.get(event.eventType);
      if (handler) {
        return handler(state, event);
      }
      return state;
    };
  }

  getProjectionId(): string {
    return this.projectionId;
  }
}

export class ProjectionEngine {
  private projections: Map<string, (state: unknown, event: DomainEvent) => unknown> = new Map();
  private states: Map<string, unknown> = new Map();

  registerProjection<T>(projectionId: string, handler: (state: T, event: DomainEvent) => T): void {
    this.projections.set(projectionId, handler as (state: unknown, event: DomainEvent) => unknown);
  }

  project(event: DomainEvent): void {
    for (const [, handler] of this.projections) {
      const currentState = this.states.get(event.aggregateId) || null;
      const newState = handler(currentState, event);
      this.states.set(event.aggregateId, newState);
    }
  }

  getState<T>(projectionId: string, aggregateId: string): T | null {
    return (this.states.get(aggregateId) as T) || null;
  }

  getAllStates<T>(_projectionId: string): Map<string, T> {
    const result = new Map<string, T>();
    for (const [aggregateId, state] of this.states) {
      result.set(aggregateId, state as T);
    }
    return result;
  }

  replay(events: DomainEvent[], fromVersion: number = 0): void {
    this.states.clear();
    for (const event of events) {
      if (event.eventVersion > fromVersion) {
        this.project(event);
      }
    }
  }

  clear(): void {
    this.states.clear();
  }
}

export class CommandBus {
  private handlers: Map<string, (command: Command) => DomainEvent[]> = new Map();

  registerHandler(commandType: string, handler: (command: Command) => DomainEvent[]): void {
    this.handlers.set(commandType, handler);
  }

  execute(command: Command): DomainEvent[] {
    const handler = this.handlers.get(command.commandType);
    if (!handler) {
      const error = new Error(`No handler for command type: ${command.commandType}`) as EventStoreError;
      error.code = EVENT_STORE_ERROR_CODES.COMMAND_HANDLING_FAILED;
      throw error;
    }
    return handler(command);
  }

  hasHandler(commandType: string): boolean {
    return this.handlers.has(commandType);
  }
}

export class QueryBus {
  private handlers: Map<string, (query: Query) => unknown> = new Map();

  registerHandler(queryType: string, handler: (query: Query) => unknown): void {
    this.handlers.set(queryType, handler);
  }

  execute(query: Query): unknown {
    const handler = this.handlers.get(query.queryType);
    if (!handler) {
      throw new Error(`No handler for query type: ${query.queryType}`);
    }
    return handler(query);
  }

  hasHandler(queryType: string): boolean {
    return this.handlers.has(queryType);
  }
}

export class EventReplayService {
  private eventStore: InMemoryEventStore;
  private eventVersionManager: EventVersionManager;

  constructor(eventStore: InMemoryEventStore, eventVersionManager: EventVersionManager) {
    this.eventStore = eventStore;
    this.eventVersionManager = eventVersionManager;
  }

  replayToVersion(aggregateId: string, targetVersion: number): DomainEvent[] {
    const events = this.eventStore.getEvents(aggregateId);
    return events.filter(e => e.eventVersion <= targetVersion);
  }

  replayFromDate(aggregateId: string, fromDate: Date): DomainEvent[] {
    const events = this.eventStore.getEvents(aggregateId);
    return events.filter(e => e.timestamp >= fromDate);
  }

  replayAll(aggregateId: string): DomainEvent[] {
    return this.eventStore.getEvents(aggregateId);
  }

  getVersionAtDate(aggregateId: string, date: Date): number {
    const events = this.eventStore.getEvents(aggregateId).filter(e => e.timestamp <= date);
    return events.length > 0 ? events[events.length - 1].eventVersion : 0;
  }
}

export class CQRSService {
  private commandBus: CommandBus;
  private queryBus: QueryBus;
  private eventStore: InMemoryEventStore;
  private snapshotStore: InMemorySnapshotStore;
  private aggregateRepository: AggregateRepository;
  private eventVersionManager: EventVersionManager;
  private projectionEngine: ProjectionEngine;
  private config: EventStoreConfig;

  constructor(config: Partial<EventStoreConfig> = {}) {
    this.config = { ...DEFAULT_EVENT_STORE_CONFIG, ...config };
    this.commandBus = new CommandBus();
    this.queryBus = new QueryBus();
    this.eventStore = new InMemoryEventStore(this.config);
    this.snapshotStore = new InMemorySnapshotStore(this.config.maxSnapshotsPerAggregate);
    this.eventVersionManager = new EventVersionManager();
    this.projectionEngine = new ProjectionEngine();
    this.aggregateRepository = new AggregateRepository(
      this.eventStore,
      this.snapshotStore,
      this.eventVersionManager,
      this.config.snapshotInterval
    );
  }

  executeCommand(command: Command): DomainEvent[] {
    const events = this.commandBus.execute(command);
    for (const event of events) {
      this.eventStore.append(event);
      if (this.config.enableSnapshots) {
        this.aggregateRepository.save(this.rebuildAggregate(command.aggregateType, event.aggregateId), [event]);
      }
      this.projectionEngine.project(event);
    }
    return events;
  }

  executeQuery<T>(query: Query): T {
    return this.queryBus.execute(query) as T;
  }

  registerCommandHandler(commandType: string, handler: (command: Command) => DomainEvent[]): void {
    this.commandBus.registerHandler(commandType, handler);
  }

  registerQueryHandler<T>(queryType: string, handler: (query: Query) => T): void {
    this.queryBus.registerHandler(queryType, handler as (query: Query) => unknown);
  }

  registerEventUpgrader(aggregateType: AggregateType, fromVersion: number, upgrader: EventUpgrader): void {
    this.eventVersionManager.registerUpgrader(aggregateType, fromVersion, upgrader);
  }

  registerProjection<T>(projectionId: string, handler: (state: T, event: DomainEvent) => T): void {
    this.projectionEngine.registerProjection(projectionId, handler);
  }

  getAggregate<T extends AggregateState>(aggregateId: string, aggregateType: AggregateType): T | null {
    return this.aggregateRepository.getById(aggregateId, aggregateType) as T | null;
  }

  getEvents(aggregateId: string): DomainEvent[] {
    return this.eventStore.getEvents(aggregateId);
  }

  getSnapshot(aggregateId: string): Snapshot | null {
    return this.snapshotStore.getLatest(aggregateId);
  }

  replay(aggregateId: string, fromVersion?: number): void {
    const events = fromVersion !== undefined
      ? this.eventStore.getEvents(aggregateId).filter(e => e.eventVersion > fromVersion)
      : this.eventStore.getEvents(aggregateId);
    this.projectionEngine.replay(events, fromVersion || 0);
  }

  private rebuildAggregate(aggregateType: AggregateType, aggregateId: string): AggregateState {
    const state = this.aggregateRepository.getById(aggregateId, aggregateType);
    return state || getInitialStateForAggregate(aggregateType);
  }

  getConfig(): EventStoreConfig {
    return { ...this.config };
  }

  clear(): void {
    this.eventStore.clear();
    this.snapshotStore.clear();
    this.projectionEngine.clear();
  }

  getEventStore(): InMemoryEventStore {
    return this.eventStore;
  }

  getSnapshotStore(): InMemorySnapshotStore {
    return this.snapshotStore;
  }

  getCommandBus(): CommandBus {
    return this.commandBus;
  }

  getQueryBus(): QueryBus {
    return this.queryBus;
  }
}

export function createCQRSService(config?: Partial<EventStoreConfig>): CQRSService {
  return new CQRSService(config);
}
