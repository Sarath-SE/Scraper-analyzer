const db = require('../db');
const { FACT_DIMENSIONS } = require('../constants/pivotDimensions');

function isValidDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidMonthString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}

exports.getPivotDimensions = async ({ sitemap_uid, start_date, end_date, month }) => {
  if (start_date && !isValidDateString(start_date)) {
    throw new Error('Invalid start_date format. Expected YYYY-MM-DD');
  }

  if (end_date && !isValidDateString(end_date)) {
    throw new Error('Invalid end_date format. Expected YYYY-MM-DD');
  }

  if (month && !isValidMonthString(month)) {
    throw new Error('Invalid month format. Expected YYYY-MM');
  }

  const params = [sitemap_uid];
  const dateFilters = [];
  const monthFilters = [];

  if (start_date) {
    params.push(start_date);
    dateFilters.push(`AND s.snapshot_date >= $${params.length}::date`);
  }

  if (end_date) {
    params.push(end_date);
    dateFilters.push(`AND s.snapshot_date <= $${params.length}::date`);
  }

  if (month) {
    params.push(`${month}-01`);
    monthFilters.push(`AND DATE_TRUNC('month', s.snapshot_date) = DATE_TRUNC('month', $${params.length}::date)`);
  }

  const factDimensionChecks = Object.entries(FACT_DIMENSIONS)
    .map(([dimension, column]) => {
      return `
      SELECT '${dimension}' AS dimension
      WHERE EXISTS (
        SELECT 1
        FROM snapshot_facts sf
        JOIN snapshots s ON s.id = sf.snapshot_id
        JOIN sitemaps sm ON sm.id = s.sitemap_id
        WHERE sm.sitemap_uid = $1
        ${dateFilters.join('\n        ')}
        ${monthFilters.join('\n        ')}
          AND ${column} IS NOT NULL
          AND BTRIM(${column}::text) <> ''
      )`;
    })
    .join('\nUNION ALL\n');

  const dynamicDimensionsQuery = `
    SELECT DISTINCT sd.dimension
    FROM snapshot_dimensions sd
    JOIN snapshots s ON s.id = sd.snapshot_id
    JOIN sitemaps sm ON sm.id = s.sitemap_id
    WHERE sm.sitemap_uid = $1
    ${dateFilters.join('\n    ')}
    ${monthFilters.join('\n    ')}
  `;

  const { rows } = await db.query(
    `
    SELECT DISTINCT dimension
    FROM (
      ${factDimensionChecks}
      UNION ALL
      ${dynamicDimensionsQuery}
    ) available_dimensions
    ORDER BY dimension
    `,
    params
  );

  // Always expose snapshot_date and snapshot_time as column dimension options
  const dims = rows.map((row) => row.dimension);
  // Remove snapshot_date/time from regular dimensions — they are handled separately in the frontend
  return dims.filter(d => d !== 'snapshot_date' && d !== 'snapshot_time');
};
