import { overlaps, type Range } from "./range.ts";

/** Returns the booking that conflicts with the request, if there is one. */
export function findConflict(existing: Range[], request: Range): Range | undefined {
  return existing.find((booking) => overlaps(booking, request));
}
