import { carts, coupons, orders, payments } from '../deps';
export async function checkout(req, res) {
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
}
