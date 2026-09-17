import { expect, test } from "bun:test";
import { inStock, totalUnits } from "./inventory.ts";

const ITEMS = [
  { sku: "a", quantity: 2 },
  { sku: "b", quantity: 0 },
  { sku: "c", quantity: 5 },
];

test("keeps only items with stock", () => {
  expect(inStock(ITEMS).map((item) => item.sku)).toEqual(["a", "c"]);
});

test("totals every unit", () => {
  expect(totalUnits(ITEMS)).toBe(7);
});
