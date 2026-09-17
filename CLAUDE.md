# Claude Code Instructions

`infinity`, a local coding agent CLI. Small enough to read directly — never grep to find something, never delegate a lookup, never spawn an agent to describe code you could have opened.

The design lives in a spec PDF that is **not in this repo**; comments cite it as `PDF §7`. Ask for a section rather than reconstructing it.

## How to change code

These override speed. `.claude/rules/` wins where it conflicts.

### 1. Fix the cause, not the symptom

**A workaround is not a fix. Ship the cause or ship nothing.**

Follow the behaviour down as far as it goes: loop, tool, adapter, wire format, Ollama. "Three layers down" is a finding, not an excuse.

Never write compensating code: no detector correcting a bad state, no retry or timeout waiting out a race, no defensive branch hiding a value that should never have arrived, no `?.` standing in for knowing why it is null.

Agent defects wear the model's clothes. A tool quietly returning the wrong thing reads as a model that cannot follow instructions, and the tempting fix is a sentence of prompt. Prove which before changing either.

If the real fix is out of reach, say so in one line with what you found. Do not ship the workaround and call it done.

Prefer the fix whose diff is mostly deletions.

### 2. Remove complexity, including complexity you did not add

**The default is the boring solution.**

A dependency, abstraction, layer, option, wrapper, or flag needs two concrete present-day uses. One use is a function, not a pattern. A requirement nobody stated is not a requirement. One runtime dependency; a second needs a reason you can state out loud.

Existing over-engineering is not protected by being existing. In any file your change already opens, an unused abstraction, a single-caller indirection, a never-false flag, a forwarding wrapper, or dead config comes out in the same change, and the report says so.

Outside those files, name what you found and what removing it costs. Do not go hunting mid-task.

**Not now, and not as a favour.** Embeddings, retrieval, vector stores, MCP, LSP, AST editing, multi-agent anything, model routing, a TUI, remote sandboxes, cloud sync, prompt-engineering the system prompt to paper over a runtime defect. A request that lands here gets this line, not code.

### 3. Reuse, and improve what you reuse

**Never write the same thing twice. Never leave two versions standing.**

`bound()`, `ok()`, `fail()`, and `resolvePath()` exist so every tool behaves identically at its edges. A tool that formats its own error, caps its own output, or resolves its own path is a defect.

When the new way is better, improve the shared one and move every call site in the same change.

### 4. Scope

Every changed line traces to the request, or to §1-§3 in a file the change already opened.

- Match the surrounding style. The tool files are deliberately parallel.
- Don't reformat, don't rename for taste. Comments are the exception — `.claude/rules/code.md`.
- Remove what your change orphaned.

## Stop and find out

- About to write "usually", "probably", or "should work" about anything outside this repo. Hard stop.
- Ollama's `/api/chat`: stream framing, `think`, `num_ctx`, `done_reason`, tool-call encoding. Under-documented and changed across releases; `src/providers/ollama.ts` records what we learned, so read it before contradicting it.
- A Bun or TypeScript 7 behaviour. An answer written for Node or TypeScript 5 is a hypothesis.
- Adding a dependency, or a pattern heavier than the problem needs.
- A first attempt failed and you do not understand why. Do not iterate on a guess.
- A contract expensive to reverse: the shape of `src/model/types.ts`, the session format, a tool's name or schema.

An open design question or an unexplained failure goes to `research` first. Take the simplest option it returns unless the brief says why that fails, and report which you took. Everything else you read yourself, from the source closest to it.

## Boundaries

The runtime does not know which model it talks to. Breaking one of these defeats the codebase even when it passes and the tests stay green.

- `src/model/types.ts` is the provider boundary. A field belongs there only if a second provider needs it too; if it exists because Ollama emits it, it lives in `src/providers/`. `src/agent/` never imports a provider, and a new provider is one file plus one `case` in `createModel`. If adding one forces a change inside `src/agent/`, the abstraction is wrong — that is the finding, and it is fixed first.
- `resolvePath()` is the only way a tool resolves a path — not `join`, not `resolve`, not a hand-rolled `startsWith`.
- A tool returns `ok()` or `fail()` and never throws past the registry. The registry validates input; the tool does not.
- `requiresApproval: true` means await `ctx.requestApproval` before acting, then `fail(..., { reason: "denied" })` on refusal. The loop counts denials on that exact string; change it and the runaway guard dies silently.
- Touching `SessionState` or `Message` means bumping `FORMAT_VERSION`. Sessions on disk are a format.
- Tests never call a model. A behaviour only observable against Ollama is reported as checked by hand.

## Evals

`evals/run.ts` drives `Agent` against a copy of a fixture's repo, approval auto-allowed — the approval path is covered by the runtime tests, not by evals.

- A verifier probes behaviour and never matches on source text. More than one fix is usually correct, and a regex verifier fails the ones it did not imagine.
- A verifier also checks the agent did not weaken the suite it was asked to satisfy.
- One run of a small model proves nothing. Read pass rate across repeats.

## Conventions

- Imports carry the `.ts` extension; nothing compiles the output.
- `exactOptionalPropertyTypes` is on: set an optional field with `...(value !== undefined ? { key: value } : {})`, never `key: value ?? undefined`.
- No linter and no formatter. Do not add one.

## Finish

1. `bun run typecheck`
2. `bun test`, or `bun test tests/<file>` while iterating.
3. **Prove it.** For anything touching the loop, the CLI, or a tool, run it: `bun run infinity --yes --max-turns 2 "<task>"` **in a scratch directory, never in this repo** — the workspace is `process.cwd()` and the agent writes to it. `bun run evals/run.ts --fast` is the broader check. Only one model fits in memory at a time; never run two. State what you ran and what you saw; "should work" is not verification.
4. Re-scan your diff, then report it.
