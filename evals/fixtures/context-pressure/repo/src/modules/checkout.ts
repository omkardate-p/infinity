export interface CheckoutRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface CheckoutSummary {
  count: number;
  total: number;
  labels: string[];
}

const CHECKOUT_DEFAULT_LABEL = "checkout";

export function makeCheckout(id: string, amount: number): CheckoutRecord {
  return {
    id,
    label: CHECKOUT_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateCheckout(record: CheckoutRecord): CheckoutRecord {
  return { ...record, active: true };
}

export function deactivateCheckout(record: CheckoutRecord): CheckoutRecord {
  return { ...record, active: false };
}

export function renameCheckout(record: CheckoutRecord, label: string): CheckoutRecord {
  return { ...record, label };
}

export function adjustCheckout(record: CheckoutRecord, delta: number): CheckoutRecord {
  return { ...record, amount: record.amount + delta };
}

export function isCheckoutEmpty(record: CheckoutRecord): boolean {
  return record.amount === 0;
}

export function filterActiveCheckouts(records: CheckoutRecord[]): CheckoutRecord[] {
  return records.filter((record) => record.active);
}

export function sortCheckoutsByAmount(records: CheckoutRecord[]): CheckoutRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalCheckoutAmount(records: CheckoutRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseCheckouts(records: CheckoutRecord[]): CheckoutSummary {
  return {
    count: records.length,
    total: totalCheckoutAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findCheckout(records: CheckoutRecord[], id: string): CheckoutRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertCheckout(records: CheckoutRecord[], record: CheckoutRecord): CheckoutRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeCheckout(records: CheckoutRecord[], id: string): CheckoutRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeCheckout(record: CheckoutRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneCheckout(record: CheckoutRecord): CheckoutRecord {
  return { ...record };
}

export function mergeCheckouts(left: CheckoutRecord[], right: CheckoutRecord[]): CheckoutRecord[] {
  return right.reduce((acc, record) => upsertCheckout(acc, record), left);
}
