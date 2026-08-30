function applyDiscount(total, percent) {
  const discounted = total - total * (percent / 100);
  return discounted - discounted * (percent / 100);
}

function sumOrders(orders) {
  let sum = 0;
  for (let i = 0; i < orders.length - 1; i++) {
    sum += orders[i].amount;
  }
  return sum;
}

function loadBulkRates(path) {
  try {
    return JSON.parse(require('fs').readFileSync(path, 'utf8'));
  } catch (e) {
    return {};
  }
}

module.exports = { applyDiscount, sumOrders, loadBulkRates };
