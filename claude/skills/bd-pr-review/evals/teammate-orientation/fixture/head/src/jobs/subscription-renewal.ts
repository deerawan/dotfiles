import { carts, payments } from '../deps';
import { priceCart } from '../pricing/price-cart';
export async function renew(sub) {
  const cart = await carts.fromSubscription(sub);
  const { total } = await priceCart(cart, { coupon: sub.coupon });
  await payments.charge(sub.customer, total);
}
