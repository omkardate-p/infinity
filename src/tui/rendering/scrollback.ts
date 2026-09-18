/**
 * Writes finished lines into the terminal's own scrollback, so the transcript
 * scrolls the whole window the way any command's output does.
 *
 * Scrollback is append-only: a line written here can never be revised. That is
 * why the caller sends a line only once it is final — for a streaming answer,
 * every row but the one still being filled — and keeps the rest in the footer,
 * which is redrawn.
 *
 * A snapshot is laid out once, at the width in force when it was written, and
 * is never touched again. When the terminal is resized the whole transcript is
 * replayed at the new width, which is why the view model keeps every committed
 * item rather than handing them to the renderer and forgetting them.
 */

import { type CliRenderer, TextRenderable } from "@opentui/core";
import type { TranscriptItem } from "../../domain/messages.ts";
import { itemLines, type Line, styledText } from "./lines.ts";

export function commitLines(renderer: CliRenderer, lines: Line[]): void {
  if (lines.length === 0) return;

  renderer.writeToScrollback((ctx) => ({
    root: new TextRenderable(ctx.renderContext, {
      content: styledText(lines),
      width: ctx.width,
    }),
    width: ctx.width,
    height: lines.length,
  }));
}

// Clears what the terminal is holding and writes every item again at the
// current width. Without this a resize leaves the transcript at whatever width
// it happened to be written at.
export function replay(
  renderer: CliRenderer,
  items: readonly TranscriptItem[],
  width: number,
): void {
  renderer.resetSplitFooterForReplay({ clearSavedLines: true });
  for (const item of items) commitLines(renderer, itemLines(item, width));
}
