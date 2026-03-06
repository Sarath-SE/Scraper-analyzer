import type { PivotResponse } from '../types/pivot';

interface PivotTableProps {
  data: PivotResponse;
  rowKeys: string[];
  measures: string[];
}

export default function PivotTable({
  data,
  rowKeys,
  measures,
}: PivotTableProps) {
  const formatMeasureLabel = (measure: string) => {
    if (measure === 'qty_sold' || measure === 'quantity_sold') return 'Qty Sold';
    if (measure === 'avg_price') return 'Avg Price';
    if (measure === 'estimated_sales') return 'Estimated Sales';
    if (measure === 'quantity') return 'Quantity';
    return measure.replace('_', ' ');
  };

  const formatValue = (measure: string, value: number) => {
    if (measure.includes('price') || measure.includes('sales')) {
      return '$' + value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return value.toLocaleString();
  };

  const formatValueForExport = (measure: string, value: number) => {
    if (measure.includes('price') || measure.includes('sales')) {
      return value.toFixed(2);
    }
    return value.toString();
  };

  const measureKey = (measure: string) => measure.toLowerCase();

  const isAverageMeasure = (measure: string) =>
    measureKey(measure) === 'avg_price';

  const isQuantityMeasure = (measure: string) =>
    measureKey(measure) === 'quantity';

  const getRowPeriodValues = (row: any, measure: string) => {
    return data.columns
      .map((col) => (row.values?.[col] as any)?.[measure])
      .filter((value) => value !== undefined && value !== null)
      .map((value) => Number(value));
  };

  const getRowTotalLikeExcel = (row: any, measure: string) => {
    const values = getRowPeriodValues(row, measure);
    if (!values.length) return 0;

    if (isQuantityMeasure(measure)) {
      // Quantity should reflect actual available inventory, not summed history.
      return values[values.length - 1];
    }

    if (isAverageMeasure(measure)) {
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    }

    return values.reduce((sum, v) => sum + v, 0);
  };

  const getGrandTotalLikeExcel = (measure: string) => {
    const rowTotals = data.rows.map((row) => getRowTotalLikeExcel(row, measure));
    if (!rowTotals.length) return 0;

    if (isAverageMeasure(measure)) {
      return rowTotals.reduce((sum, v) => sum + v, 0) / rowTotals.length;
    }

    return rowTotals.reduce((sum, v) => sum + v, 0);
  };

  const handleExport = () => {
    const csvRows: string[] = [];

    const header1: string[] = [...rowKeys];
    data.columns.forEach(col => {
      const timestamp = new Date(col).toLocaleString();
      measures.forEach(() => {
        header1.push(timestamp);
      });
    });
    measures.forEach((m) => {
      header1.push(`. ${m.toUpperCase().replace('_', ' ')}`);
    });
    csvRows.push(header1.map(h => `"${h}"`).join(','));

    const header2: string[] = rowKeys.map(() => '');
    data.columns.forEach(() => {
      measures.forEach(m => {
        header2.push(formatMeasureLabel(m));
      });
    });
    measures.forEach(() => {
      header2.push('');
    });
    csvRows.push(header2.map(h => `"${h}"`).join(','));

    data.rows.forEach(row => {
      const rowData: string[] = [];
      rowKeys.forEach(k => {
        rowData.push(`"${row[k] ?? '-'}"`);
      });
      data.columns.forEach(col => {
        measures.forEach(m => {
          const value = (row.values?.[col] as any)?.[m] ?? 0;
          rowData.push(formatValueForExport(m, value));
        });
      });
      measures.forEach((m) => {
        const totalValue = getRowTotalLikeExcel(row, m);
        rowData.push(formatValueForExport(m, totalValue));
      });
      csvRows.push(rowData.join(','));
    });

    const totalRow: string[] = [];
    rowKeys.forEach((_, i) => {
      totalRow.push(i === 0 ? '"Total"' : '""');
    });
    data.columns.forEach(col => {
      measures.forEach(m => {
        const value = (data.columnTotals?.[col] as any)?.[m] ?? 0;
        totalRow.push(formatValueForExport(m, value));
      });
    });
    measures.forEach((m) => {
      const grandTotal = getGrandTotalLikeExcel(m);
      totalRow.push(formatValueForExport(m, grandTotal));
    });
    csvRows.push(totalRow.join(','));

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `pivot_table_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (
    !data ||
    !data.rows?.length ||
    !data.columns?.length ||
    !measures.length
  ) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="text-center p-12">
          <div className="text-6xl mb-4">📊</div>
          <div className="text-gray-900 text-lg font-semibold mb-2">No Data to Display</div>
          <div className="text-gray-500 text-sm">
            Configure dimensions and measures to generate your pivot table
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Table Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Pivot Results</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {data.rows.length} rows × {data.columns.length} columns
          </p>
        </div>
        <button 
          data-tour="export-csv"
          onClick={handleExport}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2"
          title="Export pivot table to CSV file"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Table Container with Horizontal Scroll */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            {/* Column Headers Row 1 */}
            <tr className="bg-gray-100 border-b border-gray-300">
              {rowKeys.map((k, idx) => (
                <th
                  key={k}
                  rowSpan={2}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-gray-100 sticky left-0 z-20"
                  style={{ left: `${idx * 150}px` }}
                >
                  {k}
                </th>
              ))}

              {data.columns.map(col => (
                <th
                  key={col}
                  colSpan={measures.length}
                  className="px-4 py-3 text-center text-xs font-semibold text-gray-700 border-r border-gray-300 bg-blue-50"
                >
                  {new Date(col).toLocaleString()}
                </th>
              ))}

              <th
                colSpan={measures.length}
                className="px-4 py-3 text-center text-xs font-semibold text-gray-700 border-r border-gray-300 bg-amber-50"
              >
                Totals
              </th>
            </tr>

            {/* Column Headers Row 2 - Measures */}
            <tr className="bg-gray-50 border-b border-gray-300">
              {data.columns.flatMap(col =>
                measures.map(m => (
                  <th
                    key={`${col}-${m}`}
                    className="px-4 py-2 text-right text-xs font-medium text-gray-600 border-r border-gray-200 bg-green-50"
                  >
                    {formatMeasureLabel(m)}
                  </th>
                ))
              )}

              {measures.map(m => (
                <th
                  key={`totals-${m}`}
                  className="px-4 py-2 text-right text-xs font-medium text-gray-700 border-r border-gray-200 bg-amber-100"
                >
                  {`${formatMeasureLabel(m).toUpperCase()}`}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.rows.map((row, i) => (
              <tr 
                key={i} 
                className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors border-b border-gray-200`}
              >
                {rowKeys.map((k, idx) => (
                  <td
                    key={k}
                    className="px-4 py-3 text-sm text-gray-900 font-medium border-r border-gray-200 bg-inherit sticky left-0 z-10"
                    style={{ 
                      left: `${idx * 150}px`,
                      minWidth: '150px',
                      maxWidth: '150px'
                    }}
                  >
                    {row[k] ?? '-'}
                  </td>
                ))}

                {data.columns.flatMap(col =>
                  measures.map(m => {
                    const value = (row.values?.[col] as any)?.[m] ?? 0;
                    return (
                      <td
                        key={`${i}-${col}-${m}`}
                        className={`px-4 py-3 text-sm text-right border-r border-gray-200 font-mono ${
                          value > 0 ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        {formatValue(m, value)}
                      </td>
                    );
                  })
                )}

                {measures.map((m) => (
                  <td
                    key={`row-total-${i}-${m}`}
                    className="px-4 py-3 text-sm text-right border-r border-amber-200 font-mono text-gray-900 bg-amber-50"
                  >
                    {formatValue(m, getRowTotalLikeExcel(row, m))}
                  </td>
                ))
                }
              </tr>
            ))}

            {/* Total Row */}
            <tr className="bg-blue-100 border-t-2 border-blue-300 font-semibold sticky bottom-0">
              {rowKeys.map((_, idx) => (
                <td 
                  key={idx} 
                  className="px-4 py-3 text-sm text-gray-900 border-r border-blue-200 bg-blue-100 sticky left-0 z-10"
                  style={{ left: `${idx * 150}px` }}
                >
                  {idx === 0 ? 'Total' : ''}
                </td>
              ))}

              {data.columns.flatMap(col =>
                measures.map(m => (
                  <td
                    key={`total-${col}-${m}`}
                    className="px-4 py-3 text-sm text-right border-r border-blue-200 font-mono text-gray-900"
                  >
                    {formatValue(m, (data.columnTotals?.[col] as any)?.[m] ?? 0)}
                  </td>
                ))
              )}

              {measures.map((m) => {
                const grandTotal = getGrandTotalLikeExcel(m);
                return (
                  <td
                    key={`grand-total-${m}`}
                    className="px-4 py-3 text-sm text-right border-r border-blue-200 font-mono text-gray-900 bg-blue-200"
                  >
                    {formatValue(m, grandTotal)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
