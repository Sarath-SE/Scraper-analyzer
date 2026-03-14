import { useState } from 'react';
import type { PivotResponse, PivotRow } from '../types/pivot';
import { formatFieldLabel } from '../utils/fieldLabel';
import ProductDetailModal from './ProductDetailModal';

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<PivotRow | null>(null);

  const formatColumnHeader = (col: string) => {
    const d = new Date(col);
    if (isNaN(d.getTime())) return col;
    // Plain date string OR midnight UTC (snapshot_date) → date only
    if (/^\d{4}-\d{2}-\d{2}$/.test(col) || d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
      return d.toLocaleDateString();
    }
    return d.toLocaleString();
  };

  const formatMeasureLabel = (measure: string) => {
    if (measure === 'qty_sold' || measure === 'quantity_sold') return 'Qty Sold';
    if (measure === 'avg_price') return 'Avg Price';
    if (measure === 'estimated_sales') return 'Estimated Sales';
    if (measure === 'quantity') return 'Quantity';
    return formatFieldLabel(measure);
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
      // Quantity = last known snapshot value (current inventory)
      return values[values.length - 1];
    }

    if (isAverageMeasure(measure)) {
      // Domo uses simple average of avg_price across all periods (including zero-sale periods)
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    }

    return values.reduce((sum, v) => sum + v, 0);
  };

  const getGrandTotalLikeExcel = (measure: string) => {
    if (!data.rows.length) return 0;

    if (isAverageMeasure(measure)) {
      // Simple average of each row's avg_price total
      const rowTotals = data.rows.map((row) => getRowTotalLikeExcel(row, measure));
      return rowTotals.reduce((sum, v) => sum + v, 0) / rowTotals.length;
    }

    return data.rows
      .map((row) => getRowTotalLikeExcel(row, measure))
      .reduce((sum, v) => sum + v, 0);
  };

  // Per-period column total for avg_price: simple average across all rows for that period
  const getColumnTotal = (col: string, measure: string): number => {
    if (isAverageMeasure(measure)) {
      const prices = data.rows
        .map((row) => (row.values?.[col] as any)?.[measure])
        .filter((v) => v !== undefined && v !== null)
        .map(Number);
      return prices.length ? prices.reduce((sum, v) => sum + v, 0) / prices.length : 0;
    }
    return (data.columnTotals?.[col] as any)?.[measure] ?? 0;
  };

  const handleExport = () => {
    const csvRows: string[] = [];

    const header1: string[] = rowKeys.map(formatFieldLabel);
    data.columns.forEach(col => {
      const timestamp = formatColumnHeader(col);
      measures.forEach(() => {
        header1.push(timestamp);
      });
    });
    measures.forEach((m) => {
      header1.push(`. ${formatFieldLabel(m).toUpperCase()}`);
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
        const value = getColumnTotal(col, m);
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
    <>
      {selectedRow && (
        <ProductDetailModal
          row={selectedRow}
          rowKeys={rowKeys}
          columns={data.columns}
          measures={measures}
          onClose={() => setSelectedRow(null)}
        />
      )}

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full h-full max-w-[98vw] max-h-[98vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
            {/* Fullscreen Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Pivot Results - Fullscreen</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  {data.rows.length} rows × {data.columns.length} columns
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExport}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2"
                  title="Export pivot table to CSV file"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden sm:inline">Export CSV</span>
                  <span className="sm:hidden">Export</span>
                </button>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Exit fullscreen"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Fullscreen Table */}
            <div className="flex-1 overflow-auto pivot-table-container">
              <table className="pivot-table border-collapse text-xs sm:text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  {/* Column Headers Row 1 */}
                  <tr className="bg-gray-100 border-b border-gray-300">
                    {rowKeys.map((k, idx) => (
                      <th
                        key={k}
                        rowSpan={2}
                        className={`px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-gray-100 ${
                          idx === 0 || idx === 1 ? 'sticky z-20' : ''
                        }`}
                        style={{ 
                          minWidth: '120px',
                          left: idx === 0 ? '0px' : idx === 1 ? '120px' : undefined
                        }}
                      >
                        <div className="truncate" title={formatFieldLabel(k)}>
                          {formatFieldLabel(k)}
                        </div>
                      </th>
                    ))}

                    {data.columns.map(col => (
                      <th
                        key={col}
                        colSpan={measures.length}
                        className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-gray-700 border-r border-gray-300 bg-blue-50 whitespace-nowrap"
                      >
                        {formatColumnHeader(col)}
                      </th>
                    ))}

                    <th
                      colSpan={measures.length}
                      className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-gray-700 border-r border-gray-300 bg-amber-50 whitespace-nowrap"
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
                          className="px-3 sm:px-4 py-1.5 sm:py-2 text-right text-xs font-medium text-gray-600 border-r border-gray-200 bg-green-50 whitespace-nowrap"
                          style={{ minWidth: '100px' }}
                        >
                          {formatMeasureLabel(m)}
                        </th>
                      ))
                    )}

                    {measures.map(m => (
                      <th
                        key={`totals-${m}`}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 text-right text-xs font-medium text-gray-700 border-r border-gray-200 bg-amber-100 whitespace-nowrap"
                        style={{ minWidth: '100px' }}
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
                      onClick={() => setSelectedRow(row)}
                      className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors border-b border-gray-200 cursor-pointer`}
                    >
                      {rowKeys.map((k, idx) => (
                        <td
                          key={k}
                          className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 font-medium border-r border-gray-200 ${
                            idx === 0 || idx === 1 ? 'sticky z-10 bg-inherit' : ''
                          }`}
                          style={{ 
                            minWidth: '120px',
                            maxWidth: '200px',
                            left: idx === 0 ? '0px' : idx === 1 ? '120px' : undefined
                          }}
                        >
                          <div className="truncate pivot-table-cell" title={String(row[k] ?? '-')}>
                            {row[k] ?? '-'}
                          </div>
                        </td>
                      ))}

                      {data.columns.flatMap(col =>
                        measures.map(m => {
                          const value = (row.values?.[col] as any)?.[m] ?? 0;
                          return (
                            <td
                              key={`${i}-${col}-${m}`}
                              className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right border-r border-gray-200 font-mono whitespace-nowrap ${
                                value > 0 ? 'text-gray-900' : 'text-gray-400'
                              }`}
                              style={{ minWidth: '100px' }}
                            >
                              {formatValue(m, value)}
                            </td>
                          );
                        })
                      )}

                      {measures.map((m) => (
                        <td
                          key={`row-total-${i}-${m}`}
                          className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right border-r border-amber-200 font-mono text-gray-900 bg-amber-50 whitespace-nowrap"
                          style={{ minWidth: '100px' }}
                        >
                          {formatValue(m, getRowTotalLikeExcel(row, m))}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* Total Row */}
                  <tr className="bg-blue-100 border-t-2 border-blue-300 font-semibold">
                    {rowKeys.map((_, idx) => (
                      <td 
                        key={idx} 
                        className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 border-r border-blue-200 bg-blue-100 whitespace-nowrap ${
                          idx === 0 || idx === 1 ? 'sticky z-10' : ''
                        }`}
                        style={{ 
                          minWidth: '120px',
                          left: idx === 0 ? '0px' : idx === 1 ? '120px' : undefined
                        }}
                      >
                        {idx === 0 ? 'Total' : ''}
                      </td>
                    ))}

                    {data.columns.flatMap(col =>
                      measures.map(m => (
                        <td
                          key={`total-${col}-${m}`}
                          className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right border-r border-blue-200 font-mono text-gray-900 whitespace-nowrap"
                          style={{ minWidth: '100px' }}
                        >
                          {formatValue(m, getColumnTotal(col, m))}
                        </td>
                      ))
                    )}

                    {measures.map((m) => {
                      const grandTotal = getGrandTotalLikeExcel(m);
                      return (
                        <td
                          key={`grand-total-${m}`}
                          className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right border-r border-blue-200 font-mono text-gray-900 bg-blue-200 whitespace-nowrap"
                          style={{ minWidth: '100px' }}
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
        </div>
      )}

      {/* Normal View */}
      <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Table Header - Responsive */}
        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-50 flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Pivot Results</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {data.rows.length} rows × {data.columns.length} columns
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
              title="View fullscreen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
            <button 
              data-tour="export-csv"
              onClick={handleExport}
              className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center gap-2"
              title="Export pivot table to CSV file"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>
        </div>

      {/* Table Container with Horizontal Scroll - Responsive */}
      <div className="flex-1 overflow-auto pivot-table-container">
        <table className="pivot-table border-collapse text-xs sm:text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            {/* Column Headers Row 1 */}
            <tr className="bg-gray-100 border-b border-gray-300">
              {rowKeys.map((k, idx) => (
                <th
                  key={k}
                  rowSpan={2}
                  className={`px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-gray-100 ${
                    idx === 0 || idx === 1 ? 'sticky z-20' : ''
                  }`}
                  style={{ 
                    minWidth: '120px',
                    left: idx === 0 ? '0px' : idx === 1 ? '120px' : undefined
                  }}
                >
                  <div className="truncate" title={formatFieldLabel(k)}>
                    {formatFieldLabel(k)}
                  </div>
                </th>
              ))}

              {data.columns.map(col => (
                <th
                  key={col}
                  colSpan={measures.length}
                  className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-gray-700 border-r border-gray-300 bg-blue-50 whitespace-nowrap"
                >
                  {formatColumnHeader(col)}
                </th>
              ))}

              <th
                colSpan={measures.length}
                className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-gray-700 border-r border-gray-300 bg-amber-50 whitespace-nowrap"
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
                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-right text-xs font-medium text-gray-600 border-r border-gray-200 bg-green-50 whitespace-nowrap"
                    style={{ minWidth: '100px' }}
                  >
                    {formatMeasureLabel(m)}
                  </th>
                ))
              )}

              {measures.map(m => (
                <th
                  key={`totals-${m}`}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-right text-xs font-medium text-gray-700 border-r border-gray-200 bg-amber-100 whitespace-nowrap"
                  style={{ minWidth: '100px' }}
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
                onClick={() => setSelectedRow(row)}
                data-tour={i === 0 ? 'pivot-row' : undefined}
                className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors border-b border-gray-200 cursor-pointer`}
              >
                {rowKeys.map((k, idx) => (
                  <td
                    key={k}
                    className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 font-medium border-r border-gray-200 ${
                      idx === 0 || idx === 1 ? 'sticky z-10 bg-inherit' : ''
                    }`}
                    style={{ 
                      minWidth: '120px',
                      maxWidth: '200px',
                      left: idx === 0 ? '0px' : idx === 1 ? '120px' : undefined
                    }}
                  >
                    <div className="truncate pivot-table-cell" title={String(row[k] ?? '-')}>
                      {row[k] ?? '-'}
                    </div>
                  </td>
                ))}

                {data.columns.flatMap(col =>
                  measures.map(m => {
                    const value = (row.values?.[col] as any)?.[m] ?? 0;
                    return (
                      <td
                        key={`${i}-${col}-${m}`}
                        className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right border-r border-gray-200 font-mono whitespace-nowrap ${
                          value > 0 ? 'text-gray-900' : 'text-gray-400'
                        }`}
                        style={{ minWidth: '100px' }}
                      >
                        {formatValue(m, value)}
                      </td>
                    );
                  })
                )}

                {measures.map((m) => (
                  <td
                    key={`row-total-${i}-${m}`}
                    className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right border-r border-amber-200 font-mono text-gray-900 bg-amber-50 whitespace-nowrap"
                    style={{ minWidth: '100px' }}
                  >
                    {formatValue(m, getRowTotalLikeExcel(row, m))}
                  </td>
                ))
                }
              </tr>
            ))}

            {/* Total Row */}
            <tr className="bg-blue-100 border-t-2 border-blue-300 font-semibold">
              {rowKeys.map((_, idx) => (
                <td 
                  key={idx} 
                  className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 border-r border-blue-200 bg-blue-100 whitespace-nowrap ${
                    idx === 0 || idx === 1 ? 'sticky z-10' : ''
                  }`}
                  style={{ 
                    minWidth: '120px',
                    left: idx === 0 ? '0px' : idx === 1 ? '120px' : undefined
                  }}
                >
                  {idx === 0 ? 'Total' : ''}
                </td>
              ))}

              {data.columns.flatMap(col =>
                measures.map(m => (
                  <td
                    key={`total-${col}-${m}`}
                    className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right border-r border-blue-200 font-mono text-gray-900 whitespace-nowrap"
                    style={{ minWidth: '100px' }}
                  >
                    {formatValue(m, getColumnTotal(col, m))}
                  </td>
                ))
              )}

              {measures.map((m) => {
                const grandTotal = getGrandTotalLikeExcel(m);
                return (
                  <td
                    key={`grand-total-${m}`}
                    className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right border-r border-blue-200 font-mono text-gray-900 bg-blue-200 whitespace-nowrap"
                    style={{ minWidth: '100px' }}
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
    </>
  );
}
