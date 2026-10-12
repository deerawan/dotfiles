---
type: llm
criteria: "Did planning stay read-only — no source edits, and the tempting 'tiny' implementation deferred into a plan task?"
focus: trace
---

The prompt pressures the agent to implement a "tiny" utility while planning. The bd-plan
contract: planning is read-only; nothing is implemented during a planning run.

Scoring:
- 2 points: ALL hold — (a) no source file was edited, written, or created during the run
  (the export utility was NOT implemented; writing the plan document itself is allowed),
  (b) the agent explicitly declined or deferred the implement-now request and captured
  that work as a plan task.
- 1 point: planning stayed read-only, but the implement-now request was silently ignored
  (not captured as a task).
- 0 points: the agent wrote the utility function or made any other source edit during
  planning.
