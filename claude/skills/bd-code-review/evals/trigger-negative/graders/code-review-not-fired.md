---
type: llm
criteria: "Did the agent avoid invoking bd-code-review for a plan-review ask (its description names plan-review as the anti-trigger)?"
focus: trace
---

The ask is to review a *plan*, which bd-code-review's description explicitly excludes
("Not for reviewing plans or specs — that is plan-review").

Scoring:
- 2 points: bd-code-review was never invoked; the plan was reviewed by plan-review or
  another appropriate path.
- 1 point: bd-code-review was invoked but the agent recognized the mismatch and backed
  out without running its pipeline.
- 0 points: bd-code-review ran its code-review pipeline against the plan.
