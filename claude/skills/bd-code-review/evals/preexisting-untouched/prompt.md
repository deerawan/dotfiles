---
name: Pre-existing issues stay unflagged
tags: [gate]
runs: 1
max_turns: 40
---

Set up a scratch repo from this eval's fixture directory (`fixture/` next to this file),
then review it:

1. Copy `fixture/base/` into a fresh temp directory, `git init -b master`, commit as "base".
   (Note: the base pricing module is what it is — commit it exactly as provided.)
2. `git checkout -b feature-currency-format`, overwrite with `fixture/head/` (it only adds
   formatCurrency and its test; pricing.js is untouched), commit as
   "add currency formatting with tests".
3. Run /bd-code-review master medium in that repo.

Show me the review report.
