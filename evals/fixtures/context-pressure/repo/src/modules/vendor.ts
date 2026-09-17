export interface VendorRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface VendorSummary {
  count: number;
  total: number;
  labels: string[];
}

const VENDOR_DEFAULT_LABEL = "vendor";

export function makeVendor(id: string, amount: number): VendorRecord {
  return {
    id,
    label: VENDOR_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateVendor(record: VendorRecord): VendorRecord {
  return { ...record, active: true };
}

export function deactivateVendor(record: VendorRecord): VendorRecord {
  return { ...record, active: false };
}

export function renameVendor(record: VendorRecord, label: string): VendorRecord {
  return { ...record, label };
}

export function adjustVendor(record: VendorRecord, delta: number): VendorRecord {
  return { ...record, amount: record.amount + delta };
}

export function isVendorEmpty(record: VendorRecord): boolean {
  return record.amount === 0;
}

export function filterActiveVendors(records: VendorRecord[]): VendorRecord[] {
  return records.filter((record) => record.active);
}

export function sortVendorsByAmount(records: VendorRecord[]): VendorRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalVendorAmount(records: VendorRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseVendors(records: VendorRecord[]): VendorSummary {
  return {
    count: records.length,
    total: totalVendorAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findVendor(records: VendorRecord[], id: string): VendorRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertVendor(records: VendorRecord[], record: VendorRecord): VendorRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeVendor(records: VendorRecord[], id: string): VendorRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeVendor(record: VendorRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneVendor(record: VendorRecord): VendorRecord {
  return { ...record };
}

export function mergeVendors(left: VendorRecord[], right: VendorRecord[]): VendorRecord[] {
  return right.reduce((acc, record) => upsertVendor(acc, record), left);
}
