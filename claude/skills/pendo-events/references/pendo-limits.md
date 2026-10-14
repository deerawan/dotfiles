# Pendo track-event limits (sourced, checked 2026-10-14)

| Limit | Value | Effect when exceeded | Source |
|---|---|---|---|
| Properties JSON (whole `"properties": {}` incl. braces/quotes) | 512 bytes | UI shows "event properties JSON too large"; unclear if still groupable | Configure Track Events; Click event properties |
| Property map | 25KB default (app `MaxEventPropertyBytes`) | Whole map discarded, replaced by system `error` property | Track Events; Configure Track Events |
| String value | < 500 bytes recommended | Performance | Configure Track Events |
| Properties per event | no hard cap; ~20 risky with large strings, ~50 likely issues | Performance | Configure Track Events |
| Unique values per property | not intended > 50,000 | Performance | Configure Track Events |
| Unique custom property keys per subscription | 1,000 or 10,000 (docs conflict) | — | Event properties; Configure Track Events |
| Named track events per app | 5,000 | — | Track Events |
| Track event description | 280 chars | — | Track Events |
| Data Explorer chart | top 10 property values | Rest hidden in chart | Reporting tech note |
| Data Explorer breakdown table | 10,000 values | Use aggregations API beyond | Reporting tech note |
| Event breakdown table | 5,000 rows (CSV has all) | — | Track Events |
| Group By | ≤ 5 properties; string/boolean only | Number/time/list ungroupable | Reporting tech note; Configure Track Events |
| Rate | ~1 event/visitor/sec (2021 community post, unverified) | — | Track Event API Limits |

Other rules:
- Default type is string. Number → >/< filters. List → contains / not contains, no Group By.
- Changing a property type overwrites previously collected data.
- Property names: letters, digits, underscore; < 32 chars; no leading digit; no `__` prefix/suffix; unique across subscription.
- Renaming an event in Pendo changes only the label — keep sending the original name.
- Deleted event names can't be recreated (Support can re-enable).
- Event properties can't drive guide-eligibility segments or visitor/account reports.
- Events are sent one at a time; no bulk.
- Server-side (REST) events need matching visitor/account IDs + shared secret; client-side get them from the agent.
- Not documented by Pendo: arrays, PII rules, naming conventions, send frequency.

Sources:
- https://support.pendo.io/hc/en-us/articles/360032294291-Configure-Track-Events
- https://support.pendo.io/hc/en-us/articles/360032294151-Track-Events
- https://support.pendo.io/hc/en-us/articles/7710433678619-Event-properties
- https://support.pendo.io/hc/en-us/articles/360042628992-Click-event-properties
- https://support.pendo.io/hc/en-us/articles/10038502353051-Track-Event-data-is-missing-in-the-UI
- https://support.pendo.io/hc/en-us/community/posts/6083933519899-Tech-Note-Track-event-properties-and-reporting-best-practices
- https://support.pendo.io/hc/en-us/community/posts/6083916648091-Tech-Note-Track-Events-Best-Practices
- https://support.pendo.io/hc/en-us/community/posts/4410733003163-Track-Event-API-Limits
