# Requirements: Bulk invoice actions (Finance squad)

## Mark as paid in bulk

- Finance users can select up to 100 invoices at once and mark them paid.
- Already-paid and void invoices can't be selected.
- Each invoice gets a payment date. Default is today; the user can change it in the
  confirm dialog before confirming.
- If some invoices fail (for example, one was voided by someone else meanwhile), the
  successful ones stay paid and the user is told which invoice numbers failed.
- Audit log records who marked each invoice paid.
