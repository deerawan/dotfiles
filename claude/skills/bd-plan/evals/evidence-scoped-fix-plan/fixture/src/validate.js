const SINGLE_PER_ORDER = new Set(['FREIGHT', 'PALLET_FEE', 'INSURANCE']);

function validateRows(rows) {
  const seen = new Set();
  for (const row of rows) {
    if (!SINGLE_PER_ORDER.has(row.itemType) || row.externalId) continue;
    if (seen.has(row.itemType)) {
      throw new Error(`Duplicate item type on order: ${row.itemType}`);
    }
    seen.add(row.itemType);
  }
}

module.exports = { validateRows, SINGLE_PER_ORDER };
