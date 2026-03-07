import React, { useEffect, useMemo, useRef, useState } from 'react';
import { runPivot } from '../api/pivot.api';
import { fetchPivotDimensions } from '../api/dimensions.api';
import { fetchSitemaps, type SitemapOption } from '../api/sitemaps.api';
import { UnauthorizedError } from '../api/http';
import PivotBuilder from '../components/PivotBuilder';
import PivotTable from '../components/PivotTable';
import DashboardTour from '../components/DashboardTour';
import type { PivotResponse, PivotMeasure } from '../types/pivot';
import type { AuthUser } from '../auth/storage';

type PivotBuilderState = {
  rows: string[];
  columns: string[];
  measures: string[];
};

const formatSitemapLabel = (sitemap: SitemapOption): string => {
  const description = sitemap.description?.trim();
  return description
    ? `${description} - ${sitemap.sitemap_uid}`
    : sitemap.sitemap_uid;
};

const ALL_MEASURES: PivotMeasure[] = [
  'quantity',
  'quantity_sold',
  'avg_price',
  'estimated_sales',
];

interface DashboardProps {
  onNewScrape: () => void;
  onSignOut: () => void;
  onSessionExpired: () => void;
  sitemapUid: string;
  user: AuthUser;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export default function Dashboard({
  onNewScrape,
  onSignOut,
  onSessionExpired,
  sitemapUid,
  user,
  isDarkMode,
  onToggleTheme,
}: DashboardProps) {
  const [sitemaps, setSitemaps] = useState<SitemapOption[]>([]);
  const [activeSitemapUid, setActiveSitemapUid] = useState<string>(sitemapUid);
  const [monthFilter, setMonthFilter] = useState('');

  const [dimensions, setDimensions] = useState<string[]>([]);
  const [data, setData] = useState<PivotResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const [builder, setBuilder] = useState<PivotBuilderState>({
    rows: ['manufacturer'],
    columns: ['snapshot_time'],
    measures: ['quantity'],
  });

  const selectedSitemap = useMemo(
    () => sitemaps.find((s) => s.sitemap_uid === activeSitemapUid) ?? null,
    [sitemaps, activeSitemapUid]
  );

  useEffect(() => {
    let cancelled = false;

    fetchSitemaps()
      .then((list) => {
        if (cancelled) return;

        setSitemaps(list);

        if (activeSitemapUid) return;

        const fallback = sitemapUid || localStorage.getItem('currentSitemapUid') || list[0]?.sitemap_uid || '';
        if (fallback) {
          setActiveSitemapUid(fallback);
        }
      })
      .catch((error) => {
        console.error('[Sitemaps Error]', error);
        if (error instanceof UnauthorizedError) {
          onSessionExpired();
          return;
        }
        setErrorMessage(error.message || 'Failed to load sitemap list');
      });

    return () => {
      cancelled = true;
    };
  }, [activeSitemapUid, sitemapUid, onSessionExpired]);

  useEffect(() => {
    if (sitemapUid) {
      setActiveSitemapUid(sitemapUid);
    }
  }, [sitemapUid]);

  useEffect(() => {
    if (!activeSitemapUid) return;
    localStorage.setItem('currentSitemapUid', activeSitemapUid);
  }, [activeSitemapUid]);

  useEffect(() => {
    if (!activeSitemapUid) {
      setDimensions([]);
      return;
    }

    fetchPivotDimensions({
      sitemap_uid: activeSitemapUid,
      month: monthFilter || undefined,
    })
      .then((dims) => {
        setDimensions(dims);
        setErrorMessage('');
      })
      .catch((error) => {
        console.error('[Pivot Dimensions Error]', error);
        if (error instanceof UnauthorizedError) {
          onSessionExpired();
          return;
        }
        setDimensions([]);
        setErrorMessage(error.message || 'Failed to load pivot dimensions');
      });
  }, [activeSitemapUid, monthFilter, onSessionExpired]);

  useEffect(() => {
    if (!builder.rows.length || !builder.measures.length || !activeSitemapUid) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    runPivot({
      rows: builder.rows,
      columns: builder.columns,
      measures: builder.measures as PivotMeasure[],
      filters: {
        sitemap_uid: activeSitemapUid,
        month: monthFilter || undefined,
      },
    })
      .then((res) => {
        setData(res);
        setIsLoading(false);
        setErrorMessage('');
      })
      .catch((err) => {
        console.error('[Pivot Run Error]', err);
        if (err instanceof UnauthorizedError) {
          onSessionExpired();
          return;
        }
        setData(null);
        setIsLoading(false);
        setErrorMessage(err.message || 'Failed to load pivot data');
      });
  }, [builder, activeSitemapUid, monthFilter, onSessionExpired]);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const onClickOutside = (event: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isUserMenuOpen]);

  // Check if user has seen the tour
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('dashboardTourCompleted');
    if (!hasSeenTour) {
      // Start tour after a short delay to let the page load
      const timer = setTimeout(() => {
        setRunTour(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleTourFinish = () => {
    setRunTour(false);
    localStorage.setItem('dashboardTourCompleted', 'true');
  };

  const handleStartTour = () => {
    setRunTour(true);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 relative">
      {/* Tour Component */}
      <DashboardTour run={runTour} onFinish={handleTourFinish} isDarkMode={isDarkMode} />

      <div className="bg-gradient-to-r from-slate-50 to-blue-50 border-b-2 border-blue-200 shadow-md">
        <div className="px-3 sm:px-6 py-2 sm:py-3 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 sm:gap-3">
          <div className="flex-shrink-0">
            <h1 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="hidden sm:inline">Analytics Dashboard</span>
              <span className="sm:hidden">Dashboard</span>
            </h1>
          </div>

          <div className="w-full lg:w-auto flex flex-wrap items-center justify-start lg:justify-end gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white rounded-md border border-blue-200 shadow-sm">
              <label htmlFor="sitemap-select" className="text-xs font-semibold text-gray-700 whitespace-nowrap hidden sm:inline">Product</label>
              <select
                id="sitemap-select"
                value={activeSitemapUid}
                onChange={(e) => {
                  setActiveSitemapUid(e.target.value);
                }}
                className="text-xs bg-white border-0 rounded-md px-1 py-0.5 text-gray-900 min-w-[120px] max-w-[180px] focus:ring-1 focus:ring-blue-500"
              >
                {!activeSitemapUid && (
                  <option value="">Select product</option>
                )}
                {sitemaps.map((sitemap) => (
                  <option key={sitemap.sitemap_uid} value={sitemap.sitemap_uid}>
                    {formatSitemapLabel(sitemap)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 px-2 py-1.5 bg-white rounded-md border border-blue-200 shadow-sm">
              <input
                id="month-filter"
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="text-xs bg-white border-0 rounded-md px-1 py-0.5 text-gray-900 w-[110px] focus:ring-1 focus:ring-blue-500"
              />
              {monthFilter && (
                <button
                  onClick={() => setMonthFilter('')}
                  className="p-0.5 text-gray-500 hover:text-red-600 transition-colors"
                  title="Clear month filter"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <button
              data-tour="new-scrape"
              onClick={onNewScrape}
              className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-semibold rounded-md hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm flex items-center gap-1.5"
              title="Start a new web scraping job"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Scrape</span>
            </button>

            <button
              data-tour="theme-toggle"
              onClick={onToggleTheme}
              className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-md border border-blue-200 bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-400 transition-all"
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m7-9h2M3 12H5m11.314 6.314l1.414 1.414M6.272 6.272l1.414 1.414m0 8.9l-1.414 1.414m12.728-12.728l-1.414 1.414M12 7a5 5 0 100 10 5 5 0 000-10z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 118.646 3.646 7 7 0 0020.354 15.354z" />
                </svg>
              )}
            </button>

            <button
              onClick={handleStartTour}
              className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-md border border-blue-200 bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-400 transition-all"
              aria-label="Start tour"
              title="Start guided tour"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            <div className="relative" ref={userMenuRef}>
              <button
                data-tour="user-menu"
                onClick={() => setIsUserMenuOpen((value) => !value)}
                className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-md border border-blue-200 bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-400 transition-all"
                aria-label="Open user menu"
                title="User menu"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A11.952 11.952 0 0112 15.75c2.54 0 4.894.79 6.879 2.054M15 9a3 3 0 11-6 0 3 3 0 016 0zm6 3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 sm:w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-40 p-3">
                  <div className="text-xs sm:text-sm font-semibold text-gray-900 break-words">
                    {user.full_name || user.email}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 break-words">{user.email}</div>
                  <button
                    onClick={onSignOut}
                    className="mt-3 w-full px-3 py-2 bg-white text-gray-700 text-xs sm:text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 transition-colors text-left"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-6 pb-2 sm:pb-3 text-xs flex flex-wrap items-center gap-2 sm:gap-3 text-gray-700 bg-white/50 backdrop-blur-sm">
          <span className="whitespace-nowrap flex items-center gap-1">
            <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Active: <strong className="text-gray-900">{activeSitemapUid || 'None'}</strong>
          </span>
          <span className="whitespace-nowrap flex items-center gap-1">
            <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            Snapshots: <strong className="text-gray-900">{selectedSitemap?.snapshot_count ?? 0}</strong>
          </span>
          <span className="whitespace-nowrap flex items-center gap-1">
            <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Last Snapshot: <strong className="text-gray-900">{selectedSitemap?.last_snapshot_date ?? 'N/A'}</strong>
          </span>
          {monthFilter && (
            <span className="whitespace-nowrap flex items-center gap-1 bg-blue-100 px-2 py-1 rounded-md border border-blue-300">
              <svg className="w-3 h-3 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Month: <strong className="text-blue-900">{monthFilter}</strong>
            </span>
          )}
        </div>
        {errorMessage && (
          <div className="px-6 pb-4">
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {errorMessage}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div
          data-tour="sidebar"
          className={`bg-white border-r border-gray-200 overflow-y-auto transition-all duration-300 ${
            isSidebarCollapsed ? 'w-0' : 'w-56 sm:w-64'
          }`}
        >
          {!isSidebarCollapsed && (
            <PivotBuilder
              key={`${builder.rows.join(',')}-${builder.columns.join(',')}-${builder.measures.join(',')}`}
              allDimensions={dimensions}
              allMeasures={ALL_MEASURES}
              value={builder}
              onChange={setBuilder}
            />
          )}
        </div>

        <button
          data-tour="sidebar-toggle"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-white border border-gray-300 rounded-r-lg shadow-lg hover:bg-gray-50 transition-all z-30 p-1.5 sm:p-2"
          style={{ left: isSidebarCollapsed ? '0' : window.innerWidth < 640 ? '224px' : '256px' }}
          title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          <svg
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-0' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 flex flex-col overflow-hidden">
          {!isSidebarCollapsed && (
            <div className="bg-white border-b border-gray-200 p-2 sm:p-3 md:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
              <DropZone
                dataTour="rows-zone"
                title="Rows"
                items={builder.rows}
                onRemove={(item) => {
                  if (builder.rows.length > 1) {
                    setBuilder({ ...builder, rows: builder.rows.filter((i) => i !== item) });
                  }
                }}
                onClear={() => {
                  if (builder.rows.length > 0) {
                    setBuilder({ ...builder, rows: [builder.rows[0]] });
                  }
                }}
                onDrop={(item) => {
                  const newBuilder = {
                    rows: builder.rows.includes(item) ? builder.rows : [...builder.rows, item],
                    columns: builder.columns.filter((i) => i !== item),
                    measures: builder.measures,
                  };
                  setBuilder(newBuilder);
                }}
                color="blue"
                acceptType="dimension"
                minItems={1}
              />

              <DropZone
                dataTour="columns-zone"
                title="Columns"
                items={builder.columns}
                onRemove={(item) => {
                  if (builder.columns.length > 1) {
                    setBuilder({ ...builder, columns: builder.columns.filter((i) => i !== item) });
                  }
                }}
                onClear={() => {
                  if (builder.columns.length > 0) {
                    setBuilder({ ...builder, columns: [builder.columns[0]] });
                  }
                }}
                onDrop={(item) => {
                  const newBuilder = {
                    rows: builder.rows.filter((i) => i !== item),
                    columns: builder.columns.includes(item) ? builder.columns : [...builder.columns, item],
                    measures: builder.measures,
                  };
                  setBuilder(newBuilder);
                }}
                color="purple"
                acceptType="dimension"
                minItems={1}
              />

              <DropZone
                dataTour="values-zone"
                title="Values"
                items={builder.measures}
                onRemove={(item) => {
                  if (builder.measures.length > 1) {
                    setBuilder({ ...builder, measures: builder.measures.filter((i) => i !== item) });
                  }
                }}
                onClear={() => {
                  if (builder.measures.length > 0) {
                    setBuilder({ ...builder, measures: [builder.measures[0]] });
                  }
                }}
                onDrop={(item) => {
                  if (!builder.measures.includes(item)) {
                    setBuilder({ ...builder, measures: [...builder.measures, item] });
                  }
                }}
                color="green"
                acceptType="measure"
                minItems={1}
              />
              </div>
            </div>
          )}

          <div className={`flex-1 overflow-hidden bg-gray-50 ${isSidebarCollapsed ? 'p-2 sm:p-4 md:p-6' : 'p-2 sm:p-3 md:p-6'}`}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-gray-200 border-t-blue-600 mb-4"></div>
                  <p className="text-gray-600 font-medium text-sm sm:text-base">Loading pivot data...</p>
                </div>
              </div>
            ) : data ? (
              <PivotTable data={data} rowKeys={builder.rows} measures={builder.measures} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center bg-white rounded-lg border border-gray-200 p-6 sm:p-8 md:p-12 shadow-sm max-w-md mx-auto">
                  <div className="text-4xl sm:text-5xl mb-4">📊</div>
                  <p className="text-gray-900 font-semibold text-base sm:text-lg mb-2">Configure Your Pivot Table</p>
                  <p className="text-gray-500 text-xs sm:text-sm">Use sitemap and month filter, then drag fields to drop zones</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DropZoneProps {
  title: string;
  items: string[];
  onRemove: (item: string) => void;
  onClear: () => void;
  onDrop: (item: string) => void;
  color: 'blue' | 'purple' | 'green';
  acceptType?: 'dimension' | 'measure';
  minItems?: number;
  dataTour?: string;
}

function DropZone({ title, items, onRemove, onClear, onDrop, color, minItems = 0, dataTour }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const data = e.dataTransfer.getData('text/plain');
    if (data) {
      onDrop(data);
    }
  };

  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      itemBg: 'bg-blue-100',
      itemBorder: 'border-blue-300',
      dragOver: 'border-blue-400 bg-blue-100',
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-700',
      itemBg: 'bg-purple-100',
      itemBorder: 'border-purple-300',
      dragOver: 'border-purple-400 bg-purple-100',
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      itemBg: 'bg-green-100',
      itemBorder: 'border-green-300',
      dragOver: 'border-green-400 bg-green-100',
    },
  };

  const colors = colorClasses[color];
  const canClear = items.length > minItems;

  return (
    <div data-tour={dataTour}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 uppercase">{title}</span>
          {minItems > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full" title="At least one item required">
              Required
            </span>
          )}
        </div>
        {canClear && (
          <button onClick={onClear} className="text-xs text-red-600 hover:text-red-700 font-medium">
            Clear
          </button>
        )}
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`min-h-[80px] p-3 border-2 border-dashed rounded-lg transition-colors ${
          isDragOver
            ? colors.dragOver
            : items.length > 0
              ? `${colors.border} ${colors.bg}`
              : 'border-gray-300 bg-gray-50'
        }`}
      >
        {items.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-4">Drop {title.toLowerCase()} here</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => {
              const isLocked = minItems > 0 && items.length <= minItems;
              return (
                <div
                  key={item}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 ${colors.itemBg} border ${colors.itemBorder} rounded-md text-xs font-medium ${colors.text}`}
                >
                  {isLocked && (
                    <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                  <span>{item.replace('_', ' ')}</span>
                  {!isLocked && (
                    <button onClick={() => onRemove(item)} className="hover:text-red-600 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
