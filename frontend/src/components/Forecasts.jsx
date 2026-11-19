import React, { useMemo, useState } from 'react';
import { useApi } from '../api.js';
import { Async, DetailsPanel, Disclosure, Icon, PageHeader } from './ui.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym, withYear = true) => {
  const [y, m] = ym.split('-');
  return withYear ? `${MONTHS[Number(m) - 1]} ${y.slice(2)}` : MONTHS[Number(m) - 1];
};
const monthLong = (ym) => {
  const [y, m] = ym.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
};

export default function Forecasts() {
  const result = useApi('/analytics/demand-forecast');

  return (
    <div className="page">
      <PageHeader
        title="Forecasts"
        subtitle="Projected next-month request volume across marketplace service categories."
        action={
          <span className="badge badge-warn">
            <Icon name="flask" size={13} /> Experimental · synthetic data
          </span>
        }
      />

      <Async
        result={result}
        what="forecasts"
        isEmpty={(d) => !d || !d.categories || d.categories.length === 0}
        emptyText="No demand forecast data is available right now."
      >
        {(data) => <ForecastView data={data} />}
      </Async>
    </div>
  );
}

function ForecastView({ data }) {
  const categories = data.categories;
  const ranked = [...categories].sort((a, b) => b.predictedNextMonth - a.predictedNextMonth);
  const [selected, setSelected] = useState(ranked[0].category);
  const active = categories.find((c) => c.category === selected) || ranked[0];
  const forecastMonth = monthLong(categories[0].forecastMonth);

  return (
    <>
      <p className="disclosure-line">
        <Icon name="info" size={15} />
        <span>
          <strong>Synthetic benchmark:</strong> Trained on an isolated 24-month synthetic dataset ({data.methodology.totalSyntheticRequests} rows). Real marketplace requests are untouched; treat projections as experimental indicators, not guaranteed demand.
        </span>
      </p>

      <section aria-label="Next-month projections by category">
        <div className="forecast-selector-strip" role="tablist" aria-label="Service categories">
          {ranked.map((c, idx) => {
            const isSelected = c.category === active.category;
            const diff = c.predictedNextMonth - c.lastMonthActual;
            const lastMonth = monthLabel(c.history[c.history.length - 1].month, false);
            const diffText =
              Math.abs(diff) < 0.5
                ? `~Same as ${lastMonth}`
                : `${diff > 0 ? '+' : ''}${diff.toFixed(1)} vs ${lastMonth}`;

            return (
              <button
                key={c.category}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`forecast-tab ${idx === 0 ? 'is-lead' : ''} ${isSelected ? 'active' : ''}`}
                onClick={() => setSelected(c.category)}
              >
                <div className="ft-top">
                  <span className="ft-name">{c.category}</span>
                  {idx === 0 && <span className="ft-rank">Highest</span>}
                </div>
                <div className="ft-num tabular">
                  {c.predictedNextMonthRounded} <span className="ft-unit">reqs</span>
                </div>
                <div className="ft-sub">
                  <span>{forecastMonth}</span>
                  <span className={`ft-diff ${diff > 0.5 ? 'up' : diff < -0.5 ? 'down' : ''}`}>{diffText}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="sheet chart-card">
        <div className="chart-head">
          <div>
            <h2>
              {active.category} — monthly demand &amp; {forecastMonth} projection
            </h2>
            <p className="section-sub">
              Expected next month: <strong>{active.predictedNextMonth} requests</strong> (vs {active.lastMonthActual} in{' '}
              {monthLong(active.history[active.history.length - 1].month)}). Select or focus any bar for exact monthly counts.
            </p>
          </div>
        </div>

        <TrendChart cat={active} />

        <div className="chart-actions">
          <Disclosure label="How was this forecast calculated?">
            <div className="explain">
              <p>
                A linear trend line was fitted across the first <strong>{active.modelParameters.trainMonths} months</strong> of{' '}
                {active.category} synthetic history ({active.modelParameters.trainPeriod}), then tested against the final{' '}
                <strong>{active.modelParameters.testMonths} holdout months</strong> ({active.modelParameters.testPeriod}).
              </p>
              <p>
                During the holdout check, the trend line differed from actual counts by an average of{' '}
                <strong>{active.metrics.regressionMae.toFixed(2)} requests</strong> per month, compared with{' '}
                <strong>{Number(active.metrics.naiveMae).toFixed(2)}</strong> for simply repeating the prior month.
              </p>
              <p className="muted">
                Extending the trend one month forward gives {active.predictedNextMonth} requests (~{active.predictedNextMonthRounded}). Linear regression models steady direction only and does not capture sudden market shocks.
              </p>
            </div>
          </Disclosure>

          <Disclosure label="View accessible monthly data table">
            <div className="table-wrap" style={{ marginTop: '6px' }}>
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Period type</th>
                    <th className="num">Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {active.history.map((h, idx) => (
                    <tr key={h.month}>
                      <td>{monthLong(h.month)}</td>
                      <td>{idx < active.modelParameters.trainMonths ? 'Training history' : 'Holdout verification'}</td>
                      <td className="num">{h.requestCount}</td>
                    </tr>
                  ))}
                  <tr className="row-proj">
                    <td><strong>{monthLong(active.forecastMonth)}</strong></td>
                    <td><strong>Experimental projection</strong></td>
                    <td className="num"><strong>{active.predictedNextMonth}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Disclosure>
        </div>
      </section>

      <DetailsPanel
        title="Academic &amp; technical details"
        subtitle="OLS equations, MAE / RMSE vs. naive baseline, holdout residuals, and production dataset feasibility."
        badge="DBMS · ML"
      >
        <TechnicalDetails data={data} active={active} />
      </DetailsPanel>
    </>
  );
}

function TrendChart({ cat }) {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const W = 760,
    H = 250,
    PL = 36,
    PR = 14,
    PT = 22,
    PB = 30;

  const points = useMemo(() => {
    const hist = cat.history.map((h, i) => ({
      month: h.month,
      value: h.requestCount,
      t: i + 1,
      kind: i < cat.modelParameters.trainMonths ? 'train' : 'test',
      kindLabel: i < cat.modelParameters.trainMonths ? 'Training history' : 'Holdout observation',
    }));
    return [
      ...hist,
      {
        month: cat.forecastMonth,
        value: cat.predictedNextMonth,
        t: hist.length + 1,
        kind: 'proj',
        kindLabel: 'Experimental projection',
      },
    ];
  }, [cat]);

  const maxV = Math.max(...points.map((p) => p.value)) * 1.15;
  const yMax = Math.ceil(maxV / 5) * 5;
  const n = points.length;
  const slot = (W - PL - PR) / n;
  const barW = Math.min(18, slot * 0.62);
  const x = (i) => PL + slot * i + slot / 2;
  const y = (v) => PT + (H - PT - PB) * (1 - v / yMax);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
  const { slope, intercept } = cat.modelParameters;
  const trendY1 = y(intercept + slope * 1);
  const trendY2 = y(intercept + slope * n);
  const splitX = PL + slot * cat.modelParameters.trainMonths;
  const activePoint = selectedIdx !== null ? points[selectedIdx] : points[points.length - 1];

  return (
    <div className="chart-wrap">

      <div className="chart-readout" aria-live="polite">
        <span className="readout-month">{monthLong(activePoint.month)}</span>
        <span className="readout-val tabular">
          {activePoint.kind === 'proj'
            ? `${activePoint.value} projected requests`
            : `${activePoint.value} observed requests`}
        </span>
        <span className={`badge badge-${activePoint.kind === 'proj' ? 'warn' : activePoint.kind === 'test' ? 'ok' : 'neutral'}`}>
          {activePoint.kindLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        role="img"
        aria-label={`${cat.category} monthly demand chart from ${monthLong(points[0].month)} to ${monthLong(activePoint.month)}`}
      >
        <defs>
          <pattern id="proj-hatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#e5a93b" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#b45309" strokeWidth="1.5" strokeOpacity="0.45" />
          </pattern>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={PL - 8} y={y(t) + 4} className="axis-text" textAnchor="end">
              {t}
            </text>
          </g>
        ))}

        <line x1={splitX} x2={splitX} y1={PT} y2={H - PB} className="split-line" />
        <text x={splitX + 6} y={PT + 10} className="axis-text">
          Holdout check
        </text>

        {points.map((p, i) => (
          <g key={p.month}>
            <rect
              x={x(i) - barW / 2}
              y={y(p.value)}
              width={barW}
              height={H - PB - y(p.value)}
              rx="2.5"
              tabIndex={0}
              role="button"
              aria-label={`${monthLong(p.month)}: ${p.value} requests (${p.kindLabel})`}
              className={`bar bar-${p.kind} ${selectedIdx === i ? 'is-hover' : ''}`}
              fill={p.kind === 'proj' ? 'url(#proj-hatch)' : undefined}
              onMouseEnter={() => setSelectedIdx(i)}
              onFocus={() => setSelectedIdx(i)}
              onClick={() => setSelectedIdx(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedIdx(i);
                }
              }}
            />
            {(i === 0 || i === 12 || i === 18 || p.kind === 'proj') && (
              <text
                x={x(i)}
                y={H - 10}
                className={`axis-text ${p.kind === 'proj' ? 'axis-strong' : ''}`}
                textAnchor="middle"
              >
                {monthLabel(p.month)}
              </text>
            )}
          </g>
        ))}

        <line x1={x(0)} y1={trendY1} x2={x(n - 1)} y2={trendY2} className="trend-line" />
      </svg>

      <div className="chart-legend">
        <span><i className="lg lg-train" /> Training history (18m)</span>
        <span><i className="lg lg-test" /> Holdout observations (6m)</span>
        <span><i className="lg lg-proj" /> Experimental projection (t+1)</span>
        <span><i className="lg lg-line" /> OLS linear trend</span>
      </div>
    </div>
  );
}

function TechnicalDetails({ data, active }) {
  const m = data.overallMetrics;
  return (
    <div className="tech-stack">
      <div>
        <h4>Holdout error across all 4 categories ({m.totalTestObservations} test points)</h4>
        <div className="metric-row">
          <Metric label="OLS Regression MAE" value={m.regressionMae} />
          <Metric label="OLS Regression RMSE" value={m.regressionRmse} />
          <Metric label="Naive Baseline MAE" value={m.naiveMae} muted />
          <Metric label="Naive Baseline RMSE" value={m.naiveRmse} muted />
        </div>
        <p className="tech-caption">
          Lower error is better. Naive baseline predicts the prior month&apos;s value (ŷₜ = yₜ₋₁). Split: {data.methodology.splitStrategy}.
        </p>
      </div>

      <div>
        <h4>Fitted regression equations</h4>
        <div className="table-wrap">
          <table className="table-compact">
            <thead>
              <tr>
                <th>Category</th>
                <th>Equation (t = 1..24)</th>
                <th className="num">MAE</th>
                <th className="num">RMSE</th>
                <th className="num">Naive MAE</th>
                <th className="num">Naive RMSE</th>
                <th>Comparison</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((c) => (
                <tr key={c.category}>
                  <td>{c.category}</td>
                  <td>
                    <code>y = {c.modelParameters.intercept} + {c.modelParameters.slope}·t</code>
                  </td>
                  <td className="num">{c.metrics.regressionMae}</td>
                  <td className="num">{c.metrics.regressionRmse}</td>
                  <td className="num">{c.metrics.naiveMae}</td>
                  <td className="num">{c.metrics.naiveRmse}</td>
                  <td>{c.metrics.regressionMae < c.metrics.naiveMae ? 'Beats baseline' : 'Matches/worse'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4>Holdout residuals — {active.category} ({active.modelParameters.testPeriod})</h4>
        <div className="table-wrap">
          <table className="table-compact">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">t</th>
                <th className="num">Actual</th>
                <th className="num">OLS</th>
                <th className="num">|Error|</th>
                <th className="num">Naive</th>
                <th className="num">|Error|</th>
              </tr>
            </thead>
            <tbody>
              {active.holdoutComparisons.map((h) => (
                <tr key={h.month}>
                  <td>{h.month}</td>
                  <td className="num">{h.t}</td>
                  <td className="num">{h.actual}</td>
                  <td className="num">{h.regressionPredicted}</td>
                  <td className="num">{Math.abs(h.actual - h.regressionPredicted).toFixed(2)}</td>
                  <td className="num">{h.naivePredicted}</td>
                  <td className="num">{Math.abs(h.actual - h.naivePredicted).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tech-note">
        <strong>Production dataset feasibility.</strong> {data.realDataAssessment.reason} Demand forecasting runs on
        isolated table <code>synthetic_request_history</code> ({data.methodology.totalSyntheticRequests} rows) aggregated with{' '}
        <code>{data.methodology.aggregationSql}</code> and persisted in <code>service_demand_forecast</code>.
      </div>
    </div>
  );
}

function Metric({ label, value, muted }) {
  return (
    <div className={`metric ${muted ? 'muted-metric' : ''}`}>
      <div className="metric-value tabular">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}
