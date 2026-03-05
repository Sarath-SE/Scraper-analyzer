const crypto = require('crypto');

/**
 * Normalize dimension keys
 * Example:
 *  "Connector Type" → "connector_type"
 *  "Product Status" → "product_status"
 *  "Pitch" → "pitch"
 */
function normalizeDimensionKey(key) {
  if (!key) return null;

  return key
    .toString()
    .trim()
    .toLowerCase()
    .replace(/"/g, '')          // remove quotes
    .replace(/\s+/g, '_')       // spaces → _
    .replace(/[^a-z0-9_]/g, ''); // remove symbols
}

/**
 * Remove currency symbols, commas, text etc.
 * Keeps only digits and dot.
 */
function cleanNumber(value) {
  if (value === undefined || value === null) return null;

  const cleaned = value
    .toString()
    .replace(/[^0-9.]/g, '');

  if (!cleaned) return null;
  return cleaned;
}

function parseIntSafe(value) {
  const cleaned = cleanNumber(value);
  return cleaned ? parseInt(cleaned, 10) : null;
}

function parseFloatSafe(value) {
  const cleaned = cleanNumber(value);
  return cleaned ? parseFloat(cleaned) : null;
}

/**
 * Stable product identity hash
 * ⚠️ MUST NOT include volatile fields (price, quantity)
 */
function hashRow(row) {
  const identity = {
    manufacturer: row.manufacturer ?? '',
    series: row.series ?? '',
    part_number: row['part-number'] ?? '',
    product_type: row['Connector Type'] ?? '',
    pitch: row.Pitch ?? '',
    rows: row.Rows ?? '',
    positions: row.Positions ?? ''
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(identity))
    .digest('hex');
}

/**
 * Normalize raw scraper row → snapshot_facts
 */
function normalizeRow(row) {
  return {
    manufacturer: row.manufacturer ?? null,
    series: row.series ?? null,
    product_type: row['Connector Type'] ?? null,
    pitch: row.Pitch ?? null,
    rows: row.Rows ?? null,
    positions: row.Positions ?? null,

    quantity: parseIntSafe(row['quantity-available']),
    price: parseFloatSafe(row.price),

    part_number: row['part-number'] ?? null
  };
}

module.exports = {
  normalizeRow,
  hashRow,
  normalizeDimensionKey // ✅ THIS WAS MISSING
};
