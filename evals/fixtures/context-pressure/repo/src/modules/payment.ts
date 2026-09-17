export interface PaymentRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface PaymentSummary {
  count: number;
  total: number;
  labels: string[];
}

const PAYMENT_DEFAULT_LABEL = "payment";

export function makePayment(id: string, amount: number): PaymentRecord {
  return {
    id,
    label: PAYMENT_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activatePayment(record: PaymentRecord): PaymentRecord {
  return { ...record, active: true };
}

export function deactivatePayment(record: PaymentRecord): PaymentRecord {
  return { ...record, active: false };
}

export function renamePayment(record: PaymentRecord, label: string): PaymentRecord {
  return { ...record, label };
}

export function adjustPayment(record: PaymentRecord, delta: number): PaymentRecord {
  return { ...record, amount: record.amount + delta };
}

export function isPaymentEmpty(record: PaymentRecord): boolean {
  return record.amount === 0;
}

export function filterActivePayments(records: PaymentRecord[]): PaymentRecord[] {
  return records.filter((record) => record.active);
}

export function sortPaymentsByAmount(records: PaymentRecord[]): PaymentRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalPaymentAmount(records: PaymentRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summarisePayments(records: PaymentRecord[]): PaymentSummary {
  return {
    count: records.length,
    total: totalPaymentAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findPayment(records: PaymentRecord[], id: string): PaymentRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertPayment(records: PaymentRecord[], record: PaymentRecord): PaymentRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removePayment(records: PaymentRecord[], id: string): PaymentRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describePayment(record: PaymentRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function clonePayment(record: PaymentRecord): PaymentRecord {
  return { ...record };
}

export function mergePayments(left: PaymentRecord[], right: PaymentRecord[]): PaymentRecord[] {
  return right.reduce((acc, record) => upsertPayment(acc, record), left);
}
