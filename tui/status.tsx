/**
 * The spinner and the status line. Both live in the footer, which is redrawn
 * every frame, so neither is ever committed to scrollback.
 */

import { useEffect, useState } from "react";
import { TextAttributes } from "@opentui/core";
import { elapsed, opaque, padLine, shortenPath } from "./format.ts";

const FRAMES = ["✳", "✻", "✽", "✻"];

const FRAME_MS = 120;

export function Spinner({ since, width }: { since: number; width: number }) {
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
    <text fg="yellow">
      {opaque(padLine(
        `${FRAMES[frame]} Working (${elapsed(now - since)} · esc to interrupt)`,
        width,
      ))}
    </text>
  );
}

export function StatusLine({
  model,
  workspace,
  session,
  turn,
  width,
}: {
  model: string;
  workspace: string;
  session: string;
  turn: number;
  width: number;
}) {
  return (
    <text attributes={TextAttributes.DIM}>
      {opaque(padLine(
        `  ${model} · ${shortenPath(workspace)} · ${session}` +
          (turn > 0 ? ` · turn ${turn}` : ""),
        width,
      ))}
    </text>
  );
}
