export interface WishlistRecord {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updatedAt: string;
}

export interface WishlistSummary {
  count: number;
  total: number;
  labels: string[];
}

const WISHLIST_DEFAULT_LABEL = "wishlist";

export function makeWishlist(id: string, amount: number): WishlistRecord {
  return {
    id,
    label: WISHLIST_DEFAULT_LABEL,
    amount,
    active: amount > 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function activateWishlist(record: WishlistRecord): WishlistRecord {
  return { ...record, active: true };
}

export function deactivateWishlist(record: WishlistRecord): WishlistRecord {
  return { ...record, active: false };
}

export function renameWishlist(record: WishlistRecord, label: string): WishlistRecord {
  return { ...record, label };
}

export function adjustWishlist(record: WishlistRecord, delta: number): WishlistRecord {
  return { ...record, amount: record.amount + delta };
}

export function isWishlistEmpty(record: WishlistRecord): boolean {
  return record.amount === 0;
}

export function filterActiveWishlists(records: WishlistRecord[]): WishlistRecord[] {
  return records.filter((record) => record.active);
}

export function sortWishlistsByAmount(records: WishlistRecord[]): WishlistRecord[] {
  return [...records].sort((left, right) => left.amount - right.amount);
}

export function totalWishlistAmount(records: WishlistRecord[]): number {
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export function summariseWishlists(records: WishlistRecord[]): WishlistSummary {
  return {
    count: records.length,
    total: totalWishlistAmount(records),
    labels: records.map((record) => record.label),
  };
}

export function findWishlist(records: WishlistRecord[], id: string): WishlistRecord | undefined {
  return records.find((record) => record.id === id);
}

export function upsertWishlist(records: WishlistRecord[], record: WishlistRecord): WishlistRecord[] {
  const without = records.filter((existing) => existing.id !== record.id);
  return [...without, record];
}

export function removeWishlist(records: WishlistRecord[], id: string): WishlistRecord[] {
  return records.filter((record) => record.id !== id);
}

export function describeWishlist(record: WishlistRecord): string {
  return `${record.label}:${record.id}:${record.amount}`;
}

export function cloneWishlist(record: WishlistRecord): WishlistRecord {
  return { ...record };
}

export function mergeWishlists(left: WishlistRecord[], right: WishlistRecord[]): WishlistRecord[] {
  return right.reduce((acc, record) => upsertWishlist(acc, record), left);
}
