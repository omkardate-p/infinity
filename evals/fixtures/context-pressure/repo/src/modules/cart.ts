export interface CartRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface CartSummary {
  count: number;
  total: number;
  labels: string[];
}

const CART_DEFAULT_LABEL = "cart";

export function makeCart(id: string, amount: number): CartRecord {
  return {
    id,
    label: CART_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateCart(record: CartRecord): CartRecord {
  return { ...record, active: true };
}

export function deactivateCart(record: CartRecord): CartRecord {
  return { ...record, active: false };
}

export function renameCart(record: CartRecord, label: string): CartRecord {
  return { ...record, label };
}

export function adjustCart(record: CartRecord, delta: number): CartRecord {
  return { ...record, amount: record.amount + delta };
}

export function isCartEmpty(record: CartRecord): boolean {
  return record.amount === 0;
}

export function filterActiveCarts(records: CartRecord[]): CartRecord[] {
  return records.filter((record) => record.active);
}

export function sortCartsByAmount(records: CartRecord[]): CartRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalCartAmount(records: CartRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseCarts(records: CartRecord[]): CartSummary {
  return {
    count: records.length,
    total: totalCartAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findCart(records: CartRecord[], id: string): CartRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertCart(records: CartRecord[], record: CartRecord): CartRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeCart(records: CartRecord[], id: string): CartRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeCart(record: CartRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneCart(record: CartRecord): CartRecord {
  return { ...record };
}

export function mergeCarts(left: CartRecord[], right: CartRecord[]): CartRecord[] {
  return right.reduce((acc, record) => upsertCart(acc, record), left);
}
