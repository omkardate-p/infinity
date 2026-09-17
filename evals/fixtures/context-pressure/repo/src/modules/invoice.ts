export interface InvoiceRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface InvoiceSummary {
  count: number;
  total: number;
  labels: string[];
}

const INVOICE_DEFAULT_LABEL = "invoice";

export function makeInvoice(id: string, amount: number): InvoiceRecord {
  return {
    id,
    label: INVOICE_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateInvoice(record: InvoiceRecord): InvoiceRecord {
  return { ...record, active: true };
}

export function deactivateInvoice(record: InvoiceRecord): InvoiceRecord {
  return { ...record, active: false };
}

export function renameInvoice(record: InvoiceRecord, label: string): InvoiceRecord {
  return { ...record, label };
}

export function adjustInvoice(record: InvoiceRecord, delta: number): InvoiceRecord {
  return { ...record, amount: record.amount + delta };
}

export function isInvoiceEmpty(record: InvoiceRecord): boolean {
  return record.amount === 0;
}

export function filterActiveInvoices(records: InvoiceRecord[]): InvoiceRecord[] {
  return records.filter((record) => record.active);
}

export function sortInvoicesByAmount(records: InvoiceRecord[]): InvoiceRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalInvoiceAmount(records: InvoiceRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseInvoices(records: InvoiceRecord[]): InvoiceSummary {
  return {
    count: records.length,
    total: totalInvoiceAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findInvoice(records: InvoiceRecord[], id: string): InvoiceRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertInvoice(records: InvoiceRecord[], record: InvoiceRecord): InvoiceRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeInvoice(records: InvoiceRecord[], id: string): InvoiceRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeInvoice(record: InvoiceRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneInvoice(record: InvoiceRecord): InvoiceRecord {
  return { ...record };
}

export function mergeInvoices(left: InvoiceRecord[], right: InvoiceRecord[]): InvoiceRecord[] {
  return right.reduce((acc, record) => upsertInvoice(acc, record), left);
}
