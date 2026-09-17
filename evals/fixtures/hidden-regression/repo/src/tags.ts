/** Splits a comma-separated tag list. Tags may contain spaces inside them. */
export function parseTags(input: string): string[] {
  return input.split(",").filter((tag) => tag.length > 0);
}
