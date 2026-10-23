import React, { useState } from 'react';
import { apiRequest, useApi } from '../api.js';
import { Async, Badge, Field, Modal, PageHeader, Tabs, money, useForm } from './ui.jsx';
import { ProposalActions } from './Proposals.jsx';

export default function Requests({ user, onOpenBusiness }) {
  const [scope, setScope] = useState('open');
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const result = useApi(`/requests?scope=${scope}`);

  return (
    <>
      <PageHeader
        title="Requests"
        subtitle="Find work to bid on, or post what your business needs."
        action={<button className="btn" onClick={() => setCreating(true)}>+ New request</button>}
      />
      <div className="toolbar">
        <Tabs
          tabs={[{ id: 'open', label: 'Open requests from others' }, { id: 'mine', label: 'My requests' }]}
          value={scope}
          onChange={setScope}
        />
      </div>
      <Async
        result={result}
        what="requests"
        emptyText={scope === 'mine' ? 'You have not posted any requests yet.' : 'There are no open requests from other businesses right now.'}
      >
        {(rows) => (
          <div className="card">
            <div className="table-wrap">
              <table className="clickable-rows">
                <thead>
                  <tr><th>Request</th><th>Service</th><th>Posted by</th><th>Budget</th><th>Needed by</th><th>Proposals</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.request_id} onClick={() => setOpenId(r.request_id)}>
                      <td><strong>{r.title}</strong></td>
                      <td>{r.service_name}</td>
                      <td>{r.buyer_name}</td>
                      <td>{money(r.budget_min)} - {money(r.budget_max)}</td>
                      <td>{r.required_by || 'Flexible'}</td>
                      <td>{r.proposal_count}</td>
                      <td><Badge status={r.status} /></td>
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
          onCreated={() => { setCreating(false); setScope('mine'); result.reload(); }}
        />
      )}
      {openId && (
        <RequestDetail
          id={openId}
          user={user}
          onClose={() => setOpenId(null)}
          onChanged={result.reload}
          onOpenBusiness={(id) => { setOpenId(null); onOpenBusiness(id); }}
        />
      )}
    </>
  );
}

function NewRequest({ onClose, onCreated }) {
  const services = useApi('/services?filter=all');
  const form = useForm(
    { serviceId: '', title: '', description: '', quantityRequired: 1, budgetMin: '', budgetMax: '', requiredBy: '', locationPreference: '' },
    async (values) => {
      await apiRequest('POST', '/requests', values);
      onCreated();
    }
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal title="Post a new request" onClose={onClose}>
      <form onSubmit={form.onSubmit} className="stack">
        <Field label="Service needed">
          <select required value={form.values.serviceId} onChange={form.set('serviceId')}>
            <option value="">{services.loading ? 'Loading services…' : 'Choose a service'}</option>
            {(services.data || []).map((s) => <option key={s.service_id} value={s.service_id}>{s.service_name}</option>)}
          </select>
        </Field>
        <Field label="Title"><input required maxLength={150} value={form.values.title} onChange={form.set('title')} /></Field>
        <Field label="Describe what you need">
          <textarea required rows="3" maxLength={2000} value={form.values.description} onChange={form.set('description')} />
        </Field>
        <div className="two-col">
          <Field label="Minimum budget (₹)"><input required type="number" min="0" value={form.values.budgetMin} onChange={form.set('budgetMin')} /></Field>
          <Field label="Maximum budget (₹)"><input required type="number" min="0" value={form.values.budgetMax} onChange={form.set('budgetMax')} /></Field>
        </div>
        <div className="two-col">
          <Field label="Quantity"><input required type="number" min="1" value={form.values.quantityRequired} onChange={form.set('quantityRequired')} /></Field>
          <Field label="Needed by (optional)"><input type="date" min={today} value={form.values.requiredBy} onChange={form.set('requiredBy')} /></Field>
        </div>
        <Field label="Location preference (optional)">
          <input maxLength={100} value={form.values.locationPreference} onChange={form.set('locationPreference')} />
        </Field>
        {form.error && <div className="form-error">{form.error}</div>}
        <button className="btn" disabled={form.busy}>{form.busy ? 'Posting…' : 'Post request'}</button>
      </form>
    </Modal>
  );
}

function RequestDetail({ id, user, onClose, onChanged, onOpenBusiness }) {
  const result = useApi(`/requests/${id}`);
  const refresh = () => { result.reload(); onChanged(); };

  return (
    <Modal title="Request details" onClose={onClose}>
      <Async result={result} what="request" isEmpty={() => false}>
        {({ request: r, proposals }) => {
          const isOwner = r.buyer_id === user.businessId;
          const alreadyBid = proposals.some((p) => p.provider_id === user.businessId);
          return (
            <div className="stack">
              <div className="proposal-head">
                <h3>{r.title}</h3>
                <Badge status={r.status} />
              </div>
              <p>{r.description}</p>
              <dl className="facts">
                <dt>Service</dt><dd>{r.service_name} ({r.category})</dd>
                <dt>Posted by</dt><dd><button className="link" onClick={() => onOpenBusiness(r.buyer_id)}>{r.buyer_name}</button> · {r.buyer_city}</dd>
                <dt>Budget</dt><dd>{money(r.budget_min)} - {money(r.budget_max)}</dd>
                <dt>Quantity</dt><dd>{r.quantity_required}</dd>
                <dt>Needed by</dt><dd>{r.required_by || 'Flexible'}</dd>
                <dt>Location</dt><dd>{r.location_preference}</dd>
                <dt>Posted</dt><dd>{r.posted_on}</dd>
              </dl>

              {isOwner && ['Open', 'Cancelled'].includes(r.status) && (
                <StatusToggle request={r} onDone={refresh} />
              )}

              <h4>{isOwner ? `Proposals received (${proposals.length})` : 'Your proposal'}</h4>
              {proposals.length === 0 && <div className="muted">{isOwner ? 'No proposals yet.' : 'You have not sent a proposal for this request.'}</div>}
              {proposals.map((p) => (
                <div className="card proposal" key={p.proposal_id}>
                  <div className="proposal-head">
                    <div>
                      {isOwner ? <button className="link" onClick={() => onOpenBusiness(p.provider_id)}>{p.provider_name}</button> : 'Your offer'}
                      <span className="muted"> · {p.submitted_on}</span>
                    </div>
                    <Badge status={p.status} />
                  </div>
                  <div className="proposal-facts">
                    <span><b>{money(p.proposed_price)}</b></span>
                    <span>{p.estimated_delivery_duration} day delivery</span>
                    <span>Quantity {p.quantity}</span>
                  </div>
                  {p.message && <p className="quote">{p.message}</p>}
                  {p.status === 'Submitted' && r.status === 'Open' && (
                    <ProposalActions proposalId={p.proposal_id} mode={isOwner ? 'buyer' : 'provider'} onDone={refresh} />
                  )}
                </div>
              ))}

              {!isOwner && r.status === 'Open' && !alreadyBid && <ProposalForm requestId={r.request_id} onDone={refresh} />}
            </div>
          );
        }}
      </Async>
    </Modal>
  );
}

function StatusToggle({ request, onDone }) {
  const [error, setError] = useState('');
  const next = request.status === 'Open' ? 'Cancelled' : 'Open';
  const change = async () => {
    setError('');
    try {
      await apiRequest('PATCH', `/requests/${request.request_id}/status`, { status: next });
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div>
      <button className="btn ghost small" onClick={change}>{next === 'Cancelled' ? 'Cancel this request' : 'Re-open this request'}</button>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}

function ProposalForm({ requestId, onDone }) {
  const form = useForm({ proposedPrice: '', quantity: 1, estimatedDeliveryDuration: '', message: '' }, async (values) => {
    await apiRequest('POST', '/proposals', { requestId, ...values });
    onDone();
  });
  return (
    <form onSubmit={form.onSubmit} className="stack card">
      <h4>Send a proposal</h4>
      <div className="two-col">
        <Field label="Your price (₹)"><input required type="number" min="0" value={form.values.proposedPrice} onChange={form.set('proposedPrice')} /></Field>
        <Field label="Delivery time (days)"><input required type="number" min="1" value={form.values.estimatedDeliveryDuration} onChange={form.set('estimatedDeliveryDuration')} /></Field>
      </div>
      <Field label="Quantity"><input required type="number" min="1" value={form.values.quantity} onChange={form.set('quantity')} /></Field>
      <Field label="Message to the buyer (optional)">
        <textarea rows="3" maxLength={2000} value={form.values.message} onChange={form.set('message')} />
      </Field>
      {form.error && <div className="form-error">{form.error}</div>}
      <button className="btn" disabled={form.busy}>{form.busy ? 'Sending…' : 'Send proposal'}</button>
    </form>
  );
}
