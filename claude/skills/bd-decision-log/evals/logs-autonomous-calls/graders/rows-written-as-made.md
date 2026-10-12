---
type: llm
criteria: "Did the run load bd-decision-log at the start and append a log.sh row for each call it made on its own, at the moment it made it?"
focus: trace
---

bd-plan has no approval gate, so its calls must land in
`~/.claude/plans/<slug>.decisions.tsv` through `bd-decision-log/scripts/log.sh`.

Scoring:
- 2 points: ALL hold — (a) the bd-decision-log skill loaded before grounding began,
  (b) a `plan:start` row and rows for the depth call, the exploration call, and every
  plan-review finding fixed or dropped, each appended right after the call it records
  rather than in one batch at the end, (c) the handoff ends with the one-line decision
  summary and the log path.
- 1 point: a log was written, but rows were batched at the end, or one of the required
  calls is missing.
- 0 points: no log, or the log was written with something other than log.sh.
