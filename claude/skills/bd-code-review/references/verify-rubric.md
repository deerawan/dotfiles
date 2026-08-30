# Verification rubric

Injected verbatim into every reviewer prompt (the definition) and every verifier prompt
(the whole file). The definition leads; examples of what falls outside it follow — never
the other way around.

## Reportable-finding definition

A reportable finding IS all three of:

1. **On a changed line** — introduced or materially altered by this diff.
2. **Verifiable against a cited source** — the diff itself, a CLAUDE.md/AGENTS.md rule,
   a spec or ticket line, a Figma property, or git history. The citation travels with
   the finding.
3. **Something a senior engineer would raise** — it changes what the author should do
   before merging.

Outside the definition (these are examples, not the test — the three criteria above are
the test):

- Pre-existing issues the diff didn't touch, even real ones on adjacent lines
- Anything a linter, typechecker, or CI build will catch (imports, type errors,
  formatting) — assume those run separately
- Intentional changes clearly related to the broader change
- Pedantic nitpicks a senior engineer wouldn't spend review capital on
- Issues explicitly silenced in code (lint-ignore comments) for rules CLAUDE.md names

## Verifier instructions

You receive one lane's findings as a batch. For each finding, independently verify it
before scoring — re-read the cited line, the cited rule, the cited spec text. Cut or
downgrade anything that does not hold up on re-reading; reviewers hallucinate citations
and you are the gate. No finding survives without a citation you confirmed.

Source-confirmation rules:

- A finding citing **CLAUDE.md/AGENTS.md** survives only if the file states that rule —
  confirm the wording, not the vibe.
- A finding citing a **Figma property** survives only if the design context actually
  shows that value/variant.
- A finding citing the **spec/ticket** survives only if the quoted line exists and means
  what the finding claims.
- **Resolve before flagging:** if a question the finding raises can be answered by
  reading the code, answer it — report only what remains genuinely wrong.

Score each verified finding 0–100:

- **0** — Not confident at all. A false positive that doesn't stand up to light
  scrutiny, or a pre-existing issue.
- **25** — Somewhat confident. Might be real, but could not be verified. If stylistic,
  it is not explicitly called out in the relevant CLAUDE.md.
- **50** — Moderately confident. Verified real, but a nitpick or unlikely to happen in
  practice; relative to the rest of the diff, not very important.
- **75** — Highly confident. Double-checked and very likely a real issue that will be
  hit in practice; directly impacts functionality, or is directly stated in the
  relevant CLAUDE.md.
- **100** — Absolutely certain. Double-checked, definitely real, will happen frequently;
  the evidence directly confirms it.

## Thresholds

| Effort | Reported |
|---|---|
| low, medium | score ≥ 80 |
| high | score ≥ 60; findings below 80 display their confidence in the report |

Return the batch as: `score | severity | file:line | one-line summary | citation`,
one line per surviving finding, nothing else.
