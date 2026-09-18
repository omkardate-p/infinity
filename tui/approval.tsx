/**
 * The approval prompt. The tool asks, not the loop, so what is shown is
 * whatever that tool put in its ApprovalRequest: a command line, or the diff
 * edit_file built. detail is genuinely absent for a shell command in the
 * workspace root, which is why nothing here assumes it.
 */

import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import type { ApprovalRequest } from "../src/tools/tool.ts";
import { opaque, padLine } from "./format.ts";

export function Approval({
  request,
  width,
  maxDetail,
  onDecide,
}: {
  request: ApprovalRequest;
  width: number;
  /** Rows the footer can spare for the detail; a longer diff loses its middle. */
  maxDetail: number;
  onDecide(decision: "allow" | "deny"): void;
}) {
  useKeyboard((key) => {
    const answer = key.name.toLowerCase();
    if (answer === "y") return onDecide("allow");
    if (answer === "n" || answer === "escape") return onDecide("deny");
  });

  const all = request.detail ? request.detail.split("\n") : [];
  const shown =
    all.length > maxDetail ? Math.max(0, maxDetail - 1) : all.length;
  const detail =
    shown === all.length
      ? all
      : [...all.slice(0, shown), `… +${all.length - shown} lines`].slice(
          0,
          maxDetail,
        );

  // Border and padding take two cells on each side.
  const inner = width - 4;

  return (
    <box
      flexDirection="column"
      border={true}
      borderStyle="rounded"
      borderColor="yellow"
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg="yellow">
        {opaque(padLine(`Approve ${request.tool} · ${request.summary}`, inner))}
      </text>
      {detail.map((line, index) => (
        <text key={index} fg={diffColor(line)}>
          {opaque(padLine(line, inner))}
        </text>
      ))}
      <text attributes={TextAttributes.DIM}>
        {opaque(padLine("[y] allow · [n] deny", inner))}
      </text>
    </box>
  );
}

function diffColor(line: string): string {
  if (line.startsWith("+")) return "green";
  if (line.startsWith("-")) return "red";
  if (line.startsWith("@@")) return "cyan";
  return "white";
}
