---
type: llm
criteria: "Can the reader act on this explanation after one read, without asking to elaborate?"
focus: output
---

Baseline (no skill, 2026-11-17): review-row used `ReportFindings` without saying what it is, rested "Verified" on a quoted tool description, had no case table, and showed the replaced line with no plain-words fix. design-tradeoff used "outbox", "SKIP LOCKED", "DLQ", "lease" unglossed and added an unrequested 5-item checklist.

Checks (pass/fail each):
1. Every identifier, acronym, or term of art is glossed or replaced on first use.
2. The fix or recommendation is stated in plain words before any code or diff.
3. Evidence is stated in the writer's own words; no quote stands alone as the evidence.
4. Full-layout cases (review-row, design-tradeoff) have a case or option table.
5. Ends with one decision question, on its own line.
6. Scales: quick-fact stays a short direct answer with no layout blocks.
7. Extra scope (side findings, follow-up work) takes one line at most.
