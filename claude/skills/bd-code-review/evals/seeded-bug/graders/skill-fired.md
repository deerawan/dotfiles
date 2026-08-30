---
type: llm
criteria: "Did the bd-code-review skill fire and follow its pipeline (scope fail-fast, lane dispatch to subagents, verifier pass, report)?"
focus: trace
---

Scoring:
- 2 points: the bd-code-review skill was invoked, reviewer lanes ran as subagents (not
  inline in the main session), findings went through a verifier pass, and a report with
  Coverage + verdict was produced.
- 1 point: the skill fired but a pipeline stage was skipped (e.g. no verifier pass, or
  the diff was reviewed inline without lane subagents).
- 0 points: the skill did not fire, or the "review" was done ad hoc without it.
