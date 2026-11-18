import React, { useState } from 'react';
import { useApi } from '../api.js';
import { Async, Icon, PageHeader, Stars, Tabs, money } from './ui.jsx';

export default function Businesses({ profileId, onOpen }) {
  if (profileId) return <Profile id={profileId} onBack={() => onOpen(null)} />;
  return <List onOpen={onOpen} />;
}

function List({ onOpen }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (filter === 'top-rated') params.set('filter', 'top-rated');
  const result = useApi(`/businesses?${params}`);

  return (
    <div className="page">
      <PageHeader
        title="Businesses"
        subtitle="Directory of registered buyers and service providers with verified deal reputation."
      />

      <div className="toolbar">
        <div className="search-wrap">
          <Icon name="search" size={15} className="search-icon" />
          <input
            name="search"
            className="search"
            aria-label="Search businesses"
            placeholder="Search by business name, industry or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs
          label="Rating filter"
          tabs={[
            { id: 'all', label: 'All businesses' },
            { id: 'top-rated', label: 'Rated above average' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      <Async
        result={result}
        what="businesses"
        emptyText="No businesses match that search or rating filter."
      >
        {(rows) => (
          <div className="sheet">
            <div className="table-wrap">
              <table className="table-responsive clickable-rows">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Industry</th>
                    <th>Location</th>
                    <th>Size</th>
                    <th>Reputation</th>
                    <th className="col-action">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.business_id} onClick={() => onOpen(b.business_id)}>
                      <td data-label="Business">
                        <strong>{b.business_name}</strong>
                      </td>
                      <td data-label="Industry">{b.industry}</td>
                      <td data-label="Location">{b.location}</td>
                      <td data-label="Size">{b.business_size || '—'}</td>
                      <td data-label="Reputation">
                        <div className="rep-cell">
                          <Stars value={b.avg_rating} />
                          {b.review_count > 0 && (
                            <span className="muted small-text">
                              {b.review_count} review{b.review_count > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="col-action">
                        <button
                          type="button"
                          className="text-btn strong"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(b.business_id);
                          }}
                        >
                          View <Icon name="arrowRight" size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Async>
    </div>
  );
}

function Profile({ id, onBack }) {
  const result = useApi(`/businesses/${id}`);

  return (
    <div className="page">
      <button type="button" className="link-back" onClick={onBack}>
        <Icon name="arrowLeft" size={14} /> All businesses
      </button>

      <Async result={result} what="business profile" isEmpty={() => false}>
        {({ business: b, servicesDelivered, openRequests, reviews }) => {
          const hasDescription =
            b.description && b.description !== 'No description provided.';
          const facts = [
            ['Size', b.business_size],
            ['Stage', b.business_stage],
            ['Employees', b.employees > 0 ? b.employees : null],
            ['Revenue', b.revenue_range],
            ['Years active', b.business_age !== null && b.business_age !== undefined ? b.business_age : null],
            ['Email', b.email],
            ['Phone', b.phone],
            ['Website', b.website],
          ].filter(([, val]) => val && val !== 'Not specified' && val !== 'Not disclosed' && val !== 'Not provided');

          return (
            <>
              <PageHeader
                title={b.business_name}
                subtitle={`${b.industry} · ${b.location}${b.business_size ? ` · ${b.business_size}` : ''}`}
              />

              <div className="profile-layout">
                {/* Primary Evidence Column */}
                <div className="profile-main">
                  <section className="sheet aside-block">
                    <h2 className="aside-heading">Reputation &amp; track record</h2>
                    <div className="profile-rep-row">
                      <div>
                        <div className="big-rating">
                          {b.avg_rating ?? '—'}
                          <small> / 5</small>
                        </div>
                        <Stars value={b.avg_rating} />
                        <div className="muted small-text">
                          {b.review_count} verified review{b.review_count === 1 ? '' : 's'}
                        </div>
                      </div>
                      <div className="profile-services-col">
                        <h3>Services delivered</h3>
                        {servicesDelivered.length === 0 ? (
                          <p className="muted small-text">
                            No completed or active delivery records on ServicePath yet.
                          </p>
                        ) : (
                          <ul className="plain">
                            {servicesDelivered.map((s) => (
                              <li key={s.service_name}>
                                <strong>{s.service_name}</strong>{' '}
                                <span className="muted small-text">
                                  · {s.category} · {s.jobs} job{s.jobs > 1 ? 's' : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="profile-reviews">
                    <h2>Reviews received</h2>
                    {reviews.length === 0 ? (
                      <div className="sheet">
                        <div className="state empty">
                          No client reviews recorded for this business yet.
                        </div>
                      </div>
                    ) : (
                      <div className="sheet proposal-ledger">
                        {reviews.map((r) => (
                          <article className="ledger-entry review" key={r.review_id}>
                            <div className="proposal-head">
                              <div>
                                <strong>{r.service_name}</strong>
                                <span className="muted small-text"> · {r.reviewed_on}</span>
                              </div>
                              <Stars value={r.rating} />
                            </div>
                            <p className="review-copy">{r.review_text}</p>
                            <div className="muted small-text">
                              Reviewed by {r.reviewer_name}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                {/* Secondary Background, Contact & Open Requests Column */}
                <aside className="profile-aside" aria-label="Company details and open requests">
                  <section className="sheet aside-block">
                    <h2 className="aside-heading">Company &amp; contact</h2>
                    {hasDescription && <p className="profile-desc">{b.description}</p>}
                    {facts.length === 0 ? (
                      <p className="muted small-text">No additional profile details shared yet.</p>
                    ) : (
                      <dl className="facts">
                        {facts.map(([k, v]) => (
                          <React.Fragment key={k}>
                            <dt>{k}</dt>
                            <dd>{v}</dd>
                          </React.Fragment>
                        ))}
                      </dl>
                    )}
                  </section>

                  <section className="sheet aside-block">
                    <h2 className="aside-heading">Open requests</h2>
                    {openRequests.length === 0 ? (
                      <p className="muted small-text">No open service requests posted right now.</p>
                    ) : (
                      <ul className="plain">
                        {openRequests.map((r) => (
                          <li key={r.request_id}>
                            <strong>{r.title}</strong>
                            <div className="muted small-text tabular">
                              {money(r.budget_min)} – {money(r.budget_max)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </aside>
              </div>
            </>
          );
        }}
      </Async>
    </div>
  );
}
