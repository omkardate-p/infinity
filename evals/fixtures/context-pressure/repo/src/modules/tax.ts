export interface TaxRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface TaxSummary {
  count: number;
  total: number;
  labels: string[];
}

const TAX_DEFAULT_LABEL = "tax";

export function makeTax(id: string, amount: number): TaxRecord {
  return {
    id,
    label: TAX_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateTax(record: TaxRecord): TaxRecord {
  return { ...record, active: true };
}

export function deactivateTax(record: TaxRecord): TaxRecord {
  return { ...record, active: false };
}

export function renameTax(record: TaxRecord, label: string): TaxRecord {
  return { ...record, label };
}

export function adjustTax(record: TaxRecord, delta: number): TaxRecord {
  return { ...record, amount: record.amount + delta };
}

export function isTaxEmpty(record: TaxRecord): boolean {
  return record.amount === 0;
}

export function filterActiveTaxs(records: TaxRecord[]): TaxRecord[] {
  return records.filter((record) => record.active);
}

export function sortTaxsByAmount(records: TaxRecord[]): TaxRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalTaxAmount(records: TaxRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseTaxs(records: TaxRecord[]): TaxSummary {
  return {
    count: records.length,
    total: totalTaxAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findTax(records: TaxRecord[], id: string): TaxRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertTax(records: TaxRecord[], record: TaxRecord): TaxRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeTax(records: TaxRecord[], id: string): TaxRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeTax(record: TaxRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneTax(record: TaxRecord): TaxRecord {
  return { ...record };
}

export function mergeTaxs(left: TaxRecord[], right: TaxRecord[]): TaxRecord[] {
  return right.reduce((acc, record) => upsertTax(acc, record), left);
}
