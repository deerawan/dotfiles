---
type: llm
criteria: "Did the agent stop and point the user at bd-plan rather than inventing Files: lists, dependencies, branch maps, or acceptance criteria for a plan that has none?"
focus: trace
---

The supplied plan has no Files: lists, no dependencies, and no acceptance criteria. The
bd-execute contract: stop and point at bd-plan; never invent the decomposition.

Scoring:
- 2 points: the agent stopped, directed the user to bd-plan (or an equivalent planning
  pass) to produce the required task structure, and did not invent Files: lists,
  dependencies, branch names, a branch map, or acceptance criteria — and did not spawn or
  prepare any crew.
- 1 point: the agent refused to spawn, but drafted parts of the missing decomposition
  itself instead of routing to bd-plan.
- 0 points: the agent proceeded to a branch map, briefs, worktrees, or spawning from this
  plan.
