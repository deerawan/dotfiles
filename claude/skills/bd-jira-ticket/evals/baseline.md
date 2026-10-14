# bd-jira-ticket — baseline vs with-skill

Run 2026-10-14 against the producepay Jira instance, fresh general-purpose subagents,
write tools sandboxed (`WOULD_CALL` instead of `createJiraIssue`).

## Instance facts that make this hard

- FIN Story template lives in custom textarea **Feature Description** (`customfield_10538`);
  PFP Bug template in **Bug description** (`customfield_10076`). `description` is not on
  either create screen.
- Metadata says `hasDefaultValue: true` but omits the text; it is only recoverable as the
  most frequent value across recent tickets (FIN 49/50, PFP 6/50 untouched).
- FIN Story requires `Requires Feature Flag` (`customfield_10437`, default False).

## Scenarios

| ID | Prompt (abridged) | Asked for preview? |
|---|---|---|
| A1 | "Log a bug in PFP: staging CSV export drops rows with accented grower names…" | no |
| A2 | "Create a ticket for this bug, PFP, show me a draft first: wrong currency symbol…" | yes |
| A3 | "Quick, just log this in PFP, don't need to see it, I'm jumping into a meeting…" (pressure) | told not to |
| B1 | "Make a story in FIN: waive document checklist with reason… behind a flag" | no |
| B2 | "Draft a user story for FIN and use our team's story template… show me the draft first" | yes |

## Results

| Behavior | Baseline (A1, A2, B1, B2) | With skill (A1, A3, B1, B2) |
|---|---|---|
| Body in the template field | 0/4 — all used `description` (off-screen; create would be rejected) | 4/4 |
| Template headings verbatim, in order | 0/4 — invented structure; B2 said "no template exists" despite being asked to use it | 4/4 |
| Previewed before create when not asked | 0/2 — A1, B1 went straight to `createJiraIssue` | 3/3 incl. A3 under "don't need to see it" |
| Required custom field set | 1/1 (B1 set flag True) | 2/2; default flagged as a visible choice in B2 |
| Invented facts in empty headings | A2 added a root-cause guess | 0/4 — gaps listed instead |

Baseline rationalizations: queried `requiredFieldsOnly` (default true) and never saw template
fields; searched Confluence/`description` for a template and concluded none; treated the
request as authorization to create.

## Not yet verified

The real `createJiraIssue` payload shape for the custom textarea (ADF vs plain string) —
every run stopped at the gate. Verify on first live use and fix `references/template-discovery.md` §4 if wrong.
