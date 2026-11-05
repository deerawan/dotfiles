# Plan: INV-482 Bulk mark invoices as paid

Depth: Standard

## Behaviour scenarios

S1 (T1) — Finance user marks several invoices paid
  Given I am a finance user on the Invoices page with unpaid invoices INV-1001, INV-1002 and INV-1003
  When I select all three and confirm "Mark as paid" with today's date
  Then the three rows show status "Paid" and I see "3 invoices marked as paid"
  Demonstrable after: Task 3

S2 (T2) — Viewers can't bulk-select
  Given I am a viewer on the Invoices page
  When the page loads
  Then I see no selection checkboxes and no "Mark as paid" button
  Demonstrable after: Task 3

S3 (T3) — Partial failure names the failed invoices
  Given I am a finance user with INV-1001 and INV-1002 selected, and INV-1002 was voided by someone else
  When I confirm "Mark as paid"
  Then INV-1001 shows "Paid" and I see "Couldn't mark INV-1002 as paid"
  Demonstrable after: Task 4

## Tasks
Task 1: mutation ... Task 2: hook ... Task 3: table selection UI ... Task 4: error toasts
