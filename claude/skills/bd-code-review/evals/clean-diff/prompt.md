---
name: Clean-diff false-positive suppression
tags: [gate]
runs: 1
max_turns: 40
---

Set up a scratch repo from this eval's fixture directory (`fixture/` next to this file),
then review it:

1. Copy `fixture/base/` into a fresh temp directory, `git init -b master`, commit as "base".
2. `git checkout -b feature-currency-format`, overwrite with `fixture/head/` (it adds a
   new formatCurrency function together with its test), commit as
   "add currency formatting with tests".
3. Run /bd-code-review master medium in that repo.

Show me the review report.
