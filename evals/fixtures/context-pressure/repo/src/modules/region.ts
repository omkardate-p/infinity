export interface RegionRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface RegionSummary {
  count: number;
  total: number;
  labels: string[];
}

const REGION_DEFAULT_LABEL = "region";

export function makeRegion(id: string, amount: number): RegionRecord {
  return {
    id,
    label: REGION_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateRegion(record: RegionRecord): RegionRecord {
  return { ...record, active: true };
}

export function deactivateRegion(record: RegionRecord): RegionRecord {
  return { ...record, active: false };
}

export function renameRegion(record: RegionRecord, label: string): RegionRecord {
  return { ...record, label };
}

export function adjustRegion(record: RegionRecord, delta: number): RegionRecord {
  return { ...record, amount: record.amount + delta };
}

export function isRegionEmpty(record: RegionRecord): boolean {
  return record.amount === 0;
}

export function filterActiveRegions(records: RegionRecord[]): RegionRecord[] {
  return records.filter((record) => record.active);
}

export function sortRegionsByAmount(records: RegionRecord[]): RegionRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalRegionAmount(records: RegionRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseRegions(records: RegionRecord[]): RegionSummary {
  return {
    count: records.length,
    total: totalRegionAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findRegion(records: RegionRecord[], id: string): RegionRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertRegion(records: RegionRecord[], record: RegionRecord): RegionRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeRegion(records: RegionRecord[], id: string): RegionRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeRegion(record: RegionRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneRegion(record: RegionRecord): RegionRecord {
  return { ...record };
}

export function mergeRegions(left: RegionRecord[], right: RegionRecord[]): RegionRecord[] {
  return right.reduce((acc, record) => upsertRegion(acc, record), left);
}
