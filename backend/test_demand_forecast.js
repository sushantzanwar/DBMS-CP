import assert from 'node:assert/strict';
import { pool } from './src/db.js';
import { getDemandForecast, getRecommendedProvidersForRequest } from './src/queries.js';

async function runTests() {
  console.log('=== ServicePath AI — Phase 2 Demand Forecasting Verification ===\n');

  const [[reqCount]] = await pool.query('SELECT COUNT(*) AS cnt FROM request');
  const [[bizCount]] = await pool.query('SELECT COUNT(*) AS cnt FROM business');
  const [[txCount]] = await pool.query('SELECT COUNT(*) AS cnt FROM `transaction`');
  assert.equal(Number(reqCount.cnt), 8, 'Production request table must remain at 8 rows');
  assert.equal(Number(bizCount.cnt), 8, 'Production business table must remain at 8 rows');
  assert.equal(Number(txCount.cnt), 5, 'Production transaction table must remain at 5 rows');
  console.log('[PASS] 1. Production tables preserved (8 requests, 8 businesses, 5 transactions).');

  const result = await getDemandForecast();
  assert.equal(result.isSynthetic, true);
  assert.equal(result.datasetLabel, 'SYNTHETIC_24M_BENCHMARK');
  assert.equal(result.realDataAssessment.supportsForecasting, false);
  assert.equal(result.realDataAssessment.totalRealRequests, 8);
  assert.equal(result.realDataAssessment.distinctMonths, 2);
  console.log('[PASS] 2. Real data assessment confirms 8 requests across 2 months (insufficient for ML without synthetic benchmark).');

  assert.equal(result.categories.length, 4);
  for (const cat of result.categories) {
    assert.equal(cat.history.length, 24, `${cat.category} should have 24 monthly observations`);
    assert.equal(cat.modelParameters.trainMonths, 18);
    assert.equal(cat.modelParameters.testMonths, 6);
    assert.equal(cat.holdoutComparisons.length, 6);
    assert.ok(cat.metrics.regressionMae >= 0 && !Number.isNaN(cat.metrics.regressionMae));
    assert.ok(cat.metrics.regressionRmse >= cat.metrics.regressionMae);
    assert.ok(cat.metrics.naiveMae >= 0 && !Number.isNaN(cat.metrics.naiveMae));
    assert.ok(cat.metrics.naiveRmse >= cat.metrics.naiveMae);
  }
  console.log('[PASS] 3. Chronological 18M-train / 6M-test split and MAE/RMSE verified across all 4 categories.');

  const [persisted] = await pool.query('SELECT * FROM service_demand_forecast ORDER BY category ASC');
  assert.equal(persisted.length, 4, 'service_demand_forecast should store 4 category forecasts');
  console.log('[PASS] 4. Evaluated forecasts persisted in service_demand_forecast table.');

  const recs = await getRecommendedProvidersForRequest(1001);
  assert.equal(recs.length, 5, 'Phase 1 recommendations should still return top 5 providers');
  assert.ok(!recs.some((r) => r.business_id === 1), 'Buyer must be excluded from recommendations');
  console.log('[PASS] 5. Phase 1 SQL Provider Matching preserved (top 5 returned, buyer excluded).');

  console.log('\n--- Summary Table of Evaluated Forecast Outputs ---');
  console.table(
    result.categories.map((c) => ({
      Category: c.category,
      'Last (2026-10)': c.lastMonthActual,
      'OLS Pred (2026-11)': c.predictedNextMonth,
      'Naive Pred (2026-11)': c.naiveBaselineNextMonth,
      'Slope (b1)': c.modelParameters.slope,
      'Intercept (b0)': c.modelParameters.intercept,
      'OLS MAE': c.metrics.regressionMae,
      'OLS RMSE': c.metrics.regressionRmse,
      'Naive MAE': c.metrics.naiveMae,
      'Naive RMSE': c.metrics.naiveRmse,
      Trend: c.trendDirection,
    }))
  );
  console.log('Overall Holdout Metrics (24 test points across 4 categories):', result.overallMetrics);

  await pool.end();
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
