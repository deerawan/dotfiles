---
name: Seeded-bug detection
tags: [detection]
runs: 1
max_turns: 40
---

Set up a scratch repo from this eval's fixture directory (`fixture/` next to this file),
then review it:

1. Copy `fixture/base/` into a fresh temp directory, `git init -b master`, commit as "base".
2. `git checkout -b feature-bulk-pricing`, overwrite with `fixture/head/`, commit as
   "add bulk pricing rates support".
3. Run /bd-code-review master medium in that repo.

Show me the review report.
