/**
 * The composer's text buffer. Pure string and cursor arithmetic, so the part
 * of the input that is easy to get wrong can be tested without a terminal.
 * Nothing here knows about Ink, keys or rendering.
 */

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
  if (buffer.cursor === 0) return buffer;
  return {
    text:
      buffer.text.slice(0, buffer.cursor - 1) + buffer.text.slice(buffer.cursor),
    cursor: buffer.cursor - 1,
  };
}

export function deleteForward(buffer: Buffer): Buffer {
  if (buffer.cursor >= buffer.text.length) return buffer;
  return {
    text:
      buffer.text.slice(0, buffer.cursor) + buffer.text.slice(buffer.cursor + 1),
    cursor: buffer.cursor,
  };
}

export function left(buffer: Buffer): Buffer {
  return { ...buffer, cursor: Math.max(0, buffer.cursor - 1) };
}

export function right(buffer: Buffer): Buffer {
  return {
    ...buffer,
    cursor: Math.min(buffer.text.length, buffer.cursor + 1),
  };
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

/** Where the cursor sits, for drawing it and for placing the caret. */
export function position(buffer: Buffer): { line: number; column: number } {
  const before = buffer.text.slice(0, buffer.cursor);
  const lines = before.split("\n");
  return {
    line: lines.length - 1,
    column: lines[lines.length - 1]!.length,
  };
}

function startOfLine(text: string, offset: number): number {
  return text.lastIndexOf("\n", offset - 1) + 1;
}

function endOfLine(text: string, offset: number): number {
  const index = text.indexOf("\n", offset);
  return index === -1 ? text.length : index;
}
