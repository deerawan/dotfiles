---
type: llm
criteria: "Did the agent's solo shape cover Tasks 1-3 across both phases on ONE branch off trunk ending in ONE PR, with no per-phase PR and no PR stacked on another branch?"
focus: trace
---

Solo mode implements every remaining task in the plan, across all phases, on one trunk-based
branch with one PR. It ignores `--phase` and never stacks.

Scoring:
- 2 points: the solo shape at the gate (or the work after approval) lists Tasks 1, 2 and 3 on
  a single branch cut from trunk, ending in a single PR, and the agent gated before editing.
- 1 point: one branch and one PR, but the agent limited solo to Phase 1 and deferred Phase 2
  to a later run, or did not state the base.
- 0 points: a PR per phase, a Phase 2 branch or PR based on the Phase 1 branch, any stacked
  PR, or editing before an approval gate.
