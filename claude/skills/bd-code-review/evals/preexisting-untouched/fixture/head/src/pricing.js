function applyDiscount(total, percent) {
  const discounted = total - total * (percent / 100);
  return discounted - discounted * (percent / 100);
}

module.exports = { applyDiscount };
