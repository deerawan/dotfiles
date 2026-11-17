import { carts } from '../deps';
export async function quote(req, res) {
  const cart = await carts.load(req.params.cartId);
  let total = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
  if (cart.customer.tier === 'gold') total *= 0.95;
  res.json({ total });
}
