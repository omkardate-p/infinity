export interface SessionRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface SessionSummary {
  count: number;
  total: number;
  labels: string[];
}

const SESSION_DEFAULT_LABEL = "session";

export function makeSession(id: string, amount: number): SessionRecord {
  return {
    id,
    label: SESSION_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateSession(record: SessionRecord): SessionRecord {
  return { ...record, active: true };
}

export function deactivateSession(record: SessionRecord): SessionRecord {
  return { ...record, active: false };
}

export function renameSession(record: SessionRecord, label: string): SessionRecord {
  return { ...record, label };
}

export function adjustSession(record: SessionRecord, delta: number): SessionRecord {
  return { ...record, amount: record.amount + delta };
}

export function isSessionEmpty(record: SessionRecord): boolean {
  return record.amount === 0;
}

export function filterActiveSessions(records: SessionRecord[]): SessionRecord[] {
  return records.filter((record) => record.active);
}

export function sortSessionsByAmount(records: SessionRecord[]): SessionRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalSessionAmount(records: SessionRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseSessions(records: SessionRecord[]): SessionSummary {
  return {
    count: records.length,
    total: totalSessionAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findSession(records: SessionRecord[], id: string): SessionRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertSession(records: SessionRecord[], record: SessionRecord): SessionRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeSession(records: SessionRecord[], id: string): SessionRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeSession(record: SessionRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneSession(record: SessionRecord): SessionRecord {
  return { ...record };
}

export function mergeSessions(left: SessionRecord[], right: SessionRecord[]): SessionRecord[] {
  return right.reduce((acc, record) => upsertSession(acc, record), left);
}
