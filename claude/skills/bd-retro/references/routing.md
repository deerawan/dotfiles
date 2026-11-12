# Routing steps

Ask each question in order. Stop at the first yes.

| Step | Question                                                                  | Target                             | Where it lives in monarch                                                                                          |
| ---- | ------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1    | Can a script detect it every time, before or as it happens?               | hook or script                     | `.claude/hooks/` (guards Claude only), `.husky/` and lint-staged (every commit), `scripts/` (a command people run) |
| 2    | Is it a code pattern a linter or test can see?                            | lint rule, test, or CI check       | `packages/eslint-config-*`, the package's tests, `.github/workflows/`                                              |
| 3    | Is it a repeatable multi-step workflow the agent got wrong or reinvented? | skill (edit an existing one first) | `.claude/skills/<name>/`, `.claude/agents/`                                                                        |
| 4    | Is it a judgement call, or a pointer to where something lives?            | one AGENTS.md line                 | the `AGENTS.md` nearest the code it governs (`apps/frontend/AGENTS.md` beats root)                                 |

- A hook that errors instead of running is a broken guard, not friction. Every session
  since then ran without it, so its fix scores 2 on cost.
- If a skill existed but the agent never loaded it, edit the skill's `description` so it
  triggers. Leave its body alone.
- An AGENTS.md proposal states in one line why steps 1–3 can't catch it, names the file
  and section, and gives the line as a command under 25 words, because every session
  loads it. If a near-identical line exists, replace or delete it instead.
