---
name: bd-quick-wins
description: Use when the user wants to find quick wins in their Jira backlog — open tickets assigned to them or unassigned in their projects that are small to build but matter to the team or company. Triggers on "quick wins", "low-hanging fruit", "what can I knock out this week", "small high-impact tickets", "weekly ticket scan", "bd-quick-wins", or setting up a recurring/weekly quick-win check. Not for triaging a whole backlog's priorities or closing stale tickets.
argument-hint: "[--projects A,B] [--top N] [schedule]"
user-invocable: true
---

# Quick Wins

Find open tickets that are **quick to ship and worth shipping**, and say why for each. Read-only: it writes a report, it never assigns, transitions or comments. It must work unattended, so every step runs without asking the user anything.

| Phase | Produces |
|---|---|
| 1. Resolve | site, user, project scope |
| 2. Collect | candidate list (assigned to me + unassigned in scope) |
| 3. Screen | state loaded; cheap metadata pass → shortlist of ≤ 25 |
| 4. Assess | effort, impact, readiness (drafted AC where missing), with evidence |
| 5. Report | ranked file + chat summary; state saved |
| 6. Cards | task card per top-3 pick |

## Phase 1: Resolve

- `getAccessibleAtlassianResources` → `cloudId` and base `url`. Build every link from that base.
- `atlassianUserInfo` → the user's account. Use the system date for filenames and `lastRun`.
- **Project scope**, first match wins:
  1. `--projects` argument.
  2. `projects:` line in `~/.claude/bd-quick-wins/config.md`.
  3. Derived: run `(assignee = currentUser() OR assignee WAS currentUser()) AND updated >= -90d`, page through **every** result, count by project key, keep projects with ≥ 5. Reporter is excluded on purpose: filing an access request doesn't make a project yours. Print the derived list in the report so the user can pin it in the config.

## Phase 2: Collect

```text
A: assignee = currentUser() AND statusCategory = "To Do" AND issuetype != Epic
   AND updated >= -365d
B: project in (<scope>) AND assignee is EMPTY AND statusCategory = "To Do"
   AND issuetype != Epic AND updated >= -180d
```

Fetch with lean fields only: `summary, issuetype, priority, labels, status, created, updated, issuelinks, subtasks, parent, watches, votes` plus the story-point field if the site exposes one (discover it with `view: "evidence"` on one issue; if none, effort points are `unknown`). Page until done. Expect a few hundred rows. Even lean pages run 100 KB+ and may land in a file; condense each with one simple `jq` call into key, summary, type, priority, status, updated, link count.

Skip a ticket when it is blocked (an `is blocked by` link to a non-Done issue, or the description says to wait for another ticket) or already in flight. In flight means an open PR that is the ticket's own: its title or branch contains the key (`gh pr list --state open --search "<KEY> in:title"`, then confirm). Jira's Development field is not proof; it lists every PR that merely mentions the key. When the ticket names code, check the default branch too: a fix already merged means drop it.

## Phase 3: Screen (no descriptions yet)

Score each row from metadata alone and keep the top 25 (read at most 30 in Phase 4). On sites where priority, watchers and votes are flat across the backlog, they carry no signal; lean on summary wording and type instead, and say so in the report.

| Signal | Leans quick | Leans slow |
|---|---|---|
| Story points | ≤ 2 | ≥ 5, or has open subtasks |
| Type | Bug, Task, Chore | Epic child "spike", Story with many subtasks |
| Summary words | rename, copy, typo, bump, flag cleanup, add log, fix label, config | migrate, redesign, rewrite, new service, investigate |
| Impact hints | priority High+, many watchers/votes, `blocks` links, customer/support label, CI/dev-tooling friction | Lowest priority, no links, nobody watching |

Load the state file (see State). A ticket whose Jira `updated` equals its stored `updated` keeps its stored verdict and is not re-assessed; it still counts toward the ranking.

## Phase 4: Assess (shortlist only)

Read each shortlisted ticket with `getJiraIssue` (description + comments). When the current directory is a git repo the ticket points at (file paths, component names, error strings), grep for them to confirm the change is as small as it reads. Then judge:

- **Effort**: S (≤ half a day), M (≤ 2 days), L (more). Only S and M qualify. Say what makes it that size: a named file, a one-line config, a clear repro, an existing pattern to copy.
- **Impact on the team**: removes daily friction, unblocks other tickets or people, cuts CI time, kills recurring toil or alerts.
- **Impact on the company**: customer-facing bug, revenue or ops risk, compliance, support load, a stakeholder waiting.

Every reason cites evidence: a field value, a link, or a short quote from the ticket. No evidence → write `unknown`, never guess.

### Readiness

A ticket is **ready** when it has testable acceptance criteria: a section or list stating what done looks like, specific enough that a reviewer could check each item. Size alone never makes a ticket a quick win.

When criteria are missing or vague:

1. Draft them as Gherkin (`Given / When / Then`), 2–5 scenarios, built only from the description, comments, linked tickets, and code you read. Every scenario traces to one of those sources.
2. Re-assess effort and impact against the drafted criteria. Drafting often shows hidden scope; a ticket that grows past M drops out.
3. Classify:
   - **Ready**: had criteria → eligible.
   - **Ready with drafted AC**: criteria drafted, the sources answered every question, still S/M → eligible, flagged so the user posts the AC before starting.
   - **Needs refinement**: an open question the sources can't answer (expected behaviour, which users, which environment) → not eligible; list the questions.

An unresolved open question makes a ticket Needs refinement even when it already has criteria.

Drafted criteria stay in the report and the state file. Post them to Jira only on an explicit yes in an interactive session.

Rank eligible tickets by impact first, then effort (S before M), then Ready before Ready-with-drafted-AC, then age.

## Phase 5: Report

Write `~/.claude/bd-quick-wins/<YYYY-MM-DD>.md`, then show it in chat:

```text
# Quick wins: <date>
Scope: <projects> (<source: arg | config | derived>) · <n> candidates → <k> quick wins

## Quick wins
| # | Ticket | Effort | Readiness | Why it's quick | Why it matters | Mine/Unassigned | Since |
|---|---|---|---|---|---|---|---|
| 1 | [ABC-123](<url>) Fix typo in invoice email subject | S | Ready | One template string; repro in description | Customer-facing; support ticket linked (ABC-120) | Unassigned | new |

## Drafted acceptance criteria
### ABC-130 <summary>
Sources: description, comment by <name> on <date>, ABC-118
Scenario: ...

Also eligible, below the cap: <TICKET (effort, one-line why)>, ...

## Needs refinement
| Ticket | Open questions |

## Not quick
| Ticket | Why |

## Dropped since last run
| Ticket | Why (done / assigned away / grew in scope / AC drafting showed more work) |
```

`Since` is `new` or the date the ticket was first listed, from the state file. Cap the main table at `--top` (default 7). Fewer real wins beats a padded list; zero is a valid result.

## State

Findings persist in `~/.claude/bd-quick-wins/state.json`, one entry per ticket ever assessed:

```json
{
  "lastRun": "2026-11-30",
  "scope": { "projects": ["ABC"], "source": "derived" },
  "tickets": {
    "ABC-123": {
      "updated": "2026-11-20T10:02:00Z",
      "verdict": "quick-win",
      "readiness": "ready-drafted-ac",
      "effort": "S",
      "reasons": { "quick": "...", "team": "...", "company": "..." },
      "draftedAc": "Scenario: ...",
      "openQuestions": [],
      "firstSeen": "2026-11-23",
      "lastSeen": "2026-11-30",
      "timesListed": 2,
      "cardProposed": "2026-11-30"
    }
  }
}
```

`verdict` is one of `quick-win`, `needs-refinement`, `not-quick`, `dropped`. `readiness` is one of `ready`, `ready-drafted-ac`, `needs-refinement`, `none` (no criteria, not drafted because the ticket isn't a candidate). An eligible ticket below the `--top` cap keeps `verdict: quick-win`; `timesListed` counts only runs where it made the main table.

- **Read** it in Phase 3, before screening. Missing or unparsable → start empty and say so in the report; never fail the run.
- **Write** it once at the end of Phase 5: update every assessed ticket, bump `lastSeen`/`timesListed` for listed ones, and mark tickets that left the candidate set as `dropped` with the reason. Write to `state.json.tmp`, then rename, so a crashed run never leaves half a file.
- Keep `dropped` entries 90 days, then delete them. A dropped ticket that comes back is re-assessed from scratch.
- A ticket listed 4+ runs and still untouched gets a note in the report: it keeps qualifying but nobody picks it up, so it may need a conversation, not a reminder.
- The dated `.md` reports are history for the user to read; the skill reads only `state.json`.

End with one line offering to assign the unassigned picks to the user and post any drafted AC.

## Phase 6: Task cards for the top picks

Propose the top 3 picks as task cards so the user can start one with a click. Use `start_session` with `initiation: "own_initiative"`, `context: "fresh"`, `use_worktree: true`, one call per pick (the app shows at most three per turn). A card starts nothing until the user clicks it and expires after 7 days, so a weekly run never leaves old cards behind. Proposing is allowed in a scheduled run.

- `title`: `<KEY> <short summary>`, under 60 chars.
- `prompt`: the `chip-prompt` line from `~/.claude/bd-quick-wins/config.md` with `{key}` replaced (default `Implement {key}`), then a self-contained brief: what to change and where (the code facts from Phase 4), the acceptance criteria to meet, and the constraints from the ticket. For a drafted-AC pick, say to post the AC after the user approves the text, before writing code. For an unassigned pick, say to ask before assigning it.
- `background`: why it's a quick win (effort and impact reasons) and the report path.

Skip a pick that already has a card from a previous run still waiting (the state file's `cardProposed` date is under 7 days old). Record `cardProposed: <date>` on each pick you propose. If `start_session` isn't available, say so in the report and stop there. Do that only on an explicit yes in an interactive session.

## Schedule (only when the user asks to set up the routine)

Create a local scheduled task with `create_scheduled_task`:

- `taskId`: `weekly-quick-wins`
- `cronExpression`: `0 8 * * 1` (Monday 08:00 local) unless the user names another time
- `prompt`: `Run the bd-quick-wins skill. Write the report file and summarize the top picks. Do not assign, transition, or comment on any ticket.`

Tell the user it runs only while the desktop app is open (or on next launch).

## Never

- Assign, transition, comment on, or edit a ticket (including posting drafted AC) without an explicit yes in the current interactive session.
- Draft an acceptance criterion with no source behind it, or count a drafted-AC ticket as ready while an open question remains.
- Ask a question mid-run; a scheduled run has nobody to answer. Fall back to defaults and note them in the report.
- State a reason, estimate, or impact without citing the ticket evidence behind it.
- Search unassigned tickets site-wide; always scope to projects.
- Pad the list to hit `--top`.
