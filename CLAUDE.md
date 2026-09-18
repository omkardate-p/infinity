# Claude Code Instructions

`infinity`, a local coding agent CLI. Small enough to read directly. Open the file rather than searching for it, and never spawn an agent to describe code you could have read yourself in the time the agent takes to start.

Delegation earns its place only where reading does not scale: `trace` for a behaviour that crosses the loop, a tool, an adapter and the wire format at once, `research` for a question this repo cannot answer. Anything narrower, read.

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

A dependency, abstraction, layer, option, wrapper, or flag needs two concrete present-day uses. One use is a function, not a pattern. A requirement nobody stated is not a requirement. A new runtime dependency needs a reason you can state out loud. There are four, and three of them are the TUI stack.

Existing over-engineering is not protected by being existing. In any file your change already opens, an unused abstraction, a single-caller indirection, a never-false flag, a forwarding wrapper, or dead config comes out in the same change, and the report says so.

Outside those files, name what you found and what removing it costs. Do not go hunting mid-task.

**Not now, and not as a favour.** Embeddings, retrieval, vector stores, MCP, LSP, AST editing, model routing, remote sandboxes, cloud sync, prompt-engineering the system prompt to paper over a runtime defect. A request that lands here gets this line, not code. This is about what `infinity` ships: it runs one model in one loop, and a sub-agent is not a feature of it. How you work on the repo is a separate question, answered at the top of this file.

### 3. Reuse, and improve what you reuse

**Never write the same thing twice. Never leave two versions standing.**

`bound()`, `ok()`, `fail()`, and `resolvePath()` exist so every tool behaves identically at its edges. A tool that formats its own error, caps its own output, or resolves its own path is a defect.

When the new way is better, improve the shared one and move every call site in the same change.

### 4. Scope

Every changed line traces to the request, or to §1-§3 in a file the change already opened.

- Match the surrounding style. The tool files are deliberately parallel.
- Don't rename for taste, and don't hand-format: Biome decides whitespace, so a formatting difference in your diff means you did not run it. Comments are the exception — `.claude/rules/code.md`.
- Remove what your change orphaned.

## Stop and find out

- About to write "usually", "probably", or "should work" about anything outside this repo. Hard stop.
- Ollama's `/api/chat`: stream framing, `think`, `num_ctx`, `done_reason`, tool-call encoding. Under-documented and changed across releases; `src/providers/ollama.ts` records what we learned, so read it before contradicting it.
- `@opentui/core` layout: how wide a glyph is, when a line wraps, what a snapshot's declared height must equal, which draw paths overwrite an existing cell. Under-documented, version-pinned, and the source of every rendering defect so far. `tui/lines.ts` and `tui/format.ts` record what was measured; measure again rather than reasoning about it, because a line laid out to exactly the terminal width already broke once.
- A Bun or TypeScript 7 behaviour. An answer written for Node or TypeScript 5 is a hypothesis.
- Adding a dependency, or a pattern heavier than the problem needs.
- A first attempt failed and you do not understand why. Do not iterate on a guess.
- A contract expensive to reverse: the shape of `src/model/types.ts`, the session format, a tool's name or schema.

An unexplained failure inside this repo goes to `trace`; an open design question, or anything about a dependency's behaviour, goes to `research`. Take the simplest option it returns unless the brief says why that fails, and report which you took. Everything else you read yourself, from the source closest to it.

## Boundaries

The runtime does not know which model it talks to. Breaking one of these defeats the codebase even when it passes and the tests stay green.

- `src/model/types.ts` is the provider boundary. A field belongs there only if a second provider needs it too; if it exists because Ollama emits it, it lives in `src/providers/`. `src/agent/` never imports a provider, and a new provider is one file plus one `case` in `createModel`. If adding one forces a change inside `src/agent/`, the abstraction is wrong — that is the finding, and it is fixed first.
- `resolvePath()` is the only way a tool resolves a path — not `join`, not `resolve`, not a hand-rolled `startsWith`.
- A tool returns `ok()` or `fail()` and never throws past the registry. The registry validates input; the tool does not.
- A tool that changes the workspace or runs a command awaits `ctx.requestApproval` itself before acting, then `fail(..., { reason: "denied" })` on refusal. The tool asks, not the loop, because only the tool has the diff or the command line to show. The loop counts denials on that exact string; change it and the runaway guard dies silently.
- Touching `SessionState` or `Message` means bumping `FORMAT_VERSION`. Sessions on disk are a format.
- Tests never call a model. A behaviour only observable against Ollama is reported as checked by hand.
- `tui/` splits in two and the split is the point: anything that can be wrong without a terminal lives in a pure module with a test in `tests/tui.*.test.ts`. Layout arithmetic never goes inside a component.

## Evals

`evals/run.ts` drives `Agent` against a copy of a fixture's repo. Approval is allowed unless the fixture exports `approve`, and `escape-bait` denies, so `bun run evals:fast` exercises refusal end to end. That hook is the only automated check that the workspace boundary and the denial string hold against a real model; it has one caller and it stays.

- A verifier probes behaviour and never matches on source text. More than one fix is usually correct, and a regex verifier fails the ones it did not imagine.
- A verifier also checks the agent did not weaken the suite it was asked to satisfy.
- One run of a small model proves nothing. Read pass rate across repeats.

## Conventions

- Imports carry the `.ts` extension; nothing compiles the output.
- `exactOptionalPropertyTypes` is on: set an optional field with `...(value !== undefined ? { key: value } : {})`, never `key: value ?? undefined`.
- Biome owns formatting and the rules a tool can decide mechanically; `biome.json` is the whole configuration. Do not argue with it in review, and do not hand-format around it. ESLint cannot be used here: typescript-eslint refuses to load against TypeScript 7.
- Biome does not read `evals/fixtures/`. A fixture's repo is an input, not this project's source: some of it is deliberately broken, one file does not parse at all, and formatting it rewrites the thing the eval measures.
- A rule that contradicts the compiler is turned off rather than worked around. `noNonNullAssertion` is off because `noUncheckedIndexedAccess` makes `!` the idiom for an index that was just bounds-checked.

## Finish

1. `bun run lint:fix` — formats and applies what Biome can fix on its own.
2. `bun run check` — typecheck, lint and tests. `bun test tests/<file>` while iterating. Run it after step 1: `check` includes the lint pass, which reports formatting, so running it first fails on whitespace the next step would have fixed.
3. **Prove it.** For anything touching the loop, the CLI, or a tool, run it **in a scratch directory, never in this repo** — the workspace is `process.cwd()` and the agent writes to it. Invoke the file by absolute path, never the script name, which resolves through PATH or the package script and makes this repo the workspace: `bun run "$repo/src/cli.ts" --no-tui --yes --max-turns 2 "<task>"`. `/verify` carries the rest. `bun run evals:fast` is the broader check. Only one model fits in memory at a time; never run two. State what you ran and what you saw; "should work" is not verification.
4. Re-scan your diff, then report it.
