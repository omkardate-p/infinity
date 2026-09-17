export interface PricingRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface PricingSummary {
  count: number;
  total: number;
  labels: string[];
}

const PRICING_DEFAULT_LABEL = "pricing";

export function makePricing(id: string, amount: number): PricingRecord {
  return {
    id,
    label: PRICING_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activatePricing(record: PricingRecord): PricingRecord {
  return { ...record, active: true };
}

export function deactivatePricing(record: PricingRecord): PricingRecord {
  return { ...record, active: false };
}

export function renamePricing(record: PricingRecord, label: string): PricingRecord {
  return { ...record, label };
}

export function adjustPricing(record: PricingRecord, delta: number): PricingRecord {
  return { ...record, amount: record.amount + delta };
}

export function isPricingEmpty(record: PricingRecord): boolean {
  return record.amount === 0;
}

export function filterActivePricings(records: PricingRecord[]): PricingRecord[] {
  return records.filter((record) => record.active);
}

export function sortPricingsByAmount(records: PricingRecord[]): PricingRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalPricingAmount(records: PricingRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summarisePricings(records: PricingRecord[]): PricingSummary {
  return {
    count: records.length,
    total: totalPricingAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findPricing(records: PricingRecord[], id: string): PricingRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertPricing(records: PricingRecord[], record: PricingRecord): PricingRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removePricing(records: PricingRecord[], id: string): PricingRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describePricing(record: PricingRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function clonePricing(record: PricingRecord): PricingRecord {
  return { ...record };
}

export function mergePricings(left: PricingRecord[], right: PricingRecord[]): PricingRecord[] {
  return right.reduce((acc, record) => upsertPricing(acc, record), left);
}
