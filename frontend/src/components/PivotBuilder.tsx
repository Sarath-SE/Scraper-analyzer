import React from 'react';

interface PivotBuilderValue {
  rows: string[];
  columns: string[];
  measures: string[];
}

interface PivotBuilderProps {
  allDimensions: string[];
  allMeasures: string[];
  value: PivotBuilderValue;
  onChange: (v: PivotBuilderValue) => void;
}

export default function PivotBuilder({
  allDimensions,
  allMeasures,
  value,
}: PivotBuilderProps) {
  const handleDragStartWithData = (e: React.DragEvent, item: string) => {
    e.dataTransfer.setData('text/plain', item);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const availableDimensions = allDimensions.filter(
    d => !value.rows.includes(d) && !value.columns.includes(d)
  );

  const availableMeasures = allMeasures.filter(
    m => !value.measures.includes(m)
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header - Responsive */}
      <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900">Available Fields</h3>
        <p className="text-xs text-gray-500 mt-1">Drag fields to drop zones</p>
      </div>

      {/* Fields List - Responsive */}
      <div className="flex-1 p-3 sm:p-4 space-y-4 sm:space-y-6 overflow-y-auto">
        {/* Dimensions - Responsive */}
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Dimensions</h4>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{availableDimensions.length}</span>
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            {availableDimensions.map(d => (
              <div
                key={d}
                draggable
                onDragStart={(e) => handleDragStartWithData(e, d)}
                className="px-2.5 py-2 sm:px-3 sm:py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs sm:text-sm cursor-move hover:bg-blue-100 hover:border-blue-300 hover:shadow-sm transition-all text-gray-700 font-medium flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span className="truncate">{d}</span>
              </div>
            ))}
            {availableDimensions.length === 0 && (
              <div className="text-xs text-gray-400 italic py-3 sm:py-4 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                All dimensions in use
              </div>
            )}
          </div>
        </div>

        {/* Measures - Responsive */}
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Measures</h4>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{availableMeasures.length}</span>
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            {availableMeasures.map(m => (
              <div
                key={m}
                draggable
                onDragStart={(e) => handleDragStartWithData(e, m)}
                className="px-2.5 py-2 sm:px-3 sm:py-2.5 bg-green-50 border border-green-200 rounded-lg text-xs sm:text-sm cursor-move hover:bg-green-100 hover:border-green-300 hover:shadow-sm transition-all text-gray-700 font-medium flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="truncate">{m.replace('_', ' ')}</span>
              </div>
            ))}
            {availableMeasures.length === 0 && (
              <div className="text-xs text-gray-400 italic py-3 sm:py-4 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                All measures in use
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions - Responsive */}
      <div className="p-3 sm:p-4 border-t border-gray-200 bg-blue-50">
        <div className="flex items-start gap-2">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-blue-800">
            <p className="font-medium mb-1">How to use:</p>
            <ul className="space-y-0.5 text-blue-700">
              <li>• Drag dimensions to Rows or Columns</li>
              <li>• Drag measures to Values</li>
              <li>• Click × to remove items</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
