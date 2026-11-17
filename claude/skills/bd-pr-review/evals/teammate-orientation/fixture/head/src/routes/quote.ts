import { carts } from '../deps';
import { priceCart } from '../pricing/price-cart';
export async function quote(req, res) {
  const cart = await carts.load(req.params.cartId);
  res.json(await priceCart(cart, { coupon: req.query.coupon }));
}
