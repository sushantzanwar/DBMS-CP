import React, { useEffect, useState } from 'react';
import { apiRequest, getToken, setToken } from './api.js';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import AuthPage from './components/AuthPage.jsx';
import Dashboard from './components/Dashboard.jsx';
import Businesses from './components/Businesses.jsx';
import Requests from './components/Requests.jsx';
import Proposals from './components/Proposals.jsx';
import Transactions from './components/Transactions.jsx';
import Reviews from './components/Reviews.jsx';
import Simulation from './components/Simulation.jsx';
import Forecasts from './components/Forecasts.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));
  const [page, setPage] = useState('dashboard');
  const [profileId, setProfileId] = useState(null);

  useEffect(() => {
    if (!getToken()) return;
    apiRequest('GET', '/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  const signOut = () => {
    setToken(null);
    setUser(null);
    setPage('dashboard');
  };

  useEffect(() => {
    window.addEventListener('session-expired', signOut);
    return () => window.removeEventListener('session-expired', signOut);
  }, []);

  if (checking) {
    return (
      <div className="state boot" role="status">
        <span className="spinner" aria-hidden="true" /> Loading workspace…
      </div>
    );
  }
  if (!user) return <AuthPage onAuthenticated={setUser} />;

  const openBusiness = (id) => {
    setProfileId(id);
    setPage('businesses');
  };
  const go = (next) => {
    setProfileId(null);
    setPage(next);
  };

  const pages = {
    dashboard: <Dashboard user={user} go={go} />,
    businesses: <Businesses profileId={profileId} onOpen={setProfileId} />,
    requests: <Requests user={user} onOpenBusiness={openBusiness} />,
    proposals: <Proposals onOpenBusiness={openBusiness} />,
    transactions: <Transactions go={go} />,
    reviews: <Reviews onOpenBusiness={openBusiness} />,
    simulation: <Simulation user={user} go={go} onOpenBusiness={openBusiness} />,
    forecasts: <Forecasts go={go} />,
  };

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Sidebar page={page} user={user} onSelect={go} onSignOut={signOut} />
      <div className="main">
        <TopBar user={user} page={page} onSelect={go} onSignOut={signOut} />
        <main id="main-content" className="content" tabIndex={-1} key={page}>
          {pages[page]}
        </main>
      </div>
    </div>
  );
}
