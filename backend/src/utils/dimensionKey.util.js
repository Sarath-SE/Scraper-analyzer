function normalizeDynamicDimensionKey(key) {
  if (!key) return null;

  return key
    .toString()
    .trim()
    .toLowerCase()
    .replace(/"/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

module.exports = {
  normalizeDynamicDimensionKey,
};
