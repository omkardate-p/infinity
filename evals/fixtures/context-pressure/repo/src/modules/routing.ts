export interface RoutingRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface RoutingSummary {
  count: number;
  total: number;
  labels: string[];
}

const ROUTING_DEFAULT_LABEL = "routing";

export function makeRouting(id: string, amount: number): RoutingRecord {
  return {
    id,
    label: ROUTING_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateRouting(record: RoutingRecord): RoutingRecord {
  return { ...record, active: true };
}

export function deactivateRouting(record: RoutingRecord): RoutingRecord {
  return { ...record, active: false };
}

export function renameRouting(record: RoutingRecord, label: string): RoutingRecord {
  return { ...record, label };
}

export function adjustRouting(record: RoutingRecord, delta: number): RoutingRecord {
  return { ...record, amount: record.amount + delta };
}

export function isRoutingEmpty(record: RoutingRecord): boolean {
  return record.amount === 0;
}

export function filterActiveRoutings(records: RoutingRecord[]): RoutingRecord[] {
  return records.filter((record) => record.active);
}

export function sortRoutingsByAmount(records: RoutingRecord[]): RoutingRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalRoutingAmount(records: RoutingRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseRoutings(records: RoutingRecord[]): RoutingSummary {
  return {
    count: records.length,
    total: totalRoutingAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findRouting(records: RoutingRecord[], id: string): RoutingRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertRouting(records: RoutingRecord[], record: RoutingRecord): RoutingRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeRouting(records: RoutingRecord[], id: string): RoutingRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeRouting(record: RoutingRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneRouting(record: RoutingRecord): RoutingRecord {
  return { ...record };
}

export function mergeRoutings(left: RoutingRecord[], right: RoutingRecord[]): RoutingRecord[] {
  return right.reduce((acc, record) => upsertRouting(acc, record), left);
}
