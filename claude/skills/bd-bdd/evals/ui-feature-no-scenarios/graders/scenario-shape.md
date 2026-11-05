---
type: llm
criteria: "Are the scenarios concrete, observable, runner-ready Gherkin in user words?"
focus: output
---

Score each check pass/fail:
(a) Output is a ```gherkin block with one `Feature:` and Given/When/Then steps.
(b) No implementation nouns in steps: no `data-testid`, selectors, component/hook names
    (InvoiceTable, useMarkInvoicesPaid, MarkPaidDialog), mutation/GraphQL names, HTTP
    verbs, or status enums like `UNPAID` written as code.
(c) Givens are concrete: a named role and specific data (e.g. "3 unpaid invoices
    INV-1001..."), and where the user is. Not "some invoices".
(d) Thens are visible to a user: rows show "Paid", toast text, disabled checkbox, error
    message. No Then asserts a database row or the audit log table.
(e) Covers: main path, viewer can't select, paid/void not selectable, over-limit, and
    partial failure.
(f) Lists the sources used (ticket, requirements page, diff) and notes Figma was absent.
(g) Raises the 50 vs 100 limit conflict (ticket + code say 50, requirements say 100) as
    an open question instead of silently picking one.
(h) No scenario for behaviour no source states (e.g. cancelling the confirm dialog);
    each scenario's origin is traceable.

2 points: all pass. 1 point: (a)-(d) pass, one of (e)-(h) fails. 0: any of (a)-(d) fails.

Baseline without the skill (2026-11-06): 1 point. Failed (f) no sources line and (h)
invented a "Cancel the confirm dialog" scenario; 13 scenarios; one Then on a stored
payment date.

With the skill (2026-11-06): 2 points, 2/2 runs (7 and 6 scenarios, all traced, no cancel scenario).
