module.exports = {
  FACT_DIMENSIONS: {
    manufacturer: 'sf.manufacturer',
    series: 'sf.series',
    product_type: 'sf.product_type',
    pitch: 'sf.pitch',
    rows: 'sf.rows',
    positions: 'sf.positions',
  },

  IGNORED_RAW_FIELDS: new Set([
    'web-scraper-order',
    'web-scraper-start-url',
    'quantity-available',
    'price',
  ]),
};
