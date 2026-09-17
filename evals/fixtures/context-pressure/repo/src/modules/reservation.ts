export interface ReservationRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface ReservationSummary {
  count: number;
  total: number;
  labels: string[];
}

const RESERVATION_DEFAULT_LABEL = "reservation";

export function makeReservation(id: string, amount: number): ReservationRecord {
  return {
    id,
    label: RESERVATION_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateReservation(record: ReservationRecord): ReservationRecord {
  return { ...record, active: true };
}

export function deactivateReservation(record: ReservationRecord): ReservationRecord {
  return { ...record, active: false };
}

export function renameReservation(record: ReservationRecord, label: string): ReservationRecord {
  return { ...record, label };
}

export function adjustReservation(record: ReservationRecord, delta: number): ReservationRecord {
  return { ...record, amount: record.amount + delta };
}

export function isReservationEmpty(record: ReservationRecord): boolean {
  return record.amount === 0;
}

export function filterActiveReservations(records: ReservationRecord[]): ReservationRecord[] {
  return records.filter((record) => record.active);
}

export function sortReservationsByAmount(records: ReservationRecord[]): ReservationRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalReservationAmount(records: ReservationRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseReservations(records: ReservationRecord[]): ReservationSummary {
  return {
    count: records.length,
    total: totalReservationAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findReservation(records: ReservationRecord[], id: string): ReservationRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertReservation(records: ReservationRecord[], record: ReservationRecord): ReservationRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeReservation(records: ReservationRecord[], id: string): ReservationRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeReservation(record: ReservationRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneReservation(record: ReservationRecord): ReservationRecord {
  return { ...record };
}

export function mergeReservations(left: ReservationRecord[], right: ReservationRecord[]): ReservationRecord[] {
  return right.reduce((acc, record) => upsertReservation(acc, record), left);
}
