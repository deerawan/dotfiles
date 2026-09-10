# Match the Form to the Failure

Classify the baseline failure *before* choosing a form. The form that bulletproofs one
failure type measurably backfires on another — this is the highest-leverage decision in
authoring a skill, so make it deliberately.

| Baseline failure | Right form | Wrong form |
|---|---|---|
| Skips/violates a rule under pressure (knows better, does it anyway) | Prohibition + rationalization table + red-flags list | Soft guidance ("prefer…", "consider…") |
| Complies, but output has the wrong shape (bloated prompt, buried verdict, restated spec) | Positive recipe or contract: state what the output **is** — its parts, in order | Prohibition list ("don't restate", "never narrate") |
| Omits a required element from something it already produces | Structural: a REQUIRED field or slot in the template it fills in | Prose reminders near the template |
| Behavior should depend on a condition | Conditional keyed to an observable predicate ("if the brief exists, reference it") | Unconditional rule + exemption clauses |

## Why prohibitions backfire on shaping problems

Under a competing incentive ("make the prompt self-contained"), agents *negotiate* with
"don't X". In head-to-head wording tests, the prohibition arm produced clearly more of the
unwanted content than the recipe arm — and trended worse than even the no-guidance control.
A recipe leaves nothing to negotiate: the output matches the stated shape or it doesn't.
Micro-test your own case rather than assuming, but never reach for the prohibition by default.

## Two rules for whichever form you pick

- **No nuance clauses.** "Don't X unless it matters" reopens the negotiation — appending a
  single nuance clause to a winning recipe degraded it from consistent to noisy in the same
  tests. Express a real exception as its own conditional on an observable predicate.
- **Exemption clauses don't scope.** "This limit doesn't apply to code blocks" still
  suppresses code blocks. If part of the output must be exempt, restructure so the rule
  can't reach it.

## Bulletproofing a discipline skill (only for the rule-slip row)

- **Close every loophole explicitly.** Don't just state the rule — forbid the specific
  workarounds ("Delete it. Start over. Don't keep it as reference. Don't 'adapt' it.
  Delete means delete.").
- **Letter = spirit.** State early: "violating the letter of the rules is violating the
  spirit." Cuts off the whole "I'm following the spirit" class.
- **Rationalization table + red flags.** Every excuse from baseline testing goes in the
  table with its rebuttal; the red-flags list lets the agent self-catch mid-rationalization.

Source: condensed from `superpowers:writing-skills` (§ Match the Form to the Failure,
§ Bulletproofing). Read that skill for the full treatment and the persuasion research behind it.
