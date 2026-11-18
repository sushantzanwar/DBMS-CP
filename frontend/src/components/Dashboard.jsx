import React from 'react';
import { useApi } from '../api.js';
import { Async, Badge, Icon, PageHeader, SectionHeader, money } from './ui.jsx';

export default function Dashboard({ user, go }) {
  const result = useApi('/dashboard');

  return (
    <div className="page">
      <PageHeader
        title={`Overview — ${user.businessName}`}
        subtitle="Decisions waiting on your team, followed by open work across the exchange."
        action={
          <button type="button" className="btn" onClick={() => go('requests')}>
            <Icon name="plus" size={15} />
            <span>New request</span>
          </button>
        }
      />

      <Async result={result} what="your overview" isEmpty={() => false}>
        {({ marketplace, mine, recent }) => {
          const queue = [
            {
              id: 'review',
              count: Number(mine.proposals_to_review),
              title: 'Proposals waiting for your decision',
              detail: 'Incoming bids on your open service requests',
              cta: 'Review bids',
              target: 'proposals',
              urgent: Number(mine.proposals_to_review) > 0,
            },
            {
              id: 'deals',
              count: Number(mine.my_active_deals),
              title: 'Active deals in progress',
              detail: 'Contracts awaiting completion confirmation or payment update',
              cta: 'Open ledger',
              target: 'transactions',
              urgent: Number(mine.my_active_deals) > 0,
            },
            {
              id: 'open-req',
              count: Number(mine.my_open_requests),
              title: 'Your open requests',
              detail: 'Scoped briefs open to provider proposals',
              cta: 'Manage requests',
              target: 'requests',
              urgent: false,
            },
            {
              id: 'bids',
              count: Number(mine.my_pending_bids),
              title: 'Pending proposals you sent',
              detail: 'Quotes awaiting buyer acceptance or rejection',
              cta: 'View sent bids',
              target: 'proposals',
              urgent: false,
            },
          ];

          return (
            <div className="overview-grid">
              <div className="overview-main">
                <SectionHeader
                  title="Needs your attention"
                  subtitle="Jump straight into items awaiting action."
                />
                <div className="sheet attention-list">
                  {queue.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`attention-row ${item.urgent ? 'is-urgent' : ''}`}
                      onClick={() => go(item.target)}
                    >
                      <span className="att-count">{item.count}</span>
                      <span className="att-copy">
                        <strong>{item.title}</strong>
                        <span className="muted small-text">{item.detail}</span>
                      </span>
                      <span className="att-action">
                        {item.cta} <Icon name="arrowRight" size={14} />
                      </span>
                    </button>
                  ))}
                </div>

                <SectionHeader
                  title="Open market feed"
                  subtitle="Latest service requests open for proposals."
                  action={
                    <button type="button" className="text-btn strong" onClick={() => go('requests')}>
                      All requests <Icon name="arrowRight" size={14} />
                    </button>
                  }
                />
                <div className="sheet">
                  {recent.length === 0 ? (
                    <div className="state empty">No open requests right now. Post a request to start receiving bids.</div>
                  ) : (
                    <div className="table-wrap">
                      <table className="table-responsive clickable-rows">
                        <thead>
                          <tr>
                            <th>Request &amp; service</th>
                            <th>Posted by</th>
                            <th className="num">Budget range</th>
                            <th>Deadline</th>
                            <th className="col-action" />
                          </tr>
                        </thead>
                        <tbody>
                          {recent.map((r) => (
                            <tr key={r.request_id} onClick={() => go('requests')}>
                              <td data-label="Request">
                                <strong>{r.title}</strong>
                                <div className="muted small-text">{r.service_name}</div>
                              </td>
                              <td data-label="Posted by">{r.buyer_name}</td>
                              <td data-label="Budget" className="num">
                                {money(r.budget_min)} – {money(r.budget_max)}
                              </td>
                              <td data-label="Deadline">
                                {r.days_left === null ? (
                                  <span className="muted">Flexible</span>
                                ) : r.days_left < 0 ? (
                                  <Badge status="Overdue" tone="bad" />
                                ) : (
                                  <span>{r.days_left} days left</span>
                                )}
                              </td>
                              <td className="col-action">
                                <button
                                  type="button"
                                  className="text-btn strong"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    go('requests');
                                  }}
                                >
                                  Inspect <Icon name="arrowRight" size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <aside className="overview-aside" aria-label="Exchange snapshot and analysis tools">
                {marketplace && (
                  <section className="sheet aside-block">
                    <h2 className="aside-heading">Exchange snapshot</h2>
                    <dl className="kv-list">
                      <div>
                        <dt>Verified businesses</dt>
                        <dd>{marketplace.businesses}</dd>
                      </div>
                      <div>
                        <dt>Active services</dt>
                        <dd>{marketplace.services}</dd>
                      </div>
                      <div>
                        <dt>Open requests</dt>
                        <dd>{marketplace.open_requests}</dd>
                      </div>
                      <div>
                        <dt>Recorded volume</dt>
                        <dd>{money(marketplace.completed_value)}</dd>
                      </div>
                      <div>
                        <dt>Average rating</dt>
                        <dd>
                          {marketplace.average_rating !== null && marketplace.average_rating !== undefined
                            ? `${Number(marketplace.average_rating).toFixed(2)} / 5`
                            : '—'}
                        </dd>
                      </div>
                    </dl>
                  </section>
                )}

                <section className="sheet aside-block">
                  <h2 className="aside-heading">Analysis tools</h2>
                  <div className="tool-links">
                    <button type="button" className="tool-link-row" onClick={() => go('simulation')}>
                      <div>
                        <strong>Provider availability simulation</strong>
                        <span className="muted small-text">Test backup options if primary suppliers are unavailable (read-only).</span>
                      </div>
                      <Icon name="arrowRight" size={15} />
                    </button>
                    <button type="button" className="tool-link-row" onClick={() => go('forecasts')}>
                      <div>
                        <strong>Category demand forecasts</strong>
                        <span className="muted small-text">Experimental next-month volume estimates from synthetic history.</span>
                      </div>
                      <Icon name="arrowRight" size={15} />
                    </button>
                  </div>
                </section>
              </aside>
            </div>
          );
        }}
      </Async>
    </div>
  );
}
