/**
 * The prompt input. Multiline, because a coding task rarely fits on one line.
 *
 * Enter submits and Shift+Enter inserts a newline. A terminal sends the same
 * bytes for both until the kitty keyboard protocol is negotiated, which run.ts
 * does; Shift+Enter then arrives here as a return key with shift set. Pasted
 * text comes through usePaste, on its own channel, so a multi-line paste is
 * never a row of Enter presses.
 */

import { useEffect, useRef, useState } from "react";
import { useBlur, useFocus, useKeyboard, usePaste } from "@opentui/react";
import { composerLines, opaqueLines, styledText } from "./lines.ts";
import {
  backspace,
  emptyBuffer,
  deleteForward,
  down,
  insert,
  left,
  lineEnd,
  lineStart,
  right,
  up,
  type Buffer,
} from "./editor.ts";

export function Composer({
  buffer,
  width,
  maxRows,
  onChange,
  onSubmit,
  isActive,
}: {
  buffer: Buffer;
  width: number;
  /** Rows the footer can spare; more text than that scrolls under the cursor. */
  maxRows: number;
  onChange(next: Buffer): void;
  /** Returns false when the prompt was refused, so the text is kept. */
  onSubmit(text: string): boolean;
  isActive: boolean;
}) {
  // The key handler is subscribed once and several keystrokes can arrive before
  // React re-renders, so the buffer is mirrored here and updated as each edit
  // is made. Reading it from the closure, or syncing it only on render, edits a
  // buffer from before the previous keystroke.
  const latest = useRef(buffer);
  if (latest.current.text !== buffer.text) latest.current = buffer;

  // Focus here is the terminal window's, reported by the emulator. A cursor
  // that keeps blinking in a window nobody is looking at is noise.
  const [windowFocused, setWindowFocused] = useState(true);
  useFocus(() => setWindowFocused(true));
  useBlur(() => setWindowFocused(false));

  // The cursor holds steady while keys are arriving and blinks once they stop,
  // so it reads as a resting caret rather than flickering under the typing.
  const typedAt = useRef(0);
  const [blinkOn, setBlinkOn] = useState(true);
  useEffect(() => {
    if (!isActive || !windowFocused) return;
    const timer = setInterval(() => {
      setBlinkOn((on) =>
        Date.now() - typedAt.current < BLINK_MS ? true : !on,
      );
    }, BLINK_MS);
    return () => clearInterval(timer);
  }, [isActive, windowFocused]);

  const edit = (change: (previous: Buffer) => Buffer): void => {
    typedAt.current = Date.now();
    setBlinkOn(true);
    latest.current = change(latest.current);
    onChange(latest.current);
  };

  // A paste arrives as raw bytes on its own channel, so a multi-line paste is
  // never mistaken for a row of Enter presses.
  const decoder = new TextDecoder();
  usePaste((event) => {
    if (isActive)
      edit((previous) => insert(previous, decoder.decode(event.bytes)));
  });

  useKeyboard((key) => {
    if (!isActive) return;

    switch (key.name) {
      case "return":
      case "enter": {
        if (key.shift) return edit((previous) => insert(previous, "\n"));
        const text = latest.current.text.trim();
        if (!text) return;
        // Cleared here rather than waiting for the parent's next render: keys
        // can arrive before React re-renders and would otherwise append to the
        // prompt that was just sent.
        if (onSubmit(text)) latest.current = emptyBuffer();
        return;
      }
      case "backspace":
        return edit(backspace);
      case "delete":
        return edit(deleteForward);
      case "left":
        return edit(left);
      case "right":
        return edit(right);
      case "up":
        return edit(up);
      case "down":
        return edit(down);
      case "home":
        return edit(lineStart);
      case "end":
        return edit(lineEnd);
    }

    if (key.ctrl) {
      if (key.name === "a") edit(lineStart);
      if (key.name === "e") edit(lineEnd);
      return;
    }

    // Anything that is not a named key and carries one printable character.
    if (key.sequence.length === 1 && key.sequence >= " ") {
      const { sequence } = key;
      edit((previous) => insert(previous, sequence));
    }
  });

  const showCaret = isActive && windowFocused && blinkOn;

  return (
    <box
      flexDirection="column"
      border={["top", "bottom"]}
      borderStyle="single"
      borderColor="#4a4a4a"
    >
      {composerLines(
        buffer,
        width,
        showCaret ? buffer.cursor : -1,
        maxRows,
      ).map((line, index) => (
        <text key={index} content={styledText(opaqueLines([line]))} />
      ))}
    </box>
  );
}

/** Half a blink: how long the cursor stays shown, and then hidden. */
const BLINK_MS = 500;
