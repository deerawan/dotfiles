# INV-482: Bulk mark invoices as paid

As a finance user, I want to select several unpaid invoices on the Invoices page and
mark them paid in one go, so I stop clicking into each invoice.

Acceptance criteria
- Checkboxes on each unpaid invoice row, plus a "select all on this page" checkbox.
- A "Mark as paid" button appears once at least one invoice is selected.
- Up to 50 invoices per action.
- After it succeeds, the rows show status "Paid" and a toast says how many were updated.
- Viewers (read-only role) don't see the checkboxes.

Design: see CONFLUENCE.md (requirements page). Figma not available for this ticket.
