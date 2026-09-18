/**
 * Turns a transcript item, and the composer's buffer, into the exact lines
 * they occupy on screen. Pure: nothing here talks to a terminal.
 *
 * A line is a list of styled chunks rather than a string, so the colour of a
 * marker and the text beside it are decided here, where the item's status is
 * known, instead of being guessed back out of the text later.
 *
 * The one invariant every producer holds: a line never exceeds the width it
 * was given, measured in terminal cells. A line that does wraps into a row the
 * caller never reserved — which loses the last row of a committed snapshot,
 * and pushes the composer out of the footer.
 */

import {
  createTextAttributes,
  parseColor,
  StyledText,
  type TextChunk,
} from "@opentui/core";
import type { TranscriptItem } from "../../domain/messages.ts";
import type { Buffer } from "../input/editor.ts";
import {
  cells,
  contextShare,
  elapsed,
  elide,
  elideLine,
  fitLine,
  graphemes,
  opaque,
  padLine,
  shortenPath,
  timeOfDay,
  toolArgument,
} from "./format.ts";

export interface Chunk {
  text: string;
  color?: string;
  bold?: boolean;
  // The terminal's own dim attribute, so secondary text follows its theme
  // instead of a grey chosen here that fights it.
  dim?: boolean;
  // Swaps foreground and background: how a block cursor is drawn without
  // hiding the character it sits on.
  inverse?: boolean;
  bg?: string;
}

export type Line = Chunk[];

// Enough to pick a prompt out of the transcript, not enough to shout.
const PROMPT_BACKGROUND = "#262626";

const PLACEHOLDER = "ask infinity";

const MARKERS = {
  running: { glyph: "●", color: "yellow" },
  ok: { glyph: "●", color: "green" },
  failed: { glyph: "✗", color: "red" },
} as const;

const NOTICES = {
  completed: "Done",
  max_turns: "Stopped at the turn limit",
  aborted: "Interrupted",
  denial_limit: "Stopped after too many refusals",
  model_error: "Stopped",
} as const;

export function lineWidth(line: Line): number {
  return line.reduce((total, chunk) => total + cells(chunk.text), 0);
}

export function lineText(line: Line): string {
  return line.map((chunk) => chunk.text).join("");
}

// Footer lines only. Every cell a footer row covers has to be written, and an
// ASCII space will not overwrite what the previous frame left there; see
// opaque() in format.ts.
export function opaqueLines(lines: Line[]): Line[] {
  return lines.map((line) =>
    line.map((chunk) => ({ ...chunk, text: opaque(chunk.text) })),
  );
}

export function fitChunks(line: Line, width: number): Line {
  const fitted: Line = [];
  let used = 0;

  for (const chunk of line) {
    const text = fitLine(chunk.text, width - used);
    if (text === "") continue;
    fitted.push({ ...chunk, text });
    used += cells(text);
  }
  return fitted;
}

export function styledText(lines: Line[]): StyledText {
  const chunks: TextChunk[] = [];

  for (const [index, line] of lines.entries()) {
    if (index > 0) chunks.push({ __isChunk: true, text: "\n" });
    for (const chunk of line) {
      chunks.push({
        __isChunk: true,
        text: chunk.text,
        ...(chunk.color !== undefined ? { fg: parseColor(chunk.color) } : {}),
        ...(chunk.bg !== undefined ? { bg: parseColor(chunk.bg) } : {}),
        ...(chunk.bold || chunk.dim || chunk.inverse
          ? {
              attributes: createTextAttributes({
                bold: chunk.bold ?? false,
                dim: chunk.dim ?? false,
                reverse: chunk.inverse ?? false,
              }),
            }
          : {}),
      });
    }
  }

  return new StyledText(chunks);
}

export function itemLines(item: TranscriptItem, width: number): Line[] {
  switch (item.kind) {
    case "banner":
      return banner(item.model, item.workspace, item.version, width);

    case "elapsed":
      return [
        [],
        [
          { text: "✳ ", color: "yellow", dim: true },
          {
            text: fitLine(
              `Worked for ${elapsed(item.ms)} · done ${timeOfDay(item.at)}`,
              width - 2,
            ),
            dim: true,
          },
        ],
      ];

    case "user":
      return [[], ...promptLines(item.text, width)];

    case "assistant":
      return marked("● ", "green", item.text, width);

    case "error":
      return marked("✗ ", "red", item.message, width, "red");

    case "info":
      return marked("◆ ", "cyan", item.text, width);

    case "context":
      return marked(
        "▲ ",
        "yellow",
        `The model's window is ${contextShare(item.used, item.window)} full ` +
          `(${item.used.toLocaleString()} of ${item.window.toLocaleString()} tokens). ` +
          "Older turns stop reaching it from here; /clear starts a new session.",
        width,
        "yellow",
      );

    case "notice": {
      const turns = `${item.turns} ${item.turns === 1 ? "turn" : "turns"}`;
      return [
        [],
        [
          {
            text: fitLine(`${NOTICES[item.reason]} after ${turns}`, width),
            dim: true,
          },
        ],
      ];
    }

    case "tool":
      return tool(item, width);
  }
}

// A prompt, shaded the whole width so it reads as a band. Each row is padded
// because a background only covers the cells a chunk actually occupies.
export function promptLines(text: string, width: number): Line[] {
  return wrap(text, width - 2).map((row): Line => {
    const body = padLine(row, width - 2);
    return [
      { text: "› ", color: "cyan", bg: PROMPT_BACKGROUND },
      { text: body, bg: PROMPT_BACKGROUND },
    ];
  });
}

// How many rows the composer needs before any of them is dropped. It asks
// composerLines rather than counting the wrap itself: the cursor can add a row
// the text alone does not, and a count that missed it would reserve one row too
// few and scroll the composer for no reason.
export function composerRows(buffer: Buffer, width: number): number {
  return composerLines(buffer, width, buffer.cursor, Infinity).length;
}

// The composer's rows, wrapped the way the terminal will show them, with the
// cursor filling one cell. The caller passes the cursor's offset in the buffer,
// or -1 to hide it; it is turned into a row and a column here, because only
// this function knows where the text was broken.
//
// More text than `maxRows` scrolls rather than growing the footer past the
// screen, and the window keeps the cursor in view, because the row being typed
// on is the one row that must never be the one dropped.
export function composerLines(
  buffer: Buffer,
  width: number,
  cursor: number,
  maxRows: number,
): Line[] {
  const empty = buffer.text === "";
  const body = composerBody(buffer);
  let rows = wrapRows(body, width - 2);

  const at = cursor < 0 ? undefined : caretAt(rows, empty ? 0 : cursor);
  // A cursor at the end of a row that fills the width belongs on the next row,
  // which the text alone does not produce.
  if (at && at.column >= width - 2) {
    rows.push({ text: "", start: body.length });
    at.row = rows.length - 1;
    at.column = 0;
  }

  let first = 0;
  if (rows.length > maxRows) {
    const anchor = at ? at.row : rows.length - 1;
    first = Math.min(Math.max(0, anchor - maxRows + 1), rows.length - maxRows);
    rows = rows.slice(first, first + maxRows);
    if (at) at.row -= first;
  }

  return rows.map((row, index): Line => {
    const text = padLine(row.text, width - 2);
    const line: Line = [
      { text: index === 0 && first === 0 ? "› " : "  ", dim: empty },
    ];
    if (!at || at.row !== index) {
      line.push({ text, dim: empty });
      return line;
    }

    const before = fitLine(text, at.column);
    const under = graphemes(text.slice(before.length))[0]?.text ?? " ";
    if (before !== "") line.push({ text: before, dim: empty });
    line.push({ text: under, inverse: true });
    line.push({
      text: padLine(
        text.slice(before.length + under.length),
        width - 2 - at.column - cells(under),
      ),
      dim: empty,
    });
    return line;
  });
}

function composerBody(buffer: Buffer): string {
  return buffer.text === "" ? PLACEHOLDER : buffer.text;
}

// The name column stops growing here; past it a long name is cut rather than
// starving the summary beside it.
const MENU_NAME_MAX = 28;
const MENU_GAP = 2;
// Two rows of summary: as much as the eye takes in while the list is filtering.
const MENU_DESCRIPTION_ROWS = 2;
// Narrower than this and the summary column is dropped instead of being shown
// one word wide.
const MENU_DESCRIPTION_MIN = 16;

export interface MenuEntry {
  name: string;
  description: string;
  // Where the query matched the name, so this file does not search it again to
  // decide what to embolden.
  match: { start: number; end: number } | undefined;
}

// How many rows the menu would take unbounded, which is what the footer plan
// clamps. It asks menuLines for the same reason composerRows does: the wrap
// decides the count, and a second count would disagree with it.
export function menuRows(entries: MenuEntry[], width: number): number {
  return menuLines(entries, 0, width, Number.POSITIVE_INFINITY).length;
}

// The command menu: names down the left, summaries beside them, the selected
// row picked out. More entries than `maxRows` scroll, keeping the selected one
// whole and on screen, because a selection nobody can see cannot be corrected.
export function menuLines(
  entries: MenuEntry[],
  selected: number,
  width: number,
  maxRows: number,
): Line[] {
  if (entries.length === 0 || maxRows < 1) return [];

  const longest = entries.reduce(
    (most, entry) => Math.max(most, cells(entry.name)),
    0,
  );
  const nameWidth = Math.max(
    0,
    Math.min(longest, MENU_NAME_MAX, width - MENU_GAP),
  );
  const descriptionWidth = width - nameWidth - MENU_GAP;
  const blocks = entries.map((entry, index) =>
    entryLines(
      entry,
      index === selected,
      nameWidth,
      descriptionWidth >= MENU_DESCRIPTION_MIN ? descriptionWidth : 0,
    ),
  );

  const window = visibleEntries(
    blocks.map((block) => block.length),
    Math.max(0, Math.min(selected, entries.length - 1)),
    maxRows,
  );
  return blocks
    .slice(window.first, window.last)
    .flat()
    .slice(0, maxRows === Number.POSITIVE_INFINITY ? undefined : maxRows);
}

function entryLines(
  entry: MenuEntry,
  selected: boolean,
  nameWidth: number,
  descriptionWidth: number,
): Line[] {
  const name = nameChunks(entry, selected, nameWidth);
  if (descriptionWidth <= 0) return [name];

  const all = wrap(entry.description, descriptionWidth);
  const shown = all.slice(0, MENU_DESCRIPTION_ROWS);
  const last = shown.length - 1;
  if (all.length > shown.length && last >= 0) {
    shown[last] = elideLine(
      `${shown[last]} ${all[shown.length]}`,
      descriptionWidth,
    );
  }

  const indent: Line = [{ text: " ".repeat(nameWidth + MENU_GAP) }];
  return shown.map(
    (row, index): Line => [
      ...(index === 0 ? name : indent),
      selected ? { text: row, color: "cyan" } : { text: row, dim: true },
    ],
  );
}

function nameChunks(
  entry: MenuEntry,
  selected: boolean,
  nameWidth: number,
): Line {
  const text = elideLine(entry.name, nameWidth);
  const pad = { text: " ".repeat(nameWidth - cells(text) + MENU_GAP) };
  const base: Chunk = selected
    ? { text: "", color: "yellow", bold: true }
    : { text: "", dim: true };

  const span = entry.match;
  const end = span ? Math.min(span.end, text.length) : 0;
  if (!span || span.start >= end) return [{ ...base, text }, pad];

  const chunks: Line = [];
  const before = text.slice(0, span.start);
  if (before) chunks.push({ ...base, text: before });
  chunks.push({
    ...base,
    text: text.slice(span.start, end),
    bold: true,
    dim: false,
  });
  const after = text.slice(end);
  if (after) chunks.push({ ...base, text: after });
  chunks.push(pad);
  return chunks;
}

// Grows the window outwards from the selected entry, downwards first, and never
// splits an entry across the edge: half a summary reads as a different command.
function visibleEntries(
  heights: number[],
  selected: number,
  maxRows: number,
): { first: number; last: number } {
  let first = selected;
  let last = selected;
  let used = heights[selected] ?? 0;

  for (;;) {
    const next = last + 1 < heights.length ? heights[last + 1]! : undefined;
    if (next !== undefined && used + next <= maxRows) {
      used += next;
      last += 1;
      continue;
    }
    const previous = first > 0 ? heights[first - 1]! : undefined;
    if (previous !== undefined && used + previous <= maxRows) {
      used += previous;
      first -= 1;
      continue;
    }
    return { first, last: last + 1 };
  }
}

// The footer's own frame: the approval's border, heading and hint rows.
const APPROVAL_FRAME = 4;
// The composer's top and bottom rules.
const COMPOSER_FRAME = 2;
// However many commands match, the menu stops here: it is a list to pick from,
// not the screen.
const MENU_MAX_ROWS = 10;

export interface FooterWants {
  // Terminal rows, all of them.
  height: number;
  liveRows: number;
  // Rows of approval detail, or undefined when nothing is waiting.
  detailRows: number | undefined;
  menuRows: number;
  queuedRows: number;
  composerRows: number;
  spinner: boolean;
}

export interface FooterPlan {
  live: number;
  detail: number;
  menu: number;
  queued: number;
  composer: number;
  spinner: number;
  // What the renderer must reserve, which is never the whole screen.
  rows: number;
}

// Hands out the footer's rows in the order they can least afford to be lost.
//
// @opentui/core clamps footerHeight to the terminal's height and then computes
// renderOffset from it, so a footer asking for more rows than the screen has
// takes the whole screen: the scrollback region collapses to nothing, the
// bounded scroll region is never installed, and appended output scrolls the
// footer away. One row is therefore always left to the transcript.
export function footerPlan(wants: FooterWants): FooterPlan {
  let left = Math.max(1, wants.height - 1);

  // The status line, then the composer: without them there is nothing to type
  // into and no way to see what was typed.
  const status = 1;
  left -= status;

  const composer = clamp(wants.composerRows, 1, left - COMPOSER_FRAME);
  left -= composer + COMPOSER_FRAME;

  // An approval is a question; leaving it off screen leaves the run stuck.
  const detail =
    wants.detailRows === undefined
      ? 0
      : clamp(wants.detailRows, 0, left - APPROVAL_FRAME);
  const approval = wants.detailRows === undefined ? 0 : detail + APPROVAL_FRAME;
  left -= approval;

  // Ahead of the transcript's own rows: the menu is what the operator is
  // working in, and a menu with no rows is a list nobody can pick from.
  const menu = clamp(wants.menuRows, 0, Math.min(left, MENU_MAX_ROWS));
  left -= menu;

  const spinner = wants.spinner && left >= 1 ? 1 : 0;
  left -= spinner;

  const live = clamp(wants.liveRows, 0, left);
  left -= live;

  const queued = clamp(wants.queuedRows, 0, left);

  const rows =
    status +
    composer +
    COMPOSER_FRAME +
    approval +
    menu +
    spinner +
    live +
    queued;

  return {
    live,
    detail,
    menu,
    queued,
    composer,
    spinner,
    // Below five rows even the composer alone does not fit; the cap keeps the
    // transcript's row rather than letting the footer take the screen.
    rows: Math.min(rows, Math.max(1, wants.height - 1)),
  };
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, Math.max(low, high)));
}

function marked(
  glyph: string,
  color: string,
  body: string,
  width: number,
  bodyColor?: string,
): Line[] {
  const indent = cells(glyph);
  return [
    [],
    ...wrap(body, width - indent).map(
      (row, index): Line => [
        { text: index === 0 ? glyph : " ".repeat(indent), color },
        { text: row, ...(bodyColor !== undefined ? { color: bodyColor } : {}) },
      ],
    ),
  ];
}

function tool(
  item: Extract<TranscriptItem, { kind: "tool" }>,
  width: number,
): Line[] {
  const marker = MARKERS[item.status];
  const argument = toolArgument(item.args);

  const head: Line = [
    { text: `${marker.glyph} `, color: marker.color },
    { text: `Ran ${item.name}`, bold: true },
  ];
  if (argument) head.push({ text: ` ${argument}`, color: "cyan" });
  if (item.status === "running") head.push({ text: " …", dim: true });

  const lines: Line[] = [[], fitChunks(head, width)];
  const output = elide(item.content);

  for (const [index, row] of output.head.entries()) {
    lines.push([
      { text: fitLine(`${index === 0 ? "└ " : "  "}${row}`, width), dim: true },
    ]);
  }
  if (output.hidden > 0) {
    lines.push([
      { text: fitLine(`  … +${output.hidden} lines`, width), dim: true },
    ]);
  }
  for (const row of output.tail) {
    lines.push([{ text: fitLine(`  ${row}`, width), dim: true }]);
  }
  return lines;
}

function banner(
  model: string,
  workspace: string,
  version: string,
  width: number,
): Line[] {
  // Only the prompt sign and the name are at full strength; the rest is chrome.
  return [
    fitChunks(
      [
        { text: ">_ ", bold: true },
        { text: "infinity", bold: true },
        { text: ` v${version}`, dim: true },
      ],
      width,
    ),
    [],
    [{ text: fitLine(`model: ${model}`, width), dim: true }],
    [
      {
        text: fitLine(`directory: ${shortenPath(workspace, 60)}`, width),
        dim: true,
      },
    ],
  ];
}

interface Row {
  text: string;
  // Offset into the wrapped string, so a cursor can be placed on a row.
  start: number;
}

// Breaks on spaces where it can, mid-word only when a word is longer than the line.
export function wrap(text: string, width: number): string[] {
  return wrapRows(text, width).map((row) => row.text);
}

function wrapRows(text: string, width: number): Row[] {
  const rows: Row[] = [];
  let offset = 0;

  // A newline in the text is a row the caller never counted unless it is broken
  // here: a chunk carrying one renders as two rows.
  for (const paragraph of text.split("\n")) {
    for (const row of wrapParagraph(paragraph, width)) {
      rows.push({ text: row.text, start: offset + row.start });
    }
    offset += paragraph.length + 1;
  }
  return rows;
}

// Every printable ASCII character is one cell wide and one code unit long, so
// a paragraph made only of them can be measured by counting. Asking the
// segmenter costs more than the wrap it feeds: 0.16ms against 0.011ms for a
// 4KB answer, measured, which is most of what streaming an answer spends.
const PLAIN = /^[\x20-\x7e]*$/;

function wrapParagraph(text: string, width: number): Row[] {
  if (width >= 1 && PLAIN.test(text)) return wrapPlain(text, width);

  const segments = graphemes(text);
  if (segments.length === 0) return [{ text: "", start: 0 }];

  const rows: Row[] = [];
  let start = 0;
  let used = 0;
  // One past the last space on the row, so a break keeps the space behind it.
  let breakAt = -1;
  let index = 0;

  const take = (end: number): void => {
    const from = segments[start]!.index;
    const to = end < segments.length ? segments[end]!.index : text.length;
    rows.push({ text: text.slice(from, to), start: from });
    start = end;
    used = 0;
    breakAt = -1;
  };

  while (index < segments.length) {
    const segment = segments[index]!;
    const next = used + cells(segment.text);
    // `index > start` keeps a grapheme wider than the whole row moving, rather
    // than breaking before itself for ever.
    if (next > width && index > start) {
      const cut = breakAt > start ? breakAt : index;
      take(cut);
      index = cut;
      continue;
    }
    used = next;
    if (segment.text === " ") breakAt = index + 1;
    index += 1;
  }
  take(segments.length);
  return rows;
}

// A transcription of the loop above with the width of a character known to be
// one. The two are kept identical by a test that wraps the same corpus through
// both; change one and change the other.
function wrapPlain(text: string, width: number): Row[] {
  if (text.length === 0) return [{ text: "", start: 0 }];

  const rows: Row[] = [];
  let start = 0;
  let used = 0;
  let breakAt = -1;
  let index = 0;

  const take = (end: number): void => {
    rows.push({ text: text.slice(start, end), start });
    start = end;
    used = 0;
    breakAt = -1;
  };

  while (index < text.length) {
    const next = used + 1;
    if (next > width && index > start) {
      const cut = breakAt > start ? breakAt : index;
      take(cut);
      index = cut;
      continue;
    }
    used = next;
    if (text[index] === " ") breakAt = index + 1;
    index += 1;
  }
  take(text.length);
  return rows;
}

function caretAt(rows: Row[], cursor: number): { row: number; column: number } {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]!;
    if (cursor >= row.start) {
      return {
        row: index,
        column: cells(row.text.slice(0, cursor - row.start)),
      };
    }
  }
  return { row: 0, column: 0 };
}
