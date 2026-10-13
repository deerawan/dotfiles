---
name: Solo spans every phase in one PR
tags: [mode-routing]
runs: 3
max_turns: 15
---

/bd-execute ~/.claude/plans/lint-rules.md

For context, that plan has two phases. Phase 1 is Task 1 "shared restricted-imports options"
(Files: packages/eslint-config-common/options.js; Dependencies: none). Phase 2 is Tasks 2-3
"add the rules" (Files: packages/eslint-config-common/index.js; Dependencies: Task 1). Nothing
has been executed yet. I want it done solo.
