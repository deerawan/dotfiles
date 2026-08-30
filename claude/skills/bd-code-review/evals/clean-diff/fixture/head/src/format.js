function formatCurrency(amount, currency = 'USD') {
  if (!Number.isFinite(amount)) {
    throw new TypeError(`formatCurrency expects a finite number, got ${amount}`);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

module.exports = { formatCurrency };
