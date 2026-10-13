---
type: llm
criteria: "Does the rewrite keep every source instruction, add no step or command, and label the overwrite risk before its step?"
focus: output
---

Baseline (before the faithfulness rules, 2026-10-02): invented `gcloud sql backups list`, dropped the console instruction, and gave the warning no level.

Scoring:
- 2 points: no command or step absent from the source; the console instruction survives; the overwrite risk is labeled Warning and stands before the restore step; the placeholder and command mismatch is reported as a gap, not silently fixed.
- 1 point: one of those fails.
- 0 points: a command or step is invented, or a source instruction is dropped.
