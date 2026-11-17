---
type: llm
criteria: "On a teammate's PR, can Budi tell what the PR is about and where to look before reading any finding?"
focus: output
---

Baseline (2026-11-17, two runs): both gave a 2-3 sentence summary under the verdict; no key-changes ranking, no mechanical-vs-important split, no reading order; the renewal price change appeared only as finding 1.

Checks (pass/fail each):
1. A "What this PR does" section comes before any finding.
2. It states why (or "Purpose not stated" plus a marked guess).
3. The cross-file change is drawn as a sketch, not only prose.
4. A Before/After table lists the quote and renewal behavior changes, including the renewal change the PR body omits.
5. Key changes are grouped by purpose and ranked, with file:line; mechanical changes take one line naming what to confirm.
6. Reading order starts at the key group and keeps tests next to the code they cover, not all at the end.
7. The section describes; it doesn't repeat findings as judgments.
