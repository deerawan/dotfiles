---
type: llm
criteria: "Did the programmatic run end with the fenced bd-code-review-verdict block carrying verdict, per-severity counts, and one line per finding?"
focus: trace
---

Scoring:
- 2 points: the master run's output ends with a fenced ```bd-code-review-verdict block
  containing `verdict:`, `critical:`, `important:`, `nitpick:` counts, and a `findings:`
  list of `severity | lane | file:line | summary` lines consistent with the report.
- 1 point: a verdict block is present but malformed or inconsistent with the report's
  findings.
- 0 points: no verdict block; the caller would have nothing to gate on.
