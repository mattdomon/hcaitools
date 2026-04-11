export type AggregateType = 'account' | 'order' | 'inventory';

export type EventType = 'created' | 'updated' | 'deleted';

export interface DomainEvent<T = unknown> {
  id: string;
  aggregateId: string;
  aggregateType: AggregateType;
  eventType: EventType;
  eventVersion: number;
  payload: T;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  causationId?: string;
  correlationId?: string;
}

export interface Command {
  id: string;
  aggregateId: string;
  aggregateType: AggregateType;
  commandType: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  correlationId?: string;
}

export interface Query {
  id: string;
  queryType: string;
  aggregateType?: AggregateType;
  aggregateId?: string;
  filters?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface Snapshot<T = unknown> {
  id: string;
  aggregateId: string;
  aggregateType: AggregateType;
  version: number;
  state: T;
  timestamp: Date;
}

export interface EventVersion {
  version: number;
  eventType: EventType;
  upgradedEvent: DomainEvent;
  migrationDate: Date;
}

export interface ProjectionResult<T = unknown> {
  projectionId: string;
  aggregateId: string;
  state: T;
  version: number;
  lastUpdated: Date;
}

export interface EventStoreConfig {
  maxSnapshotsPerAggregate: number;
  snapshotInterval: number;
  eventRetentionDays: number;
  enableSnapshots: boolean;
  enableEventVersioning: boolean;
}

export const DEFAULT_EVENT_STORE_CONFIG: EventStoreConfig = {
  maxSnapshotsPerAggregate: 10,
  snapshotInterval: 10,
  eventRetentionDays: 365,
  enableSnapshots: true,
  enableEventVersioning: true,
};

export interface AccountCreated {
  accountId: string;
  name: string;
  email: string;
  initialBalance: number;
}

export interface AccountUpdated {
  accountId?: string;
  name?: string;
  email?: string;
  balance?: number;
}

export interface OrderCreated {
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  customerId: string;
}

export interface OrderUpdated {
  orderId?: string;
  status?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  quantity?: number;
  price?: number;
}

export interface InventoryCreated {
  inventoryId: string;
  productId: string;
  productName: string;
  quantity: number;
  warehouseId: string;
}

export interface InventoryUpdated {
  inventoryId?: string;
  productId?: string;
  productName?: string;
  quantity?: number;
  warehouseId?: string;
}

export interface AccountAggregate {
  accountId: string;
  name: string;
  email: string;
  balance: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderAggregate {
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  customerId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryAggregate {
  inventoryId: string;
  productId: string;
  productName: string;
  quantity: number;
  warehouseId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type AggregateState = AccountAggregate | OrderAggregate | InventoryAggregate;

export interface EventUpgrader {
  (event: DomainEvent): DomainEvent;
}

export const EVENT_STORE_ERROR_CODES = {
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  AGGREGATE_NOT_FOUND: 'AGGREGATE_NOT_FOUND',
  SNAPSHOT_NOT_FOUND: 'SNAPSHOT_NOT_FOUND',
  INVALID_EVENT_VERSION: 'INVALID_EVENT_VERSION',
  COMMAND_HANDLING_FAILED: 'COMMAND_HANDLING_FAILED',
  PROJECTION_FAILED: 'PROJECTION_FAILED',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  INVALID_AGGREGATE_TYPE: 'INVALID_AGGREGATE_TYPE',
} as const;

export interface EventStoreError extends Error {
  code: (typeof EVENT_STORE_ERROR_CODES)[keyof typeof EVENT_STORE_ERROR_CODES];
  originalError?: Error;
}

export function isAggregateType(value: unknown): value is AggregateType {
  return typeof value === 'string' && ['account', 'order', 'inventory'].includes(value as AggregateType);
}

export function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && ['created', 'updated', 'deleted'].includes(value as EventType);
}

export function isDomainEvent(value: unknown): value is DomainEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const event = value as DomainEvent;
  return (
    typeof event.id === 'string' &&
    typeof event.aggregateId === 'string' &&
    isAggregateType(event.aggregateType) &&
    isEventType(event.eventType) &&
    typeof event.eventVersion === 'number' &&
    event.payload !== undefined &&
    event.timestamp instanceof Date
  );
}

export function isCommand(value: unknown): value is Command {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const cmd = value as Command;
  return (
    typeof cmd.id === 'string' &&
    typeof cmd.aggregateId === 'string' &&
    isAggregateType(cmd.aggregateType) &&
    typeof cmd.commandType === 'string' &&
    cmd.payload !== undefined &&
    cmd.timestamp instanceof Date
  );
}

export function isQuery(value: unknown): value is Query {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const query = value as Query;
  return typeof query.id === 'string' && typeof query.queryType === 'string' && query.timestamp instanceof Date;
}

export function isSnapshot(value: unknown): value is Snapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const snap = value as Snapshot;
  return (
    typeof snap.id === 'string' &&
    typeof snap.aggregateId === 'string' &&
    isAggregateType(snap.aggregateType) &&
    typeof snap.version === 'number' &&
    snap.state !== undefined &&
    snap.timestamp instanceof Date
  );
}

export function generateEventId(prefix: string = 'EVT'): string {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return `${prefix}_${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

export function getAccountInitialState(): AccountAggregate {
  return {
    accountId: '',
    name: '',
    email: '',
    balance: 0,
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function getOrderInitialState(): OrderAggregate {
  return {
    orderId: '',
    productId: '',
    quantity: 0,
    price: 0,
    customerId: '',
    status: 'pending',
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function getInventoryInitialState(): InventoryAggregate {
  return {
    inventoryId: '',
    productId: '',
    productName: '',
    quantity: 0,
    warehouseId: '',
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function getInitialStateForAggregate(aggregateType: AggregateType): AggregateState {
  switch (aggregateType) {
    case 'account':
      return getAccountInitialState();
    case 'order':
      return getOrderInitialState();
    case 'inventory':
      return getInventoryInitialState();
    default:
      throw new Error(`Unknown aggregate type: ${aggregateType}`);
  }
}
