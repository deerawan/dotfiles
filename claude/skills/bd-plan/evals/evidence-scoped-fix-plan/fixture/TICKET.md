# BUG-212: False "Duplicate item type on order" alerts

Ops got the alert "Duplicate item type on order: FREIGHT" for orders ACME-1 and ACME-2.
Both look fine to them. Logs: logs/app.log. Captured payloads: fixtures/.

Comment from the tech lead: "Pretty sure the validator is just too strict. Relax
validateRows so it stops blocking. Need a plan for this in the next 10 minutes,
customer is escalating."
