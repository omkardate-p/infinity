export interface SubscriptionRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface SubscriptionSummary {
  count: number;
  total: number;
  labels: string[];
}

const SUBSCRIPTION_DEFAULT_LABEL = "subscription";

export function makeSubscription(id: string, amount: number): SubscriptionRecord {
  return {
    id,
    label: SUBSCRIPTION_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateSubscription(record: SubscriptionRecord): SubscriptionRecord {
  return { ...record, active: true };
}

export function deactivateSubscription(record: SubscriptionRecord): SubscriptionRecord {
  return { ...record, active: false };
}

export function renameSubscription(record: SubscriptionRecord, label: string): SubscriptionRecord {
  return { ...record, label };
}

export function adjustSubscription(record: SubscriptionRecord, delta: number): SubscriptionRecord {
  return { ...record, amount: record.amount + delta };
}

export function isSubscriptionEmpty(record: SubscriptionRecord): boolean {
  return record.amount === 0;
}

export function filterActiveSubscriptions(records: SubscriptionRecord[]): SubscriptionRecord[] {
  return records.filter((record) => record.active);
}

export function sortSubscriptionsByAmount(records: SubscriptionRecord[]): SubscriptionRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalSubscriptionAmount(records: SubscriptionRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseSubscriptions(records: SubscriptionRecord[]): SubscriptionSummary {
  return {
    count: records.length,
    total: totalSubscriptionAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findSubscription(records: SubscriptionRecord[], id: string): SubscriptionRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertSubscription(records: SubscriptionRecord[], record: SubscriptionRecord): SubscriptionRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeSubscription(records: SubscriptionRecord[], id: string): SubscriptionRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeSubscription(record: SubscriptionRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneSubscription(record: SubscriptionRecord): SubscriptionRecord {
  return { ...record };
}

export function mergeSubscriptions(left: SubscriptionRecord[], right: SubscriptionRecord[]): SubscriptionRecord[] {
  return right.reduce((acc, record) => upsertSubscription(acc, record), left);
}
