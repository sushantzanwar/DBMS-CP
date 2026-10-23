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

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));
  const [page, setPage] = useState('dashboard');
  const [profileId, setProfileId] = useState(null); // business profile opened from another page

  // On load, if a token exists, find out who it belongs to.
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

  // The API tells us when the login has expired.
  useEffect(() => {
    window.addEventListener('session-expired', signOut);
    return () => window.removeEventListener('session-expired', signOut);
  }, []);

  if (checking) return <div className="state boot">Loading…</div>;
  if (!user) return <AuthPage onAuthenticated={setUser} />;

  const openBusiness = (id) => { setProfileId(id); setPage('businesses'); };
  const go = (next) => { setProfileId(null); setPage(next); };

  const pages = {
    dashboard: <Dashboard user={user} go={go} />,
    businesses: <Businesses profileId={profileId} onOpen={setProfileId} />,
    requests: <Requests user={user} onOpenBusiness={openBusiness} />,
    proposals: <Proposals onOpenBusiness={openBusiness} />,
    transactions: <Transactions go={go} />,
    reviews: <Reviews onOpenBusiness={openBusiness} />,
  };

  return (
    <div className="app">
      <Sidebar page={page} onSelect={go} />
      <div className="main">
        <TopBar user={user} onSignOut={signOut} />
        <main className="content">{pages[page]}</main>
      </div>
    </div>
  );
}
