# Claude Code Instructions

## The session structure

**This thread reads. Subagents only cover what reading cannot.** That is the opposite of a large codebase, and it is deliberate: this project is small enough to open directly, so a search costs more than the file it was looking for.

Open the file. Never grep to find something, never delegate a lookup, never spawn an agent to describe code you could have read in the time the agent takes to start.

Two things earn a subagent, every time:

- **Why is this behaving wrong**, when the answer crosses the loop, a tool, an adapter and the wire format at once and the layer responsible is not yet known → `trace`.
- **How should this be done**, or **how does this dependency actually behave** — an open approach, a version-sensitive API, a new dependency, a first attempt whose failure you do not understand → `research`. See [Stop and find out](#stop-and-find-out).

Anything narrower, read it yourself. Never name the agent in your reply.

The design lives in a spec PDF that is **not in this repo**; comments cite it as `PDF §7`. Ask for a section rather than reconstructing it.

## How to change code

These override speed. `.claude/rules/` wins where it conflicts.

### 1. Fix the cause, not the symptom

**A workaround is not a fix. Ship the cause or ship nothing.**

Follow the behaviour down as far as it goes: the loop, a tool, an adapter, the wire format, the model itself. "Three layers down" is a finding, not an excuse.

Never write compensating code: no detector correcting a bad state, no retry or timeout waiting out a race, no defensive branch hiding a value that should never have arrived, no `?.` standing in for knowing why it is null.

Agent defects wear the model's clothes. A tool quietly returning the wrong thing reads as a model that cannot follow instructions, and the tempting fix is a sentence of prompt. Prove which before changing either.

If the real fix is out of reach, say so in one line with what you found. Do not ship the workaround and call it done. Whether to accept a patch is the user's call, and presenting only the patch takes that call away from them.

Prefer the fix whose diff is mostly deletions.

### 2. Remove complexity, including complexity you did not add

**The default is the boring solution.**

A dependency, abstraction, layer, option, wrapper, or flag needs two concrete present-day uses. One use is a function, not a pattern. A requirement nobody stated is not a requirement. A new runtime dependency needs a reason you can state out loud.

Existing over-engineering is not protected by being existing. In any file your change already opens, an unused abstraction, a single-caller indirection, a never-false flag, a forwarding wrapper, or dead config comes out in the same change, and the report says so.

Outside those files, name what you found and what removing it costs. Do not go hunting mid-task, and do not let cleanup silently widen a diff the user has to review.

**Not now, and not as a favour.** Embeddings, retrieval, vector stores, MCP, LSP, AST editing, model routing, remote sandboxes, cloud sync, prompt-engineering the system prompt to paper over a runtime defect. A request that lands here gets this line, not code. This is about what `infinity` ships: it runs one model in one loop, and a sub-agent is not a feature of it. How you work on the repo is a separate question, answered at the top of this file.

### 3. Reuse, and improve what you reuse

**Never write the same thing twice. Never leave two versions standing.**

Before writing a helper, type, constant or component, find the existing one and use or extend it. A second near-duplicate is a defect, not a shortcut. The shared helpers exist so that every caller behaves identically at its edges, and a caller that reimplements one is a defect even when it works.

When the new way is better, the answer is not a second implementation beside the old one. Improve the shared one and move every call site in the same change. If that is too large for this change, say how many call sites there are and move none, rather than leaving half the repo converted with no record of which half.

### 4. Scope

Every changed line traces to the request, or to §1-§3 in a file the change already opened.

- Match the surrounding style, even where you would do it differently. Files that fill the same role are deliberately parallel; keep them that way.
- Don't rename for taste, and don't hand-format: Biome decides whitespace, so a formatting difference in your diff means you did not run it. Comments are the exception — see `.claude/rules/`.
- Remove what your change orphaned.

## Stop and find out

Don't guess when an authoritative answer exists. Stop before proceeding when any of these hold:

- You catch yourself about to write "usually", "probably", "should work", or "from memory" about anything outside this repository. This is the reliable one. Treat it as a hard stop.
- The behaviour belongs to the Ollama chat API: stream framing, thinking, the context window, the stop reason, tool-call encoding. Under-documented and changed across releases. The provider records what we learned; read it before contradicting it.
- The behaviour belongs to the terminal renderer: how wide a glyph is, when a line wraps, what a snapshot's declared height must equal, which draw paths overwrite an existing cell. Under-documented, version-pinned, and the source of every rendering defect so far. Measure it again rather than reasoning about it; a line laid out to exactly the terminal width already broke once.
- It is a Bun or TypeScript 7 behaviour. An answer written for Node or TypeScript 5 is a hypothesis.
- The task adds, upgrades or configures a dependency, or reaches for a pattern heavier than the problem obviously needs.
- A first attempt failed and the reason is not understood. Do not iterate blindly on a guess.
- The choice is expensive to reverse: the provider boundary, the shape of the shared contracts, the session format, a tool's name or schema.

**Then act.** An unexplained failure inside this repo goes to `trace`. An open design question, or anything about a dependency's behaviour, goes to `research`; it returns the simplest option that works alongside its recommendation, so take the simplest unless the brief gives a concrete reason it fails, and report which you took. Everything else you read yourself, from the source closest to it: local first, then the upstream docs and changelog for the installed version.

## Conventions

Rules for writing code live in `.claude/rules/` and load at the start of every session. Read the relevant one before creating a new file.

Biome owns formatting and every rule a tool can decide mechanically. Do not argue with it in review and do not hand-format around it. ESLint cannot be used here: typescript-eslint refuses to load against TypeScript 7.

## Finish

Before your final response, in order:

1. **Format** — `bun run lint:fix`, which applies what Biome can fix on its own.
2. **Check** — `bun run check`: typecheck, lint and tests. Run it after step 1, because it includes the lint pass and would otherwise fail on whitespace that step fixes. While iterating, a single test file is faster.
3. **Prove the behaviour** — for anything touching the loop, the CLI or a tool, run it **in a scratch directory, never in this repo**: the workspace is the working directory and the agent writes to it. Invoke by absolute path, never the script name, which resolves through the package script and makes this repo the workspace. The `verify` skill carries the rest. Tests never call a model, so anything only observable against a real one is reported as checked by hand, with what you ran and what you saw. "Should work" is not verification.
4. **Report** — re-scan your diff, then state it.
