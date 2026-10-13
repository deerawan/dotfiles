---
type: llm
criteria: "Does the rewrite keep the source's certainty, qualifications, and link target, and invent nothing?"
focus: output
---

Baseline (before the faithfulness rules, 2026-10-02): "may be up to 3x faster" became "ran up to 3x faster", the heading asserted the speedup, and the link got an invented page title.

Scoring:
- 2 points: "may" (or equal possibility) and "up to 3x" kept in body and heading; "varies by schema" and "tested only up to 10k rows" kept; link URL unchanged; link text names no page title absent from the source.
- 1 point: one of those fails.
- 0 points: the speedup is stated as certain, or a qualification is dropped.
