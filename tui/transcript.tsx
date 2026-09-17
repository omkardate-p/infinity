/**
 * Draws transcript items. Committed items go through <Static>, which writes
 * them to the terminal once and never redraws them, so scrollback belongs to
 * the terminal and this file owns no viewport. The live item is the only thing
 * that re-renders.
 */

import { Box, Static, Text } from "ink";
import type { TranscriptItem } from "./view-model.ts";
import { elide, toolArgument } from "./format.ts";

const MARKERS = {
  running: { glyph: "●", color: "yellow" },
  ok: { glyph: "●", color: "green" },
  failed: { glyph: "✗", color: "red" },
} as const;

export function Transcript({
  committed,
  live,
  width,
}: {
  committed: TranscriptItem[];
  live: TranscriptItem | undefined;
  width: number;
}) {
  return (
    <>
      <Static items={committed}>
        {(item) => <Item key={item.key} item={item} width={width} />}
      </Static>
      {live ? <Item item={live} width={width} /> : null}
    </>
  );
}

function Item({ item, width }: { item: TranscriptItem; width: number }) {
  switch (item.kind) {
    case "rule":
      return (
        <Box marginY={1}>
          <Text dimColor>{"─".repeat(Math.max(0, width - 2))}</Text>
        </Box>
      );

    case "user":
      return (
        <Box marginTop={1}>
          <Text color="cyan">{"› "}</Text>
          <Text>{item.text}</Text>
        </Box>
      );

    case "assistant":
      return (
        <Box marginTop={1}>
          <Text color="green">{"● "}</Text>
          <Text>{item.text}</Text>
        </Box>
      );

    case "tool":
      return <ToolItem item={item} />;

    case "error":
      return (
        <Box marginTop={1}>
          <Text color="red">{"✗ "}</Text>
          <Text color="red">{item.message}</Text>
        </Box>
      );

    case "notice":
      return (
        <Box marginTop={1}>
          <Text dimColor>
            {NOTICES[item.reason]} after {item.turns}{" "}
            {item.turns === 1 ? "turn" : "turns"}
          </Text>
        </Box>
      );
  }
}

const NOTICES = {
  completed: "Done",
  max_turns: "Stopped at the turn limit",
  aborted: "Interrupted",
  denial_limit: "Stopped after too many refusals",
  model_error: "Stopped",
} as const;

function ToolItem({
  item,
}: {
  item: Extract<TranscriptItem, { kind: "tool" }>;
}) {
  const marker = MARKERS[item.status];
  const argument = toolArgument(item.args);
  const output = elide(item.content);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={marker.color}>{marker.glyph} </Text>
        <Text bold>Ran {item.name}</Text>
        {argument ? <Text color="cyan"> {argument}</Text> : null}
        {item.status === "running" ? <Text dimColor> …</Text> : null}
      </Box>

      {output.head.map((line, index) => (
        <OutputLine key={index} prefix={index === 0 ? "└ " : "  "} text={line} />
      ))}
      {output.hidden > 0 ? (
        <OutputLine prefix="  " text={`… +${output.hidden} lines`} />
      ) : null}
      {output.tail.map((line, index) => (
        <OutputLine key={`tail-${index}`} prefix="  " text={line} />
      ))}
    </Box>
  );
}

function OutputLine({ prefix, text }: { prefix: string; text: string }) {
  return (
    <Box>
      <Text dimColor>{prefix}</Text>
      <Text dimColor>{text}</Text>
    </Box>
  );
}
