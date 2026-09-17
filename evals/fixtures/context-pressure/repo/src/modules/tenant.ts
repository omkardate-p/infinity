export interface TenantRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface TenantSummary {
  count: number;
  total: number;
  labels: string[];
}

const TENANT_DEFAULT_LABEL = "tenant";

export function makeTenant(id: string, amount: number): TenantRecord {
  return {
    id,
    label: TENANT_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateTenant(record: TenantRecord): TenantRecord {
  return { ...record, active: true };
}

export function deactivateTenant(record: TenantRecord): TenantRecord {
  return { ...record, active: false };
}

export function renameTenant(record: TenantRecord, label: string): TenantRecord {
  return { ...record, label };
}

export function adjustTenant(record: TenantRecord, delta: number): TenantRecord {
  return { ...record, amount: record.amount + delta };
}

export function isTenantEmpty(record: TenantRecord): boolean {
  return record.amount === 0;
}

export function filterActiveTenants(records: TenantRecord[]): TenantRecord[] {
  return records.filter((record) => record.active);
}

export function sortTenantsByAmount(records: TenantRecord[]): TenantRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalTenantAmount(records: TenantRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseTenants(records: TenantRecord[]): TenantSummary {
  return {
    count: records.length,
    total: totalTenantAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findTenant(records: TenantRecord[], id: string): TenantRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertTenant(records: TenantRecord[], record: TenantRecord): TenantRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeTenant(records: TenantRecord[], id: string): TenantRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeTenant(record: TenantRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneTenant(record: TenantRecord): TenantRecord {
  return { ...record };
}

export function mergeTenants(left: TenantRecord[], right: TenantRecord[]): TenantRecord[] {
  return right.reduce((acc, record) => upsertTenant(acc, record), left);
}
