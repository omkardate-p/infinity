export interface OrderRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface OrderSummary {
  count: number;
  total: number;
  labels: string[];
}

const ORDER_DEFAULT_LABEL = "order";

export function makeOrder(id: string, amount: number): OrderRecord {
  return {
    id,
    label: ORDER_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateOrder(record: OrderRecord): OrderRecord {
  return { ...record, active: true };
}

export function deactivateOrder(record: OrderRecord): OrderRecord {
  return { ...record, active: false };
}

export function renameOrder(record: OrderRecord, label: string): OrderRecord {
  return { ...record, label };
}

export function adjustOrder(record: OrderRecord, delta: number): OrderRecord {
  return { ...record, amount: record.amount + delta };
}

export function isOrderEmpty(record: OrderRecord): boolean {
  return record.amount === 0;
}

export function filterActiveOrders(records: OrderRecord[]): OrderRecord[] {
  return records.filter((record) => record.active);
}

export function sortOrdersByAmount(records: OrderRecord[]): OrderRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalOrderAmount(records: OrderRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseOrders(records: OrderRecord[]): OrderSummary {
  return {
    count: records.length,
    total: totalOrderAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findOrder(records: OrderRecord[], id: string): OrderRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertOrder(records: OrderRecord[], record: OrderRecord): OrderRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeOrder(records: OrderRecord[], id: string): OrderRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeOrder(record: OrderRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneOrder(record: OrderRecord): OrderRecord {
  return { ...record };
}

export function mergeOrders(left: OrderRecord[], right: OrderRecord[]): OrderRecord[] {
  return right.reduce((acc, record) => upsertOrder(acc, record), left);
}
