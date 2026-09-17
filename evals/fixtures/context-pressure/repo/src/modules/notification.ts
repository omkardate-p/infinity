export interface NotificationRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface NotificationSummary {
  count: number;
  total: number;
  labels: string[];
}

const NOTIFICATION_DEFAULT_LABEL = "notification";

export function makeNotification(id: string, amount: number): NotificationRecord {
  return {
    id,
    label: NOTIFICATION_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateNotification(record: NotificationRecord): NotificationRecord {
  return { ...record, active: true };
}

export function deactivateNotification(record: NotificationRecord): NotificationRecord {
  return { ...record, active: false };
}

export function renameNotification(record: NotificationRecord, label: string): NotificationRecord {
  return { ...record, label };
}

export function adjustNotification(record: NotificationRecord, delta: number): NotificationRecord {
  return { ...record, amount: record.amount + delta };
}

export function isNotificationEmpty(record: NotificationRecord): boolean {
  return record.amount === 0;
}

export function filterActiveNotifications(records: NotificationRecord[]): NotificationRecord[] {
  return records.filter((record) => record.active);
}

export function sortNotificationsByAmount(records: NotificationRecord[]): NotificationRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalNotificationAmount(records: NotificationRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseNotifications(records: NotificationRecord[]): NotificationSummary {
  return {
    count: records.length,
    total: totalNotificationAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findNotification(records: NotificationRecord[], id: string): NotificationRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertNotification(records: NotificationRecord[], record: NotificationRecord): NotificationRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeNotification(records: NotificationRecord[], id: string): NotificationRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeNotification(record: NotificationRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneNotification(record: NotificationRecord): NotificationRecord {
  return { ...record };
}

export function mergeNotifications(left: NotificationRecord[], right: NotificationRecord[]): NotificationRecord[] {
  return right.reduce((acc, record) => upsertNotification(acc, record), left);
}
