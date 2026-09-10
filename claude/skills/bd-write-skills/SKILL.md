---
name: bd-write-skills
description: Author, edit, or harden an agent skill the rigor-first way — baseline the failure before writing, match the guidance form to that failure, then measure with an eval loop scaled to the skill type. Use when creating a new skill, rewriting or debugging one that under-triggers or gets ignored, tightening a SKILL.md, or fixing a description. Triggers on "write a skill", "create a skill", "improve this skill", "why won't my skill trigger", "bd-write-skills". Not for using or discovering existing skills, and not for building plugins, agents, hooks, or slash commands.
argument-hint: "[skill idea, existing skill path, or 'improve <name>'] [--quant|--pressure]"
---

# bd-write-skills

Turn a skill idea into a tested SKILL.md. Rigor-first spine from
`superpowers:writing-skills`: you do not write guidance until you have watched an
agent fail without it. Measurement is borrowed from `skill-creator` — referenced,
never copied — and dialled to the skill type. Unrecognized tokens: note and ignore.

```text
intent + classify type → RED (watch it fail) → author (match form to failure)
                                                        ↓
              measure (scaled to type) → REFACTOR → lint + deploy (bd-* house style)
```

**Iron law:** no guidance without a failing baseline first. This holds for a brand-new
skill AND for a one-line edit to an existing one. Wrote it before you saw the failure?
Delete it, run the baseline, start over. "Just a small addition" is not an exception —
you are documenting a fix for a failure you have not confirmed exists.

## Step 1: Capture intent + classify the type

Pull intent from the conversation first (a "turn this into a skill" often already
contains the workflow, the corrections, the I/O shapes) — the author fills gaps and
confirms. Then classify, because the type decides the author form AND the eval path:

| Type | Baseline failure it fixes | Author form | Eval path |
|---|---|---|---|
| **Discipline** (rules under pressure) | agent knows the rule, skips it | prohibition + rationalization table + red flags | pressure scenarios |
| **Technique** (how-to) | agent can't apply it / gaps | positive recipe, one great example | quant harness |
| **Pattern** (mental model) | agent misjudges when it applies | recognition + counter-examples | quant / qual |
| **Reference** (API/schema) | agent can't retrieve or misuses | tables, retrieval-optimized | quant retrieval |
| **Subjective** (voice, design) | output feels wrong | recipe + examples, explain why | light qual |

If the request is really several skills, decompose first — one skill, one job.

## Step 2: RED — watch it fail

Run the tempting task on a fresh subagent **without** the skill. Record verbatim: the
choices, the rationalizations (for discipline skills), the gaps (for technique/reference).
Always keep a no-guidance control — **if the baseline doesn't fail, there is nothing to
build; stop.** This is the whole point: you are writing against observed failure, not
imagined failure. See `superpowers:writing-skills` for the full RED-GREEN-REFACTOR method
and `testing-skills-with-subagents.md` for pressure types.

## Step 3: Author against the baseline

**Match the form to the failure** — the single most important decision. A prohibition
bulletproofs a discipline slip but *backfires* on wrong-shaped output; a recipe fixes
shape but won't hold a rule under pressure. Read `references/form-matching.md` now and
pick deliberately. Then:

- **Description = when-to-use, never what-it-does.** A description that summarizes the
  workflow becomes a shortcut the agent follows *instead of* reading the body. Write it
  **last**, through one lens: "should I reach for this right now?" Keyword-rich, third
  person, pushy enough to beat under-triggering.
- **Explain the why, not musty MUSTs.** Today's models have theory of mind — a reason
  binds better than an all-caps command. Reserve prohibitions for confirmed discipline
  slips. Don't overfit to your test cases; the skill runs on inputs you never saw.
- **Progressive disclosure.** SKILL.md lean (procedure + pointers); heavy reference,
  schemas, and reusable scripts go to `references/`/`scripts/`. A fact lives in SKILL.md
  **or** a references file, never both. Cross-reference sibling skills by name — never
  `@`-link (it force-loads and burns context).
- **bd-\* house style.** `SKILL.md` + `references/` + `evals/`, `argument-hint`
  frontmatter, terse imperative voice, a `Never` list. Land it under
  `~/dotfiles/claude/skills/<name>/`.

## Step 4: Measure — scaled to type (GREEN)

Locate the installed skill-creator once, then drive its tooling — don't reinvent it:

```bash
SC=$(dirname "$(find ~/.claude/plugins -path '*skill-creator/SKILL.md' | head -1)")
```

- **Discipline** → rerun the Step-2 pressure scenarios **with** the skill; combine
  pressures (time + sunk cost + authority). Success = complies under maximum pressure.
- **Technique / reference / pattern** → quantitative harness: for each of 3–5 realistic
  prompts, spawn a with-skill run and a baseline (no-skill) run in the same turn, grade,
  then `python -m scripts.aggregate_benchmark <workspace>/iteration-N --skill-name <name>`
  and `$SC/eval-viewer/generate_review.py` for the human review pass. Follow `skill-creator`
  for the workspace layout, grading, and viewer.
- **Subjective** → skip the benchmark; a couple of runs plus the author's eye.

Verify wording cheaply before a full scenario run: one fresh sample per variant, ≥5 reps,
always against a no-guidance control, and **read every flagged match by hand** — template
echoes masquerade as hits. Converging reps mean the wording binds; five readings mean it
doesn't.

## Step 5: REFACTOR — close loopholes

New rationalization in the with-skill runs? Add an explicit counter and re-test. Build the
rationalization table from every iteration; add a red-flags list for discipline skills.
Repeat until it holds or you stop making progress.

## Step 6: Lint + deploy

```bash
python "$SC/scripts/quick_validate.py" ~/dotfiles/claude/skills/<name>   # frontmatter, name, limits
```

Fix what it flags, then commit under `~/dotfiles/claude/skills/`. (It flags
`argument-hint` as unknown — ignore that one; it's a valid Claude Code field the
validator's allow-list predates.) Deploy one skill at a time — never batch untested skills. Leave `evals/` as the home for the scenarios you ran
so the next edit re-baselines against them.

## Delegate (no `@`-links)

- `superpowers:writing-skills` — full TDD-for-skills method, bulletproofing, SDO depth.
- `skill-creator` — eval harness, benchmark, viewer, `quick_validate.py`, and the
  description-triggering optimizer (`scripts/run_loop.py`) when a skill under- or
  over-triggers.

## Never

- Write or edit guidance before a baseline failure is on record — including "small" edits.
- Ship a skill whose baseline control didn't actually fail — there's nothing to fix.
- Put what-it-does in the description, or summarize the workflow there.
- Reach for a prohibition on a wrong-shaped-output failure — match the form (Step 3).
- Duplicate a fact across SKILL.md and references, or `@`-link a sibling skill.
- Vendor skill-creator's scripts into this skill — locate and call the installed copy.
- Batch-create skills without testing each, or claim GREEN without reading matches by hand.
