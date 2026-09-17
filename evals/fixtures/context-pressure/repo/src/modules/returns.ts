export interface ReturnsRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface ReturnsSummary {
  count: number;
  total: number;
  labels: string[];
}

const RETURNS_DEFAULT_LABEL = "returns";

export function makeReturns(id: string, amount: number): ReturnsRecord {
  return {
    id,
    label: RETURNS_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateReturns(record: ReturnsRecord): ReturnsRecord {
  return { ...record, active: true };
}

export function deactivateReturns(record: ReturnsRecord): ReturnsRecord {
  return { ...record, active: false };
}

export function renameReturns(record: ReturnsRecord, label: string): ReturnsRecord {
  return { ...record, label };
}

export function adjustReturns(record: ReturnsRecord, delta: number): ReturnsRecord {
  return { ...record, amount: record.amount + delta };
}

export function isReturnsEmpty(record: ReturnsRecord): boolean {
  return record.amount === 0;
}

export function filterActiveReturnss(records: ReturnsRecord[]): ReturnsRecord[] {
  return records.filter((record) => record.active);
}

export function sortReturnssByAmount(records: ReturnsRecord[]): ReturnsRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalReturnsAmount(records: ReturnsRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseReturnss(records: ReturnsRecord[]): ReturnsSummary {
  return {
    count: records.length,
    total: totalReturnsAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findReturns(records: ReturnsRecord[], id: string): ReturnsRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertReturns(records: ReturnsRecord[], record: ReturnsRecord): ReturnsRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeReturns(records: ReturnsRecord[], id: string): ReturnsRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeReturns(record: ReturnsRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneReturns(record: ReturnsRecord): ReturnsRecord {
  return { ...record };
}

export function mergeReturnss(left: ReturnsRecord[], right: ReturnsRecord[]): ReturnsRecord[] {
  return right.reduce((acc, record) => upsertReturns(acc, record), left);
}
