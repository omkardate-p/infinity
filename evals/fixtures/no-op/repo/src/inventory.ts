export interface Item {
  sku: string;
  quantity: number;
}

export function inStock(items: Item[]): Item[] {
  return items.filter((item) => item.quantity > 0);
}

export function totalUnits(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
