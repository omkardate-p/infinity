export interface ReceiptRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface ReceiptSummary {
  count: number;
  total: number;
  labels: string[];
}

const RECEIPT_DEFAULT_LABEL = "receipt";

export function makeReceipt(id: string, amount: number): ReceiptRecord {
  return {
    id,
    label: RECEIPT_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateReceipt(record: ReceiptRecord): ReceiptRecord {
  return { ...record, active: true };
}

export function deactivateReceipt(record: ReceiptRecord): ReceiptRecord {
  return { ...record, active: false };
}

export function renameReceipt(record: ReceiptRecord, label: string): ReceiptRecord {
  return { ...record, label };
}

export function adjustReceipt(record: ReceiptRecord, delta: number): ReceiptRecord {
  return { ...record, amount: record.amount + delta };
}

export function isReceiptEmpty(record: ReceiptRecord): boolean {
  return record.amount === 0;
}

export function filterActiveReceipts(records: ReceiptRecord[]): ReceiptRecord[] {
  return records.filter((record) => record.active);
}

export function sortReceiptsByAmount(records: ReceiptRecord[]): ReceiptRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalReceiptAmount(records: ReceiptRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseReceipts(records: ReceiptRecord[]): ReceiptSummary {
  return {
    count: records.length,
    total: totalReceiptAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findReceipt(records: ReceiptRecord[], id: string): ReceiptRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertReceipt(records: ReceiptRecord[], record: ReceiptRecord): ReceiptRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeReceipt(records: ReceiptRecord[], id: string): ReceiptRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeReceipt(record: ReceiptRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneReceipt(record: ReceiptRecord): ReceiptRecord {
  return { ...record };
}

export function mergeReceipts(left: ReceiptRecord[], right: ReceiptRecord[]): ReceiptRecord[] {
  return right.reduce((acc, record) => upsertReceipt(acc, record), left);
}
