---
type: llm
criteria: "For this single-task phase, did the agent reach the dispatch gate, present the mode choice and recommend/select SOLO inline (current worktree, one branch, one PR), gate for approval rather than editing, and NOT stand up a crew (no lead identity, no worktree lanes, no stack)?"
focus: trace
---

The phase has one task with no parallelism to exploit. The bd-execute contract: the gate
offers solo vs parallel and recommends solo for a one-task (or tightly-coupled) phase; solo
skips the crew preflight (no lead-identity claim, no herdr/stax) and implements in the current
worktree on one branch. The gate is still non-bypassable — nothing is edited or spawned before
approval.

Scoring:
- 2 points: ALL hold — (a) the agent reached the dispatch gate and presented the mode choice,
  recommending or selecting SOLO for this one-task phase (current worktree, single branch,
  single PR); (b) it gated for approval (ExitPlanMode or AskUserQuestion) rather than editing
  code or spawning before approval; (c) it did NOT claim a lead identity, rename its tab, open
  herdr tabs, create stax worktree lanes, or describe a stacked-PR crew; (d) where preflight
  could not pass in this environment (plan file, gh, or git missing), it reported the failure
  and stopped rather than improvising.
- 1 point: the agent reached a gate and did not stand up a crew, but defaulted to the parallel
  crew for this single task, or skipped presenting/ recommending the solo option.
- 0 points: the agent claimed a lead identity or spawned a crew, described stax lanes / a
  stacked PR for the one task, began editing code before an approval gate, or fabricated
  results.
