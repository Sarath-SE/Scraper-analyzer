import type { PivotRow } from '../types/pivot';


interface ProductDetailModalProps {
  row: PivotRow;
  rowKeys: string[];
  columns: string[];
  measures: string[];
  onClose: () => void;
}

const MEASURE_LABELS: Record<string, string> = {
  quantity: 'Quantity',
  quantity_sold: 'Qty Sold',
  avg_price: 'Avg Price',
  estimated_sales: 'Estimated Sales',
};

const isCurrency = (m: string) => m === 'avg_price' || m === 'estimated_sales';

function fmt(measure: string, value: number) {
  if (isCurrency(measure)) {
    return '$' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toLocaleString();
}

function formatColHeader(col: string) {
  const d = new Date(col);
  if (isNaN(d.getTime())) return col;
  if (/^\d{4}-\d{2}-\d{2}$/.test(col) || (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0)) {
    return d.toLocaleDateString();
  }
  return d.toLocaleString();
}

const MEASURE_ICONS: Record<string, string> = {
  quantity: '📦',
  quantity_sold: '🛒',
  avg_price: '💰',
  estimated_sales: '📈',
};

export default function ProductDetailModal({ row, rowKeys, columns, measures, onClose }: ProductDetailModalProps) {
  // Compute totals
  const getTotalForMeasure = (measure: string): number => {
    const values = columns
      .map(col => Number((row.values?.[col] as any)?.[measure] ?? 0))
      .filter(v => !isNaN(v));
    if (!values.length) return 0;
    if (measure === 'quantity') return values[values.length - 1];
    if (measure === 'avg_price') return values.reduce((s, v) => s + v, 0) / values.length;
    return values.reduce((s, v) => s + v, 0);
  };

  const productLabel = rowKeys.map(k => row[k] ?? '-').join(' · ');

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-blue-50 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Product Detail</p>
            <h2 className="text-base font-bold text-gray-900 leading-tight">
              {row['manufacturer'] ?? row[rowKeys[0]] ?? '-'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {row['product_type'] ?? row['part_number'] ?? (rowKeys[1] ? row[rowKeys[1]] : '') ?? ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary Cards */}
        <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-gray-100">
          {measures.map(m => {
            const total = getTotalForMeasure(m);
            return (
              <div key={m} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="text-lg mb-1">{MEASURE_ICONS[m] ?? '📊'}</div>
                <div className="text-xs text-gray-500 font-medium">{MEASURE_LABELS[m] ?? m}</div>
                <div className="text-sm font-bold text-gray-900 mt-0.5">{fmt(m, total)}</div>
              </div>
            );
          })}
        </div>

        {/* Period Breakdown Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Period Breakdown</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold text-gray-700 rounded-tl-lg">Period</th>
                {measures.map(m => (
                  <th key={m} className="text-right px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">
                    {MEASURE_LABELS[m] ?? m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columns.map((col, i) => {
                const cell = row.values?.[col] as any;
                const hasData = cell && measures.some(m => Number(cell[m] ?? 0) !== 0);
                return (
                  <tr key={col} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${hasData ? '' : 'opacity-40'}`}>
                    <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{formatColHeader(col)}</td>
                    {measures.map(m => {
                      const val = Number(cell?.[m] ?? 0);
                      return (
                        <td key={m} className={`px-3 py-2 text-right font-mono whitespace-nowrap ${val !== 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                          {fmt(m, val)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="bg-blue-50 border-t-2 border-blue-200 font-semibold">
                <td className="px-3 py-2 text-gray-900">Total</td>
                {measures.map(m => (
                  <td key={m} className="px-3 py-2 text-right font-mono text-gray-900 whitespace-nowrap">
                    {fmt(m, getTotalForMeasure(m))}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
