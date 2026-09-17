export interface DiscountRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface DiscountSummary {
  count: number;
  total: number;
  labels: string[];
}

const DISCOUNT_DEFAULT_LABEL = "discount";

export function makeDiscount(id: string, amount: number): DiscountRecord {
  return {
    id,
    label: DISCOUNT_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateDiscount(record: DiscountRecord): DiscountRecord {
  return { ...record, active: true };
}

export function deactivateDiscount(record: DiscountRecord): DiscountRecord {
  return { ...record, active: false };
}

export function renameDiscount(record: DiscountRecord, label: string): DiscountRecord {
  return { ...record, label };
}

export function adjustDiscount(record: DiscountRecord, delta: number): DiscountRecord {
  return { ...record, amount: record.amount + delta };
}

export function isDiscountEmpty(record: DiscountRecord): boolean {
  return record.amount === 0;
}

export function filterActiveDiscounts(records: DiscountRecord[]): DiscountRecord[] {
  return records.filter((record) => record.active);
}

export function sortDiscountsByAmount(records: DiscountRecord[]): DiscountRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalDiscountAmount(records: DiscountRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseDiscounts(records: DiscountRecord[]): DiscountSummary {
  return {
    count: records.length,
    total: totalDiscountAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findDiscount(records: DiscountRecord[], id: string): DiscountRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertDiscount(records: DiscountRecord[], record: DiscountRecord): DiscountRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeDiscount(records: DiscountRecord[], id: string): DiscountRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeDiscount(record: DiscountRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneDiscount(record: DiscountRecord): DiscountRecord {
  return { ...record };
}

export function mergeDiscounts(left: DiscountRecord[], right: DiscountRecord[]): DiscountRecord[] {
  return right.reduce((acc, record) => upsertDiscount(acc, record), left);
}
