export interface RetryPolicyRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface RetryPolicySummary {
  count: number;
  total: number;
  labels: string[];
}

const RETRY_POLICY_DEFAULT_LABEL = "retry-policy";

/** Attempts a failed operation is given before it is abandoned. */
export const MAX_RETRY_BUDGET = 3;

export function makeRetryPolicy(id: string, amount: number): RetryPolicyRecord {
  return {
    id,
    label: RETRY_POLICY_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateRetryPolicy(record: RetryPolicyRecord): RetryPolicyRecord {
  return { ...record, active: true };
}

export function deactivateRetryPolicy(record: RetryPolicyRecord): RetryPolicyRecord {
  return { ...record, active: false };
}

export function renameRetryPolicy(record: RetryPolicyRecord, label: string): RetryPolicyRecord {
  return { ...record, label };
}

export function adjustRetryPolicy(record: RetryPolicyRecord, delta: number): RetryPolicyRecord {
  return { ...record, amount: record.amount + delta };
}

export function isRetryPolicyEmpty(record: RetryPolicyRecord): boolean {
  return record.amount === 0;
}

export function filterActiveRetryPolicys(records: RetryPolicyRecord[]): RetryPolicyRecord[] {
  return records.filter((record) => record.active);
}

export function sortRetryPolicysByAmount(records: RetryPolicyRecord[]): RetryPolicyRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalRetryPolicyAmount(records: RetryPolicyRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseRetryPolicys(records: RetryPolicyRecord[]): RetryPolicySummary {
  return {
    count: records.length,
    total: totalRetryPolicyAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findRetryPolicy(records: RetryPolicyRecord[], id: string): RetryPolicyRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertRetryPolicy(records: RetryPolicyRecord[], record: RetryPolicyRecord): RetryPolicyRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeRetryPolicy(records: RetryPolicyRecord[], id: string): RetryPolicyRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeRetryPolicy(record: RetryPolicyRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneRetryPolicy(record: RetryPolicyRecord): RetryPolicyRecord {
  return { ...record };
}

export function mergeRetryPolicys(left: RetryPolicyRecord[], right: RetryPolicyRecord[]): RetryPolicyRecord[] {
  return right.reduce((acc, record) => upsertRetryPolicy(acc, record), left);
}
