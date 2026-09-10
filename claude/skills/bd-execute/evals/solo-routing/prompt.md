---
name: Solo routing for a small phase
tags: [mode-routing]
runs: 3
max_turns: 15
---

/bd-execute ~/.claude/plans/rename-button.md --phase 1

For context, that plan is one small task: Task 1 "rename the Save button to Submit"
(Files: apps/web/components/Toolbar.tsx; Dependencies: none), with acceptance criteria and a
verification command (the component test). It is the whole phase — there is nothing to
parallelise.
