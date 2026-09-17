export interface CurrencyRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface CurrencySummary {
  count: number;
  total: number;
  labels: string[];
}

const CURRENCY_DEFAULT_LABEL = "currency";

export function makeCurrency(id: string, amount: number): CurrencyRecord {
  return {
    id,
    label: CURRENCY_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateCurrency(record: CurrencyRecord): CurrencyRecord {
  return { ...record, active: true };
}

export function deactivateCurrency(record: CurrencyRecord): CurrencyRecord {
  return { ...record, active: false };
}

export function renameCurrency(record: CurrencyRecord, label: string): CurrencyRecord {
  return { ...record, label };
}

export function adjustCurrency(record: CurrencyRecord, delta: number): CurrencyRecord {
  return { ...record, amount: record.amount + delta };
}

export function isCurrencyEmpty(record: CurrencyRecord): boolean {
  return record.amount === 0;
}

export function filterActiveCurrencys(records: CurrencyRecord[]): CurrencyRecord[] {
  return records.filter((record) => record.active);
}

export function sortCurrencysByAmount(records: CurrencyRecord[]): CurrencyRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalCurrencyAmount(records: CurrencyRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseCurrencys(records: CurrencyRecord[]): CurrencySummary {
  return {
    count: records.length,
    total: totalCurrencyAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findCurrency(records: CurrencyRecord[], id: string): CurrencyRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertCurrency(records: CurrencyRecord[], record: CurrencyRecord): CurrencyRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeCurrency(records: CurrencyRecord[], id: string): CurrencyRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeCurrency(record: CurrencyRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneCurrency(record: CurrencyRecord): CurrencyRecord {
  return { ...record };
}

export function mergeCurrencys(left: CurrencyRecord[], right: CurrencyRecord[]): CurrencyRecord[] {
  return right.reduce((acc, record) => upsertCurrency(acc, record), left);
}
