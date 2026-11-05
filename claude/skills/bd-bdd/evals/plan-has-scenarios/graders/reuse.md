---
type: llm
criteria: "Does it reuse the plan's scenarios instead of writing a parallel set?"
focus: output
---

2 points: output says it found existing scenarios in PLAN.md and returns S1-S3 as Gherkin
with the same Given/When/Then meaning (rewording into Gherkin syntax is fine; dropping
`Demonstrable after` is fine). It may point out gaps (e.g. over-limit, the 50 vs 100
conflict) as notes or open questions, but does not silently add new scenarios as if they
came from the plan.
1 point: reuses S1-S3 but mixes in new invented scenarios without labelling them.
0 points: ignores PLAN.md and writes a fresh set.

Baseline without the skill (2026-11-06): 1 point. Kept S1-S3 and added 8 unlabelled
scenarios, including audit-log and stored-payment-date Thens.

With the skill (2026-11-06): 2 points, 1/1 run (returned S1-S3 only; gaps under Open questions).
