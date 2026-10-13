---
type: tool_used
tool: Bash
input_match: 'herdr\s+(agent|tab)\s+rename'
min: 0
max: 0
---

Mechanical check: solo mode never claims a lead identity or renames a tab — the (crew)
preflight in Step 1.2 is deferred and runs only when parallel is chosen. Any `herdr agent
rename` / `herdr tab rename` here means the agent took the crew path for a phase it should
have run solo.
