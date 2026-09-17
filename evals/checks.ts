/**
 * Shared helpers for fixture verifiers. A verifier's reason is the only thing
 * that survives a sweep, so it has to name the decisive line rather than the
 * fact that something failed.
 */

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

// Bun splits a failure across lines: the test name on the (fail) line, the
// values on Expected/Received, and the counts last. One of them alone does not
// say what broke, so the reason carries all three when they are there.
export function failureLine(result: CommandResult): string {
  const lines = [...result.stderr.split("\n"), ...result.stdout.split("\n")]
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const decisive = lines.filter(
    (line) =>
      line.includes("(fail)") ||
      line.startsWith("Expected:") ||
      line.startsWith("Received:") ||
      line.startsWith("error:"),
  );
  return (
    decisive.length
      ? decisive.slice(0, 4).join(" | ")
      : (lines.at(-1) ?? "no output")
  ).slice(0, 300);
}
