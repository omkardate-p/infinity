export interface BillingRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface BillingSummary {
  count: number;
  total: number;
  labels: string[];
}

const BILLING_DEFAULT_LABEL = "billing";

export function makeBilling(id: string, amount: number): BillingRecord {
  return {
    id,
    label: BILLING_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateBilling(record: BillingRecord): BillingRecord {
  return { ...record, active: true };
}

export function deactivateBilling(record: BillingRecord): BillingRecord {
  return { ...record, active: false };
}

export function renameBilling(record: BillingRecord, label: string): BillingRecord {
  return { ...record, label };
}

export function adjustBilling(record: BillingRecord, delta: number): BillingRecord {
  return { ...record, amount: record.amount + delta };
}

export function isBillingEmpty(record: BillingRecord): boolean {
  return record.amount === 0;
}

export function filterActiveBillings(records: BillingRecord[]): BillingRecord[] {
  return records.filter((record) => record.active);
}

export function sortBillingsByAmount(records: BillingRecord[]): BillingRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalBillingAmount(records: BillingRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseBillings(records: BillingRecord[]): BillingSummary {
  return {
    count: records.length,
    total: totalBillingAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findBilling(records: BillingRecord[], id: string): BillingRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertBilling(records: BillingRecord[], record: BillingRecord): BillingRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeBilling(records: BillingRecord[], id: string): BillingRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeBilling(record: BillingRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneBilling(record: BillingRecord): BillingRecord {
  return { ...record };
}

export function mergeBillings(left: BillingRecord[], right: BillingRecord[]): BillingRecord[] {
  return right.reduce((acc, record) => upsertBilling(acc, record), left);
}
