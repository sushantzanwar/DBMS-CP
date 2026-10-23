import React, { useState } from 'react';
import { useApi } from '../api.js';
import { Async, PageHeader, Stars, Tabs, money } from './ui.jsx';

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
    <>
      <PageHeader title="Businesses" subtitle="Discover businesses on the platform and review their track record." />
      <div className="toolbar">
        <input className="search" placeholder="Search by name, industry or city" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Tabs
          tabs={[{ id: 'all', label: 'All businesses' }, { id: 'top-rated', label: 'Rated above average' }]}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <Async result={result} what="businesses" emptyText="No businesses match your search.">
        {(rows) => (
          <div className="card-grid">
            {rows.map((b) => (
              <button key={b.business_id} className="card biz-card" onClick={() => onOpen(b.business_id)}>
                <div className="biz-name">{b.business_name}</div>
                <div className="muted">{b.industry}</div>
                <div className="biz-meta">{b.location}{b.business_size ? ` · ${b.business_size}` : ''}</div>
                <div className="biz-rating">
                  <Stars value={b.avg_rating} />
                  {b.review_count > 0 && <span className="muted"> · {b.review_count} review{b.review_count > 1 ? 's' : ''}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </Async>
    </>
  );
}

function Profile({ id, onBack }) {
  const result = useApi(`/businesses/${id}`);
  return (
    <>
      <button className="link-back" onClick={onBack}>← All businesses</button>
      <Async result={result} what="business profile" isEmpty={() => false}>
        {({ business: b, servicesDelivered, openRequests, reviews }) => (
          <>
            <PageHeader title={b.business_name} subtitle={`${b.industry} · ${b.location}`} />
            <div className="profile-grid">
              <section className="card">
                <h3>About</h3>
                <p>{b.description}</p>
                <dl className="facts">
                  <dt>Size</dt><dd>{b.business_size || 'Not specified'}</dd>
                  <dt>Stage</dt><dd>{b.business_stage}</dd>
                  <dt>Employees</dt><dd>{b.employees || 'Not disclosed'}</dd>
                  <dt>Revenue</dt><dd>{b.revenue_range}</dd>
                  <dt>Years in business</dt><dd>{b.business_age ?? 'Not specified'}</dd>
                  <dt>Email</dt><dd>{b.email}</dd>
                  <dt>Phone</dt><dd>{b.phone}</dd>
                  <dt>Website</dt><dd>{b.website}</dd>
                </dl>
              </section>
              <section className="card">
                <h3>Reputation</h3>
                <div className="big-rating">{b.avg_rating ?? '-'}<small> / 5</small></div>
                <Stars value={b.avg_rating} />
                <p className="muted">{b.review_count} review{b.review_count === 1 ? '' : 's'}</p>
                <h3>Services delivered</h3>
                {servicesDelivered.length === 0 ? (
                  <p className="muted">No completed or active jobs yet.</p>
                ) : (
                  <ul className="plain">
                    {servicesDelivered.map((s) => (
                      <li key={s.service_name}>{s.service_name} <span className="muted">· {s.category} · {s.jobs} job{s.jobs > 1 ? 's' : ''}</span></li>
                    ))}
                  </ul>
                )}
                <h3>Open requests</h3>
                {openRequests.length === 0 ? (
                  <p className="muted">None right now.</p>
                ) : (
                  <ul className="plain">
                    {openRequests.map((r) => (
                      <li key={r.request_id}>{r.title} <span className="muted">· {money(r.budget_min)} - {money(r.budget_max)}</span></li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
            <h2>Reviews received</h2>
            {reviews.length === 0 ? (
              <div className="card"><div className="state">No reviews yet.</div></div>
            ) : (
              reviews.map((r) => (
                <div className="card review" key={r.review_id}>
                  <div><Stars value={r.rating} /> <span className="muted">· {r.service_name} · {r.reviewed_on}</span></div>
                  <p>{r.review_text}</p>
                  <div className="muted">by {r.reviewer_name}</div>
                </div>
              ))
            )}
          </>
        )}
      </Async>
    </>
  );
}
