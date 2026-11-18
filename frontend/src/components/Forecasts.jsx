import React, { useState } from 'react';
import { useApi } from '../api.js';
import { Async, Badge, DetailsPanel, PageHeader, Tabs } from './ui.jsx';

export default function Forecasts({ go }) {
  const forecastResult = useApi('/analytics/demand-forecast');
  const [selectedCategory, setSelectedCategory] = useState('IT');

  return (
    <div className="page-forecasts">
      <PageHeader
        title="Service Demand Forecasts"
        subtitle="Anticipate upcoming market demand and plan capacity across core service sectors."
        action={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="badge amber">Synthetic 24M Benchmark</span>
            <span className="pill">Experimental OLS Model</span>
          </div>
        }
      />

      <Async result={forecastResult} what="demand forecasts" isEmpty={() => false}>
        {(data) => {
          const categories = data.categories || [];
          const activeCat = categories.find((c) => c.category === selectedCategory) || categories[0];
          const maxCount = activeCat
            ? Math.max(...activeCat.history.map((h) => h.requestCount), activeCat.predictedNextMonthRounded, 1)
            : 1;

          return (
            <>
              {/* Dataset Disclaimer Notice */}
              <div className="notice-banner warning">
                <span className="notice-icon">⚠️</span>
                <div>
                  <strong>Model &amp; Data Notice:</strong> {data.disclaimer}
                </div>
              </div>

              {/* Next-Month Projected Demand Overview (Clean Business Cards) */}
              <div className="section-head" style={{ marginTop: '20px' }}>
                <div>
                  <h2>Projected Demand for Next Month ({categories[0]?.forecastMonth || '2026-11'})</h2>
                  <span className="muted">Expected request volumes based on secular industry trends</span>
                </div>
              </div>

              <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                {categories.map((c) => {
                  const isSelected = activeCat?.category === c.category;
                  const delta = c.predictedNextMonthRounded - c.lastMonthActual;
                  const deltaText = delta > 0 ? `+${delta}` : delta === 0 ? '±0' : `${delta}`;

                  return (
                    <div
                      key={c.category}
                      className={`card forecast-category-card clickable ${isSelected ? 'active-card' : ''}`}
                      onClick={() => setSelectedCategory(c.category)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span className="category-tag">{c.category}</span>
                          <h3 style={{ margin: '6px 0 2px', fontSize: '18px' }}>{c.category} Services</h3>
                        </div>
                        <Badge status={c.trendDirection === 'Upward' ? 'Completed' : 'Open'} />
                      </div>

                      <div className="forecast-big-value" style={{ margin: '14px 0 6px' }}>
                        <span className="forecast-number">{c.predictedNextMonthRounded}</span>
                        <span className="forecast-unit">predicted requests</span>
                      </div>

                      <div className="forecast-comparison-row">
                        <span className="muted" style={{ fontSize: '12px' }}>
                          Last observed ({c.history[c.history.length - 1]?.month}): <strong>{c.lastMonthActual}</strong>
                        </span>
                        <span className={`forecast-delta ${delta >= 0 ? 'pos' : 'neg'}`}>
                          {deltaText} vs last mo.
                        </span>
                      </div>

                      <div style={{ marginTop: '12px', fontSize: '12px', color: '#0d9488', fontWeight: 600 }}>
                        {isSelected ? '● Viewing Historical Trend' : 'Click to inspect trend →'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Visual 24-Month Trend Chart */}
              {activeCat && (
                <div className="card" style={{ marginTop: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '17px' }}>
                        24-Month Demand Trajectory: {activeCat.category}
                      </h3>
                      <p className="muted" style={{ margin: '2px 0 0', fontSize: '13px' }}>
                        Monthly request volumes showing 18-month baseline training, 6-month holdout test, and next-month projection.
                      </p>
                    </div>
                    <Tabs
                      tabs={categories.map((c) => ({ id: c.category, label: c.category }))}
                      value={activeCat.category}
                      onChange={setSelectedCategory}
                    />
                  </div>

                  {/* Clean SVG/HTML Bar Chart */}
                  <div className="trend-chart-container">
                    {activeCat.history.map((h, idx) => {
                      const isTest = idx >= activeCat.modelParameters.trainMonths;
                      const heightPct = Math.max(12, Math.round((h.requestCount / maxCount) * 100));
                      return (
                        <div
                          key={h.month}
                          className="trend-bar-col"
                          title={`${h.month} (${isTest ? 'Holdout Test Window' : 'Model Training Window'}): ${h.requestCount} requests`}
                        >
                          <span className="bar-val">{h.requestCount}</span>
                          <div
                            className={`trend-bar-fill ${isTest ? 'test-bar' : 'train-bar'}`}
                            style={{ height: `${heightPct}%` }}
                          />
                          <span className="bar-label">{h.month.slice(2)}</span>
                        </div>
                      );
                    })}

                    {/* Projected Next Month Bar */}
                    <div
                      className="trend-bar-col projected"
                      title={`${activeCat.forecastMonth} (Experimental Prediction): ${activeCat.predictedNextMonth} requests`}
                    >
                      <span className="bar-val highlight">{activeCat.predictedNextMonthRounded}</span>
                      <div
                        className="trend-bar-fill projected-bar"
                        style={{ height: `${Math.max(12, Math.round((activeCat.predictedNextMonth / maxCount) * 100))}%` }}
                      />
                      <span className="bar-label highlight">{activeCat.forecastMonth.slice(2)}*</span>
                    </div>
                  </div>

                  {/* Chart Legend */}
                  <div className="chart-legend" style={{ marginTop: '16px' }}>
                    <div className="legend-item">
                      <span className="legend-dot train-dot" />
                      <span>Training Set (Months 1–18: {activeCat.modelParameters.trainPeriod})</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot test-dot" />
                      <span>Holdout Test Set (Months 19–24: {activeCat.modelParameters.testPeriod})</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot projected-dot" />
                      <span><strong>Experimental Projection (Month 25: {activeCat.forecastMonth}*)</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Expandable Technical & Academic Details Accordion (DBMS Course Evaluation) */}
              <div style={{ marginTop: '24px' }}>
                <DetailsPanel
                  title="Technical &amp; Academic Evaluation Details (DBMS Course Focus)"
                  subtitle="Detailed model evaluation: MAE/RMSE comparisons against naive baseline, chronological train/test split, and regression formulas."
                  badge="Course Viva &amp; Metrics"
                  defaultOpen={false}
                >
                  {/* Overall Error Metrics Cards */}
                  <h4 style={{ marginBottom: '8px' }}>Empirical Holdout Evaluation Metrics (Months 19–24 Test Window)</h4>
                  <div className="stat-grid" style={{ marginBottom: '18px' }}>
                    <div className="card stat compact">
                      <div className="stat-value small">{data.overallMetrics?.regressionMae}</div>
                      <div className="stat-label">OLS Linear Regression MAE</div>
                      <small className="muted" style={{ fontSize: '11px' }}>Mean Absolute Error</small>
                    </div>
                    <div className="card stat compact">
                      <div className="stat-value small">{data.overallMetrics?.regressionRmse}</div>
                      <div className="stat-label">OLS Linear Regression RMSE</div>
                      <small className="muted" style={{ fontSize: '11px' }}>Root Mean Squared Error</small>
                    </div>
                    <div className="card stat compact">
                      <div className="stat-value small" style={{ color: '#5d6b7a' }}>{data.overallMetrics?.naiveMae}</div>
                      <div className="stat-label">Naive Baseline MAE</div>
                      <small className="muted" style={{ fontSize: '11px' }}>Last-Value Persistence (yt = yt-1)</small>
                    </div>
                    <div className="card stat compact">
                      <div className="stat-value small" style={{ color: '#5d6b7a' }}>{data.overallMetrics?.naiveRmse}</div>
                      <div className="stat-label">Naive Baseline RMSE</div>
                      <small className="muted" style={{ fontSize: '11px' }}>Last-Value Persistence (yt = yt-1)</small>
                    </div>
                  </div>

                  {/* Mathematical Formulas Table */}
                  <h4 style={{ marginBottom: '8px' }}>Fitted Linear Regression Formulas per Category</h4>
                  <div className="table-wrap" style={{ marginBottom: '18px' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Trend Formula (y = b0 + b1·t)</th>
                          <th>Slope (b1)</th>
                          <th>Intercept (b0)</th>
                          <th>OLS MAE / RMSE</th>
                          <th>Baseline MAE / RMSE</th>
                          <th>Holdout Verdict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((c) => (
                          <tr key={c.category}>
                            <td><strong>{c.category}</strong></td>
                            <td><code>y = {c.modelParameters.intercept} + {c.modelParameters.slope}·t</code></td>
                            <td>{c.modelParameters.slope}</td>
                            <td>{c.modelParameters.intercept}</td>
                            <td><strong>{c.metrics.regressionMae}</strong> / {c.metrics.regressionRmse}</td>
                            <td className="muted">{c.metrics.naiveMae} / {c.metrics.naiveRmse}</td>
                            <td>
                              <span className="badge green tiny">
                                {c.metrics.regressionMae < c.metrics.naiveMae ? 'Beats Baseline' : 'Comparable'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Holdout Comparison Table for the active category */}
                  {activeCat && (
                    <>
                      <h4 style={{ marginBottom: '8px' }}>
                        Out-of-Sample Holdout Points: {activeCat.category} (Months 19–24)
                      </h4>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Holdout Month</th>
                              <th>Index (t)</th>
                              <th>Actual Demand</th>
                              <th>OLS Predicted</th>
                              <th>OLS Absolute Error</th>
                              <th>Baseline Predicted</th>
                              <th>Baseline Absolute Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeCat.holdoutComparisons.map((hc) => (
                              <tr key={hc.month}>
                                <td>{hc.month}</td>
                                <td>t = {hc.t}</td>
                                <td><strong>{hc.actual}</strong></td>
                                <td>{hc.regressionPredicted}</td>
                                <td>{Math.abs(hc.actual - hc.regressionPredicted).toFixed(2)}</td>
                                <td>{hc.naivePredicted}</td>
                                <td>{Math.abs(hc.actual - hc.naivePredicted).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* Diagnostic details on production data vs synthetic benchmark */}
                  <div className="dbms-note-box" style={{ marginTop: '16px' }}>
                    <strong>Production Dataset Feasibility Assessment:</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#475569' }}>
                      {data.realDataAssessment?.reason} Production table <code>request</code> currently contains{' '}
                      {data.realDataAssessment?.totalRealRequests} records across {data.realDataAssessment?.distinctMonths}{' '}
                      months ({data.realDataAssessment?.realBreakdown?.map((b) => `${b.category}: ${b.request_count}`).join(', ')}).
                      To avoid training an invalid model on sparse data, the regression model is trained on an isolated table{' '}
                      <code>synthetic_request_history</code> (993 rows, 24 months) and evaluated with genuine chronological splitting.
                    </p>
                  </div>
                </DetailsPanel>
              </div>
            </>
          );
        }}
      </Async>
    </div>
  );
}

