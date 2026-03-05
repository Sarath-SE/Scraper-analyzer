module.exports.buildPivotResult = (rows, rowDims, colDim, measures) => {
  const columnSet = new Set();
  const resultMap = new Map();
  const columnTotals = {};

  for (const r of rows) {
    const colValue = r[colDim] instanceof Date
      ? r[colDim].toISOString()
      : r[colDim];

    columnSet.add(colValue);

    const rowKey = rowDims.map(d => r[d]).join('||');

    // init row
    if (!resultMap.has(rowKey)) {
      const baseRow = {};
      rowDims.forEach(d => (baseRow[d] = r[d]));

      resultMap.set(rowKey, {
        ...baseRow,
        values: {},
        totals: Object.fromEntries(measures.map(m => [m, 0]))
      });
    }

    const rowObj = resultMap.get(rowKey);

    // init column cell
    if (!rowObj.values[colValue]) {
      rowObj.values[colValue] = Object.fromEntries(
        measures.map(m => [m, 0])
      );
    }

    // init column totals
    if (!columnTotals[colValue]) {
      columnTotals[colValue] = Object.fromEntries(
        measures.map(m => [m, 0])
      );
    }

    // accumulate
    for (const m of measures) {
      const val = Number(r[m] ?? 0);

      rowObj.values[colValue][m] += val;
      rowObj.totals[m] += val;
      columnTotals[colValue][m] += val;
    }
  }

  return {
    columns: Array.from(columnSet).sort(),
    columnTotals,
    rows: Array.from(resultMap.values())
  };
};
