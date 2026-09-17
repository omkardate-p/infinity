export interface MerchantRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface MerchantSummary {
  count: number;
  total: number;
  labels: string[];
}

const MERCHANT_DEFAULT_LABEL = "merchant";

export function makeMerchant(id: string, amount: number): MerchantRecord {
  return {
    id,
    label: MERCHANT_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateMerchant(record: MerchantRecord): MerchantRecord {
  return { ...record, active: true };
}

export function deactivateMerchant(record: MerchantRecord): MerchantRecord {
  return { ...record, active: false };
}

export function renameMerchant(record: MerchantRecord, label: string): MerchantRecord {
  return { ...record, label };
}

export function adjustMerchant(record: MerchantRecord, delta: number): MerchantRecord {
  return { ...record, amount: record.amount + delta };
}

export function isMerchantEmpty(record: MerchantRecord): boolean {
  return record.amount === 0;
}

export function filterActiveMerchants(records: MerchantRecord[]): MerchantRecord[] {
  return records.filter((record) => record.active);
}

export function sortMerchantsByAmount(records: MerchantRecord[]): MerchantRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalMerchantAmount(records: MerchantRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseMerchants(records: MerchantRecord[]): MerchantSummary {
  return {
    count: records.length,
    total: totalMerchantAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findMerchant(records: MerchantRecord[], id: string): MerchantRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertMerchant(records: MerchantRecord[], record: MerchantRecord): MerchantRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeMerchant(records: MerchantRecord[], id: string): MerchantRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeMerchant(record: MerchantRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneMerchant(record: MerchantRecord): MerchantRecord {
  return { ...record };
}

export function mergeMerchants(left: MerchantRecord[], right: MerchantRecord[]): MerchantRecord[] {
  return right.reduce((acc, record) => upsertMerchant(acc, record), left);
}
