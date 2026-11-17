import { carts, coupons, payments } from '../deps';
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
