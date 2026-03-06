import { useState, useEffect } from 'react';
import { triggerScrape, getJobStatus } from '../api/scraper.api';
import { UnauthorizedError } from '../api/http';

interface ScraperProps {
  onComplete: (sitemapUid: string) => void;
  onSessionExpired: () => void;
  onBackToDashboard: () => void;
}

export default function Scraper({ onComplete, onSessionExpired, onBackToDashboard }: ScraperProps) {
  const [sitemapUid, setSitemapUid] = useState('');
  const [lastTriggeredSitemapUid, setLastTriggeredSitemapUid] = useState('');
  const [jobId, setJobId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showSkippedModal, setShowSkippedModal] = useState(false);

  const handleTrigger = async () => {
    const normalizedSitemapUid = sitemapUid.trim();

    if (!normalizedSitemapUid) {
      alert('Please enter a sitemap UID');
      return;
    }

    setSitemapUid(normalizedSitemapUid);
    setLastTriggeredSitemapUid(normalizedSitemapUid);
    setIsLoading(true);
    setStatus('');
    setShowSkippedModal(false);
    setShowPopup(false);
    
    try {
      const response = await triggerScrape(normalizedSitemapUid);
      
      // Check if scraping was skipped (already scraped today)
      if (response.status === 'skipped') {
        console.log('[Scraper] Already scraped today, showing modal');
        setIsLoading(false);
        setShowSkippedModal(true);
        return;
      }
      
      if (typeof response.scrape_job_id === 'number') {
        setJobId(response.scrape_job_id);
      }
      setStatus(response.status);
    } catch (error) {
      console.error('Failed to trigger scrape:', error);
      if (error instanceof UnauthorizedError) {
        onSessionExpired();
        return;
      }
      alert('Failed to trigger scrape');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;

    console.log('[Scraper] Starting status polling for job:', jobId);

    const interval = setInterval(async () => {
      try {
        const statusResponse = await getJobStatus(jobId);
        console.log('[Scraper] Status update:', statusResponse.status, 'for job:', jobId);
        setStatus(statusResponse.status);

        if (statusResponse.status === 'finished') {
          clearInterval(interval);
          setIsLoading(false);
          
          // Always navigate to dashboard when finished
          const completedSitemapUid = (lastTriggeredSitemapUid || sitemapUid).trim();
          console.log('[Scraper] Job finished! Navigating to dashboard with sitemap:', completedSitemapUid);
          
          // Small delay to ensure status is visible before navigation
          setTimeout(() => {
            console.log('[Scraper] Executing navigation now...');
            onComplete(completedSitemapUid);
          }, 1000);
        } else if (statusResponse.status === 'failed') {
          clearInterval(interval);
          setIsLoading(false);
          console.error('[Scraper] Job failed');
          alert('Scraping failed');
        }
      } catch (error) {
        console.error('Failed to get status:', error);
        if (error instanceof UnauthorizedError) {
          clearInterval(interval);
          onSessionExpired();
        }
      }
    }, 3000);

    return () => {
      console.log('[Scraper] Cleaning up status polling for job:', jobId);
      clearInterval(interval);
    };
  }, [jobId, lastTriggeredSitemapUid, sitemapUid, onComplete, onSessionExpired]);

  const getStatusColor = () => {
    switch (status) {
      case 'running':
      case 'ingesting':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'finished':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Geometric background pattern */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e520_1px,transparent_1px),linear-gradient(to_bottom,#4f46e520_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10"></div>
      </div>

      {/* Animated gradient orbs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="absolute top-5 left-5 md:top-6 md:left-6 z-20">
        <button
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium text-white/95 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-full backdrop-blur-md transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </button>
      </div>

      <div className="w-full max-w-md relative z-10">

        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mb-4 shadow-xl">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Scraper.io</h1>
            <p className="text-sm text-gray-600">Enterprise Data Collection Platform</p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sitemap UID
              </label>
              <input
                type="text"
                value={sitemapUid}
                onChange={(e) => setSitemapUid(e.target.value)}
                placeholder="Enter sitemap UID"
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors text-gray-900"
              />
            </div>

            <button
              onClick={handleTrigger}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scraping in Progress...
                </span>
              ) : (
                'Start Scraping'
              )}
            </button>

            {/* Status Display */}
            {status && (
              <div className="mt-4 p-4 bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg border border-gray-200 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Status</span>
                  {jobId && (
                    <span className="text-xs text-gray-500 font-mono bg-white px-2 py-1 rounded">Job ID: {jobId}</span>
                  )}
                </div>
                <div className={`inline-block px-3 py-1.5 rounded-md border text-sm font-medium ${getStatusColor()}`}>
                  {status.toUpperCase()}
                  {status === 'ingesting' && ' - Saving to database...'}
                </div>
                {isLoading && (
                  <div className="mt-3">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full animate-pulse w-full"></div>
                    </div>
                    {status === 'ingesting' && (
                      <p className="text-xs text-gray-600 mt-2 text-center">
                        Processing scraped data, this may take a moment...
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full relative z-10 transform animate-scaleIn">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-4 shadow-xl">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Scraping Complete!
              </h2>
              <p className="text-gray-600 mb-6">
                Your data has been successfully collected and is ready for analysis.
              </p>
              <button
                onClick={() => onComplete((lastTriggeredSitemapUid || sitemapUid).trim())}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                View Analytics Dashboard →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Already Scraped Modal */}
      {showSkippedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full relative z-10 transform animate-scaleIn">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4 shadow-xl">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Already Scraped Today
              </h2>
              <p className="text-gray-600 mb-6">
                This sitemap was already scraped today. You can view the existing data in the analytics dashboard.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSkippedModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowSkippedModal(false);
                    onComplete((lastTriggeredSitemapUid || sitemapUid).trim());
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  View Dashboard →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
