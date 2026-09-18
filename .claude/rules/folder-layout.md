# Folder Layout

Three parts, and the dependency runs one way only.

```
src/
├── cli.ts        the entry point: parses arguments and wires the pieces together
├── domain/       the shared contracts, imported by both sides, importing neither
├── tui/          the terminal interface
└── harness/      the agent loop, the model boundary, the providers, the tools
```

`src/domain/` is what a run reports (`events.ts`) and what a conversation is made of (`messages.ts`). A type belongs here when both sides need it. A type that only one side needs stays on that side.

`src/tui/` splits by what can be wrong without a terminal:

```
tui/
├── app.tsx       the root: owns the transcript, the composer buffer, the run
├── run.ts        mounts the renderer and restores the terminal on the way out
├── components/   render; they hold no layout arithmetic
├── rendering/    pure: what a line is, how wide it is, what reaches the scrollback
├── input/        the prompt buffer and resume, pure; the key probe, which reads a real terminal
└── state/        pure: the reducer that folds events into transcript items
```

`rendering/`, `state/`, and the prompt buffer and resume in `input/` compute from values and touch no terminal, so `tests/tui/` covers them without one. `app.tsx`, `run.ts` and the key probe need a terminal, and what they do is checked by hand. Layout arithmetic never goes inside a component: a component that measures a string is a defect.

`src/harness/` is `agent/`, `model/`, `providers/` and `tools/`. Nothing in `src/tui/` reaches into it for a type that belongs in `src/domain/`.

`tests/` follows the same split, one level deep:

```
tests/
├── helpers.ts    the scripted model and the workspace fixture, shared by both
├── tui/
└── harness/
```

A test is named after the module it covers, or after the invariant it pins when it spans several, and never repeats the folder.

Files are kebab-case. No barrels: import the module, not an index that re-exports it.
