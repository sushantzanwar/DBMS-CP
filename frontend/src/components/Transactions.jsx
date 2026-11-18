import React, { useState } from 'react';
import { apiRequest, useApi } from '../api.js';
import { Async, Badge, Field, Modal, PageHeader, money, useForm } from './ui.jsx';

export default function Transactions() {
  const result = useApi('/transactions');
  const [reviewing, setReviewing] = useState(null);
  const [error, setError] = useState('');

  const complete = async (id) => {
    if (
      !window.confirm(
        'Confirm that this work has been completed? This updates the deal record only; no payment is processed through ServicePath.'
      )
    ) {
      return;
    }
    setError('');
    try {
      await apiRequest('PATCH', `/transactions/${id}/complete`);
      result.reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Transactions"
        subtitle="Ledger of agreed contracts as buyer and as seller. ServicePath records deal progress and payment status only; payments settle directly between parties."
      />

      {error && <div className="form-error" role="alert">{error}</div>}

      <Async
        result={result}
        what="transactions"
        emptyText="No contracts recorded yet. A transaction is created when a buyer accepts a proposal."
      >
        {(rows) => (
          <div className="sheet">
            <div className="table-wrap">
              <table className="table-responsive">
                <thead>
                  <tr>
                    <th>Contract &amp; service</th>
                    <th>Role</th>
                    <th>Counterparty</th>
                    <th className="num">Agreed price</th>
                    <th>Timeline</th>
                    <th>Work status</th>
                    <th>Payment record</th>
                    <th className="col-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const counterparty = t.my_role === 'Buying' ? t.seller_name : t.buyer_name;
                    return (
                      <tr key={t.transaction_id}>
                        <td data-label="Contract">
                          <strong>{t.request_title}</strong>
                          <div className="muted small-text">{t.service_name}</div>
                        </td>
                        <td data-label="Your role">{t.my_role}</td>
                        <td data-label={t.my_role === 'Buying' ? 'Seller' : 'Buyer'}>
                          {counterparty}
                        </td>
                        <td data-label="Agreed price" className="num">
                          <strong>{money(t.agreed_price)}</strong>
                        </td>
                        <td data-label="Timeline">
                          <div className="small-text">
                            Started: {t.started_on || '—'}
                          </div>
                          <div className="muted small-text">
                            Completed: {t.completed_on || '—'}
                          </div>
                        </td>
                        <td data-label="Work status">
                          <Badge status={t.status} />
                        </td>
                        <td data-label="Payment record">
                          <Badge status={t.payment_status} />
                        </td>
                        <td className="col-action">
                          {t.my_role === 'Buying' && t.status === 'Active' ? (
                            <button
                              type="button"
                              className="btn small"
                              onClick={() => complete(t.transaction_id)}
                            >
                              Mark completed
                            </button>
                          ) : t.my_role === 'Buying' && t.status === 'Completed' && !t.reviewed ? (
                            <button
                              type="button"
                              className="btn small"
                              onClick={() => setReviewing(t)}
                            >
                              Write review
                            </button>
                          ) : t.reviewed ? (
                            <span className="muted small-text">Review submitted</span>
                          ) : (
                            <span className="muted small-text">No action needed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Async>

      {reviewing && (
        <ReviewForm
          deal={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null);
            result.reload();
          }}
        />
      )}
    </div>
  );
}

function RatingSelect({ name, value, onChange, optional }) {
  return (
    <select name={name} value={value} onChange={onChange} required={!optional}>
      {optional && <option value="">Not specified</option>}
      {!optional && <option value="">Select rating…</option>}
      {[5, 4, 3, 2, 1].map((n) => (
        <option key={n} value={n}>
          {n} — {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][n]}
        </option>
      ))}
    </select>
  );
}

function ReviewForm({ deal, onClose, onDone }) {
  const form = useForm(
    { rating: '', qualityRating: '', timelinessRating: '', communicationRating: '', reviewText: '' },
    async (values) => {
      await apiRequest('POST', '/reviews', { transactionId: deal.transaction_id, ...values });
      onDone();
    }
  );

  return (
    <Modal title={`Review ${deal.seller_name}`} onClose={onClose}>
      <form onSubmit={form.onSubmit} className="stack">
        <p className="muted small-text">
          {deal.request_title} · {deal.service_name}
        </p>
        <Field label="Overall rating">
          <RatingSelect name="rating" value={form.values.rating} onChange={form.set('rating')} />
        </Field>
        <div className="three-col">
          <Field label="Quality" optional>
            <RatingSelect
              name="qualityRating"
              optional
              value={form.values.qualityRating}
              onChange={form.set('qualityRating')}
            />
          </Field>
          <Field label="Timeliness" optional>
            <RatingSelect
              name="timelinessRating"
              optional
              value={form.values.timelinessRating}
              onChange={form.set('timelinessRating')}
            />
          </Field>
          <Field label="Communication" optional>
            <RatingSelect
              name="communicationRating"
              optional
              value={form.values.communicationRating}
              onChange={form.set('communicationRating')}
            />
          </Field>
        </div>
        <Field label="Written feedback" optional>
          <textarea
            name="reviewText"
            rows="3"
            maxLength={2000}
            placeholder="Share specifics about delivery quality and responsiveness…"
            value={form.values.reviewText}
            onChange={form.set('reviewText')}
          />
        </Field>
        {form.error && <div className="form-error" role="alert">{form.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={form.busy}>
            {form.busy ? 'Submitting…' : 'Submit review'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
