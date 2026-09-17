export interface LedgerRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface LedgerSummary {
  count: number;
  total: number;
  labels: string[];
}

const LEDGER_DEFAULT_LABEL = "ledger";

export function makeLedger(id: string, amount: number): LedgerRecord {
  return {
    id,
    label: LEDGER_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateLedger(record: LedgerRecord): LedgerRecord {
  return { ...record, active: true };
}

export function deactivateLedger(record: LedgerRecord): LedgerRecord {
  return { ...record, active: false };
}

export function renameLedger(record: LedgerRecord, label: string): LedgerRecord {
  return { ...record, label };
}

export function adjustLedger(record: LedgerRecord, delta: number): LedgerRecord {
  return { ...record, amount: record.amount + delta };
}

export function isLedgerEmpty(record: LedgerRecord): boolean {
  return record.amount === 0;
}

export function filterActiveLedgers(records: LedgerRecord[]): LedgerRecord[] {
  return records.filter((record) => record.active);
}

export function sortLedgersByAmount(records: LedgerRecord[]): LedgerRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalLedgerAmount(records: LedgerRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseLedgers(records: LedgerRecord[]): LedgerSummary {
  return {
    count: records.length,
    total: totalLedgerAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findLedger(records: LedgerRecord[], id: string): LedgerRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertLedger(records: LedgerRecord[], record: LedgerRecord): LedgerRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeLedger(records: LedgerRecord[], id: string): LedgerRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeLedger(record: LedgerRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneLedger(record: LedgerRecord): LedgerRecord {
  return { ...record };
}

export function mergeLedgers(left: LedgerRecord[], right: LedgerRecord[]): LedgerRecord[] {
  return right.reduce((acc, record) => upsertLedger(acc, record), left);
}
