import React from 'react';
import { useApi } from '../api.js';
import { Async, Badge, PageHeader, money } from './ui.jsx';

export default function Dashboard({ user, go }) {
  const result = useApi('/dashboard');

  return (
    <div className="page-dashboard">
      <PageHeader
        title={`Welcome, ${user.businessName}`}
        subtitle="Marketplace overview, personal activity, and pending actions."
        action={
          <div className="header-actions">
            <button className="btn small" onClick={() => go('requests')}>
              + Post New Request
            </button>
          </div>
        }
      />

      <Async result={result} what="your dashboard" isEmpty={() => false}>
        {({ marketplace, mine, recent }) => (
          <>
            {/* Quick Action Navigation Bar */}
            <div className="overview-nav-strip">
              <div className="nav-strip-item clickable" onClick={() => go('requests')}>
                <span className="strip-icon">📋</span>
                <div>
                  <strong>Browse Requests</strong>
                  <small>View &amp; tender client proposals</small>
                </div>
              </div>
              <div className="nav-strip-item clickable" onClick={() => go('businesses')}>
                <span className="strip-icon">🏢</span>
                <div>
                  <strong>Verified Providers</strong>
                  <small>Explore enterprise directory</small>
                </div>
              </div>
              <div className="nav-strip-item clickable highlight-cyan" onClick={() => go('simulation')}>
                <span className="strip-icon">⚡</span>
                <div>
                  <strong>Market Simulation</strong>
                  <small>Test provider resilience &amp; alternatives</small>
                </div>
              </div>
              <div className="nav-strip-item clickable highlight-amber" onClick={() => go('forecasts')}>
                <span className="strip-icon">📈</span>
                <div>
                  <strong>Demand Forecasts</strong>
                  <small>Anticipate next-month service needs</small>
                </div>
              </div>
            </div>

            {/* Action Center (Personal Activity) */}
            <div className="section-head">
              <h2>Your Activity</h2>
              <span className="muted">Direct shortcuts to pending deals and offers</span>
            </div>
            <div className="stat-grid">
              <Stat
                value={mine.my_open_requests}
                label="Your Open Requests"
                sub="Awaiting proposals"
                onClick={() => go('requests')}
              />
              <Stat
                value={mine.proposals_to_review}
                label="Proposals to Review"
                sub="Incoming offers on your requests"
                badge={mine.proposals_to_review > 0 ? 'Needs Attention' : null}
                badgeType="amber"
                onClick={() => go('proposals')}
              />
              <Stat
                value={mine.my_pending_bids}
                label="Your Submitted Bids"
                sub="Active quotes submitted"
                onClick={() => go('proposals')}
              />
              <Stat
                value={mine.my_active_deals}
                label="Active Contracts"
                sub="In-flight transactions"
                badge={mine.my_active_deals > 0 ? 'Active' : null}
                badgeType="green"
                onClick={() => go('transactions')}
              />
            </div>

            {/* Marketplace Platform Highlights */}
            {marketplace && (
              <>
                <div className="section-head" style={{ marginTop: '24px' }}>
                  <h2>Marketplace Highlights</h2>
                  <span className="muted">Live platform benchmarks across all participating businesses</span>
                </div>
                <div className="stat-grid secondary">
                  <div className="card stat compact">
                    <div className="stat-value small">{marketplace.businesses}</div>
                    <div className="stat-label">Registered Businesses</div>
                  </div>
                  <div className="card stat compact">
                    <div className="stat-value small">{marketplace.services}</div>
                    <div className="stat-label">Active Service Categories</div>
                  </div>
                  <div className="card stat compact">
                    <div className="stat-value small">{marketplace.open_requests}</div>
                    <div className="stat-label">Open Market Requests</div>
                  </div>
                  <div className="card stat compact">
                    <div className="stat-value small">{money(marketplace.completed_value)}</div>
                    <div className="stat-label">Completed Trade Volume</div>
                  </div>
                </div>
              </>
            )}

            {/* Latest Open Requests Table */}
            <div className="section-head" style={{ marginTop: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div>
                  <h2>Latest Open Requests</h2>
                  <span className="muted">Recent market requests open for bidding</span>
                </div>
                <button className="link strong" onClick={() => go('requests')}>
                  View all requests →
                </button>
              </div>
            </div>

            <div className="card">
              {recent.length === 0 ? (
                <div className="state">No open requests right now. Be the first to post one!</div>
              ) : (
                <div className="table-wrap">
                  <table className="clickable-rows">
                    <thead>
                      <tr>
                        <th>Request Title</th>
                        <th>Category &amp; Service</th>
                        <th>Buyer</th>
                        <th>Budget Range</th>
                        <th>Posted</th>
                        <th>Timeline</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((r) => (
                        <tr key={r.request_id} onClick={() => go('requests')}>
                          <td>
                            <strong>{r.title}</strong>
                          </td>
                          <td>
                            <span className="badge blue">{r.service_name}</span>
                          </td>
                          <td>{r.buyer_name}</td>
                          <td>
                            <strong>
                              {money(r.budget_min)} – {money(r.budget_max)}
                            </strong>
                          </td>
                          <td>{r.posted_on}</td>
                          <td>
                            {r.days_left === null ? (
                              <span className="muted">Flexible</span>
                            ) : r.days_left < 0 ? (
                              <span className="badge red">Past due</span>
                            ) : (
                              <span className="badge">{r.days_left} days left</span>
                            )}
                          </td>
                          <td>
                            <button
                              className="btn ghost small"
                              onClick={(e) => {
                                e.stopPropagation();
                                go('requests');
                              }}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Intelligence & Analytics Feature Spotlight */}
            <div className="two-col" style={{ marginTop: '20px' }}>
              <div className="card spotlight-card clickable" onClick={() => go('simulation')}>
                <div className="spotlight-badge">Phase 3 Intelligence</div>
                <h3>What-If Market Simulation</h3>
                <p className="muted" style={{ fontSize: '13px', margin: '6px 0 14px' }}>
                  Simulate provider outages or capacity constraints. See how the platform automatically adapts
                  and promotes qualified backup providers using 100-point SQL multi-criteria ranking.
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="pill">Ephemeral • Read-Only</span>
                  <span className="link strong">Open Simulator →</span>
                </div>
              </div>

              <div className="card spotlight-card clickable" onClick={() => go('forecasts')}>
                <div className="spotlight-badge highlight-amber">Phase 2 Forecasting</div>
                <h3>Service Demand Projections</h3>
                <p className="muted" style={{ fontSize: '13px', margin: '6px 0 14px' }}>
                  Review next-month expected demand across IT, Marketing, Finance, and Design services based on a
                  24-month historical trend model with empirical MAE/RMSE holdout evaluation.
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="pill">OLS Regression Model</span>
                  <span className="link strong">View Forecasts →</span>
                </div>
              </div>
            </div>
          </>
        )}
      </Async>
    </div>
  );
}

function Stat({ value, label, sub, badge, badgeType = 'blue', onClick }) {
  return (
    <div className={`card stat ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stat-value">{value}</div>
        {badge && <Badge status={badge} />}
      </div>
      <div className="stat-label">{label}</div>
      {sub && <small className="muted" style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>{sub}</small>}
    </div>
  );
}
