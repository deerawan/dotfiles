function createWriteback(sheet, delayMs = 5000) {
  return {
    enqueue({ rowId, externalId }) {
      setTimeout(() => sheet.setExternalId(rowId, externalId), delayMs);
    },
  };
}

module.exports = { createWriteback };
