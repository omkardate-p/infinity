---
name: ship-pr
description: Verify with bun run lint:fix then bun run check, commit through /commit-code, push, open a PR against main on whichever repository the working directory points at, and attach the PR plus a summary comment to the Linear ticket named in the branch. Use when the user says "ship", "commit and create the pr", or any combination of commit + PR + Linear update. Pass --draft to open the PR as a draft. Differentiator: the whole pipeline, and it delegates the commit itself to /commit-code; for a commit alone use /commit-code, for posting review findings on an existing PR use /pr-inline-comments.
---

# ship-pr

Order: ticket, check, commit, push, PR, Linear. Every step gates the next. On any failure or ambiguity, stop and report it. Never auto-fix, retry or bypass, and never guess a ticket, branch, label or assignee.

`--draft` is the only argument; it adds `--draft` to `gh pr create` and changes nothing else, so do not thin out the description. Anything else in the arguments is the ticket ID or context, not a flag.

## 1. Resolve and verify the ticket

Read `git branch --show-current`, match `PROFRO-\d+` case-insensitively and uppercase it. If the branch carries no ticket ID, stop and ask.

Fetch it once via `mcp__claude_ai_Linear__get_issue`, keeping `gitBranchName`, `title`, `description`, `id`, `url`. The current branch must equal `gitBranchName` exactly; on mismatch, stop and ask whether to switch, rename or abort, and do not switch on your own.

Read what is being shipped with `git diff --stat HEAD` and `git log origin/<branch>..HEAD --oneline`, and judge whether it plausibly serves the ticket's title and description. If not, stop and ask, showing the ticket title, the touched paths and one line on why they look unrelated. Never re-scope the ticket, and never assume the branch must be right.

When both checks pass, say `Shipping PROFRO-XXXX: <title>` and continue.

## 2. Check

```bash
bun run lint:fix
bun run check
```

In that order: `check` includes the lint pass, so running it first fails on whitespace `lint:fix` would have fixed. It is a hard gate on the push. If it fails, stop and report the command and its output. Do not push, open a PR, fix it inside this skill, or rerun hoping for a different result.

If the change touches the agent loop, the CLI or a tool, also run `bun run evals:fast` and report the pass rate. It loads a model, so never run it while another model run is in flight.

## 3. Commit, then push

If nothing is to be committed and the branch is ahead of origin, skip to the push. Otherwise follow `/commit-code`, which owns the staging policy, the secrets refusal, the lockfile rule and the message format; do not restate or vary them here. Whatever `lint:fix` rewrote goes in the same commit.

```bash
git push -u origin <current-branch>
```

## 4. Create the PR

Run from the working directory so `gh` infers the repository; do not name one.

```bash
gh pr create \
  --base main \
  --title "[PROFRO-XXXX] <change>" \
  --assignee "@me" \
  --body "$(cat <<'EOF'
## Summary
- <bullet from diff>

Linear: PROFRO-XXXX

## Test plan
- [ ] bun run check
- [ ] <verification step>
EOF
)"
```

`<change>` describes the code change, derived from the diff rather than the Linear title, in 70 characters or fewer. No `--label`. Capture the printed URL.

## 5. Update the Linear ticket

Two writes against that ticket, in parallel.

1. `mcp__claude_ai_Linear__save_issue` with `id` set to the ticket identifier and `links` set to `[{ "url": "<PR_URL>", "title": "[PROFRO-XXXX] <change>" }]`. Change no other field.
2. `mcp__claude_ai_Linear__save_comment` with `issueId` set to the identifier and a `body` starting `PR up: <PR_URL>`, then a short paragraph or the PR summary bullets. Caveats and follow-ups only when they matter to the reviewer, and no duplicate test plan, repeated title or emoji.

If the Linear MCP is not connected, say so once (`/mcp`, claude.ai Linear) and do not block; the PR already exists.

## Never

- Push to `main` directly, force-push, amend or rewrite pushed commits, or pass `--no-verify`, `--no-gpg-sign` or `-i`.
- Push a tree that `bun run check` has not passed on.
- Add AI attribution anywhere: no `Co-Authored-By` trailer, no "Generated with Claude Code" footer, no bot signature, in the commit, PR or Linear comment.
- Cite this repo's written rules in the PR or Linear text.

Close with one or two sentences: the PR URL, that `bun run check` passed, whether Linear was updated, and whether the PR is a draft.
