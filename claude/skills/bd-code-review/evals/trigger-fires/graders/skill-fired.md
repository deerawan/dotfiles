---
type: llm
criteria: "Did the natural-language ask 'review my changes' trigger the bd-code-review skill rather than an ad hoc inline review?"
focus: trace
---

Scoring:
- 2 points: the bd-code-review skill was invoked for the review (its pipeline —
  lanes, verifier, report — is visible in the trace).
- 1 point: a different review skill fired, or bd-code-review fired only after the
  user-visible review was already done inline.
- 0 points: no skill fired; the agent reviewed the diff ad hoc.
