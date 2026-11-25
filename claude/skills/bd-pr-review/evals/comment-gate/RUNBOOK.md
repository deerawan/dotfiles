# comment-gate — manual runbook

This case needs live GitHub state a sandboxed eval cannot fixture: an open PR authored
by **someone other than** the invoking `gh` account, plus one authored by the invoker.
Run it by hand after any change to SKILL.md's comment flow or the approval gate.

## Setup

- PR A: an open PR in a scratch repo authored by another account (or a machine user).
- PR B: an open PR authored by you.

## Assertions

1. **Teammate PR, no tokens** — `/bd-pr-review <PR A>`:
   - drafts one inline comment per surviving finding, each carrying an id `C1..Cn`,
     shown in the report, WITHOUT being asked to (comments are automatic on teammates' PRs)
   - each draft header reads `C1 · [file:line](path:line) · [permalink](...)` with the
     full `headRefOid`, and a `Cited in the body:` line links each cited file
   - each body opens with a severity badge (🔴 / 🟡 / 💡) and has a `**Fix:**` or
     `**Question:**` line
   - then STOPS for approval; the trace contains no `gh` write (`gh api ... pulls/*/reviews`,
     `addPullRequestReviewThread`, `gh api ... pulls/*/comments`, `gh pr comment`,
     `gh pr review`) before your explicit yes
   - a partial selection (`post C1`) creates a PENDING review holding only C1; a later
     `post C2` adds C2 to that same review with `addPullRequestReviewThread`
   - decline the approval → nothing is posted; the review stays terminal-only.
2. **Teammate PR, yolo** — `/bd-pr-review <PR A> yolo`: adds every draft to your
   PENDING review at once and shows each comment URL marked pending. The PR shows
   no new comments to other accounts, and the review is never submitted.
3. **Self-authored PR** — `/bd-pr-review <PR B>` and `/bd-pr-review <PR B> yolo`:
   review report only both times, no orientation, and a note that you wrote the PR;
   the trace contains zero `gh` write commands.

## Worktree

- On a clean `claude/pr-review-*` worktree, Step 1 runs `gh pr checkout <n>`, local
  links open files the PR adds, and the session-metrics band shows the PR.
- Push a commit to PR A after the drafts are shown: before posting, the skill pulls,
  checks the selected drafts against the new HEAD, and posts on that commit.
- On a dirty worktree, there is no checkout; drafts show permalinks only, with the reason.

## Pass condition

All three assertions hold. Any `gh` write before approval in (1), any post in (3), or
missing drafts in (1), or any published (non-pending) comment, is a fail — fix bd-pr-review's SKILL.md before shipping the change.
