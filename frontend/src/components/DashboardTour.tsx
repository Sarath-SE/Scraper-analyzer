import { useState } from 'react';
import Joyride, { STATUS } from 'react-joyride';

interface DashboardTourProps {
  run: boolean;
  onFinish: () => void;
  isDarkMode?: boolean;
}

interface Step {
  target: string | HTMLElement;
  content: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto';
  disableBeacon?: boolean;
}

export default function DashboardTour({ run, onFinish, isDarkMode = false }: DashboardTourProps) {
  const [stepIndex, setStepIndex] = useState(0);

  const steps: Step[] = [
    {
      target: 'body',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2">Welcome to Analytics Dashboard! 👋</h3>
          <p className="text-sm">
            Let's take a quick tour to help you get started with building powerful pivot tables and analyzing your data.
          </p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#sitemap-select',
      content: (
        <div>
          <h4 className="font-semibold mb-1">Product Selector</h4>
          <p className="text-sm">
            Choose which product/sitemap you want to analyze. Each product has its own scraped data and snapshots.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '#month-filter',
      content: (
        <div>
          <h4 className="font-semibold mb-1">Month Filter</h4>
          <p className="text-sm">
            Filter your data by specific month. Leave empty to see all available data. Click "Clear" to reset.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="new-scrape"]',
      content: (
        <div>
          <h4 className="font-semibold mb-1">New Scrape Button</h4>
          <p className="text-sm">
            Start a new web scraping job to collect fresh data. The system will automatically update your dashboard when complete.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="theme-toggle"]',
      content: (
        <div>
          <h4 className="font-semibold mb-1">Theme Toggle</h4>
          <p className="text-sm">
            Switch between light and dark mode. Dark mode is perfect for long analysis sessions and reduces eye strain.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="user-menu"]',
      content: (
        <div>
          <h4 className="font-semibold mb-1">User Menu</h4>
          <p className="text-sm">
            View your account details and logout. Your preferences are automatically saved.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="sidebar"]',
      content: (
        <div>
          <h4 className="font-semibold mb-1">Available Fields</h4>
          <p className="text-sm">
            Drag dimensions (like manufacturer, series) and measures (like quantity, price) from here to build your pivot table.
          </p>
        </div>
      ),
      placement: 'right',
    },
    {
      target: '[data-tour="sidebar-toggle"]',
      content: (
        <div>
          <h4 className="font-semibold mb-1">Sidebar Toggle</h4>
          <p className="text-sm">
            Hide or show the sidebar to maximize your table viewing area. The sidebar contains all available fields.
          </p>
        </div>
      ),
      placement: 'right',
    },
    {
      target: '[data-tour="rows-zone"]',
      content: (
        <div>
          <h4 className="font-semibold mb-1">Rows Drop Zone</h4>
          <p className="text-sm">
            Drag dimensions here to create table rows. For example, add "manufacturer" to group data by manufacturer.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="columns-zone"]',
      content: (
        <div>
          <h4 className="font-semibold mb-1">Columns Drop Zone</h4>
          <p className="text-sm">
            Drag time fields here — use "Snapshot Date" for daily grouping or "Snapshot Time" for exact timestamps.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="values-zone"]',
      content: (
        <div>
          <h4 className="font-semibold mb-1">Values Drop Zone</h4>
          <p className="text-sm">
            Drag measures here to display metrics. Add "quantity", "avg_price", or "estimated_sales" to analyze your data.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="export-csv"]',
      content: (
        <div>
          <h4 className="font-semibold mb-1">Export to CSV</h4>
          <p className="text-sm">
            Download your pivot table as a CSV file for further analysis in Excel or other tools.
          </p>
        </div>
      ),
      placement: 'left',
    },
    {
      target: '[data-tour="pivot-row"]',
      content: (
        <div>
          <h4 className="font-semibold mb-1">Product Detail View 🔍</h4>
          <p className="text-sm">
            Click any row in the table to open a detailed breakdown for that product — showing quantities, avg price, estimated sales, and a full period-by-period history.
          </p>
        </div>
      ),
      placement: 'top',
    },
    {
      target: 'body',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2">You're All Set! 🎉</h3>
          <p className="text-sm mb-3">
            Start building your pivot table by dragging fields to the drop zones. Your data will update automatically!
          </p>
          <p className="text-xs text-gray-600">
            Tip: You can restart this tour anytime by clicking the help button.
          </p>
        </div>
      ),
      placement: 'center',
    },
  ];

  const handleJoyrideCallback = (data: any) => {
    const { status, index, type } = data;

    if (type === 'step:after') {
      setStepIndex(index + 1);
    }

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setStepIndex(0);
      onFinish();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#2563eb',
          textColor: isDarkMode ? '#e2e8f0' : '#1f2937',
          backgroundColor: isDarkMode ? '#1a1f2e' : '#ffffff',
          overlayColor: 'rgba(0, 0, 0, 0.5)',
          arrowColor: isDarkMode ? '#1a1f2e' : '#ffffff',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 12,
          padding: 20,
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        buttonNext: {
          backgroundColor: '#2563eb',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 600,
        },
        buttonBack: {
          color: isDarkMode ? '#94a3b8' : '#6b7280',
          marginRight: 10,
          fontSize: 14,
        },
        buttonSkip: {
          color: isDarkMode ? '#94a3b8' : '#6b7280',
          fontSize: 14,
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip Tour',
      }}
    />
  );
}
