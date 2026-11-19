import React from 'react';
import { Disclosure, ScoreMeter } from './ui.jsx';

export function capabilityEvidence(score) {
  const s = Number(score);
  if (s >= 40) return { text: 'Completed this exact service on ServicePath before', level: 'strong' };
  if (s >= 30) return { text: 'Submitted bids on this service before (no completed contract yet)', level: 'moderate' };
  if (s >= 20) return { text: 'Industry matches the service category (no bid/deal history)', level: 'partial' };
  return { text: 'No direct service, bid or category capability evidence', level: 'weak' };
}

export function locationEvidence(score) {
  const s = Number(score);
  if (s >= 25) return 'Matches preferred city (or request location is flexible)';
  if (s >= 15) return 'Based in the same state as the buyer';
  return 'Based in a different region';
}

export function reputationEvidence(score, avgRating) {
  if (avgRating === null || avgRating === undefined) return 'Unrated on platform — neutral 10/20 baseline applied';
  return `Verified rating ${Number(avgRating).toFixed(1)} / 5`;
}

export function trackRecordEvidence(score) {
  const s = Number(score);
  if (s >= 15) return 'Two or more completed contracts on ServicePath';
  if (s >= 10) return 'One completed contract on ServicePath';
  return 'No completed contracts yet — estimated from company size';
}

export function matchStrength(provider) {
  const cap = capabilityEvidence(provider.capability_score);
  if (cap.level === 'strong') return { label: 'Proven match', tone: 'ok' };
  if (cap.level === 'moderate') return { label: 'Prior bidder', tone: 'open' };
  if (cap.level === 'partial') return { label: 'Category match', tone: 'warn' };
  return { label: 'Fallback match', tone: 'bad' };
}

export function MatchTag({ provider }) {
  const m = matchStrength(provider);
  return <span className={`badge badge-${m.tone}`}>{m.label}</span>;
}

export function WhyRecommended({ provider, label = 'Why recommended?' }) {
  const p = provider;
  return (
    <Disclosure label={label}>
      <div className="why-grid">
        <ScoreMeter label="Capability" value={p.capability_score} max={40} hint={capabilityEvidence(p.capability_score).text} />
        <ScoreMeter label="Location" value={p.location_score} max={25} hint={locationEvidence(p.location_score)} />
        <ScoreMeter label="Reputation" value={p.reputation_score} max={20} hint={reputationEvidence(p.reputation_score, p.avg_rating)} />
        <ScoreMeter label="Track record" value={p.track_record_score} max={15} hint={trackRecordEvidence(p.track_record_score)} />
      </div>
      {capabilityEvidence(p.capability_score).level === 'weak' && (
        <p className="why-warning">
          Fallback only: this business appears here because of location, rating, or company size — there is no record of them delivering this service. Verify capability directly before hiring.
        </p>
      )}
    </Disclosure>
  );
}
