export interface CouponRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface CouponSummary {
  count: number;
  total: number;
  labels: string[];
}

const COUPON_DEFAULT_LABEL = "coupon";

export function makeCoupon(id: string, amount: number): CouponRecord {
  return {
    id,
    label: COUPON_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateCoupon(record: CouponRecord): CouponRecord {
  return { ...record, active: true };
}

export function deactivateCoupon(record: CouponRecord): CouponRecord {
  return { ...record, active: false };
}

export function renameCoupon(record: CouponRecord, label: string): CouponRecord {
  return { ...record, label };
}

export function adjustCoupon(record: CouponRecord, delta: number): CouponRecord {
  return { ...record, amount: record.amount + delta };
}

export function isCouponEmpty(record: CouponRecord): boolean {
  return record.amount === 0;
}

export function filterActiveCoupons(records: CouponRecord[]): CouponRecord[] {
  return records.filter((record) => record.active);
}

export function sortCouponsByAmount(records: CouponRecord[]): CouponRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalCouponAmount(records: CouponRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseCoupons(records: CouponRecord[]): CouponSummary {
  return {
    count: records.length,
    total: totalCouponAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findCoupon(records: CouponRecord[], id: string): CouponRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertCoupon(records: CouponRecord[], record: CouponRecord): CouponRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeCoupon(records: CouponRecord[], id: string): CouponRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeCoupon(record: CouponRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneCoupon(record: CouponRecord): CouponRecord {
  return { ...record };
}

export function mergeCoupons(left: CouponRecord[], right: CouponRecord[]): CouponRecord[] {
  return right.reduce((acc, record) => upsertCoupon(acc, record), left);
}
