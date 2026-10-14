# Baseline: filter-changed payload (2026-10-14, sonnet, no tools, no skill)

Prompt: design a `filter changed` payload for a shipments page with 8 filters (buyer/seller
multi-select company names, commodity multi-select, variety, status, week, port, free-text
container search); example with 5 buyers; naming rules; Pendo limits; admin steps.

Baseline got right: one event + `filter_name` property; pipe-joined sorted values; never send
free-text search; flag company names as customer data.

Baseline failures (what the skill must fix):
- No size budget: 16 properties, 429 bytes before sender-added fields (~520 with sender-added fields) → over 512.
- Suggested capping lists at "20 values or ~500 chars" — blows the 512-byte budget alone.
- Didn't know Group By is string/boolean only (planned charts on numeric props).
- Didn't know property names must be unique across the subscription (would reuse a name another event already owns).
- Didn't know `error` is reserved / 25KB replaces the map with `error`.
- Believed type locks on first value; actual: changing type in Pendo overwrites collected data.
- Didn't know charts show top 10 values only.

With-skill pass criteria: payload byte-measured incl. sender-added fields and ≤ 512; ≤ ~8 props;
capped multi-select with count; avoids taken names; numeric counts flagged for type-setting;
no `error` property.

## With-skill run (2026-10-14, sonnet)

PASS on all criteria: reused the existing filter event; 199 bytes incl. sender-added fields (worst case 271);
5 props per event; cap-3 + `buyerCount`; flagged names already taken in the subscription → app prefix;
`*Count` → set number type immediately; no `error`; container search name-only; company names
gated on data-owner yes. New insight folded into SKILL.md: joined strings group as combinations.
