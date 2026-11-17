import { carts, orders, payments } from '../deps';
import { priceCart } from '../pricing/price-cart';
export async function checkout(req, res) {
  const cart = await carts.load(req.body.cartId);
  const { total } = await priceCart(cart, { coupon: req.body.coupon });
  const order = await orders.create(cart, total);
  await payments.charge(cart.customer, total);
  res.json(order);
}
