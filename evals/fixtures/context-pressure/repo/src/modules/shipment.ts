export interface ShipmentRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface ShipmentSummary {
  count: number;
  total: number;
  labels: string[];
}

const SHIPMENT_DEFAULT_LABEL = "shipment";

export function makeShipment(id: string, amount: number): ShipmentRecord {
  return {
    id,
    label: SHIPMENT_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateShipment(record: ShipmentRecord): ShipmentRecord {
  return { ...record, active: true };
}

export function deactivateShipment(record: ShipmentRecord): ShipmentRecord {
  return { ...record, active: false };
}

export function renameShipment(record: ShipmentRecord, label: string): ShipmentRecord {
  return { ...record, label };
}

export function adjustShipment(record: ShipmentRecord, delta: number): ShipmentRecord {
  return { ...record, amount: record.amount + delta };
}

export function isShipmentEmpty(record: ShipmentRecord): boolean {
  return record.amount === 0;
}

export function filterActiveShipments(records: ShipmentRecord[]): ShipmentRecord[] {
  return records.filter((record) => record.active);
}

export function sortShipmentsByAmount(records: ShipmentRecord[]): ShipmentRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalShipmentAmount(records: ShipmentRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseShipments(records: ShipmentRecord[]): ShipmentSummary {
  return {
    count: records.length,
    total: totalShipmentAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findShipment(records: ShipmentRecord[], id: string): ShipmentRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertShipment(records: ShipmentRecord[], record: ShipmentRecord): ShipmentRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeShipment(records: ShipmentRecord[], id: string): ShipmentRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeShipment(record: ShipmentRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneShipment(record: ShipmentRecord): ShipmentRecord {
  return { ...record };
}

export function mergeShipments(left: ShipmentRecord[], right: ShipmentRecord[]): ShipmentRecord[] {
  return right.reduce((acc, record) => upsertShipment(acc, record), left);
}
