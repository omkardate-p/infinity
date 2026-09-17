/**
 * Display formatting for transcript items: what a tool call is called by, and
 * how a long result is shortened on screen. Pure string work, no Ink.
 *
 * bound() has already capped what arrives here at a size the model can read.
 * This is the second, much tighter cut that makes a transcript scannable, and
 * it keeps the head and the tail for the same reason bound() does.
 */

const HEAD_LINES = 4;
const TAIL_LINES = 2;

/**
 * The single argument worth showing beside a tool's name. Falls back to compact JSON
 * for a tool whose interesting argument is not obvious.
 */
export function toolArgument(args: unknown): string {
  if (args === null || typeof args !== "object") return "";

  const record = args as Record<string, unknown>;
  for (const key of ["command", "path", "pattern", "query"]) {
    const value = record[key];
    if (typeof value === "string") return value;
  }

  const json = JSON.stringify(record);
  return json === "{}" ? "" : json;
}

export interface ElidedOutput {
  head: string[];
  hidden: number;
  tail: string[];
}

export function elide(content: string): ElidedOutput {
  if (content === "") return { head: [], hidden: 0, tail: [] };

  const lines = content.split("\n");
  if (lines.length <= HEAD_LINES + TAIL_LINES + 1) {
    return { head: lines, hidden: 0, tail: [] };
  }

  return {
    head: lines.slice(0, HEAD_LINES),
    hidden: lines.length - HEAD_LINES - TAIL_LINES,
    tail: lines.slice(-TAIL_LINES),
  };
}

/** Seconds while a run is short, minutes and seconds once it is not. */
export function elapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/** Long paths lose their middle, so both the project and the file stay legible. */
export function shortenPath(path: string, max = 48): string {
  const home = process.env["HOME"];
  const tilde = home && path.startsWith(home) ? `~${path.slice(home.length)}` : path;
  if (tilde.length <= max) return tilde;

  const parts = tilde.split("/");
  if (parts.length <= 2) return tilde.slice(-max);
  return `${parts[0]}/…/${parts.slice(-2).join("/")}`;
}
