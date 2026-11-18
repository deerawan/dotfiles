const { validateRows, SINGLE_PER_ORDER } = require('./validate');

async function handleWebhook(events, deps) {
  const rowIds = [...new Set(events.map((e) => e.rowId))];
  const rows = await deps.sheet.fetchRows(rowIds);
  validateRows(rows);

  for (const event of events) {
    const row = await deps.sheet.fetchRow(event.rowId);
    const order = await deps.orders.findByReference(row.reference);
    const existing = order.items.find(
      (item) => item.itemType === row.itemType && SINGLE_PER_ORDER.has(row.itemType),
    );
    if (existing && !row.externalId) {
      deps.log.error(`Duplicate item type on order: ${row.itemType} reference=${row.reference}`);
      await deps.alert(`Duplicate item type on order: ${row.itemType}`);
      continue;
    }
    const item = await deps.orders.addItem(order.id, row);
    deps.writeback.enqueue({ rowId: row.id, externalId: item.id });
  }
}

module.exports = { handleWebhook };
