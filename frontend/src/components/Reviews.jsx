import React from 'react';
import { useApi } from '../api.js';
import { Async, PageHeader, Stars } from './ui.jsx';

export default function Reviews({ onOpenBusiness }) {
  const result = useApi('/reviews');
  return (
    <>
      <PageHeader title="Reviews" subtitle="Feedback from businesses after completed work. Only buyers of a completed deal can leave a review." />
      <Async result={result} what="reviews" emptyText="No reviews have been written yet.">
        {(rows) => rows.map((r) => (
          <div className="card review" key={r.review_id}>
            <div className="proposal-head">
              <div>
                <button className="link strong" onClick={() => onOpenBusiness(r.reviewed_id)}>{r.reviewed_name}</button>
                <span className="muted"> · {r.service_name} · {r.reviewed_on}</span>
              </div>
              <Stars value={r.rating} />
            </div>
            <p>{r.review_text}</p>
            <div className="muted">
              Reviewed by {r.reviewer_name}
              {r.quality_rating && ` · Quality ${r.quality_rating}/5`}
              {r.timeliness_rating && ` · Timeliness ${r.timeliness_rating}/5`}
              {r.communication_rating && ` · Communication ${r.communication_rating}/5`}
            </div>
          </div>
        ))}
      </Async>
    </>
  );
}
