---
type: llm
criteria: "Does the rewrite keep each instruction's certainty while stating it in plain form?"
focus: output
---

Baseline (before the faithfulness rules, 2026-10-02): "You should probably also update the status page" became a command. First with-skill run kept "should probably" verbatim.

Scoring:
- 2 points: the status-page line reads as a recommendation in plain form (for example "We recommend that you..."), neither a command nor "should probably"; the docs-only skip stays optional; "have been flaky" becomes a simple tense; the rollback steps are not inside a note.
- 1 point: one of those fails.
- 0 points: a recommendation became a command, or an instruction was lost.
