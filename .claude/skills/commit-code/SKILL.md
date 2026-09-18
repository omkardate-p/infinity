---
name: commit-code
description: Understand the current working changes in the infinity repo and commit them, then stop. Use when the user says "commit", "commit this", "commit the changes", or invokes /commit-code. Differentiator: commit only, no push and no PR, and it owns the staging policy and message format that /ship-pr defers to; for the full check + push + PR + Linear pipeline use /ship-pr.
---

# commit-code

Invoking this is the go-ahead to commit. Read the changes and commit them. Do not interrogate the user about the branch, the files or the intent.

1. **Understand the changes.** `git status`, `git diff`, `git diff --staged`. Read the code so the message reflects what changed and why.
2. **Stage.** If files are already staged, commit those as-is and add nothing: the staged set is the user's stated intent. Only when nothing is staged, stage the changed files that form the coherent change. Never `git add -A`, which sweeps in unrelated work. Skip anything under **Never** and say so in one line when a skipped file is present.
3. **Stage `bun.lock` when `package.json` dependencies changed**, so the install stays reproducible. Leave it alone when `package.json` did not change.
4. **Message:** sentence-style imperative, capitalised, no trailing period, no `<type>(<scope>):` prefix. Match the tone of `git log -5 --oneline`. Add body paragraphs when the change has a reason a reader cannot see in the diff.

   ```bash
   git commit -m "$(cat <<'EOF'
   Summary line in the imperative

   Why it changed, if that is not obvious from the diff.
   EOF
   )"
   ```

5. **Stop.** No push, no PR. Report the commit in one line. If there is nothing to commit, say so; never create an empty commit.

## Never

- Author is the current git user. No `Co-Authored-By: Claude` trailer, no "Generated with Claude Code" footer. Strip the defaults if present.
- Cite this repo's written rules in the message. Describe the change itself.
- Stage secrets: `.env*`, `*credentials*`, `*.pem`, `*.key`.
- Pass `--no-verify`, `--no-gpg-sign` or `-i`.
- Retry or bypass on failure: stop and show the output.
