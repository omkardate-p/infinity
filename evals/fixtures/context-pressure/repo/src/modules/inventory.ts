export interface InventoryRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface InventorySummary {
  count: number;
  total: number;
  labels: string[];
}

const INVENTORY_DEFAULT_LABEL = "inventory";

export function makeInventory(id: string, amount: number): InventoryRecord {
  return {
    id,
    label: INVENTORY_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateInventory(record: InventoryRecord): InventoryRecord {
  return { ...record, active: true };
}

export function deactivateInventory(record: InventoryRecord): InventoryRecord {
  return { ...record, active: false };
}

export function renameInventory(record: InventoryRecord, label: string): InventoryRecord {
  return { ...record, label };
}

export function adjustInventory(record: InventoryRecord, delta: number): InventoryRecord {
  return { ...record, amount: record.amount + delta };
}

export function isInventoryEmpty(record: InventoryRecord): boolean {
  return record.amount === 0;
}

export function filterActiveInventorys(records: InventoryRecord[]): InventoryRecord[] {
  return records.filter((record) => record.active);
}

export function sortInventorysByAmount(records: InventoryRecord[]): InventoryRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalInventoryAmount(records: InventoryRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseInventorys(records: InventoryRecord[]): InventorySummary {
  return {
    count: records.length,
    total: totalInventoryAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findInventory(records: InventoryRecord[], id: string): InventoryRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertInventory(records: InventoryRecord[], record: InventoryRecord): InventoryRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeInventory(records: InventoryRecord[], id: string): InventoryRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeInventory(record: InventoryRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneInventory(record: InventoryRecord): InventoryRecord {
  return { ...record };
}

export function mergeInventorys(left: InventoryRecord[], right: InventoryRecord[]): InventoryRecord[] {
  return right.reduce((acc, record) => upsertInventory(acc, record), left);
}
