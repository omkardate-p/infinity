export interface SupplierRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface SupplierSummary {
  count: number;
  total: number;
  labels: string[];
}

const SUPPLIER_DEFAULT_LABEL = "supplier";

export function makeSupplier(id: string, amount: number): SupplierRecord {
  return {
    id,
    label: SUPPLIER_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateSupplier(record: SupplierRecord): SupplierRecord {
  return { ...record, active: true };
}

export function deactivateSupplier(record: SupplierRecord): SupplierRecord {
  return { ...record, active: false };
}

export function renameSupplier(record: SupplierRecord, label: string): SupplierRecord {
  return { ...record, label };
}

export function adjustSupplier(record: SupplierRecord, delta: number): SupplierRecord {
  return { ...record, amount: record.amount + delta };
}

export function isSupplierEmpty(record: SupplierRecord): boolean {
  return record.amount === 0;
}

export function filterActiveSuppliers(records: SupplierRecord[]): SupplierRecord[] {
  return records.filter((record) => record.active);
}

export function sortSuppliersByAmount(records: SupplierRecord[]): SupplierRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalSupplierAmount(records: SupplierRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseSuppliers(records: SupplierRecord[]): SupplierSummary {
  return {
    count: records.length,
    total: totalSupplierAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findSupplier(records: SupplierRecord[], id: string): SupplierRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertSupplier(records: SupplierRecord[], record: SupplierRecord): SupplierRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeSupplier(records: SupplierRecord[], id: string): SupplierRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeSupplier(record: SupplierRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneSupplier(record: SupplierRecord): SupplierRecord {
  return { ...record };
}

export function mergeSuppliers(left: SupplierRecord[], right: SupplierRecord[]): SupplierRecord[] {
  return right.reduce((acc, record) => upsertSupplier(acc, record), left);
}
