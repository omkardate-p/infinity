/**
 * The approval prompt. The tool asks, not the loop, so what is shown is
 * whatever that tool put in its ApprovalRequest: a command line, or the diff
 * edit_file built. detail is genuinely absent for a shell command in the
 * workspace root, which is why nothing here assumes it.
 */

import { Box, Text, useInput } from "ink";
import type { ApprovalRequest } from "../src/tools/tool.ts";

export function Approval({
  request,
  onDecide,
}: {
  request: ApprovalRequest;
  onDecide(decision: "allow" | "deny"): void;
}) {
  useInput((input, key) => {
    const answer = input.toLowerCase();
    if (answer === "y") return onDecide("allow");
    if (answer === "n" || key.escape) return onDecide("deny");
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      marginTop={1}
    >
      <Text>
        <Text bold color="yellow">
          Approve {request.tool}
        </Text>
        <Text dimColor> · </Text>
        <Text>{request.summary}</Text>
      </Text>

      {request.detail ? (
        <Box flexDirection="column" marginTop={1}>
          {request.detail.split("\n").map((line, index) => (
            <DiffLine key={index} line={line} />
          ))}
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text dimColor>[y] allow · [n] deny</Text>
      </Box>
    </Box>
  );
}

function DiffLine({ line }: { line: string }) {
  const color = diffColor(line);
  return <Text {...(color ? { color } : {})}>{line}</Text>;
}

function diffColor(line: string): string | undefined {
  if (line.startsWith("+")) return "green";
  if (line.startsWith("-")) return "red";
  if (line.startsWith("@@")) return "cyan";
  return undefined;
}
