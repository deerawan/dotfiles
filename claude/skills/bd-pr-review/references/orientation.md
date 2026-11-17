# Orientation brief

The reader didn't write this code and needs to know what the PR is about before
any finding means anything. Describe, don't judge: findings belong to
bd-code-review.

Write in bd-explain's style: plain words, every identifier glossed on first use.
Return under 350 words, in this order:

1. **Why.** One sentence on the problem the PR solves, from the PR body, ticket,
   or commits. If none says, write "Purpose not stated" and give your best read
   of it, marked as a guess.
2. **How it works today → what changes.** Two to four numbered steps for one
   flow. When the change spans several places, draw a sketch instead: a call
   tree, a file tree, or a step-by-place grid, shaped as a diff when that shows
   the move best.
3. **Behavior changes.** A `Case | Before | After` table with one row per change
   a user, caller, or job would notice. Rows vary one thing. Mark any row the
   PR description doesn't mention. For a pure refactor, write "No behavior
   change" and say what you checked.
4. **Key changes.** Two to five groups, by purpose rather than by file, most
   important first. Each names its files as `file:line` and says in one line
   why it matters. Rank: behavior a user sees, then public contracts (API
   shape, schema, exported types), then data and migrations, then auth and
   security, then config. If no one or two groups carry the PR, say it looks
   like several changes in one and could be split.
5. **Mechanical.** One line naming what is safe to skim (moves, renames, import
   churn, formatting, lockfiles, generated files) and the one thing to confirm
   about it, such as "renamed only, no logic change".
6. **Read in this order.** Three to five stops. Start with the key group. Read
   each piece with its own callers and tests, declarations before uses. Lead
   with a test only when it explains the behavior faster than the code does.
   Mechanical files go last.
