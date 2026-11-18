import React from 'react';
import { useApi } from '../api.js';
import { Async, PageHeader, Stars } from './ui.jsx';

export default function Reviews({ onOpenBusiness }) {
  const result = useApi('/reviews');

  return (
    <div className="page">
      <PageHeader
        title="Reviews"
        subtitle="Verified feedback published by buyers after marking a transaction completed."
      />

      <Async
        result={result}
        what="reviews"
        emptyText="No completed-deal reviews have been published yet. Buyers can write a review once a transaction is marked completed."
      >
        {(rows) => (
          <div className="sheet proposal-ledger">
            {rows.map((r) => {
              const subScores = [
                ['Quality', r.quality_rating],
                ['Timeliness', r.timeliness_rating],
                ['Communication', r.communication_rating],
              ].filter(([, val]) => val !== null && val !== undefined);

              return (
                <article className="ledger-entry review" key={r.review_id}>
                  <div className="proposal-head">
                    <div>
                      <button
                        type="button"
                        className="link strong"
                        onClick={() => onOpenBusiness(r.reviewed_id)}
                      >
                        {r.reviewed_name}
                      </button>
                      <span className="muted small-text">
                        {' · '}
                        {r.service_name}
                        {' · '}
                        {r.reviewed_on}
                      </span>
                    </div>
                    <Stars value={r.rating} />
                  </div>

                  <p className="review-copy">{r.review_text}</p>

                  <div className="review-meta-row">
                    <span className="muted small-text">Reviewed by {r.reviewer_name}</span>
                    {subScores.length > 0 && (
                      <div className="subscores" aria-label="Detailed rating breakdown">
                        {subScores.map(([label, score]) => (
                          <span key={label} className="subscore-item">
                            <span className="muted">{label}</span>{' '}
                            <strong className="tabular">{score}/5</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Async>
    </div>
  );
}
