# Separation of Concerns

The runtime does not know which model it talks to, and the interface does not know a model exists. Breaking one of these defeats the codebase even when it passes and the tests stay green.

**`src/harness/model/types.ts` is the provider boundary.** A field belongs there only if a second provider needs it too; if it exists because Ollama emits it, it lives in `src/harness/providers/`. `src/harness/agent/` never imports a provider, and a new provider is one file plus one `case` in `createModel`. If adding one forces a change inside `src/harness/agent/`, the abstraction is wrong — that is the finding, and it is fixed first.

**`src/domain/` is the contract between a run and whatever watches one.** Both sides import it and it imports neither. A type that reaches into `src/harness/` from `src/tui/` is either misplaced or belongs in `src/domain/`.

**Sessions on disk are a format.** Touching `SessionState` or `Message` means bumping `FORMAT_VERSION`.

**The interface owns no agent logic.** A component renders what the reducer produced; it does not decide what a turn means.
