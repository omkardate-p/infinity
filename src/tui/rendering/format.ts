/**
 * Display formatting for transcript items: what a tool call is called by, and
 * how a long result is shortened on screen, and how wide any of it is.
 *
 * bound() has already capped what arrives here at a size the model can read.
 * This is the second, much tighter cut that makes a transcript scannable, and
 * it keeps the head and the tail for the same reason bound() does.
 */

const HEAD_LINES = 4;
const TAIL_LINES = 2;

// The single argument worth showing beside a tool's name. Falls back to compact JSON
// for a tool whose interesting argument is not obvious.
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

const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// The width a string occupies on screen, which is the only measure a layout
// may use. A code unit, a code point and a cell are three different counts: a
// CJK ideograph is one code point and two cells, a family emoji is seven code
// points and two cells, a combining accent is a code point and no cell at all.
//
// Tabs are expanded before measuring rather than counted, because a tab is as
// wide as the distance to the next stop and a layout cannot know that distance
// until it knows where the tab landed, and a control character is not a cell at
// all.
export function cells(text: string): number {
  return Bun.stringWidth(printable(text));
}

// Makes one line safe to draw: tabs become spaces, and anything past the width
// is cut. The cut falls on a grapheme boundary and never leaves a wide glyph
// straddling the edge — @opentui/core drops a cluster that does not fit the
// remaining cells without clearing the cell, so the previous frame shows
// through there.
export function fitLine(text: string, width: number): string {
  const expanded = printable(text);
  if (Bun.stringWidth(expanded) <= width) return expanded;

  let kept = "";
  let used = 0;
  for (const { segment } of GRAPHEMES.segment(expanded)) {
    const next = used + Bun.stringWidth(segment);
    if (next > width) break;
    kept += segment;
    used = next;
  }
  return kept;
}

// Cuts like fitLine, but says so: a description the menu had to shorten ends
// in an ellipsis rather than stopping mid-word as though that were the text.
export function elideLine(text: string, width: number): string {
  if (width <= 0) return "";
  if (cells(text) <= width) return fitLine(text, width);
  return `${fitLine(text, width - 1)}\u2026`;
}

// Fits, then fills to exactly `width` cells so the line covers every one.
export function padLine(text: string, width: number): string {
  const fitted = fitLine(text, width);
  return fitted + " ".repeat(Math.max(0, width - cells(fitted)));
}

// The text split where the terminal will split it, each piece carrying its
// offset back into the original. A wrap breaks between these and never inside
// one: half a surrogate pair, or a base letter parted from its accent, is not
// a character the terminal can draw.
export function graphemes(text: string): { text: string; index: number }[] {
  return [...GRAPHEMES.segment(text)].map(({ segment, index }) => ({
    text: segment,
    index,
  }));
}

// Keeps the end rather than the start: the file matters more than the root.
function fitTail(text: string, width: number): string {
  let kept = "";
  let used = 0;
  for (const segment of [...GRAPHEMES.segment(text)].reverse()) {
    const next = used + cells(segment.segment);
    if (next > width) break;
    kept = segment.segment + kept;
    used = next;
  }
  return kept;
}

// Everything that is not one drawable cell becomes one.
//
// A tab advances to the next stop, so it is wider than the single character it
// counts as, and a newline inside a line that was already broken into rows
// renders as a row the caller never counted. The rest are control characters,
// and they are the dangerous case: tool output and model text reach this
// function unaltered, so an ESC arriving from a command that emits colour would
// otherwise be handed to the terminal to obey.
function printable(text: string): string {
  return (
    text
      .replace(/\t/g, "    ")
      // biome-ignore lint/suspicious/noControlCharactersInRegex: the point is to remove them
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
  );
}

// Seconds while a run is short, minutes and seconds once it is not.
export function elapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

// Makes a footer line define every cell it covers.
//
// Measured against @opentui/core 0.5.11: an incoming ASCII space does not
// overwrite an existing glyph. Drawing "A" + three spaces + "B" over "XXXXXXXX"
// leaves "AXXXB", with or without a background colour. The footer is redrawn
// over whatever the previous frame left in the renderer's buffer, so its spaces
// let those characters show through — a spinner reading
// "Working (39s · esc to interrupt)" comes out as "Workingo(39se·tesc...".
// A no-break space is not that sentinel, so it overwrites, and renders blank.
//
// Committed scrollback keeps ordinary spaces: a snapshot is laid out in a fresh
// buffer, where there is nothing to show through.
export function opaque(text: string): string {
  return text.replaceAll(" ", "\u00a0");
}

// The wall clock, for saying when a turn finished.
export function timeOfDay(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Long paths lose their middle, so both the project and the file stay legible.
export function shortenPath(path: string, max = 48): string {
  const home = process.env.HOME;
  const tilde =
    home && path.startsWith(home) ? `~${path.slice(home.length)}` : path;
  if (cells(tilde) <= max) return tilde;

  const parts = tilde.split("/");
  if (parts.length <= 2) return fitTail(tilde, max);
  return fitTail(`${parts[0]}/…/${parts.slice(-2).join("/")}`, max);
}
