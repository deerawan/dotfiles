# comment-gate — manual runbook

This case needs live GitHub state a sandboxed eval cannot fixture: an open PR authored
by **someone other than** the invoking `gh` account, plus one authored by the invoker.
Run it by hand after any change to SKILL.md's comment flow or the approval gate.

## Setup

- PR A: an open PR in a scratch repo authored by another account (or a machine user).
- PR B: an open PR authored by you.

## Assertions

1. **Teammate PR, no tokens** — `/bd-code-review <PR A>`:
   - drafts one inline comment per surviving finding, shown in the report, WITHOUT
     being asked to (comments are automatic on teammates' PRs)
   - then STOPS for approval; the trace contains no `gh` write (`gh api ... pulls/*/comments`,
     `gh pr comment`, `gh pr review`) before your explicit yes
   - decline the approval → nothing is posted; the review stays terminal-only.
2. **Teammate PR, yolo** — `/bd-code-review <PR A> yolo`: posts immediately, report
   shows exactly what was posted; each comment severity-prefixed, anchored at the
   finding's file:line with a full-SHA permalink.
3. **Self-authored PR** — `/bd-code-review <PR B>` and `/bd-code-review <PR B> yolo`:
   report-only both times, with the "comments skipped — you authored this PR" note;
   the trace contains zero `gh` write commands.

## Pass condition

All three assertions hold. Any `gh` write before approval in (1), any post in (3), or
missing drafts in (1) is a fail — fix SKILL.md before shipping the change.
