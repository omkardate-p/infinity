/**
 * The prompt input. Multiline, because a coding task rarely fits on one line
 * and every maintained Ink input is single-line.
 *
 * Enter submits and Shift+Enter inserts a newline. Terminals that send the same
 * bytes for both cannot distinguish them, and there is no way for this file to
 * tell; that is a property of the emulator, checked by hand rather than guessed
 * at here. Pasted text arrives through usePaste, on a separate channel, so a
 * multi-line paste never reads as a row of Enter presses.
 */

import { Box, Text, useInput, usePaste } from "ink";
import {
  backspace,
  deleteForward,
  down,
  insert,
  left,
  lineEnd,
  lineStart,
  position,
  right,
  up,
  type Buffer,
} from "./editor.ts";

export function Composer({
  buffer,
  onChange,
  onSubmit,
  isActive,
}: {
  buffer: Buffer;
  onChange(next: Buffer): void;
  onSubmit(text: string): void;
  isActive: boolean;
}) {
  usePaste((text) => onChange(insert(buffer, text)), { isActive });

  useInput(
    (input, key) => {
      if (key.return) {
        if (key.shift) {
          onChange(insert(buffer, "\n"));
          return;
        }
        const text = buffer.text.trim();
        if (text) onSubmit(text);
        return;
      }

      if (key.backspace) return onChange(backspace(buffer));
      if (key.delete) return onChange(deleteForward(buffer));
      if (key.leftArrow) return onChange(left(buffer));
      if (key.rightArrow) return onChange(right(buffer));
      if (key.upArrow) return onChange(up(buffer));
      if (key.downArrow) return onChange(down(buffer));
      if (key.home || (key.ctrl && input === "a"))
        return onChange(lineStart(buffer));
      if (key.end || (key.ctrl && input === "e"))
        return onChange(lineEnd(buffer));

      if (key.ctrl || key.escape || key.tab || key.meta) return;
      if (input) onChange(insert(buffer, input));
    },
    { isActive },
  );

  const lines = buffer.text.split("\n");
  const caret = position(buffer);

  return (
    <Box borderStyle="round" borderDimColor paddingX={1} flexDirection="column">
      {lines.map((line, index) => (
        <Box key={index}>
          <Text color="cyan">{index === 0 ? "› " : "  "}</Text>
          {buffer.text === "" && index === 0 ? (
            <Text dimColor>Ask infinity to do anything</Text>
          ) : (
            <Line
              text={line}
              caret={isActive && index === caret.line ? caret.column : -1}
            />
          )}
        </Box>
      ))}
    </Box>
  );
}

/** The caret is drawn as an inverted cell, so no real cursor has to be moved. */
function Line({ text, caret }: { text: string; caret: number }) {
  if (caret < 0) return <Text>{text}</Text>;

  return (
    <Text>
      {text.slice(0, caret)}
      <Text inverse>{text[caret] ?? " "}</Text>
      {text.slice(caret + 1)}
    </Text>
  );
}
