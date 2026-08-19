---
type: tool_used
tool: Skill
input_match: '"skill"\s*:\s*"(?:[\w-]+:)?bd-execute"'
min: 1
withOnly: true
---

Indicator only: the bd-execute skill actually loaded for this run (it is
user-invocation-only, so the slash-command form in the prompt must have resolved).
