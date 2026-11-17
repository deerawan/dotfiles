import { priceCart } from '../src/pricing/price-cart';
jest.mock('../src/deps', () => ({ coupons: { find: jest.fn() } }));
const { coupons } = jest.requireMock('../src/deps');
const cart = (tier) => ({ customer: { tier }, items: [{ price: 50, qty: 2 }] });
test('applies coupon then gold', async () => {
  coupons.find.mockResolvedValue({ percent: 10, expiresAt: new Date('2099-01-01') });
  expect((await priceCart(cart('gold'), { coupon: 'X' })).total).toBe(85.5);
});
test('ignores expired coupon', async () => {
  coupons.find.mockResolvedValue({ percent: 10, expiresAt: new Date('2000-01-01') });
  expect((await priceCart(cart('basic'), { coupon: 'X' })).total).toBe(100);
});
