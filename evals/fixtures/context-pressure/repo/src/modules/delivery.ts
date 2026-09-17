export interface DeliveryRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface DeliverySummary {
  count: number;
  total: number;
  labels: string[];
}

const DELIVERY_DEFAULT_LABEL = "delivery";

export function makeDelivery(id: string, amount: number): DeliveryRecord {
  return {
    id,
    label: DELIVERY_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateDelivery(record: DeliveryRecord): DeliveryRecord {
  return { ...record, active: true };
}

export function deactivateDelivery(record: DeliveryRecord): DeliveryRecord {
  return { ...record, active: false };
}

export function renameDelivery(record: DeliveryRecord, label: string): DeliveryRecord {
  return { ...record, label };
}

export function adjustDelivery(record: DeliveryRecord, delta: number): DeliveryRecord {
  return { ...record, amount: record.amount + delta };
}

export function isDeliveryEmpty(record: DeliveryRecord): boolean {
  return record.amount === 0;
}

export function filterActiveDeliverys(records: DeliveryRecord[]): DeliveryRecord[] {
  return records.filter((record) => record.active);
}

export function sortDeliverysByAmount(records: DeliveryRecord[]): DeliveryRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalDeliveryAmount(records: DeliveryRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseDeliverys(records: DeliveryRecord[]): DeliverySummary {
  return {
    count: records.length,
    total: totalDeliveryAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findDelivery(records: DeliveryRecord[], id: string): DeliveryRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertDelivery(records: DeliveryRecord[], record: DeliveryRecord): DeliveryRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeDelivery(records: DeliveryRecord[], id: string): DeliveryRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeDelivery(record: DeliveryRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneDelivery(record: DeliveryRecord): DeliveryRecord {
  return { ...record };
}

export function mergeDeliverys(left: DeliveryRecord[], right: DeliveryRecord[]): DeliveryRecord[] {
  return right.reduce((acc, record) => upsertDelivery(acc, record), left);
}
