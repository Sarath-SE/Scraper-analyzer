const db = require('../db');

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

  const { rows } = await db.query(
    `
    SELECT DISTINCT sd.dimension
    FROM snapshot_dimensions sd
    JOIN snapshots s ON s.id = sd.snapshot_id
    JOIN sitemaps sm ON sm.id = s.sitemap_id
    WHERE sm.sitemap_uid = $1
    ${dateFilters.join('\n    ')}
    ${monthFilters.join('\n    ')}
    ORDER BY sd.dimension
    `,
    params
  );

  return rows.map(r => r.dimension);
};
