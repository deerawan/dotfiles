# Proposed refactor: checkout discount logic (shop-api)

## Today

src/routes/checkout.ts
```ts
router.post('/checkout', async (req, res) => {
  const cart = await carts.load(req.body.cartId);
  let total = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
  if (req.body.coupon) {
    const c = await coupons.find(req.body.coupon);
    if (c && c.expiresAt > new Date()) total -= c.percent ? total * c.percent / 100 : c.amount;
  }
  if (cart.customer.tier === 'gold') total *= 0.95;
  total = Math.max(total, 0);
  const order = await orders.create(cart, total);
  await payments.charge(cart.customer, total);
  res.json(order);
});
```

src/routes/quote.ts
```ts
router.get('/quote/:cartId', async (req, res) => {
  const cart = await carts.load(req.params.cartId);
  let total = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
  if (cart.customer.tier === 'gold') total *= 0.95;
  res.json({ total });
});
```

src/jobs/subscription-renewal.ts
```ts
export async function renew(sub) {
  const cart = await carts.fromSubscription(sub);
  let total = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
  if (sub.coupon) {
    const c = await coupons.find(sub.coupon);
    if (c) total -= c.percent ? total * c.percent / 100 : c.amount;
  }
  total = Math.max(total, 0);
  await payments.charge(sub.customer, total);
}
```

## Known problems
- quote.ts ignores coupons, so the quote shown on the cart page is higher than the checkout charge.
- subscription-renewal.ts skips the coupon expiry check and the gold-tier discount.
- Coupon then tier order differs nowhere today, but nothing enforces it.

## Proposal
Add src/pricing/price-cart.ts exporting `priceCart(cart, { coupon, now })` that does: subtotal -> coupon (with expiry check) -> gold tier 5% -> floor at 0, and returns `{ subtotal, couponDiscount, tierDiscount, total }`. checkout.ts, quote.ts and subscription-renewal.ts all call it. quote.ts starts reading `?coupon=` from the query string. No change to orders, payments, or carts.

Side effects: renewals for gold customers get 5% cheaper; renewals using an expired coupon get charged full price; quotes with a coupon drop to match checkout.
