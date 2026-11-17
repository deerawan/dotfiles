PR #48 "Extract priceCart" by alice-dev (teammate). Body: "Consolidate pricing into one function. Fixes quote/checkout mismatch."
Verified survivors from the lanes:
- correctness | ask-user | src/jobs/subscription-renewal.ts:5 | Renewals now drop expired coupons and add gold 5%; customer charges change with no flag or note | score 85
- correctness | auto-fix | src/routes/quote.ts:5 | quote response shape changed from {total} to {subtotal,couponDiscount,tierDiscount,total}; existing callers reading .total still work but contract widened silently | score 65
