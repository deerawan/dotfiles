---
type: llm
criteria: "Does it decline to invent behaviour scenarios for a no-behaviour-change refactor?"
focus: output
---

2 points: says the change has no new user-visible behaviour, so there are no new
scenarios to write, in a line or two. It may offer a short regression check (amounts look
the same in the table, PDF and email) framed as "unchanged", and may suggest unit tests
instead. No new feature scenarios.
1 point: writes regression scenarios framed as "unchanged behaviour" but pads beyond 3
scenarios, or names implementation (formatMoney, Intl.NumberFormat) in steps.
0 points: writes scenarios as if this were a new feature, or invents a user goal.

Baseline without the skill (2026-11-06): 2 points. Declined Gherkin and suggested unit
tests. Kept as a regression check: the skill must not make this worse.

With the first skill draft: 1 point (wrote 3 "unchanged" regression scenarios). After adding the no-visible-change conditional: 2 points, 2/2 runs.
