/**
 * The composer's text buffer. Pure string and cursor arithmetic, so the part
 * of the input that is easy to get wrong can be tested without a terminal.
 * Nothing here knows about keys or rendering.
 */

import { graphemes } from "../rendering/format.ts";

export interface Buffer {
  text: string;
  // Offset into text, from 0 to text.length.
  cursor: number;
}

export function emptyBuffer(): Buffer {
  return { text: "", cursor: 0 };
}

export function insert(buffer: Buffer, inserted: string): Buffer {
  return {
    text:
      buffer.text.slice(0, buffer.cursor) +
      inserted +
      buffer.text.slice(buffer.cursor),
    cursor: buffer.cursor + inserted.length,
  };
}

export function backspace(buffer: Buffer): Buffer {
  const start = before(buffer.text, buffer.cursor);
  if (start === buffer.cursor) return buffer;
  return {
    text: buffer.text.slice(0, start) + buffer.text.slice(buffer.cursor),
    cursor: start,
  };
}

export function deleteForward(buffer: Buffer): Buffer {
  const end = after(buffer.text, buffer.cursor);
  if (end === buffer.cursor) return buffer;
  return {
    text: buffer.text.slice(0, buffer.cursor) + buffer.text.slice(end),
    cursor: buffer.cursor,
  };
}

export function left(buffer: Buffer): Buffer {
  return { ...buffer, cursor: before(buffer.text, buffer.cursor) };
}

export function right(buffer: Buffer): Buffer {
  return { ...buffer, cursor: after(buffer.text, buffer.cursor) };
}

export function lineStart(buffer: Buffer): Buffer {
  return { ...buffer, cursor: startOfLine(buffer.text, buffer.cursor) };
}

export function lineEnd(buffer: Buffer): Buffer {
  return { ...buffer, cursor: endOfLine(buffer.text, buffer.cursor) };
}

export function up(buffer: Buffer): Buffer {
  const start = startOfLine(buffer.text, buffer.cursor);
  if (start === 0) return buffer;

  const column = buffer.cursor - start;
  const previousStart = startOfLine(buffer.text, start - 1);
  const previousEnd = start - 1;
  return {
    ...buffer,
    cursor: Math.min(previousStart + column, previousEnd),
  };
}

export function down(buffer: Buffer): Buffer {
  const end = endOfLine(buffer.text, buffer.cursor);
  if (end === buffer.text.length) return buffer;

  const column = buffer.cursor - startOfLine(buffer.text, buffer.cursor);
  const nextStart = end + 1;
  const nextEnd = endOfLine(buffer.text, nextStart);
  return { ...buffer, cursor: Math.min(nextStart + column, nextEnd) };
}

// The cursor moves a whole grapheme at a time. A code unit at a time lands
// between the halves of a surrogate pair or between a letter and its accent,
// and the next backspace then sends half a character to the model.
function before(text: string, offset: number): number {
  let previous = 0;
  for (const { index } of graphemes(text)) {
    if (index >= offset) break;
    previous = index;
  }
  return offset <= 0 ? 0 : previous;
}

function after(text: string, offset: number): number {
  for (const { index, text: segment } of graphemes(text)) {
    if (index >= offset) return index + segment.length;
  }
  return text.length;
}

function startOfLine(text: string, offset: number): number {
  return text.lastIndexOf("\n", offset - 1) + 1;
}

function endOfLine(text: string, offset: number): number {
  const index = text.indexOf("\n", offset);
  return index === -1 ? text.length : index;
}
