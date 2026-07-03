---
name: find-context
description: >
  Search Slack, Confluence, and GitHub PRs in parallel to gather context or
  rationale behind architecture and product decisions. Use when the user asks
  "why was X built this way", "find context on Y", "what did the team decide
  about Z", "history of W", or any cross-tool background lookup. Triggers on:
  "find context", "search context", "why did we", "rationale for", "history
  of", "/find-context".
---

# Find Context

Search Slack, Confluence, and GitHub PRs in parallel to gather background context — typical use case is understanding the rationale behind an architecture or product decision before making a code change.

## Inputs

- **query** (required) — natural-language description of what you're looking for. Example: `"why did we move background jobs to a message queue"`.
- **`since:<YYYY-MM-DD>`** (optional) — limit results to messages/pages/PRs newer than this date.
- **`--source <list>`** (optional) — comma-separated subset of `slack,confluence,github` to restrict which lanes run. Defaults to all three.
- **`--repo <owner/name>`** (optional) — override the GitHub repo. Defaults to the current repository (resolved via `gh repo view --json nameWithOwner -q .nameWithOwner`, falling back to the `origin` remote).

## Workflow

### 1. Parse the query

Extract:
- The core search terms (strip filler words like "why did we", "what's the history of").
- Any explicit issue/ticket IDs (the `[A-Z]+-\d+` pattern, e.g. `PROJ-1234`, `ABC-56`) — keep these verbatim, they're high-signal.
- Any modifiers (`since:`, `--source`, `--repo`).

### 2. Spawn 3 Explore subagents in parallel

**Single message, multiple `Agent` tool calls** with `subagent_type: Explore`. Each agent gets the query plus tool-specific guidance below. Skip a lane only if the user passed `--source` and excluded it.

#### Slack agent prompt

> Search Slack for context on: `<query>`. Use `mcp__claude_ai_Slack__slack_search_public_and_private` (ask for user consent if prompted; otherwise fall back to `slack_search_public`). Slack is keyword-only — no boolean operators. Apply `after:<date>` if the user supplied `since:`.
>
> Run **three search passes**, then merge by relevance:
>
> **Pass A — public & private channels** (default `channel_types`).
> Run 3–5 narrow keyword searches built from the parsed query. For top hits, call `slack_read_thread` for surrounding context.
>
> **Pass B — user's DMs and group DMs** (auto-enumerate; the user is a member of these by definition).
> Re-run the same keyword searches with `channel_types="im,mpim"`. This surfaces DMs/group DMs the user is in that mention the topic — no need to know channel IDs in advance. Treat hits exactly like Pass A hits, but tag the channel as `(DM)` or `(group DM)` in the output. As a fallback, resolve the current user's own Slack handle/ID (via `slack_read_user_profile` on self, or `slack_search_users`) and try `from:<their handle>` combined with the topic keywords to surface threads they personally posted in.
>
> **Pass C — archived & harvested channels** (search misses these entirely; runs LAST so it can use IDs surfaced by Pass A/B and the Confluence/GitHub agents).
> 1. Brainstorm plausible archived channel names from the query (e.g. for "route53" → `#route53-migration`, `#dns-cutover`; for "auth refactor" → `#auth-migration`, `#auth-rewrite`; for a ticket prefix → `#<prefix>-rollout`). Resolve each via `mcp__claude_ai_Slack__slack_search_channels` with `include_archived=true`, then `slack_read_channel` the matches.
> 2. **Harvest every channel ID** from Slack URLs that appear in Pass A/B hits and (when available) from Confluence pages and PR bodies. URLs follow `/archives/C########/p#########` — the `C########` is the channel ID. `slack_read_channel` each one — search indexing is unreliable even with `channel_types="im,mpim"`, so old group DMs and inactive channels often only surface this way (this is a real gap — inactive group DMs are frequently missed by search and read directly only via `slack_read_channel`).
> 3. Paginate with the returned `cursor` until you've found the relevant discussion or hit the channel start. Tag hits with `(archived)`, `(DM)`, or `(group DM)` based on what `slack_read_channel` returns in the channel header.
>
> **No fabrication — mandatory:** every permalink, channel ID, channel name, author, and timestamp you return MUST come verbatim from a real tool result. If a pass returns 0 hits, write "0 hits" for that pass — never invent results to fill the list. Specific red flags to avoid emitting: placeholder-looking message timestamps like `p1620000000000000` or `p163000…0000`, channel IDs you didn't see in tool output, author names you can't tie to a `slack_read_user_profile` or search-result entry. Channel IDs follow `C\d{8,11}` and message timestamps follow `p\d{16}` (16 digits derived from a real Unix-time-with-microseconds — not zero-padded placeholders).
>
> Return a markdown list of up to 5 results across all passes, each with: permalink (or channel link), channel name with tag (`(archived)`, `(DM)`, `(group DM)` as applicable, otherwise plain), author display name, posted date, and a 1–2 sentence excerpt explaining why this thread is relevant. If 0 hits across all passes, say so explicitly. Note any rate-limit or auth errors.

#### Confluence agent prompt

> Search Confluence for context on: `<query>`. Use `mcp__atlassian__search` (Rovo) for natural-language queries — it's the recommended tool unless the user explicitly asked for CQL. The `cloudId` is auto-derived from the access token, no setup needed.
>
> For up to 5 promising hits, call `mcp__atlassian__getConfluencePage` with `contentFormat: "markdown"` to read the body and extract the rationale. Use `mcp__atlassian__searchConfluenceUsingCql` only if the user asks for CQL or needs structured filters (e.g., `space = X AND lastModified > Y`).
>
> **No fabrication — mandatory:** every page URL, page ID, title, and excerpt you return MUST come verbatim from a tool result. If search returns 0 hits, say so — never invent a page. Confluence URLs end in `/pages/<numeric_id>/<slug>`; suspicious-looking placeholder IDs are a red flag.
>
> Return a markdown list of up to 5 pages, each with: URL, title, space, last-updated date, and a 1–2 sentence excerpt covering the decision/rationale that matches the query. If 0 hits, say so explicitly.

#### GitHub agent prompt

> Search PRs in `<repo>` (default: the current repository — resolve with `gh repo view --json nameWithOwner -q .nameWithOwner`) for context on: `<query>`.
>
> Run: `gh pr list --repo <repo> --search "<query> in:title,body" --state all --limit 30 --json number,title,url,mergedAt,author,body`.
>
> For architecture-decision queries, also try `--search "<query> label:rfc OR label:adr in:title,body"`.
>
> For the top 5 candidates by relevance, fetch review-comment context: `gh api repos/<repo>/pulls/<n>/comments` and `gh pr view <n> --json title,body,url,mergedAt,author,reviews`.
>
> Apply a `merged:>=<date>` filter if the user supplied `since:`.
>
> **No fabrication — mandatory:** every PR number, URL, author handle, merge date, and excerpt you return MUST come verbatim from a tool result. If a search returns 0 PRs, say so — never invent a PR. PR URLs follow `https://github.com/<owner>/<repo>/pull/<n>` with `<n>` a real integer.
>
> Return a markdown list of up to 5 PRs, each with: URL, title, merge date, author, and a 1–2 sentence excerpt of the description or discussion that matches the query. If 0 hits, say so explicitly. If `gh auth status` fails, return that error so the caller can prompt the user to run `gh auth login`.

### 3. Synthesize

After all agents return, write the response in this shape:

```
<2–4 sentence narrative that ties threads across the sources, highlighting the answer to the user's question. Cite specific findings inline where helpful.>

## Sources

### Slack
- [<channel> · <date>](<permalink>) — <why it's relevant>

### Confluence
- [<page title>](<url>) — <why it's relevant>

### GitHub PRs
- [#<number> <title>](<url>) — <why it's relevant>
```

Omit a `###` section entirely if that source returned 0 hits, but mention "no Slack hits" in the narrative so the user knows it was searched.

**Pre-publish verification (mandatory).** Before sending the synthesis to the user, sanity-check every citation the agents returned:

- **Slack**: each permalink must follow `/archives/C\d{8,11}/p\d{16}`. If any timestamp looks padded (`p1620000000000000`, `p1630000000000000`) or any channel ID is shorter than 9 chars, that entry is hallucinated — drop it.
- **Confluence**: each URL must follow `/wiki/spaces/<space>/pages/<numeric_id>/<slug>`. Drop entries with non-numeric or oddly short page IDs.
- **GitHub**: each PR URL must follow `https://github.com/<owner>/<repo>/pull/<n>` and `<n>` must be plausible (e.g., the repo's known PR range). Drop entries that cite PR numbers no agent surfaced.
- **Authors**: every name should appear in the agent's tool output. Drop entries with authors that look invented.

If verification drops items below useful coverage for a source, re-run that lane (don't backfill with guesses) and flag the partial result in the narrative.

## Search-quality tips

- **Slack**: keyword-only, space-separated terms are AND. No boolean ops. Break complex queries into multiple narrow searches when zero hits. Useful modifiers: `in:#channel`, `from:@user`, `has:link`, `is:thread`. **Search misses**: archived channels are excluded entirely, and DMs/group DMs are unreliably indexed under the default search. Always run all three passes (public/private, DMs/group DMs via `channel_types="im,mpim"`, archived & harvested via `slack_read_channel`).
- **Confluence**: prefer Rovo `search` for natural-language. Reach for `searchConfluenceUsingCql` only when filters matter.
- **GitHub**: `is:merged` filters to landed decisions; `label:rfc` / `label:adr` help when looking for architecture records. Ticket IDs in titles (e.g. `[PROJ-547]`) are high-signal — search those verbatim.
- **Issue IDs across tools**: issue/ticket IDs (the `[A-Z]+-\d+` pattern, e.g. `PROJ-1234`) frequently appear in Slack threads, Confluence pages, and PR titles. If the user's query contains one, prioritize it as a search term in every lane.

## Edge cases

- **Source skipped**: if `--source` excludes a lane, don't spawn that agent and don't list its `###` section.
- **Zero hits**: report briefly in the narrative; don't error out the whole skill.
- **Slack rate-limit**: catch in the agent and return partial results with a note.
- **GitHub auth missing**: surface the `gh auth login` instruction; the other lanes still run.
- **Ambiguous query**: if the parsed query is too vague (e.g., a single common word), ask the user for one disambiguating keyword before fanning out.

## Why subagents

Fanning out via `Explore` agents (rather than running the searches inline) keeps the main context lean — each agent returns a small structured summary instead of dumping raw search payloads back. This matters because Slack/Confluence/GitHub responses can be large, and the synthesis step only needs the distilled findings.
