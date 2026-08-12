---
name: browser-artifacts
description: Open the browser-tester screenshot and video folder for the current session in Finder, with this run's artifacts selected so they can be dragged straight into a PR comment. Use when the user asks to "open the recordings", "show me the screenshots", "where's the video", "open the test artifacts", or runs /browser-artifacts. Handles runs that happened in a different git worktree.
---

# Browser Artifacts

Reveal what the `browser-tester` agent just produced — screenshots and the `.webm` recording — so they can be dragged into a PR.

`browser-tester` writes to `<repo-or-worktree>/.playwright-cli/`:

- `recordings/{test-slug}-{route}-*.png` — screenshots
- `recordings/{test-slug}-{timestamp}.webm` — the video
- loose `video-*.webm` at the top level when `video-start` ran without an explicit path

Nothing on disk is tagged with a session id, and the folder accumulates across days and branches. So "current session" is resolved by recency: the newest cluster of artifacts, walking back from the most recent file until a gap of more than 20 minutes. A single `browser-tester` run writes everything within a couple of minutes, so this catches all runs from the current working session and stops before older ones.

## Run it

```bash
scripts/reveal-artifacts.sh
```

Prints the folder and the selected files, then `open -R`s them so Finder opens the folder with exactly this session's artifacts highlighted.

Options — only reach for these when the default misses:

- `--all` — take the whole folder instead of the latest cluster. Use when the user wants an older run too.
- `<path>` — a repo/worktree root or a `.playwright-cli` dir. Use when the user names where the run happened.
- `GAP_SECONDS=<n>` — widen or tighten the cluster window. Use when a session spanned a long gap and the default cut it short.

## Where it looks

In order, stopping at the first hit:

1. `$PWD/.playwright-cli`
2. the git toplevel of `$PWD`
3. every worktree of the current repo (`git worktree list`) that has a `.playwright-cli` — most recently written wins

Step 3 matters: you likely ran `browser-tester` inside a task worktree, then came back to the main checkout. It asks git rather than crawling the filesystem, so it stays bounded.

## Reporting back

Relay the folder path and the artifact list. Call out the `.webm` explicitly — that's the PR evidence and the reason the folder is being opened.

If the user is choosing which shot to attach, `Read` the PNGs and describe them rather than making them open each one.

## When there is nothing

- **No `.playwright-cli` anywhere** — say so and ask where the run happened, or whether `browser-tester` has been run yet. Do not go hunting across unrelated repos.
- **Folder exists but is empty** — report the path; the run probably failed before capture. Check the agent's summary for an `INCONCLUSIVE` verdict.
- **Not macOS** — the script prints paths and skips the Finder step.

## Note

If per-session folders would be better than the recency heuristic, that needs a change to `~/.claude/agents/browser-tester.md` (Step 5/6 write paths) — out of scope here.
