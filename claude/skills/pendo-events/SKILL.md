---
name: pendo-events
description: Use when designing, reviewing, or changing Pendo track events or their property payloads — naming an event, choosing properties, sending filter values or multi-select values, worrying about payload size, deciding between a track event and a tagged Feature, or forwarding events from an iframe or embedded app where Pendo can't run. Also use when asked "how do we model clicks in Pendo" or "will this break Pendo's limits".
argument-hint: "[event or page to design]"
---

# Pendo events

Design track-event payloads that Pendo can actually report on. Most limits are about
**reporting**, not ingestion: a payload Pendo accepts can still be ungroupable,
hidden in the UI, or silently wiped. Full sourced limits: `references/pendo-limits.md`.
Project-specific context (subscription IDs, taken names, event set) belongs in project
memory or docs, not here — load it if present.

## 1. Event or Feature?

- Click on an element Pendo's agent can see → tag a **Feature** in the Pendo UI (no code).
- Pendo can't see it (sandboxed iframe, embedded third-party app), or you need context properties →
  **track event**.
- One event per *outcome* (`export_completed`, `filter_changed`). Plain clicks with no extra
  context share one event split by a property (`action_clicked {action}`).

## 2. Property rules

| Rule | Why |
|---|---|
| Names: letters, digits, underscore; < 32 chars; no leading digit; no `__` prefix/suffix | Other formats don't display |
| Name unique across the **whole subscription** | Same name on another event conflates them; list existing track events and their properties first (Pendo MCP `listPagesFeaturesAndEvents type=trackEvent`) |
| Never name a property `error` | Pendo writes `error` when the map is oversized |
| Values that will be grouped/charted: **string or boolean** | Number, time, list can't Group By in Data Explorer or funnels |
| Need a number *and* grouping → send both (`rows: 57`, `results: '10+'`) | Pendo's own pattern (`completion_time` + `completion_speed`) |
| Flat, primitive values only; one type per property forever | No nested objects/arrays; changing type in Pendo **overwrites** collected data |
| < 50k unique values per property; no free text | Not designed for high cardinality; charts show top 10 only |
| No PII / free-text search terms; customer company names need a data-owner yes | Pendo docs are silent; company policy decides |

## 3. Size budget

Keep the whole `properties` JSON **≤ 512 bytes**, including fields the sender adds
(e.g. a postMessage bridge adding `source`/`app`/`env` costs ~60–100 bytes).
Over 512 → Pendo UI shows "event properties JSON too large". Over 25KB → the entire map
is replaced by `error`. Aim for ≤ 20 properties, each string < 500 bytes.

Measure, don't guess:

```bash
node -e 'console.log(Buffer.byteLength(JSON.stringify(<payload>)))'
```

## 4. Multi-select / many filters

One property per filter, never one combined `value`:

```json
{ "filter": "seller,commodity", "seller": "Agricola A|Berry B|Costa C +2", "sellerCount": 5, "commodity": "Avocado" }
```

- Join sorted values with `|`; cap at 3 values then `+N`; truncate each value ~40 chars.
- Send `<filter>Count` alongside a capped list.
- A joined string groups as one combination (`A|B|C +2` is one bucket) — fine for
  single-value filters, approximate for multi-select. Per-value charts need one event per
  value; that's a product call (event volume).
- Free-text search → field name only (`filter: 'container'`), never the text.
- Guard in the sender: if payload > 500 bytes, drop value fields, keep `filter` + counts.

## 5. After first events arrive (Pendo admin)

- Confirm the Track Type appears; add a description.
- Set number properties (`*Count`) to number type **immediately** — later changes wipe data.
- Delete/hide test events. A deleted event's name can never be reused.

## Never

- Ship a payload you haven't byte-measured with sender-added fields included.
- Send arrays, nested objects, or a property named `error`.
- Reuse a property name another event already uses for a different meaning.
- Send free-text input, IDs with unbounded cardinality, or PII as property values.
- Expect a tagged Feature to see clicks inside an iframe where Pendo isn't running.
- Change a property's type in Pendo after real data has landed.
