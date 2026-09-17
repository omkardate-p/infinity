export interface WebhookRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface WebhookSummary {
  count: number;
  total: number;
  labels: string[];
}

const WEBHOOK_DEFAULT_LABEL = "webhook";

export function makeWebhook(id: string, amount: number): WebhookRecord {
  return {
    id,
    label: WEBHOOK_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateWebhook(record: WebhookRecord): WebhookRecord {
  return { ...record, active: true };
}

export function deactivateWebhook(record: WebhookRecord): WebhookRecord {
  return { ...record, active: false };
}

export function renameWebhook(record: WebhookRecord, label: string): WebhookRecord {
  return { ...record, label };
}

export function adjustWebhook(record: WebhookRecord, delta: number): WebhookRecord {
  return { ...record, amount: record.amount + delta };
}

export function isWebhookEmpty(record: WebhookRecord): boolean {
  return record.amount === 0;
}

export function filterActiveWebhooks(records: WebhookRecord[]): WebhookRecord[] {
  return records.filter((record) => record.active);
}

export function sortWebhooksByAmount(records: WebhookRecord[]): WebhookRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalWebhookAmount(records: WebhookRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseWebhooks(records: WebhookRecord[]): WebhookSummary {
  return {
    count: records.length,
    total: totalWebhookAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findWebhook(records: WebhookRecord[], id: string): WebhookRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertWebhook(records: WebhookRecord[], record: WebhookRecord): WebhookRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeWebhook(records: WebhookRecord[], id: string): WebhookRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeWebhook(record: WebhookRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneWebhook(record: WebhookRecord): WebhookRecord {
  return { ...record };
}

export function mergeWebhooks(left: WebhookRecord[], right: WebhookRecord[]): WebhookRecord[] {
  return right.reduce((acc, record) => upsertWebhook(acc, record), left);
}
