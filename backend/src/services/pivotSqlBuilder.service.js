const DIMENSION_MAP = {
  manufacturer: 'sf.manufacturer',
  series: 'sf.series',
  product_type: 'sf.product_type',
  pitch: 'sf.pitch',
  rows: 'sf.rows',
  positions: 'sf.positions',
  connector_type: 'dims.connector_type',
  mounting_type: 'dims.mounting_type',
  product_status: 'dims.product_status',
  termination: 'dims.termination',
  package: 'dims.package',
};

const MEASURE_MAP = {
  quantity: 'quantity',
  quantity_sold: 'quantity_sold',
  avg_price: 'avg_price',
  estimated_sales: 'estimated_sales',
};

const ALLOWED_TIME_COLUMNS = new Set(['snapshot_time', 'snapshot_date']);

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
    if (!DIMENSION_MAP[rowDim]) {
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
    .map((rowDim) => `${DIMENSION_MAP[rowDim]} AS ${rowDim}`)
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
WITH dims AS (
  SELECT
    snapshot_id,
    product_id,
    MAX(value) FILTER (WHERE dimension = 'connector_type') AS connector_type,
    MAX(value) FILTER (WHERE dimension = 'mounting_type') AS mounting_type,
    MAX(value) FILTER (WHERE dimension = 'product_status') AS product_status,
    MAX(value) FILTER (WHERE dimension = 'termination') AS termination,
    MAX(value) FILTER (WHERE dimension = 'package') AS package
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
  LEFT JOIN dims
    ON dims.snapshot_id = sf.snapshot_id
   AND dims.product_id = sf.product_id
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
