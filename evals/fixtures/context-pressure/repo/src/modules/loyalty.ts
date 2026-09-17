export interface LoyaltyRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface LoyaltySummary {
  count: number;
  total: number;
  labels: string[];
}

const LOYALTY_DEFAULT_LABEL = "loyalty";

export function makeLoyalty(id: string, amount: number): LoyaltyRecord {
  return {
    id,
    label: LOYALTY_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateLoyalty(record: LoyaltyRecord): LoyaltyRecord {
  return { ...record, active: true };
}

export function deactivateLoyalty(record: LoyaltyRecord): LoyaltyRecord {
  return { ...record, active: false };
}

export function renameLoyalty(record: LoyaltyRecord, label: string): LoyaltyRecord {
  return { ...record, label };
}

export function adjustLoyalty(record: LoyaltyRecord, delta: number): LoyaltyRecord {
  return { ...record, amount: record.amount + delta };
}

export function isLoyaltyEmpty(record: LoyaltyRecord): boolean {
  return record.amount === 0;
}

export function filterActiveLoyaltys(records: LoyaltyRecord[]): LoyaltyRecord[] {
  return records.filter((record) => record.active);
}

export function sortLoyaltysByAmount(records: LoyaltyRecord[]): LoyaltyRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalLoyaltyAmount(records: LoyaltyRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseLoyaltys(records: LoyaltyRecord[]): LoyaltySummary {
  return {
    count: records.length,
    total: totalLoyaltyAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findLoyalty(records: LoyaltyRecord[], id: string): LoyaltyRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertLoyalty(records: LoyaltyRecord[], record: LoyaltyRecord): LoyaltyRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeLoyalty(records: LoyaltyRecord[], id: string): LoyaltyRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeLoyalty(record: LoyaltyRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneLoyalty(record: LoyaltyRecord): LoyaltyRecord {
  return { ...record };
}

export function mergeLoyaltys(left: LoyaltyRecord[], right: LoyaltyRecord[]): LoyaltyRecord[] {
  return right.reduce((acc, record) => upsertLoyalty(acc, record), left);
}
