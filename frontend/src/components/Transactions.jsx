import React, { useState } from 'react';
import { apiRequest, useApi } from '../api.js';
import { Async, Badge, Field, Modal, PageHeader, money, useForm } from './ui.jsx';

export default function Transactions() {
  const result = useApi('/transactions');
  const [reviewing, setReviewing] = useState(null);
  const [error, setError] = useState('');

  const complete = async (id) => {
    if (!window.confirm('Confirm that this work has been completed? This updates the records only. No payment is processed.')) return;
    setError('');
    try {
      await apiRequest('PATCH', `/transactions/${id}/complete`);
      result.reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Your deals, as buyer and as seller. These are records of agreed work; ServicePath does not process payments."
      />
      {error && <div className="form-error">{error}</div>}
      <Async result={result} what="transactions" emptyText="You have no deals yet. A deal is created when a proposal is accepted.">
        {(rows) => (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Deal</th><th>You are</th><th>Buyer</th><th>Seller</th><th>Agreed price</th><th>Started</th><th>Completed</th><th>Status</th><th>Payment record</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.transaction_id}>
                      <td><strong>{t.request_title}</strong><div className="muted">{t.service_name}</div></td>
                      <td>{t.my_role}</td>
                      <td>{t.buyer_name}</td>
                      <td>{t.seller_name}</td>
                      <td>{money(t.agreed_price)}</td>
                      <td>{t.started_on || '-'}</td>
                      <td>{t.completed_on || '-'}</td>
                      <td><Badge status={t.status} /></td>
                      <td><Badge status={t.payment_status} /></td>
                      <td>
                        {t.my_role === 'Buying' && t.status === 'Active' && (
                          <button className="btn small" onClick={() => complete(t.transaction_id)}>Mark completed</button>
                        )}
                        {t.my_role === 'Buying' && t.status === 'Completed' && !t.reviewed && (
                          <button className="btn small" onClick={() => setReviewing(t)}>Write review</button>
                        )}
                        {t.reviewed ? <span className="muted">Reviewed</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Async>
      {reviewing && <ReviewForm deal={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); result.reload(); }} />}
    </>
  );
}

function RatingSelect({ value, onChange, optional }) {
  return (
    <select value={value} onChange={onChange} required={!optional}>
      {optional && <option value="">No rating</option>}
      {!optional && <option value="">Select</option>}
      {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} - {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][n]}</option>)}
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
        <p className="muted">{deal.request_title} · {deal.service_name}</p>
        <Field label="Overall rating"><RatingSelect value={form.values.rating} onChange={form.set('rating')} /></Field>
        <div className="three-col">
          <Field label="Quality"><RatingSelect optional value={form.values.qualityRating} onChange={form.set('qualityRating')} /></Field>
          <Field label="Timeliness"><RatingSelect optional value={form.values.timelinessRating} onChange={form.set('timelinessRating')} /></Field>
          <Field label="Communication"><RatingSelect optional value={form.values.communicationRating} onChange={form.set('communicationRating')} /></Field>
        </div>
        <Field label="Your feedback (optional)">
          <textarea rows="3" maxLength={2000} value={form.values.reviewText} onChange={form.set('reviewText')} />
        </Field>
        {form.error && <div className="form-error">{form.error}</div>}
        <button className="btn" disabled={form.busy}>{form.busy ? 'Submitting…' : 'Submit review'}</button>
      </form>
    </Modal>
  );
}
