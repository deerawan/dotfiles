---
name: bd-jira-ticket
description: Use when the user asks to log, file, raise, open, write, or draft a single Jira ticket — a bug, story, task, or any issue type — from a description in the conversation, especially when the team has a ticket template, the project uses custom description fields, or the user wants to see the ticket before it is created.
argument-hint: "[project key] [issue type] <what the ticket is about>"
---

# bd-jira-ticket

One ticket, from conversation to Jira, in the team's own template, previewed before
it exists. For a plan file's worth of tickets, use `bd-ticket` instead.

**Two things this skill exists to get right:**

1. **The template lives where the team put it — often not in `description`.** Many
   instances hold the per-type template as the *default value* of a custom textarea
   ("Bug description", "Feature Description"), and some hide `description` from the
   create screen entirely. Required-fields-only metadata never shows these fields, so
   an agent that only asks for required fields concludes "no template" and invents one.
2. **Nothing is created until the user has seen the exact draft and approved it.**
   That holds when the user didn't ask for a preview, too. A wrong ticket is visible
   to the whole team the moment it exists; a draft costs one round-trip.

## Step 1: Resolve project and issue type

- Project from the request (`PFP`, "the payments board"). Ambiguous or absent → ask with
  `AskUserQuestion`, offering `getVisibleJiraProjects` results. Never guess a project.
- Issue type from the request ("bug", "story"), matched against
  `getJiraProjectIssueTypesMetadata`. Names differ per project — use what it returns.

## Step 2: Discover fields and the template

Follow `references/template-discovery.md`. It produces:

- **Template field** — the field id the body goes in, and the template text.
- **Template source** — `field default`, `recovered from N/M recent tickets`, or
  `none found` (then you fall back as that reference says, and say so).
- **Required fields** — every `required: true` field beyond project/type/summary, with
  its default and allowed values.
- **`description` on screen?** — whether `description` appears in the create metadata.

## Step 3: Fill the template

The template is the contract — its shape stays, only the blanks change:

- Every heading/label from the template, verbatim, in its order. Content goes under the
  heading it belongs to.
- A heading the conversation gives nothing for stays in place, left empty (or `TBD` when
  the team's filled tickets show that convention). Empty headings tell the reader what is
  still unknown; deleting them hides it.
- Inline options in the template (`QA | Staging | Prod`, `x/5`) get resolved to the
  value the user gave — keep the line, pick the option.
- Facts come from the user. Don't invent repro steps, acceptance criteria, or root-cause
  guesses; open questions go under the template's own questions section if it has one,
  else in the preview's "Gaps" list.
- Required fields: use what the user said ("behind a flag" → `Requires Feature Flag:
  True`); otherwise the field's default, flagged in the preview so it is a visible choice.
- Writing on the user's behalf: follow `~/.claude/VOICE.md` for the prose you add.

Run one quick duplicate search (distinctive nouns from the summary, last 180 days,
same project, all statuses) and carry any hit into the preview.

## Step 4: Preview — the gate

Show this, then ask (`AskUserQuestion`: Create / Edit / Cancel). No create call before
an explicit Create.

````markdown
## Draft — <Project KEY> <Issue type>

**Summary:** <≤80 chars>
**Template:** <field name> (`<field id>`) — source: <field default | recovered from 21/50 recent Bugs | none found → fallback>
**Fields:** Priority: Medium (default) · Requires Feature Flag: True (from "behind a flag") · Assignee: unset
**Possible duplicates:** none | PFP-123 "…" (Open)

### <field name> — exactly as it will be posted
```
<the filled template, verbatim>
```

**Gaps:** <headings left empty and what would fill them>
````

Edits loop back to this preview with the change applied. Re-preview after every edit —
approval covers the draft the user saw, not a later version.

## Step 5: Create and verify

One `createJiraIssue` call:

- `summary`, `issueTypeName`, `projectKey`.
- Template field via `additional_fields` (format rules in the reference). Send
  `description` only if Step 2 found it on the create screen — an off-screen field
  rejects the whole create.
- Every required field from Step 2.
- No sprint, no estimate, no transition unless the user asked.

A rejected create made nothing — read the error, fix the payload, retry once; if it
fails again, report the error and stop. Then `getJiraIssue` the new key and confirm the
template field holds the body. Report key + URL.

## Never

- Call `createJiraIssue` before the user approves the preview — including when they
  didn't ask for one, the ticket is "simple", or they said "just log it".
- Conclude "no template" from required-fields-only metadata or from `description` alone.
- Put the body in `description` when the template lives in another field.
- Drop, rename, reorder, or add top-level template headings.
- Invent facts to fill a heading.
- Create in a guessed project.
- Change the draft after approval without re-previewing.
