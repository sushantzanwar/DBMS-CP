import React, { useEffect, useState } from 'react';
import { apiRequest, useApi } from '../api.js';
import { DetailsPanel, Disclosure, Empty, Icon, PageHeader, Stars, Async, money } from './ui.jsx';
import { MatchTag, WhyRecommended, capabilityEvidence } from './insights.jsx';

// Phase 3: read-only "what if selected providers are unavailable?" simulation.
// All ranking runs server-side using pre-LIMIT SQL exclusion; nothing is modified in the database.

export default function Simulation({ onOpenBusiness }) {
  const requestsResult = useApi('/requests?scope=all');

  return (
    <div className="page">
      <PageHeader
        title="Simulation"
        subtitle="Test how recommended providers change if selected suppliers cannot take the job."
        meta={
          <span className="inline-note">
            <Icon name="info" size={14} />
            Read-only analysis — nothing is saved or changed in the marketplace.
          </span>
        }
      />

      <Async
        result={requestsResult}
        what="requests"
        emptyText="No service requests are available to simulate right now."
      >
        {(requests) => <SimulationWorkspace requests={requests} onOpenBusiness={onOpenBusiness} />}
      </Async>
    </div>
  );
}

function SimulationWorkspace({ requests, onOpenBusiness }) {
  const [requestId, setRequestId] = useState(
    () => (requests.find((r) => r.request_id === 1001) || requests[0]).request_id
  );
  const [excluded, setExcluded] = useState([]);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const baseline = useApi(`/requests/${requestId}/recommendations`);
  const request = requests.find((r) => r.request_id === requestId);

  useEffect(() => {
    setResult(null);
    setError('');
    if (baseline.data && baseline.data.length) {
      setExcluded([Number(baseline.data[0].business_id)]);
    } else {
      setExcluded([]);
    }
  }, [requestId, baseline.data]);

  const toggle = (id) =>
    setExcluded((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const preset = (n) =>
    setExcluded((baseline.data || []).slice(0, n).map((p) => Number(p.business_id)));

  async function run() {
    if (!excluded.length) {
      setError('Select at least one provider to mark unavailable.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await apiRequest('POST', `/requests/${requestId}/simulate-unavailability`, {
        unavailableProviderIds: excluded,
        reason: reason.trim() || undefined,
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sim-layout">
      {/* ---------- Left Setup Column ---------- */}
      <section className="sheet sim-setup" aria-label="Simulation setup">
        <div className="step">
          <label className="step-label" htmlFor="sim-request-select">
            <span className="step-num">Step 1</span> Select service request
          </label>
          <select
            id="sim-request-select"
            className="select-lg"
            value={requestId}
            onChange={(e) => setRequestId(Number(e.target.value))}
          >
            {requests.map((r) => (
              <option key={r.request_id} value={r.request_id}>
                {r.title} — {r.service_name}
              </option>
            ))}
          </select>
          {request && (
            <dl className="mini-facts">
              <div>
                <dt>Buyer</dt>
                <dd>{request.buyer_name}</dd>
              </div>
              <div>
                <dt>Budget</dt>
                <dd className="tabular">
                  {money(request.budget_min)} – {money(request.budget_max)}
                </dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{request.location_preference || 'Anywhere'}</dd>
              </div>
            </dl>
          )}
        </div>

        <div className="step">
          <div className="step-head">
            <span className="step-label">
              <span className="step-num">Step 2</span> Select unavailable providers
            </span>
            <span className="step-actions">
              <button type="button" className="text-btn" onClick={() => preset(1)}>
                Top 1
              </button>
              <button type="button" className="text-btn" onClick={() => preset(2)}>
                Top 2
              </button>
              <button type="button" className="text-btn" onClick={() => setExcluded([])}>
                Clear
              </button>
            </span>
          </div>

          {baseline.loading ? (
            <div className="skeleton-list" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-row" />
              ))}
            </div>
          ) : baseline.error ? (
            <div className="form-error" role="alert">{baseline.error}</div>
          ) : !(baseline.data || []).length ? (
            <Empty>No eligible providers exist for this request.</Empty>
          ) : (
            <ul className="select-rows">
              {baseline.data.map((p, idx) => {
                const id = Number(p.business_id);
                const off = excluded.includes(id);
                return (
                  <li key={id}>
                    <label className={`select-row ${off ? 'is-off' : ''}`}>
                      <input type="checkbox" checked={off} onChange={() => toggle(id)} />
                      <span className="row-rank">#{idx + 1}</span>
                      <span className="row-main">
                        <span className="row-title">{p.business_name}</span>
                        <span className="row-sub tabular">
                          {p.city} · score {p.match_score}/100
                        </span>
                      </span>
                      <span className={`status-dot ${off ? 'off' : 'on'}`}>
                        {off ? 'Unavailable' : 'Available'}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <Disclosure label="Disruption note (optional)">
            <input
              name="reason"
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Primary supplier booked out this month…"
              aria-label="Disruption reason"
            />
          </Disclosure>
        </div>

        <div className="step step-last">
          <button
            type="button"
            className="btn btn-lg full-width"
            disabled={busy || !excluded.length}
            onClick={run}
          >
            {busy ? (
              <>
                <span className="spinner light" aria-hidden="true" /> Finding alternatives…
              </>
            ) : (
              <>
                Find alternatives <Icon name="arrowRight" size={16} />
              </>
            )}
          </button>
          <p className="step-foot">
            {excluded.length} provider{excluded.length === 1 ? '' : 's'} marked unavailable · read-only
          </p>
          {error && <div className="form-error" role="alert">{error}</div>}
        </div>
      </section>

      {/* ---------- Right Result Column ---------- */}
      <section className="sim-results" aria-live="polite">
        {!result ? (
          <div className="sheet placeholder-card">
            <h3>Run a simulation to inspect alternatives</h3>
            <p className="muted">
              Marked providers are filtered out before ranking, showing how standby candidates move up while preserving original scores.
            </p>
          </div>
        ) : (
          <SimulationResult result={result} onOpenBusiness={onOpenBusiness} />
        )}
      </section>
    </div>
  );
}

function SimulationResult({ result, onOpenBusiness }) {
  const ev = result.simulationEvent;
  const alts = result.simulatedAlternatives;
  const prevLeader = result.baselineTop5[0];
  const [newLeader, ...secondary] = alts;
  const promotedCount = alts.filter((a) => a.baseline_rank > 5).length;

  return (
    <div className="stack">
      {/* Direct Previous Leader vs New Recommended Provider Comparison */}
      <section className="sheet leader-comparison" aria-label="Leader comparison">
        <div className="leader-col">
          <div className="leader-kicker">Previous leader (baseline #1)</div>
          <div className="leader-row">
            <div>
              <strong>{prevLeader.business_name}</strong>
              <div className="muted small-text">
                {prevLeader.city} · {prevLeader.industry}
              </div>
            </div>
            <div className="leader-right">
              <span className="tabular"><strong>{prevLeader.match_score}</strong>/100</span>
              {prevLeader.is_unavailable ? (
                <span className="badge badge-bad">Excluded</span>
              ) : (
                <span className="badge badge-ok">Still available</span>
              )}
            </div>
          </div>
        </div>

        <div className="leader-arrow" aria-hidden="true">
          <Icon name="arrowRight" size={16} />
        </div>

        <div className="leader-col">
          <div className="leader-kicker">New top recommendation</div>
          {newLeader ? (
            <div className="leader-row">
              <div>
                <strong>{newLeader.business_name}</strong>
                <div className="muted small-text">
                  {newLeader.city} ·{' '}
                  {ev.topRecommendationChanged
                    ? `Moved from #${newLeader.baseline_rank} to #1`
                    : 'Remained #1'}
                </div>
              </div>
              <div className="leader-right">
                <span className="tabular"><strong>{newLeader.match_score}</strong>/100</span>
                <MatchTag provider={newLeader} />
              </div>
            </div>
          ) : (
            <div className="muted small-text">No remaining eligible provider</div>
          )}
        </div>
      </section>

      <div className="sim-meta-line">
        <span>
          <strong>{ev.remainingAvailablePoolSize}</strong> of {ev.totalEligiblePoolSize} eligible providers still available
        </span>
        {promotedCount > 0 && (
          <span>
            · <strong>{promotedCount}</strong> standby candidate{promotedCount > 1 ? 's' : ''} entered top 5
          </span>
        )}
        {ev.reason && <span> · Note: “{ev.reason}”</span>}
      </div>

      {!newLeader ? (
        <div className="sheet">
          <Empty icon="alert">
            All eligible providers for this request were marked unavailable. Clear one or more selections to see remaining alternatives.
          </Empty>
        </div>
      ) : (
        <>
          <ProviderResultCard provider={newLeader} featured onOpenBusiness={onOpenBusiness} />
          {secondary.length > 0 && (
            <div className="alt-grid">
              {secondary.slice(0, 2).map((p) => (
                <ProviderResultCard key={p.business_id} provider={p} onOpenBusiness={onOpenBusiness} />
              ))}
            </div>
          )}
          <p className="score-note">
            <Icon name="info" size={14} />
            Scores never change during simulation. Rank movements happen because unavailable providers were removed prior to ranking.
          </p>
        </>
      )}

      <DetailsPanel
        title="Full 5-provider comparison &amp; SQL scoring"
        subtitle="Before/after rankings, component scores, score gap to baseline #1, and pre-LIMIT query logic."
        badge="Technical details"
      >
        <TechnicalComparison result={result} />
      </DetailsPanel>
    </div>
  );
}

function RankMovement({ p }) {
  if (p.baseline_rank > 5) {
    return (
      <span className="move move-new">
        <Icon name="arrowUp" size={13} /> Promoted from standby #{p.baseline_rank} → #{p.simulated_rank}
      </span>
    );
  }
  if (p.rank_shift > 0) {
    return (
      <span className="move move-up">
        <Icon name="arrowUp" size={13} /> Moved from #{p.baseline_rank} → #{p.simulated_rank}
      </span>
    );
  }
  return <span className="move">Remained #{p.simulated_rank}</span>;
}

function ProviderResultCard({ provider: p, featured, onOpenBusiness }) {
  const cap = capabilityEvidence(p.capability_score);
  return (
    <article className={`sheet result-card ${featured ? 'featured' : ''}`}>
      <div className="result-top">
        <div>
          <div className="result-rank-line">
            {featured ? 'Best remaining alternative (#1)' : `Alternative #${p.simulated_rank}`}
          </div>
          <h3>{p.business_name}</h3>
          <div className="result-meta">
            <Icon name="pin" size={13} /> {p.city}, {p.state} · {p.industry}
          </div>
        </div>
        <div className="score-block" title="Original recommendation score out of 100">
          <span className="score-num">{Math.round(Number(p.match_score))}</span>
          <span className="score-max">/ 100</span>
        </div>
      </div>

      <div className="result-tags">
        <MatchTag provider={p} />
        <RankMovement p={p} />
      </div>

      <ul className="evidence">
        <li className={`ev-${cap.level}`}>
          <Icon name={cap.level === 'weak' ? 'alert' : 'check'} size={14} />
          <span>{cap.text}</span>
        </li>
        <li>
          <Icon name="reviews" size={14} />
          <Stars value={p.avg_rating} />
          {p.review_count > 0 && <span className="muted"> · {p.review_count} reviews</span>}
        </li>
        {p.has_already_bid ? (
          <li>
            <Icon name="check" size={14} />
            <span>Already submitted a proposal for this request</span>
          </li>
        ) : null}
      </ul>

      <div className="result-foot">
        <WhyRecommended provider={p} />
        {onOpenBusiness && (
          <button type="button" className="text-btn strong" onClick={() => onOpenBusiness(p.business_id)}>
            View profile <Icon name="arrowRight" size={14} />
          </button>
        )}
      </div>
    </article>
  );
}

function TechnicalComparison({ result }) {
  return (
    <div className="tech-stack">
      <div className="two-col">
        <div>
          <h4>Baseline top 5 (before outage)</h4>
          <div className="table-wrap">
            <table className="table-compact">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Provider</th>
                  <th className="num">Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {result.baselineTop5.map((b) => (
                  <tr key={b.business_id} className={b.is_unavailable ? 'row-muted' : ''}>
                    <td>#{b.baseline_rank}</td>
                    <td>{b.business_name}</td>
                    <td className="num">{b.match_score}</td>
                    <td>
                      {b.is_unavailable ? (
                        <span className="badge badge-bad">Excluded</span>
                      ) : (
                        <span className="badge badge-ok">Available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4>Simulated top 5 (after SQL exclusion)</h4>
          <div className="table-wrap">
            <table className="table-compact">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Provider</th>
                  <th className="num">Score</th>
                  <th>Rank change</th>
                </tr>
              </thead>
              <tbody>
                {result.simulatedAlternatives.map((a) => (
                  <tr key={a.business_id}>
                    <td>#{a.simulated_rank}</td>
                    <td>{a.business_name}</td>
                    <td className="num">{a.match_score}</td>
                    <td>
                      {a.baseline_rank > 5
                        ? `New (from #${a.baseline_rank})`
                        : a.rank_shift > 0
                        ? `+${a.rank_shift} (was #${a.baseline_rank})`
                        : 'Unchanged'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h4>100-point SQL CASE breakdown</h4>
        <div className="table-wrap">
          <table className="table-compact">
            <thead>
              <tr>
                <th>Provider</th>
                <th className="num">Capability /40</th>
                <th className="num">Location /25</th>
                <th className="num">Reputation /20</th>
                <th className="num">Track record /15</th>
                <th className="num">Total /100</th>
                <th className="num">Gap vs #1</th>
              </tr>
            </thead>
            <tbody>
              {result.simulatedAlternatives.map((a) => (
                <tr key={a.business_id}>
                  <td>{a.business_name}</td>
                  <td className="num">{a.capability_score}</td>
                  <td className="num">{a.location_score}</td>
                  <td className="num">{a.reputation_score}</td>
                  <td className="num">{a.track_record_score}</td>
                  <td className="num"><strong>{a.match_score}</strong></td>
                  <td className="num">{a.score_delta_vs_baseline_top}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tech-note">
        <strong>SQL pre-LIMIT exclusion &amp; read-only guarantee.</strong> Unavailable business IDs are excluded in the
        query&apos;s <code>WHERE b.business_id NOT IN (…)</code> filter <em>before</em>{' '}
        <code>ORDER BY match_score DESC LIMIT 5</code> executes. Only <code>SELECT</code> queries run;{' '}
        <code>persistedToDatabase: {String(result.persistedToDatabase)}</code>.
      </div>
    </div>
  );
}
