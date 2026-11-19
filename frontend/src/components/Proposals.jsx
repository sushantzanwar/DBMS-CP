import React, { useState } from 'react';
import { apiRequest, useApi } from '../api.js';
import { Async, Badge, PageHeader, Tabs, money } from './ui.jsx';

export function ProposalActions({ proposalId, mode, onDone }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const change = async (status) => {
    if (
      status === 'Accepted' &&
      !window.confirm(
        'Accept this proposal? Other pending proposals for this request will be declined and a contract record will be created.'
      )
    ) {
      return;
    }
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
          <button type="button" className="btn small" disabled={busy} onClick={() => change('Accepted')}>
            {busy ? 'Saving…' : 'Accept proposal'}
          </button>
          <button type="button" className="btn ghost small" disabled={busy} onClick={() => change('Rejected')}>
            Decline
          </button>
        </>
      ) : (
        <button type="button" className="btn ghost small" disabled={busy} onClick={() => change('Withdrawn')}>
          {busy ? 'Withdrawing…' : 'Withdraw proposal'}
        </button>
      )}
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  );
}

export default function Proposals({ onOpenBusiness }) {
  const [scope, setScope] = useState('received');
  const result = useApi(`/proposals?scope=${scope}`);
  const received = scope === 'received';

  return (
    <div className="page">
      <PageHeader
        title="Proposals"
        subtitle={
          received
            ? 'Bids received from providers on your open service requests.'
            : 'Quotes your business has submitted to other buyers.'
        }
      />

      <div className="toolbar">
        <Tabs
          label="Proposal inbox"
          tabs={[
            { id: 'received', label: 'Received on my requests' },
            { id: 'sent', label: 'Sent by my business' },
          ]}
          value={scope}
          onChange={setScope}
        />
      </div>

      <Async
        result={result}
        what="proposals"
        emptyText={
          received
            ? 'No proposals received on your requests yet.'
            : 'You have not sent any proposals yet. Open a request under Requests to submit a bid.'
        }
      >
        {(rows) => (
          <div className="sheet proposal-ledger">
            {rows.map((p) => (
              <article className="ledger-entry" key={p.proposal_id}>
                <div className="proposal-head">
                  <div>
                    <div className="proposal-title-row">
                      <strong>{p.request_title}</strong>
                      <span className="muted"> · {p.service_name}</span>
                    </div>
                    <div className="muted small-text">
                      {received ? 'Offer from ' : 'Quoted to '}
                      <button
                        type="button"
                        className="link"
                        onClick={() => onOpenBusiness(received ? p.provider_id : p.buyer_id)}
                      >
                        {received ? p.provider_name : p.buyer_name}
                      </button>
                      {' · Submitted '}
                      {p.submitted_on}
                    </div>
                  </div>
                  <Badge status={p.status} />
                </div>

                <dl className="proposal-metrics">
                  <div>
                    <dt>Quoted price</dt>
                    <dd className="tabular"><strong>{money(p.proposed_price)}</strong></dd>
                  </div>
                  <div>
                    <dt>Target budget</dt>
                    <dd className="tabular">
                      {money(p.budget_min)} – {money(p.budget_max)}{' '}
                      <span className={`fit ${p.budget_fit === 'Within budget' ? 'good' : ''}`}>
                        ({p.budget_fit})
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Delivery estimate</dt>
                    <dd className="tabular">{p.estimated_delivery_duration} days</dd>
                  </div>
                  <div>
                    <dt>Quantity</dt>
                    <dd className="tabular">{p.quantity}</dd>
                  </div>
                </dl>

                {p.message && <p className="quote">{p.message}</p>}

                {p.status === 'Submitted' && p.request_status === 'Open' && (
                  <ProposalActions
                    proposalId={p.proposal_id}
                    mode={received ? 'buyer' : 'provider'}
                    onDone={result.reload}
                  />
                )}
              </article>
            ))}
          </div>
        )}
      </Async>
    </div>
  );
}
