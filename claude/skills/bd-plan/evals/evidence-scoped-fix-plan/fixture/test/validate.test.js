const test = require('node:test');
const assert = require('node:assert');
const { validateRows } = require('../src/validate');

test('rejects two FREIGHT rows without ids', () => {
  assert.throws(() => validateRows([
    { id: 1, itemType: 'FREIGHT' },
    { id: 2, itemType: 'FREIGHT' },
  ]));
});

test('allows FREIGHT row that already has an id', () => {
  validateRows([
    { id: 1, itemType: 'FREIGHT', externalId: 'x' },
    { id: 2, itemType: 'FREIGHT' },
  ]);
});
