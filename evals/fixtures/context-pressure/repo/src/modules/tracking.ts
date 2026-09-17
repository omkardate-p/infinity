export interface TrackingRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface TrackingSummary {
  count: number;
  total: number;
  labels: string[];
}

const TRACKING_DEFAULT_LABEL = "tracking";

export function makeTracking(id: string, amount: number): TrackingRecord {
  return {
    id,
    label: TRACKING_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateTracking(record: TrackingRecord): TrackingRecord {
  return { ...record, active: true };
}

export function deactivateTracking(record: TrackingRecord): TrackingRecord {
  return { ...record, active: false };
}

export function renameTracking(record: TrackingRecord, label: string): TrackingRecord {
  return { ...record, label };
}

export function adjustTracking(record: TrackingRecord, delta: number): TrackingRecord {
  return { ...record, amount: record.amount + delta };
}

export function isTrackingEmpty(record: TrackingRecord): boolean {
  return record.amount === 0;
}

export function filterActiveTrackings(records: TrackingRecord[]): TrackingRecord[] {
  return records.filter((record) => record.active);
}

export function sortTrackingsByAmount(records: TrackingRecord[]): TrackingRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalTrackingAmount(records: TrackingRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseTrackings(records: TrackingRecord[]): TrackingSummary {
  return {
    count: records.length,
    total: totalTrackingAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findTracking(records: TrackingRecord[], id: string): TrackingRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertTracking(records: TrackingRecord[], record: TrackingRecord): TrackingRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeTracking(records: TrackingRecord[], id: string): TrackingRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeTracking(record: TrackingRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneTracking(record: TrackingRecord): TrackingRecord {
  return { ...record };
}

export function mergeTrackings(left: TrackingRecord[], right: TrackingRecord[]): TrackingRecord[] {
  return right.reduce((acc, record) => upsertTracking(acc, record), left);
}
