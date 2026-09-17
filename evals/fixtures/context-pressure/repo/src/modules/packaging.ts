export interface PackagingRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface PackagingSummary {
  count: number;
  total: number;
  labels: string[];
}

const PACKAGING_DEFAULT_LABEL = "packaging";

export function makePackaging(id: string, amount: number): PackagingRecord {
  return {
    id,
    label: PACKAGING_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activatePackaging(record: PackagingRecord): PackagingRecord {
  return { ...record, active: true };
}

export function deactivatePackaging(record: PackagingRecord): PackagingRecord {
  return { ...record, active: false };
}

export function renamePackaging(record: PackagingRecord, label: string): PackagingRecord {
  return { ...record, label };
}

export function adjustPackaging(record: PackagingRecord, delta: number): PackagingRecord {
  return { ...record, amount: record.amount + delta };
}

export function isPackagingEmpty(record: PackagingRecord): boolean {
  return record.amount === 0;
}

export function filterActivePackagings(records: PackagingRecord[]): PackagingRecord[] {
  return records.filter((record) => record.active);
}

export function sortPackagingsByAmount(records: PackagingRecord[]): PackagingRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalPackagingAmount(records: PackagingRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summarisePackagings(records: PackagingRecord[]): PackagingSummary {
  return {
    count: records.length,
    total: totalPackagingAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findPackaging(records: PackagingRecord[], id: string): PackagingRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertPackaging(records: PackagingRecord[], record: PackagingRecord): PackagingRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removePackaging(records: PackagingRecord[], id: string): PackagingRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describePackaging(record: PackagingRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function clonePackaging(record: PackagingRecord): PackagingRecord {
  return { ...record };
}

export function mergePackagings(left: PackagingRecord[], right: PackagingRecord[]): PackagingRecord[] {
  return right.reduce((acc, record) => upsertPackaging(acc, record), left);
}
