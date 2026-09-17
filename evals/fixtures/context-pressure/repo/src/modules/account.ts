export interface AccountRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface AccountSummary {
  count: number;
  total: number;
  labels: string[];
}

const ACCOUNT_DEFAULT_LABEL = "account";

export function makeAccount(id: string, amount: number): AccountRecord {
  return {
    id,
    label: ACCOUNT_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateAccount(record: AccountRecord): AccountRecord {
  return { ...record, active: true };
}

export function deactivateAccount(record: AccountRecord): AccountRecord {
  return { ...record, active: false };
}

export function renameAccount(record: AccountRecord, label: string): AccountRecord {
  return { ...record, label };
}

export function adjustAccount(record: AccountRecord, delta: number): AccountRecord {
  return { ...record, amount: record.amount + delta };
}

export function isAccountEmpty(record: AccountRecord): boolean {
  return record.amount === 0;
}

export function filterActiveAccounts(records: AccountRecord[]): AccountRecord[] {
  return records.filter((record) => record.active);
}

export function sortAccountsByAmount(records: AccountRecord[]): AccountRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalAccountAmount(records: AccountRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseAccounts(records: AccountRecord[]): AccountSummary {
  return {
    count: records.length,
    total: totalAccountAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findAccount(records: AccountRecord[], id: string): AccountRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertAccount(records: AccountRecord[], record: AccountRecord): AccountRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeAccount(records: AccountRecord[], id: string): AccountRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeAccount(record: AccountRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneAccount(record: AccountRecord): AccountRecord {
  return { ...record };
}

export function mergeAccounts(left: AccountRecord[], right: AccountRecord[]): AccountRecord[] {
  return right.reduce((acc, record) => upsertAccount(acc, record), left);
}
