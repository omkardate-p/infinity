export interface Range {
  start: number;
  end: number;
}

/** True when the two ranges share at least one point. Ends are inclusive. */
export function overlaps(a: Range, b: Range): boolean {
  return a.start < b.end && b.start < a.end;
}
