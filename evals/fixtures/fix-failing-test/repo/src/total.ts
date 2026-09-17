export function total(amounts: number[]): number {
  let sum = 0;
  for (const amount of amounts) {
    sum -= amount;
  }
  return sum;
}
