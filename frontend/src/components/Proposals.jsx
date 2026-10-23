import React, { useState } from 'react';
import { apiRequest, useApi } from '../api.js';
import { Async, Badge, PageHeader, Tabs, money } from './ui.jsx';

// Accept / Reject (for the buyer) or Withdraw (for the provider). Used here and inside the request details.
export function ProposalActions({ proposalId, mode, onDone }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const change = async (status) => {
    if (status === 'Accepted' && !window.confirm('Accept this proposal? All other proposals for this request will be declined and a deal will be recorded.')) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest('PATCH', `/proposals/${proposalId}/status`, { status });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="actions">
      {mode === 'buyer' ? (
        <>
          <button className="btn small" disabled={busy} onClick={() => change('Accepted')}>Accept</button>
          <button className="btn ghost small" disabled={busy} onClick={() => change('Rejected')}>Reject</button>
        </>
      ) : (
        <button className="btn ghost small" disabled={busy} onClick={() => change('Withdrawn')}>Withdraw</button>
      )}
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}

export default function Proposals({ onOpenBusiness }) {
  const [scope, setScope] = useState('received');
  const result = useApi(`/proposals?scope=${scope}`);
  const received = scope === 'received';

  return (
    <>
      <PageHeader title="Proposals" subtitle="Offers made on your requests, and offers you have sent to other businesses." />
      <div className="toolbar">
        <Tabs tabs={[{ id: 'received', label: 'Received' }, { id: 'sent', label: 'Sent' }]} value={scope} onChange={setScope} />
      </div>
      <Async
        result={result}
        what="proposals"
        emptyText={received ? 'No one has sent a proposal on your requests yet.' : 'You have not sent any proposals yet. Open a request to make an offer.'}
      >
        {(rows) => rows.map((p) => (
          <div className="card proposal" key={p.proposal_id}>
            <div className="proposal-head">
              <div>
                <strong>{p.request_title}</strong> <span className="muted">· {p.service_name}</span>
                <div className="muted">
                  {received ? 'From ' : 'To '}
                  <button className="link" onClick={() => onOpenBusiness(received ? p.provider_id : p.buyer_id)}>
                    {received ? p.provider_name : p.buyer_name}
                  </button>
                  {' · '}{p.submitted_on}
                </div>
              </div>
              <Badge status={p.status} />
            </div>
            <div className="proposal-facts">
              <span><b>{money(p.proposed_price)}</b> offered</span>
              <span>Budget {money(p.budget_min)} - {money(p.budget_max)} <em className={`fit ${p.budget_fit === 'Within budget' ? 'good' : ''}`}>{p.budget_fit}</em></span>
              <span>{p.estimated_delivery_duration} day delivery</span>
              <span>Quantity {p.quantity}</span>
            </div>
            {p.message && <p className="quote">{p.message}</p>}
            {p.status === 'Submitted' && p.request_status === 'Open' && (
              <ProposalActions proposalId={p.proposal_id} mode={received ? 'buyer' : 'provider'} onDone={result.reload} />
            )}
          </div>
        ))}
      </Async>
    </>
  );
}
