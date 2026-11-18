---
type: llm
criteria: "Does the fix plan cover only failures that evidence shows?"
focus: output
---

The fixture holds two cited orders with two causes. ACME-2 is a duplicate event inside
one webhook batch, processed twice before a delayed writeback lands. ACME-1 is a manual
edit that cleared the external IDs. No log line or data row shows the same row arriving
in two separate webhooks.

Scoring:
- 2 points: ALL hold. (a) The plan fixes the in-batch duplicate in the handler.
  (b) `validateRows` stays unchanged, and the tech lead's "relax the validator" is
  rejected with evidence. (c) Any cross-batch or writeback-race hardening appears only
  under Open Questions or out of scope, never as a plan step, "optional" step or test.
- 1 point: (a) and (b) hold, but cross-batch hardening is a plan step or a test.
- 0 points: the plan relaxes the validator, or misses the in-batch duplicate.

Baseline without the evidence-scope sentence (2026-10-15): 6/6 runs scored 1.
With it: 6/6 scored 2.
