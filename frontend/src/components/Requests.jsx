import React, { useMemo, useState } from 'react';
import { apiRequest, useApi } from '../api.js';
import { Async, Badge, Field, Icon, Modal, PageHeader, Stars, Tabs, money, useForm } from './ui.jsx';
import { MatchTag, WhyRecommended } from './insights.jsx';
import { ProposalActions } from './Proposals.jsx';

const SCOPE_TABS = [
  { id: 'open', label: 'Open from others' },
  { id: 'unbid', label: 'Unbid' },
  { id: 'unanswered', label: 'Unanswered' },
  { id: 'my-bids', label: 'My bids' },
  { id: 'above-average-budget', label: 'Above-avg budget' },
  { id: 'mine', label: 'My requests' },
  { id: 'all', label: 'All requests' },
];

const EMPTY_FILTERS = {
  keyword: '',
  category: '',
  city: '',
  minBudget: '',
  maxBudget: '',
  maxDaysLeft: '',
};

const EMPTY_COPY = {
  open: 'There are no open requests from other businesses right now.',
  unbid: 'You have already submitted proposals on all open requests from other businesses.',
  unanswered: 'Every open request from other businesses currently has at least one proposal.',
  'my-bids': 'You have not submitted proposals on any requests yet.',
  'above-average-budget': 'No open requests exceed the current average maximum budget.',
  mine: 'You have not posted any requests yet. Create a request to collect proposals from providers.',
  all: 'No requests found in the marketplace.',
};

export default function Requests({ user, onOpenBusiness }) {
  const [scope, setScope] = useState('open');
  const [serviceId, setServiceId] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedSearch, setAppliedSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);

  const services = useApi('/services?filter=all');
  const serviceList = services.data || [];
  const categories = useMemo(
    () => [...new Set(serviceList.map((s) => s.category).filter(Boolean))].sort(),
    [serviceList]
  );
  const activeService = useMemo(
    () => serviceList.find((s) => String(s.service_id) === String(serviceId)) || null,
    [serviceList, serviceId]
  );

  const apiPath = appliedSearch
    ? `/requests/search?${appliedSearch}`
    : serviceId
      ? `/services/${serviceId}/requests`
      : scope === 'unanswered'
        ? '/requests/unanswered'
        : `/requests?scope=${scope}`;

  const result = useApi(apiPath);

  const handleScopeChange = (nextScope) => {
    setScope(nextScope);
    setServiceId('');
    setAppliedSearch('');
  };

  const handleServiceChange = (e) => {
    setServiceId(e.target.value);
    setAppliedSearch('');
  };

  const setFilter = (key) => (e) => {
    const val = e.target.value;
    setFilters((prev) => ({ ...prev, [key]: val }));
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      const trimmed = String(value).trim();
      if (trimmed !== '') params.set(key, trimmed);
    });
    const qs = params.toString();
    setServiceId('');
    setAppliedSearch(qs);
  };

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedSearch('');
  };

  const activeModeLabel = appliedSearch
    ? 'Showing open requests matching your search filters'
    : activeService
      ? `Showing open requests for ${activeService.service_name}`
      : null;

  const emptyText = appliedSearch
    ? 'No open requests match your search filters. Try widening the budget, city, or timeline.'
    : activeService
      ? `No open requests are currently posted for ${activeService.service_name}.`
      : EMPTY_COPY[scope] || 'No requests found.';

  return (
    <div className="page">
      <PageHeader
        title="Requests"
        subtitle="Compare open work to bid on, filter by service or budget, or manage your briefs."
        action={
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            <Icon name="plus" size={15} />
            <span>New request</span>
          </button>
        }
      />

      <div className="requests-controls">
        <div className="toolbar">
          <Tabs
            label="Request scope"
            tabs={SCOPE_TABS}
            value={appliedSearch || serviceId ? null : scope}
            onChange={handleScopeChange}
          />
          <div className="toolbar-right">
            <label className="inline-filter" htmlFor="req-service-filter">
              <span className="muted small-text">Service</span>
              <select
                id="req-service-filter"
                value={serviceId}
                onChange={handleServiceChange}
                aria-label="Browse requests by service"
              >
                <option value="">All services</option>
                {serviceList.map((s) => (
                  <option key={s.service_id} value={String(s.service_id)}>
                    {s.service_name} ({s.category})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={`btn ghost small${searchOpen || appliedSearch ? ' is-active' : ''}`}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((v) => !v)}
            >
              Search &amp; filters
            </button>
          </div>
        </div>

        {searchOpen && (
          <form className="sheet filter-panel" onSubmit={handleSearchSubmit}>
            <div className="filter-grid">
              <Field label="Keyword">
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Title, description or service…"
                  value={filters.keyword}
                  onChange={setFilter('keyword')}
                />
              </Field>
              <Field label="Category">
                <select value={filters.category} onChange={setFilter('category')}>
                  <option value="">All categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="City">
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="City or location…"
                  value={filters.city}
                  onChange={setFilter('city')}
                />
              </Field>
              <Field label="Min budget (₹)">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="Min amount…"
                  value={filters.minBudget}
                  onChange={setFilter('minBudget')}
                />
              </Field>
              <Field label="Max budget (₹)">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="Max amount…"
                  value={filters.maxBudget}
                  onChange={setFilter('maxBudget')}
                />
              </Field>
              <Field label="Max days left">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="Deadline within…"
                  value={filters.maxDaysLeft}
                  onChange={setFilter('maxDaysLeft')}
                />
              </Field>
            </div>
            <div className="filter-actions">
              <button type="submit" className="btn small">
                Apply filters
              </button>
              <button type="button" className="btn ghost small" onClick={handleClearFilters}>
                Clear filters
              </button>
            </div>
          </form>
        )}

        {activeModeLabel && (
          <div className="active-filter-bar">
            <span className="small-text">{activeModeLabel}</span>
            <button
              type="button"
              className="link small-text"
              onClick={() => {
                setServiceId('');
                setAppliedSearch('');
              }}
            >
              Back to tab view
            </button>
          </div>
        )}
      </div>

      <Async result={result} what="requests" emptyText={emptyText}>
        {(rows) => (
          <div className="sheet">
            <div className="table-wrap">
              <table className="table-responsive clickable-rows">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Service</th>
                    <th>Posted by</th>
                    <th className="num">Budget range</th>
                    <th>Timeline</th>
                    <th className="num">Proposals</th>
                    <th>Status</th>
                    <th className="col-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.request_id} onClick={() => setOpenId(r.request_id)}>
                      <td data-label="Request">
                        <strong>{r.title}</strong>
                        {r.location_preference && (
                          <div className="muted small-text">{r.location_preference}</div>
                        )}
                      </td>
                      <td data-label="Service">{r.service_name || activeService?.service_name || '—'}</td>
                      <td data-label="Posted by">
                        <div>
                          <div>{r.buyer_name}</div>
                          {r.buyer_city && <div className="muted small-text">{r.buyer_city}</div>}
                        </div>
                      </td>
                      <td data-label="Budget" className="num">
                        {money(r.budget_min)} – {money(r.budget_max)}
                      </td>
                      <td data-label="Timeline">
                        <div>
                          <div>{r.required_by || 'Flexible'}</div>
                          <div className="muted small-text">
                            Posted {r.posted_on || '—'}
                            {r.days_left != null && r.status === 'Open'
                              ? r.days_left >= 0
                                ? ` · ${r.days_left}d left`
                                : ' · Past target date'
                              : ''}
                          </div>
                        </div>
                      </td>
                      <td data-label="Proposals" className="num">{r.proposal_count ?? 0}</td>
                      <td data-label="Status">
                        <Badge status={r.status} />
                      </td>
                      <td className="col-action">
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenId(r.request_id);
                          }}
                        >
                          {r.buyer_id === user.businessId ? 'Manage' : 'Details'}
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

      {creating && (
        <NewRequest
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            setServiceId('');
            setAppliedSearch('');
            setScope('mine');
            result.reload();
          }}
        />
      )}

      {openId && (
        <RequestDetail
          id={openId}
          user={user}
          onClose={() => setOpenId(null)}
          onChanged={result.reload}
          onOpenBusiness={(id) => {
            setOpenId(null);
            onOpenBusiness(id);
          }}
        />
      )}
    </div>
  );
}

function NewRequest({ onClose, onCreated }) {
  const services = useApi('/services?filter=all');
  const form = useForm(
    {
      serviceId: '',
      title: '',
      description: '',
      quantityRequired: 1,
      budgetMin: '',
      budgetMax: '',
      requiredBy: '',
      locationPreference: '',
    },
    async (values) => {
      await apiRequest('POST', '/requests', values);
      onCreated();
    }
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal title="Post a new request" onClose={onClose}>
      <form onSubmit={form.onSubmit} className="stack">
        <fieldset className="form-group">
          <legend>Service scope</legend>
          <div className="stack-sm">
            <Field label="Service needed">
              <select name="serviceId" required value={form.values.serviceId} onChange={form.set('serviceId')}>
                <option value="">{services.loading ? 'Loading services…' : 'Choose a service…'}</option>
                {(services.data || []).map((s) => (
                  <option key={s.service_id} value={s.service_id}>
                    {s.service_name} ({s.category})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Request title">
              <input
                name="title"
                required
                maxLength={150}
                placeholder="e.g. Company website redesign…"
                value={form.values.title}
                onChange={form.set('title')}
              />
            </Field>
            <Field label="Scope & deliverables">
              <textarea
                name="description"
                required
                rows="3"
                maxLength={2000}
                placeholder="Describe expected deliverables, timeline constraints or tools…"
                value={form.values.description}
                onChange={form.set('description')}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="form-group">
          <legend>Budget &amp; volume</legend>
          <div className="three-col">
            <Field label="Min budget (₹)">
              <input
                name="budgetMin"
                required
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="20000…"
                value={form.values.budgetMin}
                onChange={form.set('budgetMin')}
              />
            </Field>
            <Field label="Max budget (₹)">
              <input
                name="budgetMax"
                required
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="50000…"
                value={form.values.budgetMax}
                onChange={form.set('budgetMax')}
              />
            </Field>
            <Field label="Quantity">
              <input
                name="quantityRequired"
                required
                type="number"
                inputMode="numeric"
                min="1"
                value={form.values.quantityRequired}
                onChange={form.set('quantityRequired')}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="form-group">
          <legend>Schedule &amp; location</legend>
          <div className="two-col">
            <Field label="Needed by" optional>
              <input name="requiredBy" type="date" min={today} value={form.values.requiredBy} onChange={form.set('requiredBy')} />
            </Field>
            <Field label="Location preference" optional>
              <input
                name="locationPreference"
                maxLength={100}
                placeholder="e.g. Pune or Remote…"
                value={form.values.locationPreference}
                onChange={form.set('locationPreference')}
              />
            </Field>
          </div>
        </fieldset>

        {form.error && <div className="form-error" role="alert">{form.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={form.busy}>
            {form.busy ? 'Posting…' : 'Post request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RequestDetail({ id, user, onClose, onChanged, onOpenBusiness }) {
  const result = useApi(`/requests/${id}`);
  const refresh = () => {
    result.reload();
    onChanged();
  };

  return (
    <Modal title="Request details" onClose={onClose}>
      <Async result={result} what="request" isEmpty={() => false}>
        {({ request: r, proposals }) => {
          const isOwner = r.buyer_id === user.businessId;
          const alreadyBid = proposals.some((p) => p.provider_id === user.businessId);
          return (
            <div className="stack">
              {/* Brief & Terms */}
              <section className="detail-group">
                <div className="proposal-head">
                  <div>
                    <h3 className="detail-title">{r.title}</h3>
                    <div className="muted small-text">{r.service_name} · {r.category}</div>
                  </div>
                  <Badge status={r.status} />
                </div>
                <p className="detail-body">{r.description}</p>
                <dl className="facts facts-grid">
                  <div><dt>Posted by</dt><dd><button type="button" className="link" onClick={() => onOpenBusiness(r.buyer_id)}>{r.buyer_name}</button> · {r.buyer_city}</dd></div>
                  <div><dt>Budget</dt><dd className="tabular">{money(r.budget_min)} – {money(r.budget_max)}</dd></div>
                  <div><dt>Quantity</dt><dd className="tabular">{r.quantity_required}</dd></div>
                  <div><dt>Needed by</dt><dd>{r.required_by || 'Flexible'}</dd></div>
                  <div><dt>Location</dt><dd>{r.location_preference}</dd></div>
                  <div><dt>Posted</dt><dd>{r.posted_on}</dd></div>
                </dl>
                {isOwner && ['Open', 'Cancelled'].includes(r.status) && (
                  <div className="detail-footer">
                    <StatusToggle request={r} onDone={refresh} />
                  </div>
                )}
              </section>

              {/* Bids / Provider Proposal Form */}
              <section className="detail-group">
                <h4>{isOwner ? `Proposals received (${proposals.length})` : 'Your proposal'}</h4>
                {proposals.length === 0 && (
                  <p className="muted small-text">
                    {isOwner ? 'No proposals received for this request yet.' : 'You have not submitted a proposal for this request yet.'}
                  </p>
                )}
                {proposals.map((p) => (
                  <div className="inset-row proposal" key={p.proposal_id}>
                    <div className="proposal-head">
                      <div>
                        {isOwner ? (
                          <button type="button" className="link strong" onClick={() => onOpenBusiness(p.provider_id)}>
                            {p.provider_name}
                          </button>
                        ) : (
                          <strong>{p.provider_name || 'Your bid'}</strong>
                        )}
                        {p.provider_city && (
                          <span className="muted small-text"> · {p.provider_city}</span>
                        )}
                        <span className="muted small-text"> · {p.submitted_on}</span>
                      </div>
                      <Badge status={p.status} />
                    </div>
                    <div className="proposal-facts">
                      <span><strong>{money(p.proposed_price)}</strong></span>
                      <span>{p.estimated_delivery_duration} days delivery</span>
                      <span>Qty {p.quantity}</span>
                    </div>
                    {p.message && <p className="quote">{p.message}</p>}
                    {p.status === 'Submitted' && r.status === 'Open' && (
                      <ProposalActions proposalId={p.proposal_id} mode={isOwner ? 'buyer' : 'provider'} onDone={refresh} />
                    )}
                  </div>
                ))}

                {!isOwner && r.status === 'Open' && !alreadyBid && (
                  <ProposalForm requestId={r.request_id} onDone={refresh} />
                )}
              </section>

              {/* Suggested Providers (Buyer view) */}
              {isOwner && <SuggestedProviders requestId={r.request_id} onOpenBusiness={onOpenBusiness} />}
            </div>
          );
        }}
      </Async>
    </Modal>
  );
}

function StatusToggle({ request, onDone }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = request.status === 'Open' ? 'Cancelled' : 'Open';

  const change = async () => {
    setError('');
    setBusy(true);
    try {
      await apiRequest('PATCH', `/requests/${request.request_id}/status`, { status: next });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button type="button" className="btn ghost small" disabled={busy} onClick={change}>
        {busy ? 'Updating…' : next === 'Cancelled' ? 'Cancel request' : 'Re-open request'}
      </button>
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  );
}

function ProposalForm({ requestId, onDone }) {
  const form = useForm(
    { proposedPrice: '', quantity: 1, estimatedDeliveryDuration: '', message: '' },
    async (values) => {
      await apiRequest('POST', '/proposals', { requestId, ...values });
      onDone();
    }
  );

  return (
    <form onSubmit={form.onSubmit} className="stack-sm inset-form">
      <h4>Send a proposal</h4>
      <div className="three-col">
        <Field label="Your price (₹)">
          <input
            name="proposedPrice"
            required
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="45000…"
            value={form.values.proposedPrice}
            onChange={form.set('proposedPrice')}
          />
        </Field>
        <Field label="Delivery (days)">
          <input
            name="estimatedDeliveryDuration"
            required
            type="number"
            inputMode="numeric"
            min="1"
            placeholder="14…"
            value={form.values.estimatedDeliveryDuration}
            onChange={form.set('estimatedDeliveryDuration')}
          />
        </Field>
        <Field label="Quantity">
          <input
            name="quantity"
            required
            type="number"
            inputMode="numeric"
            min="1"
            value={form.values.quantity}
            onChange={form.set('quantity')}
          />
        </Field>
      </div>
      <Field label="Message to the buyer" optional>
        <textarea
          name="message"
          rows="2"
          maxLength={2000}
          placeholder="Outline your delivery approach or relevant experience…"
          value={form.values.message}
          onChange={form.set('message')}
        />
      </Field>
      {form.error && <div className="form-error" role="alert">{form.error}</div>}
      <button type="submit" className="btn" disabled={form.busy}>
        {form.busy ? 'Sending…' : 'Send proposal'}
      </button>
    </form>
  );
}

function SuggestedProviders({ requestId, onOpenBusiness }) {
  const recommendations = useApi(`/requests/${requestId}/recommendations`);

  return (
    <section className="detail-group">
      <div className="rec-section-head">
        <h4>Suggested providers</h4>
        <span className="muted small-text">Ranked by capability evidence, location, rating and track record</span>
      </div>
      <Async
        result={recommendations}
        what="suggested providers"
        emptyText="No eligible providers found for this request."
      >
        {(providers) => (
          <div className="rec-list">
            {providers.map((p, idx) => (
              <div key={p.business_id} className="inset-row rec-row">
                <div className="rec-head">
                  <div className="rec-title-group">
                    <span className="row-rank">#{idx + 1}</span>
                    <button type="button" className="link strong" onClick={() => onOpenBusiness(p.business_id)}>
                      {p.business_name}
                    </button>
                    <MatchTag provider={p} />
                    {p.has_already_bid ? <Badge status="Proposal received" tone="ok" /> : null}
                  </div>
                  <div className="rec-actions">
                    <span className="rec-score">{Math.round(Number(p.match_score))} / 100</span>
                    <button type="button" className="btn ghost small" onClick={() => onOpenBusiness(p.business_id)}>
                      Profile
                    </button>
                  </div>
                </div>
                <div className="rec-meta">
                  <span>{p.industry} · {p.city}, {p.state}</span>
                  <Stars value={p.avg_rating} />
                  {p.review_count > 0 && <span className="muted">({p.review_count})</span>}
                </div>
                <WhyRecommended provider={p} />
              </div>
            ))}
          </div>
        )}
      </Async>
    </section>
  );
}
