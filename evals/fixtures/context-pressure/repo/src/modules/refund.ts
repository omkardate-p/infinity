export interface RefundRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface RefundSummary {
  count: number;
  total: number;
  labels: string[];
}

const REFUND_DEFAULT_LABEL = "refund";

export function makeRefund(id: string, amount: number): RefundRecord {
  return {
    id,
    label: REFUND_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateRefund(record: RefundRecord): RefundRecord {
  return { ...record, active: true };
}

export function deactivateRefund(record: RefundRecord): RefundRecord {
  return { ...record, active: false };
}

export function renameRefund(record: RefundRecord, label: string): RefundRecord {
  return { ...record, label };
}

export function adjustRefund(record: RefundRecord, delta: number): RefundRecord {
  return { ...record, amount: record.amount + delta };
}

export function isRefundEmpty(record: RefundRecord): boolean {
  return record.amount === 0;
}

export function filterActiveRefunds(records: RefundRecord[]): RefundRecord[] {
  return records.filter((record) => record.active);
}

export function sortRefundsByAmount(records: RefundRecord[]): RefundRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalRefundAmount(records: RefundRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseRefunds(records: RefundRecord[]): RefundSummary {
  return {
    count: records.length,
    total: totalRefundAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findRefund(records: RefundRecord[], id: string): RefundRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertRefund(records: RefundRecord[], record: RefundRecord): RefundRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeRefund(records: RefundRecord[], id: string): RefundRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeRefund(record: RefundRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneRefund(record: RefundRecord): RefundRecord {
  return { ...record };
}

export function mergeRefunds(left: RefundRecord[], right: RefundRecord[]): RefundRecord[] {
  return right.reduce((acc, record) => upsertRefund(acc, record), left);
}
