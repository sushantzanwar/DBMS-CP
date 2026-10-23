import React from 'react';
import { useApi } from '../api.js';
import { Async, PageHeader, money } from './ui.jsx';

export default function Dashboard({ user, go }) {
  const result = useApi('/dashboard');

  return (
    <>
      <PageHeader title={`Welcome, ${user.businessName}`} subtitle="Your marketplace activity at a glance." />
      <Async result={result} what="your dashboard" isEmpty={() => false}>
        {({ mine, recent }) => (
          <>
            <h2 className="first">Your activity</h2>
            <div className="stat-grid">
              <Stat value={mine.my_open_requests} label="Your open requests" onClick={() => go('requests')} />
              <Stat value={mine.proposals_to_review} label="Proposals to review" onClick={() => go('proposals')} />
              <Stat value={mine.my_pending_bids} label="Your pending proposals" onClick={() => go('proposals')} />
              <Stat value={mine.my_active_deals} label="Your active deals" onClick={() => go('transactions')} />
            </div>

            <h2>Latest open requests</h2>
            <div className="card">
              {recent.length === 0 ? (
                <div className="state">No open requests right now.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Request</th><th>Service</th><th>Posted by</th><th>Budget</th><th>Posted</th><th>Time left</th></tr>
                    </thead>
                    <tbody>
                      {recent.map((r) => (
                        <tr key={r.request_id}>
                          <td>{r.title}</td>
                          <td>{r.service_name}</td>
                          <td>{r.buyer_name}</td>
                          <td>{money(r.budget_min)} - {money(r.budget_max)}</td>
                          <td>{r.posted_on}</td>
                          <td>{r.days_left === null ? 'Flexible' : r.days_left < 0 ? 'Overdue' : `${r.days_left} days`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </Async>
    </>
  );
}

function Stat({ value, label, onClick }) {
  return (
    <div className={`card stat ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
