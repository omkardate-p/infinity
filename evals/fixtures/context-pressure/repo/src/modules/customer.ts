export interface CustomerRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface CustomerSummary {
  count: number;
  total: number;
  labels: string[];
}

const CUSTOMER_DEFAULT_LABEL = "customer";

export function makeCustomer(id: string, amount: number): CustomerRecord {
  return {
    id,
    label: CUSTOMER_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateCustomer(record: CustomerRecord): CustomerRecord {
  return { ...record, active: true };
}

export function deactivateCustomer(record: CustomerRecord): CustomerRecord {
  return { ...record, active: false };
}

export function renameCustomer(record: CustomerRecord, label: string): CustomerRecord {
  return { ...record, label };
}

export function adjustCustomer(record: CustomerRecord, delta: number): CustomerRecord {
  return { ...record, amount: record.amount + delta };
}

export function isCustomerEmpty(record: CustomerRecord): boolean {
  return record.amount === 0;
}

export function filterActiveCustomers(records: CustomerRecord[]): CustomerRecord[] {
  return records.filter((record) => record.active);
}

export function sortCustomersByAmount(records: CustomerRecord[]): CustomerRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalCustomerAmount(records: CustomerRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseCustomers(records: CustomerRecord[]): CustomerSummary {
  return {
    count: records.length,
    total: totalCustomerAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findCustomer(records: CustomerRecord[], id: string): CustomerRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertCustomer(records: CustomerRecord[], record: CustomerRecord): CustomerRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeCustomer(records: CustomerRecord[], id: string): CustomerRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeCustomer(record: CustomerRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneCustomer(record: CustomerRecord): CustomerRecord {
  return { ...record };
}

export function mergeCustomers(left: CustomerRecord[], right: CustomerRecord[]): CustomerRecord[] {
  return right.reduce((acc, record) => upsertCustomer(acc, record), left);
}
