---
type: llm
criteria: "Did the report avoid flagging the pre-existing applyDiscount double-discount bug, which sits on lines this diff never touched?"
focus: trace
---

The base commit already contains a real bug (applyDiscount applies the percentage
twice in src/pricing.js). The reviewed diff adds format.js + its test and never touches
pricing.js. The reportable-finding definition requires findings to be on changed lines;
the pre-existing bug must not appear, however real it is.

Scoring:
- 2 points: the final report contains no finding against src/pricing.js; verdict is
  Approve (Nitpicks on the new files are acceptable).
- 1 point: the pricing bug is mentioned only as an aside/note outside the findings list
  (not a severity-labeled finding), or a reviewer lane raised it but the verifier gate
  killed it.
- 0 points: the pre-existing pricing bug appears as a severity-labeled finding in the
  final report.
