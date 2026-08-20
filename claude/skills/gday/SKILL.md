---
name: gday
description: "Morning briefing skill that pulls together your daily digest: recent emails, Confluence page updates, JIRA ticket changes, Slack conversations, and today's upcoming calendar events — all in one nicely formatted summary. Use this skill whenever the user says things like 'gday', \"g'day\", 'morning', 'good morning', 'morning briefing', 'daily digest', 'catch me up', 'what did I miss', 'what happened overnight', 'daily standup prep', 'start my day', 'morning summary', or any variation asking for an overview of recent activity across their work tools. Also trigger if the user asks to see recent updates across email, Slack, JIRA, and calendar together."
---

# Morning Briefing

You are generating a morning briefing — a single, scannable summary that helps the user start their day informed. The goal is to surface what matters so nothing falls through the cracks.

## Context

The user's work tools span Gmail, Atlassian (JIRA + Confluence), Slack, and Google Calendar. Step 2 resolves their site and timezone — don't assume either. When they run this skill, they want a quick but thorough overview of what's happened since they last checked in, plus what's coming up today.

## Step 1: Determine the lookback window

Figure out what day it is (use the current date from the environment).

- **Monday**: Look back **3 days** (covers Saturday and Sunday — which overlap with Friday in the US, so this catches end-of-week activity from US-based colleagues).
- **Tuesday through Friday**: Look back **24 hours**.

Use this window for all data-fetching steps below. Calculate the `after:` date accordingly (e.g., if today is Monday March 23, the lookback starts from Friday March 20).

## Step 2: Resolve the Atlassian site and the user's timezone

Call `getAccessibleAtlassianResources` first. It returns the `cloudId` every subsequent Atlassian call needs, plus the site's base `url` — build every Atlassian link from that base rather than hardcoding a site.

Then call `atlassianUserInfo` once for `zoneinfo`, the user's own timezone. Cache both for the duration of the briefing.

## Step 3: Fetch data from all sources in parallel

Speed matters here — the user is starting their day and doesn't want to wait. Launch all of these data-fetching calls at the same time (in parallel, not sequentially):

### 📧 Email (Gmail)

Use `search_threads` with query `after:YYYY/MM/DD -in:sent` (e.g., `after:2026/03/20 -in:sent` — sent mail is included by default, and your own replies are not news). Set `pageSize` to 20. The default `view` already returns each thread's `id`, sender, subject, snippet and date, so triage from the search result alone; reach for `get_message` only when a snippet is too thin to summarize. Focus on emails that look important — from real people (not automated notifications), with substantive subjects. **Skip GitHub PR/notification emails** (e.g. from `notifications@github.com`) — pull requests are covered by the dedicated GitHub section below via the `gh` CLI, not email.

### 📝 Confluence

Use `searchConfluenceUsingCql` with the `cloudId` from Step 2. Use CQL like `lastmodified >= "YYYY-MM-DD" ORDER BY lastmodified DESC`. Pull the page title, space, who modified it, and when.

### 🎫 JIRA

Use `searchJiraIssuesUsingJql` with the `cloudId` from Step 2. Use JQL like `updated >= "-1d" ORDER BY updated DESC` (or `-3d` on Mondays), and set `fields` to `["summary", "status", "assignee", "priority", "updated", "project"]`. Keep the query site-wide: seeing what the whole team moved is the point, not just the user's own tickets.

Two limits to plan around. `maxResults` has a floor of 50 here, so asking for fewer does nothing. And **never request `comment`** — comment bodies across 50 issues overflow the response limit on their own.

A site-wide day of activity often overflows the limit anyway, in which case the full result is written to a file and the path is returned. That is the normal path, not a failure — read it rather than narrowing the search and losing the breadth:

```
jq -r '.issues.nodes[] | [.key, .fields.project.key, .fields.status.name, (.fields.assignee.displayName // "unassigned"), .fields.summary] | @tsv' <path>
```

### 💬 Slack

Use `slack_search_public_and_private` to search for recent messages. Use date modifiers in the query: `after:YYYY-MM-DD` (e.g., `after:2026-03-20`). Sort by `timestamp` with `sort_dir: desc`. To find mentions, search separately for `to:<@THEIR_ID>`. The Slack MCP server states the logged-in user's own ID in the `slack_search_users` tool description, so read it from there rather than spending a call to look it up. Focus on substantive conversations (not bot notifications or routine automated messages).

### 🔀 GitHub Pull Requests

Retrieve PRs with the `gh` CLI via the `Bash` tool — **never** from email. Run these searches (date filter uses the lookback start, e.g. `2026-03-20`):

- **Awaiting your review:** `gh search prs --review-requested=@me --state=open --draft=false --json number,title,url,repository,author,updatedAt --limit 30` (`--draft=false` excludes draft PRs — you can't review those yet)
- **Your open PRs (recently active):** `gh search prs --author=@me --state=open --json number,title,url,repository,isDraft,updatedAt --limit 30`. `reviewDecision` is **not** a valid field on `gh search prs` and asking for it fails the whole query — it is valid on `gh pr view <number> --repo <repo> --json reviewDecision`, so fetch review status per PR only for the ones you are going to report.
- **Your review in progress (awaiting author):** `gh search prs --reviewed-by=@me --state=open --draft=false --json number,title,url,repository,author,updatedAt --limit 30`. These are PRs you've already engaged with (reviewed or commented) but that no longer request your review — the ball is in the author's court. **Exclude** any PR that also appears in "Awaiting your review" (still requesting you), that you authored, **or that you've already approved** — once you've approved, it's off your plate. To check, run `gh pr view <number> --repo <repo> --json reviews` and drop the PR if your most recent review state is `APPROVED`; keep it only when your latest review is `COMMENTED` or `CHANGES_REQUESTED`.
- **Updated since lookback:** append `--updated=">=YYYY-MM-DD"` to any search to focus on overnight activity.

For each PR capture the repo, number, title, author, review status, and URL (the `url` field is the direct link). Prioritize PRs waiting on the user's review and the user's own PRs that just got approved or have new review comments. If `gh` isn't authenticated (`gh auth status` fails), note it and skip this section rather than failing the briefing.

### 📅 Calendar (Google Calendar)

Use `list_events` to get today's events. Set the time range to cover the full day. Include the event title, time, location/meeting link, and attendees.

## Step 3: Format the briefing

Present the briefing as a clean, well-organized summary directly in the conversation. Use the section structure below with emoji headers. Within each section, keep items concise — one or two lines per item is ideal. If a section has nothing noteworthy, say so briefly (e.g., "No new updates") rather than omitting it, so the user knows you checked.

### Output structure

```
## ☀️ Good Morning, Budi!
_Here's your briefing for [Day, Month Date]. Covering updates since [lookback start]._

---

### 📧 Email Highlights
[For each important email: sender, subject as a clickable link, and a one-line summary. Group by importance if possible. Aim for 5-10 items max — skip obvious spam/newsletters unless they look relevant.]

Each email item should link to the email thread. `search_threads` returns each thread's `id` — construct a direct Gmail link like: `https://mail.google.com/mail/u/0/#inbox/<id>`. Format the subject as a markdown link: `[Subject](https://mail.google.com/mail/u/0/#inbox/<id>)`.

---

### 📝 Confluence Updates
[For each updated page: page title as a clickable link, space name, who updated it, and a brief note on what changed.]

Confluence search results include a `_links.webui` path. Append it to the site base URL from Step 2: `<site-url>/wiki<_links.webui path>`. Format the page title as a markdown link: `[Page Title](full URL)`.

---

### 🎫 JIRA Activity
[For each updated ticket: ticket key + summary as a clickable link, current status, and what changed (e.g., "moved to In Review", "new comment from Sarah"). Group by project if there are multiple projects.]

JIRA issues have a `key` field (e.g., `ABC-1234`). Construct a direct link from the site base URL in Step 2: `<site-url>/browse/<key>`. Format each ticket as a markdown link: `[ABC-1234](<site-url>/browse/ABC-1234)`.

---

### 💬 Slack Conversations
[Key conversations and mentions. For each: channel name as a clickable link, topic/thread summary, and whether action is needed from the user. Prioritize direct mentions and active threads.]

Slack search results include a `permalink` field for each message. Use it directly as a markdown link. Format like: `[#channel-name](permalink) — summary of conversation`. If a permalink isn't available, construct one from the workspace domain, channel ID and message timestamp: `https://<workspace>.slack.com/archives/<channel_id>/p<message_ts without dot>`.

---

### 🔀 GitHub Pull Requests
[Group into "Awaiting your review", "Your review in progress (awaiting author)", and "Your open PRs". For each: repo + PR number + title as a clickable link, author (for review requests) or review status (for your own PRs), and what's new. For the "review in progress" bucket, note that the ball is in the author's court (e.g. "you commented yesterday, author hasn't responded"). Flag PRs that are approved and ready to merge, or that have requested changes.]

Use the `url` field from the `gh` output directly as the markdown link. Format like: `[repo#1234](url) — title (author / review status)`.

---

### 📅 Today's Schedule
[Chronological list of today's events. For each: time, title as a clickable link, and meeting link if available. Flag any conflicts or back-to-back meetings.]

Calendar events include an `htmlLink` field — use it to link the event title directly to Google Calendar. If the event has a Google Meet or Zoom link in its location/description, show that as a separate "Join" link.

---

### 🎯 Suggested Focus
[Based on everything above, suggest 2-3 things the user might want to prioritize today. This could be responding to an urgent email, reviewing a JIRA ticket that's blocked, or prepping for an important meeting. Keep it actionable. Include relevant links so the user can jump straight to the item.]
```

## Tips for a great briefing

- **Link everything.** Every item in the briefing should be clickable — JIRA tickets link to the issue, Slack messages link to the thread, Confluence pages link to the page, emails link to Gmail, GitHub PRs link to the pull request, and calendar events link to Google Calendar. This is critical because the whole point of the briefing is to help the user quickly jump to the things that need attention. A briefing without links forces the user to go hunting, which defeats the purpose.
- **Be concise but complete.** Each item should be scannable in under 5 seconds. If something needs more detail, the user can ask follow-up questions.
- **Prioritize signal over noise.** Skip automated notifications, bot messages, and routine system emails. Surface the stuff that actually needs human attention.
- **Use plain language.** Instead of "Issue ABC-1234 transitioned from TODO to IN_PROGRESS," say "[ABC-1234](<site-url>/browse/ABC-1234) (Payment gateway fix) — moved to In Progress by Alex."
- **Time formatting.** Use 12-hour format with AM/PM for calendar events, in the `zoneinfo` timezone from Step 2 — not UTC and not the event's own timezone.
- **The Suggested Focus section is the cherry on top.** It shows you've actually synthesized the information rather than just listing it. Think about what's urgent, what's blocking others, and what the user's calendar tells you about their available focus time.

## Error handling

If any of the data sources fail or return no results, don't let it break the whole briefing. Show what you have and note which sources had issues (e.g., "⚠️ Couldn't fetch Confluence updates — you may want to check manually"). The briefing should always produce output, even if partial.
