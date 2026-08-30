const assert = require('node:assert');
const { formatCurrency } = require('../src/format');

assert.strictEqual(formatCurrency(1234.5), '$1,234.50');
assert.strictEqual(formatCurrency(0), '$0.00');
assert.throws(() => formatCurrency(NaN), TypeError);
assert.throws(() => formatCurrency(Infinity), TypeError);
console.log('format.test.js ok');
