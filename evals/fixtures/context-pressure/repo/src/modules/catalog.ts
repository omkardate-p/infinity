export interface CatalogRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface CatalogSummary {
  count: number;
  total: number;
  labels: string[];
}

const CATALOG_DEFAULT_LABEL = "catalog";

export function makeCatalog(id: string, amount: number): CatalogRecord {
  return {
    id,
    label: CATALOG_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateCatalog(record: CatalogRecord): CatalogRecord {
  return { ...record, active: true };
}

export function deactivateCatalog(record: CatalogRecord): CatalogRecord {
  return { ...record, active: false };
}

export function renameCatalog(record: CatalogRecord, label: string): CatalogRecord {
  return { ...record, label };
}

export function adjustCatalog(record: CatalogRecord, delta: number): CatalogRecord {
  return { ...record, amount: record.amount + delta };
}

export function isCatalogEmpty(record: CatalogRecord): boolean {
  return record.amount === 0;
}

export function filterActiveCatalogs(records: CatalogRecord[]): CatalogRecord[] {
  return records.filter((record) => record.active);
}

export function sortCatalogsByAmount(records: CatalogRecord[]): CatalogRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalCatalogAmount(records: CatalogRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseCatalogs(records: CatalogRecord[]): CatalogSummary {
  return {
    count: records.length,
    total: totalCatalogAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findCatalog(records: CatalogRecord[], id: string): CatalogRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertCatalog(records: CatalogRecord[], record: CatalogRecord): CatalogRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeCatalog(records: CatalogRecord[], id: string): CatalogRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeCatalog(record: CatalogRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneCatalog(record: CatalogRecord): CatalogRecord {
  return { ...record };
}

export function mergeCatalogs(left: CatalogRecord[], right: CatalogRecord[]): CatalogRecord[] {
  return right.reduce((acc, record) => upsertCatalog(acc, record), left);
}
