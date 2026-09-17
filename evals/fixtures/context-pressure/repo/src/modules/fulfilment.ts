export interface FulfilmentRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface FulfilmentSummary {
  count: number;
  total: number;
  labels: string[];
}

const FULFILMENT_DEFAULT_LABEL = "fulfilment";

export function makeFulfilment(id: string, amount: number): FulfilmentRecord {
  return {
    id,
    label: FULFILMENT_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateFulfilment(record: FulfilmentRecord): FulfilmentRecord {
  return { ...record, active: true };
}

export function deactivateFulfilment(record: FulfilmentRecord): FulfilmentRecord {
  return { ...record, active: false };
}

export function renameFulfilment(record: FulfilmentRecord, label: string): FulfilmentRecord {
  return { ...record, label };
}

export function adjustFulfilment(record: FulfilmentRecord, delta: number): FulfilmentRecord {
  return { ...record, amount: record.amount + delta };
}

export function isFulfilmentEmpty(record: FulfilmentRecord): boolean {
  return record.amount === 0;
}

export function filterActiveFulfilments(records: FulfilmentRecord[]): FulfilmentRecord[] {
  return records.filter((record) => record.active);
}

export function sortFulfilmentsByAmount(records: FulfilmentRecord[]): FulfilmentRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalFulfilmentAmount(records: FulfilmentRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseFulfilments(records: FulfilmentRecord[]): FulfilmentSummary {
  return {
    count: records.length,
    total: totalFulfilmentAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findFulfilment(records: FulfilmentRecord[], id: string): FulfilmentRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertFulfilment(records: FulfilmentRecord[], record: FulfilmentRecord): FulfilmentRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeFulfilment(records: FulfilmentRecord[], id: string): FulfilmentRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeFulfilment(record: FulfilmentRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneFulfilment(record: FulfilmentRecord): FulfilmentRecord {
  return { ...record };
}

export function mergeFulfilments(left: FulfilmentRecord[], right: FulfilmentRecord[]): FulfilmentRecord[] {
  return right.reduce((acc, record) => upsertFulfilment(acc, record), left);
}
