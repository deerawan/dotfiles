---
name: bd-quick-wins
description: Use when the user wants to find quick wins in their Jira or Linear backlog — open tickets assigned to them or unassigned in their projects or teams that are small to build but matter to the team or company. Triggers on "quick wins", "low-hanging fruit", "what can I knock out this week", "small high-impact tickets", "weekly ticket scan", "bd-quick-wins", or setting up a recurring/weekly quick-win check. Not for triaging a whole backlog's priorities or closing stale tickets.
argument-hint: "[--tracker jira|linear|both] [--projects A,B] [--teams X,Y] [--top N] [schedule]"
user-invocable: true
---

# Quick Wins

Find open tickets that are **quick to ship and worth shipping**, and say why for each. Read-only: it writes a report, it never assigns, transitions or comments. It must work unattended, so every step runs without asking the user anything.

| Phase | Produces |
|---|---|
| 1. Resolve | trackers, site, user, scope |
| 2. Collect | candidate list (assigned to me + unassigned in scope), per tracker |
| 3. Screen | state loaded; cheap metadata pass → shortlist of ≤ 25 across trackers |
| 4. Assess | effort, impact, readiness (drafted AC where missing), with evidence |
| 5. Report | ranked file + chat summary; state saved |
| 6. Cards | task card per top-3 pick |

## Trackers

A team can keep its backlog in Jira, in Linear, or partly in each (mid-migration). Checking only one misses the other's work. Phases 2–6 are the same for both; only the calls differ:

| Step | Jira (Atlassian MCP) | Linear (Linear MCP) |
|---|---|---|
| Site + user | `getAccessibleAtlassianResources` → `cloudId`, base `url`; `atlassianUserInfo` | `whoami` |
| Scope unit | project key | team name |
| Derive scope | JQL `(assignee = currentUser() OR assignee WAS currentUser()) AND updated >= -90d`, count by project | `list_issues` `assignee: "me"`, `updatedAt: "-P90D"`, `fields: [team]`, count by team |
| A: mine, to do | JQL `assignee = currentUser() AND statusCategory = "To Do" AND issuetype != Epic AND updated >= -365d` | `list_issues` `assignee: "me"`, `state` `unstarted` then `backlog`, `updatedAt: "-P365D"` |
| B: unassigned | JQL `project in (<scope>) AND assignee is EMPTY AND statusCategory = "To Do" AND issuetype != Epic AND updated >= -180d` | `list_issues` per team, `assignee: "null"`, `state` `unstarted` then `backlog`, `updatedAt: "-P180D"` |
| Lean fields | `summary, issuetype, priority, labels, status, created, updated, issuelinks, subtasks, parent, watches, votes` + story-point field (find it with `view: "evidence"` on one issue) | `fields: [title, priority, estimate, labels, status, updatedAt, createdAt, parentId, project]` |
| Paging | `nextPageToken` until `isLast` | `limit: 250`, `cursor` while `hasNextPage` |
| Read one | `getJiraIssue` `view: "evidence"` (description, comments, links) | `get_issue` `fields: [title, description, priority, relations, updatedAt, url]`, plus `list_comments` when the description leaves a question open |
| Blocked | `is blocked by` link to a non-Done issue | `relations.blockedBy` holds an issue not completed or canceled |
| Effort points | story points | `estimate` |
| Link | `<base url>/browse/<KEY>` | `url` from `get_issue`, or `https://linear.app/<workspace>/issue/<KEY>` |

Skip Linear's `triage` state: untriaged tickets have not been accepted into the backlog yet.

## Phase 1: Resolve

- **Trackers**, first match wins:
  1. `--tracker` argument.
  2. `trackers:` line in `~/.claude/bd-quick-wins/config.md` (`jira`, `linear`, or `jira, linear`).
  3. Derived: try both. Keep each tracker whose MCP answers and whose scope rule below finds at least one project or team. A tracker whose MCP is missing or errors is reported as `unavailable`, never silently dropped.
- Use the system date for filenames and `lastRun`.
- **Scope** per tracker, first match wins:
  1. `--projects` (Jira) or `--teams` (Linear) argument.
  2. `projects:` / `teams:` line in the config.
  3. Derived: run the tracker's derive-scope call from the table, page through **every** result, count by project or team, keep those with ≥ 5. Reporter/creator is excluded on purpose: filing an access request doesn't make a project yours. Print the derived list in the report so the user can pin it in the config.

## Phase 2: Collect

Run queries A and B for each tracker in scope, with the lean fields only. Page until done. Expect a few hundred rows per tracker. Even lean pages run 100 KB+ and may land in a file; condense each with one simple `jq` call into key, summary, type or labels, priority, status, updated, link count.

**Duplicates across trackers.** Tickets migrated from Jira to Linear carry `Migrated from Jira: [FOO-123]` in the description. List each piece of work once, under its live tracker (usually Linear), and use both keys in the in-flight and merged checks below. When the Jira original is still open, say in the report that it can be closed as a duplicate.

Skip a ticket when it is blocked (see the table, or the description says to wait for another ticket) or already in flight. In flight means an open PR that is the ticket's own: its title or branch contains the key (`gh pr list --state open --search "<KEY> in:title"`, then confirm). Jira's Development field and Linear's attached PR links are not proof; they list every PR that merely mentions the key. When the ticket names code, check the default branch too (`git log origin/<default> -i --grep=<KEY>` for each key, then the named file): a fix already merged means drop it.

## Phase 3: Screen (no descriptions yet)

Score each row from metadata alone and keep the top 25 across all trackers (read at most 30 in Phase 4). When priority, watchers, votes or estimates are flat or empty across the backlog, they carry no signal; lean on summary wording, type and labels instead, and say so in the report. Bulk-migrated tickets share one `updated` date, so age carries no signal for them either.

| Signal | Leans quick | Leans slow |
|---|---|---|
| Story points / estimate | ≤ 2 | ≥ 5, or has open subtasks/children |
| Type or label | Bug, Task, Chore | Epic child "spike", Story with many subtasks, `Open Question` |
| Summary words | rename, copy, typo, bump, flag cleanup, add log, fix label, config | migrate, redesign, rewrite, new service, investigate |
| Impact hints | priority High+, many watchers/votes, `blocks` links, customer/support label, security or PII, CI/dev-tooling friction | Lowest priority, no links, nobody watching |

Load the state file (see State). A ticket whose tracker `updated` equals its stored `updated` keeps its stored verdict and is not re-assessed; it still counts toward the ranking.

## Phase 4: Assess (shortlist only)

Read each shortlisted ticket with the tracker's read call. If a read times out, retry once; if it fails again, list the ticket under "Not assessed" with the reason and move on. When the current directory is a git repo the ticket points at (file paths, component names, error strings), grep for them on the default branch to confirm the change is as small as it reads. Then judge:

- **Effort**: S (≤ half a day), M (≤ 2 days), L (more). Only S and M qualify. Say what makes it that size: a named file, a one-line config, a clear repro, an existing pattern to copy.
- **Impact on the team**: removes daily friction, unblocks other tickets or people, cuts CI time, kills recurring toil or alerts.
- **Impact on the company**: customer-facing bug, revenue or ops risk, compliance, support load, a stakeholder waiting.

Every reason cites evidence: a field value, a link, or a short quote from the ticket. No evidence → write `unknown`, never guess. Ticket code facts can be stale; when the code you grep disagrees with the ticket (a line number moved, one call site became three), report what the code says.

### Readiness

A ticket is **ready** when it has testable acceptance criteria: a section or list stating what done looks like, specific enough that a reviewer could check each item. Size alone never makes a ticket a quick win.

When criteria are missing or vague:

1. Draft them as Gherkin (`Given / When / Then`), 2–5 scenarios, built only from the description, comments, linked tickets, and code you read. Every scenario traces to one of those sources.
2. Re-assess effort and impact against the drafted criteria. Drafting often shows hidden scope; a ticket that grows past M drops out.
3. Classify:
   - **Ready**: had criteria → eligible.
   - **Ready with drafted AC**: criteria drafted, the sources answered every question, still S/M → eligible, flagged so the user posts the AC before starting.
   - **Needs refinement**: an open question the sources can't answer (expected behaviour, which users, which environment) → not eligible; list the questions.

An unresolved open question makes a ticket Needs refinement even when it already has criteria. A sibling or migrated ticket in the other tracker can answer the question; cite it.

Drafted criteria stay in the report and the state file. Post them to the ticket's tracker only on an explicit yes in an interactive session.

Rank eligible tickets by impact first, then effort (S before M), then Ready before Ready-with-drafted-AC, then age.

## Phase 5: Report

Write `~/.claude/bd-quick-wins/<YYYY-MM-DD>.md` (one report covering every tracker), then show it in chat:

```text
# Quick wins: <date>
Scope: Jira <projects> (<source>) · Linear <teams> (<source>) · <n> candidates → <k> quick wins
Unavailable: <tracker and why, or omit>

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

## Not quick / not assessed
| Ticket | Why |

## Duplicates across trackers
| Live ticket | Old ticket | Note |

## Dropped since last run
| Ticket | Why (done / assigned away / grew in scope / AC drafting showed more work) |
```

`Since` is `new` or the date the ticket was first listed, from the state file. Cap the main table at `--top` (default 7). Fewer real wins beats a padded list; zero is a valid result.

## State

Findings persist in `~/.claude/bd-quick-wins/state.json`, one entry per ticket ever assessed, keyed by ticket key (Jira and Linear keys don't collide):

```json
{
  "lastRun": "2026-11-30",
  "scope": {
    "jira": { "projects": ["ABC"], "source": "derived" },
    "linear": { "teams": ["Product"], "source": "derived" }
  },
  "tickets": {
    "ABC-123": {
      "tracker": "jira",
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

`tracker` is `jira` or `linear`; an entry without it is from an older run and is Jira. `verdict` is one of `quick-win`, `needs-refinement`, `not-quick`, `dropped`. `readiness` is one of `ready`, `ready-drafted-ac`, `needs-refinement`, `none` (no criteria, not drafted because the ticket isn't a candidate). An eligible ticket below the `--top` cap keeps `verdict: quick-win`; `timesListed` counts only runs where it made the main table. Older state files with a flat `scope` (`projects` at the top) are Jira scope; rewrite them in the new shape.

- **Read** it in Phase 3, before screening. Missing or unparsable → start empty and say so in the report; never fail the run.
- **Write** it once at the end of Phase 5: update every assessed ticket, bump `lastSeen`/`timesListed` for listed ones, and mark tickets that left the candidate set as `dropped` with the reason. A ticket whose tracker was unavailable this run is left as it was, not dropped. Write to `state.json.tmp`, then rename, so a crashed run never leaves half a file.
- Keep `dropped` entries 90 days, then delete them. A dropped ticket that comes back is re-assessed from scratch.
- A ticket listed 4+ runs and still untouched gets a note in the report: it keeps qualifying but nobody picks it up, so it may need a conversation, not a reminder.
- The dated `.md` reports are history for the user to read; the skill reads only `state.json`.

End with one line offering to assign the unassigned picks to the user and post any drafted AC.

## Phase 6: Task cards for the top picks

Propose the top 3 picks as task cards so the user can start one with a click. Cards exist only in the desktop app; in the CLI, use the fallback at the end of this phase. Use `start_session` (or `spawn_task`, whichever the app provides) with `initiation: "own_initiative"`, `context: "fresh"`, `use_worktree: true`, one call per pick (the app shows at most three per turn). A card starts nothing until the user clicks it and expires after 7 days, so a weekly run never leaves old cards behind. Proposing is allowed in a scheduled run.

- `title`: `<KEY> <short summary>`, under 60 chars.
- `prompt`: the `chip-prompt` line from `~/.claude/bd-quick-wins/config.md` with `{key}` replaced (default `Implement {key}`), then a self-contained brief: the ticket's tracker and link, what to change and where (the code facts from Phase 4), the acceptance criteria to meet, and the constraints from the ticket. For a drafted-AC pick, say to post the AC after the user approves the text, before writing code. For an unassigned pick, say to assign the ticket to the user first, before any other step: clicking the card is the user's approval.
- `background`: why it's a quick win (effort and impact reasons) and the report path.

Skip a pick that already has a card from a previous run still waiting (the state file's `cardProposed` date is under 7 days old). Record `cardProposed: <date>` on each pick you propose. **CLI fallback.** When no card tool is available, print each pick as a command the user can paste, in the report and in chat:

```bash
claude "<the card prompt above>"
```

Use the same prompt a card would get. Tell the user to run it from a fresh worktree of the repo, because the command does not create one. Leave `cardProposed` unset, because nothing is waiting to be clicked.

## Schedule (only when the user asks to set up the routine)

Create a local scheduled task with `create_scheduled_task`:

- `taskId`: `weekly-quick-wins`
- `cronExpression`: `0 8 * * 1` (Monday 08:00 local) unless the user names another time
- `prompt`: `Run the bd-quick-wins skill. Write the report file and summarize the top picks. Do not assign, transition, or comment on any ticket.`

Tell the user it runs only while the desktop app is open (or on next launch).

## Never

- Assign, transition, comment on, or edit a ticket (including posting drafted AC) without an explicit yes in the current interactive session. The scan itself never assigns. Starting a task card counts as a yes to assigning that card's ticket, and only that ticket.
- Draft an acceptance criterion with no source behind it, or count a drafted-AC ticket as ready while an open question remains.
- Ask a question mid-run; a scheduled run has nobody to answer. Fall back to defaults and note them in the report.
- State a reason, estimate, or impact without citing the ticket evidence behind it.
- Search unassigned tickets site-wide or workspace-wide; always scope to projects or teams.
- Check one tracker and report "no quick wins" without saying which trackers were searched and which were unavailable.
- Pad the list to hit `--top`.
