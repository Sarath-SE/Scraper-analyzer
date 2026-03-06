import { useState, useEffect, useCallback } from 'react';
import './App.css';
import Scraper from './pages/Scraper';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import { getCurrentUser, login, logout } from './api/auth.api';
import {
  clearAuthStorage,
  getAuthToken,
  getAuthUser,
  setAuthToken,
  setAuthUser,
  type AuthUser
} from './auth/storage';

export function App() {
  const [authUser, setAuthUserState] = useState<AuthUser | null>(() => getAuthUser());
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  const [currentPage, setCurrentPage] = useState<'scraper' | 'dashboard'>(() => {
    const saved = localStorage.getItem('currentPage');
    return (saved as 'scraper' | 'dashboard') || 'dashboard';
  });

  const [currentSitemapUid, setCurrentSitemapUid] = useState<string>(() => {
    const saved = localStorage.getItem('currentSitemapUid');
    return saved || '';
  });

  useEffect(() => {
    localStorage.setItem('currentPage', currentPage);
  }, [currentPage]);

  useEffect(() => {
    if (currentSitemapUid) {
      localStorage.setItem('currentSitemapUid', currentSitemapUid);
    }
  }, [currentSitemapUid]);

  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [isDarkMode]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setIsAuthChecking(false);
      return;
    }

    getCurrentUser()
      .then((user) => {
        setAuthUser(user);
        setAuthUserState(user);
      })
      .catch((error) => {
        console.error('Failed to validate session:', error);
        clearAuthStorage();
        setAuthUserState(null);
      })
      .finally(() => {
        setIsAuthChecking(false);
      });
  }, []);

  const handleSignIn = useCallback(async (email: string, password: string) => {
    const response = await login(email, password);
    setAuthToken(response.token);
    setAuthUser(response.user);
    setAuthUserState(response.user);
    setCurrentPage('dashboard');
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      if (getAuthToken()) {
        await logout();
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      clearAuthStorage();
      setAuthUserState(null);
      setCurrentSitemapUid('');
    }
  }, []);

  const handleSessionExpired = useCallback(() => {
    clearAuthStorage();
    setAuthUserState(null);
    setCurrentSitemapUid('');
    alert('Your session has expired. Please log in again.');
  }, []);

  const handleScrapeComplete = useCallback((sitemapUid: string) => {
    setCurrentSitemapUid(sitemapUid);
    setCurrentPage('dashboard');
  }, []);

  const handleNewScrape = () => {
    setCurrentPage('scraper');
  };

  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-700 font-medium">Checking your session...</div>
      </div>
    );
  }

  if (!authUser) {
    return <LoginPage onSignIn={handleSignIn} />;
  }

  return (
    <>
      {currentPage === 'scraper' ? (
        <Scraper
          onComplete={handleScrapeComplete}
          onSessionExpired={handleSessionExpired}
          onBackToDashboard={handleBackToDashboard}
        />
      ) : (
        <Dashboard
          onNewScrape={handleNewScrape}
          onSignOut={handleSignOut}
          sitemapUid={currentSitemapUid}
          isDarkMode={isDarkMode}
          user={authUser}
          onSessionExpired={handleSessionExpired}
          onToggleTheme={() => setIsDarkMode((v) => !v)}
        />
      )}
    </>
  );
}

export default App;
