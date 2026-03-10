const { FACT_DIMENSIONS } = require('../constants/pivotDimensions');

const MEASURE_MAP = {
  quantity: 'quantity',
  quantity_sold: 'quantity_sold',
  avg_price: 'avg_price',
  estimated_sales: 'estimated_sales',
};

const ALLOWED_TIME_COLUMNS = new Set(['snapshot_time', 'snapshot_date']);

function isValidDimensionKey(value) {
  return typeof value === 'string' && /^[a-z0-9_]+$/.test(value);
}

function getDimensionExpression(rowDim) {
  if (FACT_DIMENSIONS[rowDim]) {
    return `${FACT_DIMENSIONS[rowDim]} AS ${rowDim}`;
  }

  return `dim_values.dimensions ->> '${rowDim}' AS ${rowDim}`;
}

function isValidDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidMonthString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}

exports.buildPivotQuery = ({
  rows = [],
  columns = [],
  measures = [],
  filters = {},
}) => {
  if (!rows.length) throw new Error('At least one row dimension is required');
  if (!columns.length) throw new Error('At least one column is required');
  if (!measures.length) throw new Error('At least one measure is required');

  const timeCol = columns[0];

  if (!ALLOWED_TIME_COLUMNS.has(timeCol)) {
    throw new Error(`Unsupported column dimension: ${timeCol}`);
  }

  rows.forEach((rowDim) => {
    if (!isValidDimensionKey(rowDim)) {
      throw new Error(`Unknown dimension: ${rowDim}`);
    }
  });

  measures.forEach((measure) => {
    if (!MEASURE_MAP[measure]) {
      throw new Error(`Unknown measure: ${measure}`);
    }
  });

  if (!filters.sitemap_id) {
    throw new Error('sitemap_id filter is required');
  }

  if (filters.start_date && !isValidDateString(filters.start_date)) {
    throw new Error('Invalid start_date format. Expected YYYY-MM-DD');
  }

  if (filters.end_date && !isValidDateString(filters.end_date)) {
    throw new Error('Invalid end_date format. Expected YYYY-MM-DD');
  }

  if (filters.month && !isValidMonthString(filters.month)) {
    throw new Error('Invalid month format. Expected YYYY-MM');
  }

  const rowSelect = rows
    .map((rowDim) => getDimensionExpression(rowDim))
    .join(',\n    ');

  const rowGroupBy = rows.join(', ');

  const measureSelect = measures
    .map((measure) => `${MEASURE_MAP[measure]} AS ${measure}`)
    .join(',\n    ');

  const fullHistoryWhereClause = `WHERE sf.sitemap_id = ${Number(filters.sitemap_id)}`;

  const outputFilters = [];

  if (filters.start_date) {
    outputFilters.push(`snapshot_date_filter >= '${filters.start_date}'::date`);
  }

  if (filters.end_date) {
    outputFilters.push(`snapshot_date_filter <= '${filters.end_date}'::date`);
  }

  if (filters.month) {
    outputFilters.push(
      `DATE_TRUNC('month', snapshot_date_filter) = DATE_TRUNC('month', '${filters.month}-01'::date)`
    );
  }

  const outputWhereClause = outputFilters.length
    ? `WHERE ${outputFilters.join(' AND ')}`
    : '';

  return `
WITH dim_values AS (
  SELECT
    snapshot_id,
    product_id,
    jsonb_object_agg(dimension, value) AS dimensions
  FROM snapshot_dimensions
  GROUP BY snapshot_id, product_id
),

base_all AS (
  SELECT
    ${rowSelect},
    s.${timeCol} AS ${timeCol},
    s.snapshot_time AS snapshot_time_for_lag,
    s.snapshot_date AS snapshot_date_filter,
    sf.product_id,
    sf.quantity,
    sf.price
  FROM snapshot_facts sf
  JOIN snapshots s
    ON s.id = sf.snapshot_id
  LEFT JOIN dim_values
    ON dim_values.snapshot_id = sf.snapshot_id
   AND dim_values.product_id = sf.product_id
  ${fullHistoryWhereClause}
),

grouped_period AS (
  SELECT
    ${rowGroupBy},
    ${timeCol},
    snapshot_time_for_lag,
    snapshot_date_filter,
    SUM(quantity) AS quantity,
    AVG(price) AS avg_price
  FROM base_all
  GROUP BY
    ${rowGroupBy},
    ${timeCol},
    snapshot_time_for_lag,
    snapshot_date_filter
),

base_with_metrics AS (
  SELECT
    *,
    GREATEST(
      COALESCE(
        (LAG(quantity) OVER (
          PARTITION BY ${rowGroupBy}
          ORDER BY snapshot_time_for_lag
        ) - quantity),
        0
      ),
      0
    ) AS quantity_sold,
    GREATEST(
      COALESCE(
        (LAG(quantity) OVER (
          PARTITION BY ${rowGroupBy}
          ORDER BY snapshot_time_for_lag
        ) - quantity),
        0
      ),
      0
    ) * avg_price AS estimated_sales
  FROM grouped_period
),

filtered AS (
  SELECT *
  FROM base_with_metrics
  ${outputWhereClause}
)

SELECT
  ${rowGroupBy},
  ${timeCol},
  ${measureSelect}
FROM filtered
ORDER BY
  ${rowGroupBy},
  ${timeCol};
`;
};
