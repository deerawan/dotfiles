import { coupons } from '../deps';
export async function priceCart(cart, { coupon, now = new Date() }: { coupon?: string; now?: Date }) {
  const subtotal = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
  let couponDiscount = 0;
  if (coupon) {
    const c = await coupons.find(coupon);
    if (c && c.expiresAt > now) couponDiscount = c.percent ? subtotal * c.percent / 100 : c.amount;
  }
  const afterCoupon = subtotal - couponDiscount;
  const tierDiscount = cart.customer.tier === 'gold' ? afterCoupon * 0.05 : 0;
  const total = Math.max(afterCoupon - tierDiscount, 0);
  return { subtotal, couponDiscount, tierDiscount, total };
}
