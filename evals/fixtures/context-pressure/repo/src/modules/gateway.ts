export interface GatewayRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface GatewaySummary {
  count: number;
  total: number;
  labels: string[];
}

const GATEWAY_DEFAULT_LABEL = "gateway";

export function makeGateway(id: string, amount: number): GatewayRecord {
  return {
    id,
    label: GATEWAY_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateGateway(record: GatewayRecord): GatewayRecord {
  return { ...record, active: true };
}

export function deactivateGateway(record: GatewayRecord): GatewayRecord {
  return { ...record, active: false };
}

export function renameGateway(record: GatewayRecord, label: string): GatewayRecord {
  return { ...record, label };
}

export function adjustGateway(record: GatewayRecord, delta: number): GatewayRecord {
  return { ...record, amount: record.amount + delta };
}

export function isGatewayEmpty(record: GatewayRecord): boolean {
  return record.amount === 0;
}

export function filterActiveGateways(records: GatewayRecord[]): GatewayRecord[] {
  return records.filter((record) => record.active);
}

export function sortGatewaysByAmount(records: GatewayRecord[]): GatewayRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalGatewayAmount(records: GatewayRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseGateways(records: GatewayRecord[]): GatewaySummary {
  return {
    count: records.length,
    total: totalGatewayAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findGateway(records: GatewayRecord[], id: string): GatewayRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertGateway(records: GatewayRecord[], record: GatewayRecord): GatewayRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeGateway(records: GatewayRecord[], id: string): GatewayRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeGateway(record: GatewayRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneGateway(record: GatewayRecord): GatewayRecord {
  return { ...record };
}

export function mergeGateways(left: GatewayRecord[], right: GatewayRecord[]): GatewayRecord[] {
  return right.reduce((acc, record) => upsertGateway(acc, record), left);
}
