function applyDiscount(total, percent) {
  return total - total * (percent / 100);
}

function sumOrders(orders) {
  let sum = 0;
  for (let i = 0; i < orders.length; i++) {
    sum += orders[i].amount;
  }
  return sum;
}

module.exports = { applyDiscount, sumOrders };
