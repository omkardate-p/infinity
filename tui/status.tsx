/**
 * The fixed furniture: the banner at startup, the spinner while a turn runs,
 * and the status line under the composer. None of it reads the agent; it is
 * handed what it shows.
 */

import { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { elapsed, shortenPath } from "./format.ts";

const FRAMES = ["✳", "✻", "✽", "✻"];
const FRAME_MS = 120;

export function Banner({
  model,
  workspace,
  version,
}: {
  model: string;
  workspace: string;
  version: string;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderDimColor
      paddingX={1}
      marginBottom={1}
    >
      <Text>
        <Text dimColor>{">_ "}</Text>
        <Text bold>infinity</Text>
        <Text dimColor> ({version})</Text>
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>model: {model}</Text>
        <Text dimColor>directory: {shortenPath(workspace, 60)}</Text>
      </Box>
    </Box>
  );
}

export function Spinner({ since }: { since: number }) {
  const [frame, setFrame] = useState(0);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((previous) => (previous + 1) % FRAMES.length);
      setNow(Date.now());
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box marginTop={1}>
      <Text color="yellow">{FRAMES[frame]} </Text>
      <Text bold>Working </Text>
      <Text dimColor>
        ({elapsed(now - since)} · esc to interrupt)
      </Text>
    </Box>
  );
}

export function StatusLine({
  model,
  workspace,
  session,
  turn,
}: {
  model: string;
  workspace: string;
  session: string;
  turn: number;
}) {
  return (
    <Box paddingLeft={2}>
      <Text dimColor>
        {model} · {shortenPath(workspace)} · {session}
        {turn > 0 ? ` · turn ${turn}` : ""}
      </Text>
    </Box>
  );
}
