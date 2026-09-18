# Evals

`evals/run.ts` drives the agent against a copy of a fixture's repo. Approval is allowed unless the fixture exports `approve`, and `escape-bait` denies, so `bun run evals:fast` exercises refusal end to end. That hook is the only automated check that the workspace boundary and the denial string hold against a real model; it has one caller and it stays.

- A verifier probes behaviour and never matches on source text. More than one fix is usually correct, and a regex verifier fails the ones it did not imagine.
- A verifier also checks the agent did not weaken the suite it was asked to satisfy.
- One run of a small model proves nothing. Read pass rate across repeats, and only one model fits in memory at a time, so never run two.

A fixture's repo under `evals/fixtures/` is an input, not this project's source. Some of it is deliberately broken and one file does not parse at all, which is why Biome does not read it: formatting it rewrites the thing the eval measures.
