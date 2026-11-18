import React, { useEffect, useState } from 'react';
import { apiRequest, useApi } from '../api.js';
import { Async, Badge, DetailsPanel, PageHeader, Stars, money } from './ui.jsx';

export default function Simulation({ user, go, onOpenBusiness }) {
  const requestsResult = useApi('/requests?scope=all');
  const [selectedRequestId, setSelectedRequestId] = useState(1001);
  const [selectedUnavailableIds, setSelectedUnavailableIds] = useState([]);
  const [eventReason, setEventReason] = useState('Provider capacity overload / SLA freeze');
  const [simData, setSimData] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState('');

  // Fetch baseline recommendations for the currently selected request
  const baselineRecs = useApi(selectedRequestId ? `/requests/${selectedRequestId}/recommendations` : null);

  // Automatically pre-select the #1 provider as unavailable when a request loads for convenience
  useEffect(() => {
    if (baselineRecs.data && baselineRecs.data.length > 0) {
      const topId = Number(baselineRecs.data[0].business_id);
      setSelectedUnavailableIds([topId]);
      // Run initial simulation
      runSimulation(selectedRequestId, [topId], eventReason);
    }
  }, [selectedRequestId, baselineRecs.data]);

  async function runSimulation(reqId, unavailableIds, reasonText) {
    if (!reqId || !unavailableIds || unavailableIds.length === 0) {
      setSimError('Please select at least one provider to simulate unavailability.');
      return;
    }
    setSimLoading(true);
    setSimError('');
    try {
      const response = await apiRequest('POST', `/requests/${reqId}/simulate-unavailability`, {
        unavailableProviderIds: unavailableIds,
        reason: reasonText || 'Market capacity overload',
      });
      setSimData(response);
    } catch (err) {
      setSimError(err.message);
    } finally {
      setSimLoading(false);
    }
  }

  function toggleProvider(providerId) {
    const id = Number(providerId);
    const next = selectedUnavailableIds.includes(id)
      ? selectedUnavailableIds.filter((x) => x !== id)
      : [...selectedUnavailableIds, id];
    setSelectedUnavailableIds(next);
  }

  function handlePreset(count) {
    if (!baselineRecs.data || baselineRecs.data.length === 0) return;
    const presetIds = baselineRecs.data.slice(0, count).map((p) => Number(p.business_id));
    setSelectedUnavailableIds(presetIds);
    runSimulation(selectedRequestId, presetIds, eventReason);
  }

  function handleReset() {
    if (!baselineRecs.data || baselineRecs.data.length === 0) return;
    const topId = Number(baselineRecs.data[0].business_id);
    setSelectedUnavailableIds([topId]);
    runSimulation(selectedRequestId, [topId], eventReason);
  }

  return (
    <div className="page-simulation">
      <PageHeader
        title="Market Event Simulation"
        subtitle="Simulate supplier outages or capacity bottlenecks to find immediate, qualified alternative providers."
        action={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="pill">Phase 3 Intelligence</span>
            <span className="badge blue">Ephemeral &amp; Read-Only</span>
          </div>
        }
      />

      <Async result={requestsResult} what="service requests" isEmpty={() => false}>
        {(requests) => {
          const requestList = requests || [];
          const currentRequest = requestList.find((r) => r.request_id === selectedRequestId) || requestList[0];

          return (
            <>
              {/* Guided Workflow Stepper */}
              <div className="card workflow-card">
                <div className="workflow-grid">
                  {/* Step 1: Request Selection */}
                  <div className="workflow-step">
                    <div className="step-num">Step 1</div>
                    <label className="field">
                      <span>Select Target Service Request</span>
                      <select
                        value={selectedRequestId}
                        onChange={(e) => setSelectedRequestId(Number(e.target.value))}
                      >
                        {requestList.map((r) => (
                          <option key={r.request_id} value={r.request_id}>
                            #{r.request_id} — {r.title} ({r.service_name} • {money(r.budget_max)})
                          </option>
                        ))}
                      </select>
                    </label>

                    {currentRequest && (
                      <div className="request-preview-pill">
                        <div>
                          <strong>{currentRequest.title}</strong> • <span className="muted">{currentRequest.service_name}</span>
                        </div>
                        <div className="muted" style={{ fontSize: '12px', marginTop: '2px' }}>
                          Buyer: {currentRequest.buyer_name} ({currentRequest.buyer_city || 'City'}) • Pref: {currentRequest.location_preference || 'Anywhere'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 2: Choose Unavailable Providers */}
                  <div className="workflow-step">
                    <div className="step-num">Step 2</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>Mark Provider(s) Unavailable</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button type="button" className="btn ghost tiny" onClick={() => handlePreset(1)}>
                          #1 Outage
                        </button>
                        <button type="button" className="btn ghost tiny" onClick={() => handlePreset(2)}>
                          Top 2 Outage
                        </button>
                        <button type="button" className="btn ghost tiny" onClick={handleReset}>
                          Reset
                        </button>
                      </div>
                    </div>

                    <div className="provider-select-list">
                      {baselineRecs.loading ? (
                        <div className="state" style={{ padding: '8px' }}>Loading candidate providers…</div>
                      ) : (baselineRecs.data || []).slice(0, 5).map((p, idx) => {
                        const isChecked = selectedUnavailableIds.includes(Number(p.business_id));
                        return (
                          <label
                            key={p.business_id}
                            className={`provider-select-item ${isChecked ? 'selected' : ''}`}
                          >
                            <input
                              type="checkbox"
                              style={{ width: 'auto', margin: 0 }}
                              checked={isChecked}
                              onChange={() => toggleProvider(p.business_id)}
                            />
                            <div className="item-info">
                              <strong>#{idx + 1} {p.business_name}</strong>
                              <span className="muted" style={{ fontSize: '11px' }}>
                                {p.city} • Score: {p.match_score}/100
                              </span>
                            </div>
                            {isChecked ? (
                              <span className="badge red tiny">Excluded</span>
                            ) : (
                              <span className="badge green tiny">Available</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 3: Trigger Simulation */}
                  <div className="workflow-step">
                    <div className="step-num">Step 3</div>
                    <label className="field">
                      <span>Market Disruption Reason</span>
                      <input
                        value={eventReason}
                        onChange={(e) => setEventReason(e.target.value)}
                        placeholder="e.g. Unscheduled downtime, high demand"
                      />
                    </label>

                    <button
                      type="button"
                      className="btn primary full-width"
                      disabled={simLoading || selectedUnavailableIds.length === 0}
                      onClick={() => runSimulation(selectedRequestId, selectedUnavailableIds, eventReason)}
                      style={{ marginTop: '12px' }}
                    >
                      {simLoading ? 'Simulating Alternatives…' : '⚡ Find Alternative Providers'}
                    </button>

                    <small className="muted" style={{ display: 'block', marginTop: '8px', textAlign: 'center' }}>
                      Pre-filters candidates in SQL before ranking. No database records are altered.
                    </small>
                  </div>
                </div>

                {simError && <div className="form-error" style={{ marginTop: '12px' }}>{simError}</div>}
              </div>

              {/* Simulation Results Section */}
              {simData && (
                <div className="sim-results-container" style={{ marginTop: '24px' }}>
                  {/* Plain English Narrative Alert */}
                  <div className="narrative-banner">
                    <div className="narrative-icon">💡</div>
                    <div className="narrative-text">
                      <strong>Executive Summary:</strong> {simData.simulationEvent?.narrative}
                    </div>
                  </div>

                  {/* Top 3 Alternative Providers Cards (Clean Business View) */}
                  <div className="section-head" style={{ marginTop: '20px' }}>
                    <div>
                      <h2>Top Recommended Alternative Providers</h2>
                      <span className="muted">
                        Best qualified backup partners for {currentRequest?.title} ({currentRequest?.service_name})
                      </span>
                    </div>
                  </div>

                  {simData.simulatedAlternatives.length === 0 ? (
                    <div className="card">
                      <div className="state">
                        All eligible candidate providers were marked unavailable. No alternative providers remain in this category.
                      </div>
                    </div>
                  ) : (
                    <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))' }}>
                      {simData.simulatedAlternatives.slice(0, 3).map((alt) => (
                        <div key={alt.business_id} className="card alt-provider-card">
                          <div className="alt-card-header">
                            <div>
                              <span className="rank-badge">#{alt.simulated_rank} Choice</span>
                              {alt.baseline_rank > 5 ? (
                                <span className="badge green" style={{ marginLeft: '6px' }}>
                                  Newly Promoted (Standby #{alt.baseline_rank})
                                </span>
                              ) : alt.rank_shift > 0 ? (
                                <span className="badge blue" style={{ marginLeft: '6px' }}>
                                  Moved Up +{alt.rank_shift} Spot
                                </span>
                              ) : (
                                <span className="badge" style={{ marginLeft: '6px' }}>
                                  Maintained Rank
                                </span>
                              )}
                            </div>
                            <div className="alt-score">
                              <strong>{alt.match_score}</strong>
                              <small>/100</small>
                            </div>
                          </div>

                          <h3 style={{ margin: '12px 0 4px', fontSize: '18px' }}>
                            {alt.business_name}
                          </h3>
                          <div className="muted" style={{ fontSize: '13px', marginBottom: '10px' }}>
                            {alt.industry} • {alt.city}, {alt.state} • Size: {alt.business_size}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <Stars value={alt.avg_rating} />
                            <span className="muted" style={{ fontSize: '12px' }}>
                              ({alt.review_count || 0} reviews)
                            </span>
                          </div>

                          <div className="alt-explanation-box">
                            <strong>Why this provider:</strong> {alt.explanation}
                          </div>

                          <div className="alt-card-footer" style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="muted" style={{ fontSize: '12px' }}>
                              {alt.has_already_bid ? '✓ Already submitted bid' : 'Has not bid yet'}
                            </span>
                            {onOpenBusiness && (
                              <button
                                type="button"
                                className="link strong"
                                onClick={() => onOpenBusiness(alt.business_id)}
                              >
                                View Company Profile →
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Expandable Advanced & DBMS Technical Details Accordion */}
                  <div style={{ marginTop: '24px' }}>
                    <DetailsPanel
                      title="Technical Details &amp; Full 5-Provider Comparison"
                      subtitle="Inspect full baseline vs simulated candidate rankings, 100-point SQL multi-criteria score breakdown, and pre-LIMIT query logic."
                      badge="DBMS Evaluation"
                      defaultOpen={false}
                    >
                      <div className="two-col" style={{ alignItems: 'start', marginTop: '8px' }}>
                        {/* Baseline Top 5 Table */}
                        <div>
                          <h4 style={{ marginBottom: '8px' }}>Baseline Recommendations (Before Event)</h4>
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Rank</th>
                                  <th>Provider</th>
                                  <th>Score</th>
                                  <th>Availability Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {simData.baselineTop5.map((b) => (
                                  <tr
                                    key={b.business_id}
                                    style={b.is_unavailable ? { background: '#fef2f2' } : undefined}
                                  >
                                    <td><strong>#{b.baseline_rank}</strong></td>
                                    <td>
                                      <div><strong>{b.business_name}</strong></div>
                                      <div className="muted" style={{ fontSize: '11px' }}>{b.city} • {b.industry}</div>
                                    </td>
                                    <td><strong>{b.match_score}</strong>/100</td>
                                    <td>
                                      {b.is_unavailable ? (
                                        <span className="badge red tiny">Simulated Outage</span>
                                      ) : (
                                        <span className="badge green tiny">Available</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Simulated Alternatives Full Table */}
                        <div>
                          <h4 style={{ marginBottom: '8px' }}>Active Alternatives (Post SQL Exclusion)</h4>
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Sim Rank</th>
                                  <th>Shift</th>
                                  <th>Provider</th>
                                  <th>Score (Δ)</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {simData.simulatedAlternatives.map((alt) => (
                                  <tr
                                    key={alt.business_id}
                                    style={alt.baseline_rank > 5 ? { background: '#f0fdf4' } : undefined}
                                  >
                                    <td><strong>#{alt.simulated_rank}</strong></td>
                                    <td>
                                      {alt.baseline_rank > 5 ? (
                                        <span className="badge green tiny">New (#{alt.baseline_rank}→#{alt.simulated_rank})</span>
                                      ) : alt.rank_shift > 0 ? (
                                        <span className="badge blue tiny">+{alt.rank_shift} (was #{alt.baseline_rank})</span>
                                      ) : (
                                        <span className="badge tiny">#{alt.baseline_rank}</span>
                                      )}
                                    </td>
                                    <td>
                                      <div><strong>{alt.business_name}</strong></div>
                                      <div className="muted" style={{ fontSize: '11px' }}>{alt.city}</div>
                                    </td>
                                    <td>
                                      <strong>{alt.match_score}</strong>
                                      <span className="muted" style={{ fontSize: '11px', marginLeft: '4px' }}>
                                        ({alt.score_delta_vs_baseline_top > 0 ? `+${alt.score_delta_vs_baseline_top}` : alt.score_delta_vs_baseline_top})
                                      </span>
                                    </td>
                                    <td>
                                      <small>{alt.status_change}</small>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* SQL 100-Point Scoring Breakdown Table */}
                      <h4 style={{ marginTop: '20px', marginBottom: '8px' }}>
                        100-Point Multi-Criteria Component Breakdown (SQL CASE Expressions)
                      </h4>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Provider</th>
                              <th>Capability (40)</th>
                              <th>Location (25)</th>
                              <th>Reputation (20)</th>
                              <th>Track Record (15)</th>
                              <th>Total Score (100)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {simData.simulatedAlternatives.map((alt) => (
                              <tr key={alt.business_id}>
                                <td><strong>{alt.business_name}</strong></td>
                                <td>{alt.capability_score} / 40</td>
                                <td>{alt.location_score} / 25</td>
                                <td>{alt.reputation_score} / 20</td>
                                <td>{alt.track_record_score} / 15</td>
                                <td><strong>{alt.match_score} / 100</strong></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* DBMS Query Architecture Explanation */}
                      <div className="dbms-note-box" style={{ marginTop: '16px' }}>
                        <strong>DBMS Implementation Concept:</strong>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#475569' }}>
                          Simulations execute a strictly read-only SQL query with a dynamic <code>WHERE b.business_id NOT IN (...)</code> exclusion
                          clause evaluated <em>before</em> the <code>ORDER BY match_score DESC, vbr.avg_rating DESC LIMIT 5</code> clause.
                          This guarantees genuine relational promotion of standby candidates (#6 and #7) without altering any stored records or triggering mutations.
                        </p>
                      </div>
                    </DetailsPanel>
                  </div>
                </div>
              )}
            </>
          );
        }}
      </Async>
    </div>
  );
}

