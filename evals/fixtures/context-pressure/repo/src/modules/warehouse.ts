export interface WarehouseRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface WarehouseSummary {
  count: number;
  total: number;
  labels: string[];
}

const WAREHOUSE_DEFAULT_LABEL = "warehouse";

export function makeWarehouse(id: string, amount: number): WarehouseRecord {
  return {
    id,
    label: WAREHOUSE_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateWarehouse(record: WarehouseRecord): WarehouseRecord {
  return { ...record, active: true };
}

export function deactivateWarehouse(record: WarehouseRecord): WarehouseRecord {
  return { ...record, active: false };
}

export function renameWarehouse(record: WarehouseRecord, label: string): WarehouseRecord {
  return { ...record, label };
}

export function adjustWarehouse(record: WarehouseRecord, delta: number): WarehouseRecord {
  return { ...record, amount: record.amount + delta };
}

export function isWarehouseEmpty(record: WarehouseRecord): boolean {
  return record.amount === 0;
}

export function filterActiveWarehouses(records: WarehouseRecord[]): WarehouseRecord[] {
  return records.filter((record) => record.active);
}

export function sortWarehousesByAmount(records: WarehouseRecord[]): WarehouseRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalWarehouseAmount(records: WarehouseRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseWarehouses(records: WarehouseRecord[]): WarehouseSummary {
  return {
    count: records.length,
    total: totalWarehouseAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findWarehouse(records: WarehouseRecord[], id: string): WarehouseRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertWarehouse(records: WarehouseRecord[], record: WarehouseRecord): WarehouseRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeWarehouse(records: WarehouseRecord[], id: string): WarehouseRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeWarehouse(record: WarehouseRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneWarehouse(record: WarehouseRecord): WarehouseRecord {
  return { ...record };
}

export function mergeWarehouses(left: WarehouseRecord[], right: WarehouseRecord[]): WarehouseRecord[] {
  return right.reduce((acc, record) => upsertWarehouse(acc, record), left);
}
