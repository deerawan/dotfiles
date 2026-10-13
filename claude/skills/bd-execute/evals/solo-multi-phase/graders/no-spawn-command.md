---
type: tool_used
tool: Bash
input_match: 'spawn-crewmate\.sh'
min: 0
max: 0
---

Mechanical check: spawn-crewmate.sh must never be executed for a solo-routed phase — solo mode
implements in the current worktree with no crewmates, and the sandbox has no herdr/stax anyway.
