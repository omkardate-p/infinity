---
name: verify
description: Prove an infinity change by running it, and report the artifact rather than the intention. Covers driving the CLI against real Ollama in a throwaway workspace, checking what a tool did to disk instead of trusting the transcript, and reading eval pass rate across repeats. Use whenever a change touches the agent loop, a tool, the CLI or the TUI, or before reporting any behaviour claim. Differentiator: `bun run check` proves the code compiles and the unit tests pass; this proves the running agent behaves, which no test here can, because tests never call a model.
---

# Verify

Report the artifact: a file on disk, a session file, an exit code, a pass rate. "Should work" is not verification, and neither is the transcript the agent printed about its own work. `bun run check` is the floor, not the proof.

Check what is resident with `ollama ps` first, and never leave a CLI run and an eval sweep going together. The second load evicts the first mid-run and surfaces as a nonsense failure, not as memory pressure.

## Run the CLI in a throwaway workspace

The workspace is the shell's directory, so a run started here edits this repo, including the files your change is being judged on.

```bash
repo=$PWD
scratch=$(mktemp -d)
cd "$scratch"
git init -q
printf 'export const total = (n: number[]) => n.reduce((a, b) => a + b, 0);\n' > total.ts
bun run "$repo/src/cli.ts" --no-tui --yes --max-turns 2 "add a test for total"
echo "exit=$?"
```

- Invoke the entry point by absolute path, never `bun run infinity`: that name resolves to whatever is on PATH, and inside the repo it makes the repo the workspace, which is what the scratch directory existed to prevent. Nothing else overrides the shell's directory, there is no workspace flag, and an invented one prints `Unknown flag` and exits 0, reading like a hung run.
- `--yes` is required non-interactively. Without it approval denies on a stdin nobody can answer, and the run reads like a model that will not use its tools.
- Pass `--no-tui`. Captured output is never a TTY, so this path runs either way; passing it makes the transcript state which one ran.
- Exit 0 means the loop completed. Every other stop exits 1.

## Check the workspace, not the transcript

```bash
git -C "$scratch" status --porcelain && git -C "$scratch" diff
cat "$scratch"/.infinity/sessions/*.json
```

A tool that returned the wrong thing still produces a confident transcript, so compare the two before believing either: a session entry claiming success beside a file that did not change is our defect, not the model's judgement. When the claim is about one tool, call it directly from a `bun` one-liner against a temp workspace rather than hoping the model reaches it.

## Evals

```bash
bun run evals:fast
bun run evals/run.ts --task fix-failing-test --repeats 5
bun run evals/run.ts --out /tmp/sweep.json
```

Flags: `--model`, `--provider`, `--repeats`, `--fast`, `--task`, `--max-turns`, `--out`, `--help`.

Read the pass rate across repeats, never one run; a single pass is indistinguishable from luck. A rate that moved while the rejected-call and failed-edit counts stayed flat is model variance, and those counts moving is a defect to fix. Compare against a recorded sweep on the same model.

## What cannot be proven here

The TUI needs a pty and there is none in a tool call. Key disambiguation, focus reporting, paste as one event, the pinned footer, scrollback and resize replay are checked by a human at a real terminal or not at all; a person runs `bun run tui/keyprobe.ts` and pastes back what their terminal emitted.

Say which of these you checked by hand, on which terminal, and what you saw. An unchecked one is reported as unchecked.
