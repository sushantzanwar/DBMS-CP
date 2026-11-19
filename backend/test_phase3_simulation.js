import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { api } from './src/api.js';
import { pool } from './src/db.js';

const PORT = 4009;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

async function requestJson(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runPhase3Tests() {
  console.log('=== ServicePath AI — Phase 3 Market Event Simulation E2E Test Suite ===\n');

  const app = express();
  app.use(express.json());
  app.use('/api', api);

  const server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => resolve(s));
  });

  try {

    const unauthPost = await requestJson('POST', '/requests/1001/simulate-unavailability', {
      body: { unavailableProviderIds: [4] },
    });
    assert.equal(unauthPost.status, 401, 'Unauthenticated POST must return 401');

    const unauthAnalytics = await requestJson('POST', '/analytics/simulate-unavailability', {
      body: { requestId: 1001, unavailableProviderIds: [4] },
    });
    assert.equal(unauthAnalytics.status, 401, 'Unauthenticated analytics POST must return 401');
    console.log('[PASS] 1. Authorization enforced: unauthenticated simulation requests rejected with 401.');

    const token = jwt.sign({ businessId: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const badReqId = await requestJson('POST', '/requests/abc/simulate-unavailability', {
      token,
      body: { unavailableProviderIds: [4] },
    });
    assert.equal(badReqId.status, 400, 'Non-integer request ID must return 400');

    const missingReqId = await requestJson('POST', '/requests/99999/simulate-unavailability', {
      token,
      body: { unavailableProviderIds: [4] },
    });
    assert.equal(missingReqId.status, 404, 'Non-existent request ID must return 404');

    const emptyProvIds = await requestJson('POST', '/requests/1001/simulate-unavailability', {
      token,
      body: { unavailableProviderIds: [] },
    });
    assert.equal(emptyProvIds.status, 400, 'Empty unavailableProviderIds must return 400');

    const invalidProvId = await requestJson('POST', '/requests/1001/simulate-unavailability', {
      token,
      body: { unavailableProviderIds: ['not-an-int'] },
    });
    assert.equal(invalidProvId.status, 400, 'Non-integer provider ID must return 400');

    const buyerAsUnavailable = await requestJson('POST', '/requests/1001/simulate-unavailability', {
      token,
      body: { unavailableProviderIds: [1] },
    });
    assert.equal(buyerAsUnavailable.status, 400, 'Buyer business ID in unavailableProviderIds must return 400');

    const nonExistentProv = await requestJson('POST', '/requests/1001/simulate-unavailability', {
      token,
      body: { unavailableProviderIds: [9999] },
    });
    assert.equal(nonExistentProv.status, 404, 'Non-existent provider ID must return 404');
    console.log('[PASS] 2. Input validation verified (400 for invalid IDs/empty/buyer, 404 for unknown request/provider).');

    const simSingle = await requestJson('POST', '/requests/1001/simulate-unavailability', {
      token,
      body: {
        unavailableProviderIds: [4],
        reason: 'Primary provider at 100% capacity',
      },
    });
    assert.equal(simSingle.status, 200);
    const s1 = simSingle.data;
    assert.equal(s1.isEphemeralSimulation, true);
    assert.equal(s1.persistedToDatabase, false);
    assert.equal(s1.baselineTop5.length, 5);
    assert.equal(s1.simulatedAlternatives.length, 5, 'Must return 5 alternatives by promoting #6 before LIMIT 5');
    assert.equal(s1.baselineTop5[0].business_id, 4);
    assert.equal(s1.baselineTop5[0].is_unavailable, true);
    assert.ok(!s1.simulatedAlternatives.some((p) => p.business_id === 4), 'Excluded provider 4 must not appear in alternatives');
    assert.equal(
      s1.simulatedAlternatives[0].business_id,
      s1.baselineTop5[1].business_id,
      'Baseline #2 provider must move up to #1'
    );
    assert.equal(s1.simulatedAlternatives[0].baseline_rank, 2);
    assert.equal(s1.simulatedAlternatives[0].simulated_rank, 1);
    assert.equal(s1.simulatedAlternatives[0].rank_shift, 1);
    const newlyPromotedSingle = s1.simulatedAlternatives.find((p) => p.baseline_rank > 5);
    assert.ok(newlyPromotedSingle, 'Standby provider from rank #6 must enter Top 5');
    assert.equal(newlyPromotedSingle.simulated_rank, 5);
    console.log('[PASS] 3. Single top-provider unavailability verified: #2 promoted to #1, standby #6 entered Top 5 at #5.');

    const simMultiGet = await requestJson(
      'GET',
      '/requests/1001/simulate-unavailability?unavailableProviderIds=4,5&reason=Regional+outage',
      { token }
    );
    assert.equal(simMultiGet.status, 200);
    const s2 = simMultiGet.data;
    assert.equal(s2.simulatedAlternatives.length, 5, 'Must still return 5 alternatives when 2 providers excluded');
    assert.equal(s2.simulationEvent.disruptedTop5Count, 2);
    const promotedFromOutsideTop5 = s2.simulatedAlternatives.filter((p) => p.baseline_rank > 5);
    assert.equal(promotedFromOutsideTop5.length, 2, 'Ranks #6 and #7 must both enter the Top 5');

    const simAnalyticsPost = await requestJson('POST', '/analytics/simulate-unavailability', {
      token,
      body: { requestId: 1001, unavailableProviderIds: [4, 5], reason: 'Regional outage' },
    });
    assert.equal(simAnalyticsPost.status, 200);
    assert.deepEqual(
      simAnalyticsPost.data.simulatedAlternatives.map((p) => p.business_id),
      s2.simulatedAlternatives.map((p) => p.business_id)
    );
    console.log('[PASS] 4. Multi-provider simulation verified across GET and POST routes (ranks #6 and #7 promoted into Top 5).');

    const simAllUnavailable = await requestJson('POST', '/requests/1001/simulate-unavailability', {
      token,
      body: { unavailableProviderIds: [2, 3, 4, 5, 6, 7, 8] },
    });
    assert.equal(simAllUnavailable.status, 200);
    assert.equal(simAllUnavailable.data.simulatedAlternatives.length, 0);
    assert.equal(simAllUnavailable.data.simulationEvent.remainingAvailablePoolSize, 0);
    console.log('[PASS] 5. Exhausted candidate pool edge case handled gracefully (0 alternatives returned).');

    const phase1RecsAfter = await requestJson('GET', '/requests/1001/recommendations', { token });
    assert.equal(phase1RecsAfter.status, 200);
    assert.equal(phase1RecsAfter.data.length, 5);
    assert.equal(phase1RecsAfter.data[0].business_id, 4, 'Phase 1 baseline #1 must still be EduSpark Academy (ID 4)');

    const phase2ForecastAfter = await requestJson('GET', '/analytics/demand-forecast', { token });
    assert.equal(phase2ForecastAfter.status, 200);
    assert.equal(phase2ForecastAfter.data.categories.length, 4);
    assert.equal(phase2ForecastAfter.data.overallMetrics.regressionMae, 0.51);
    console.log('[PASS] 6. Ephemeral guarantee verified: Phase 1 rankings, Phase 2 forecasts, and DB records untouched.');

    console.log('\n--- Sample Simulation Output (Request #1001, Top 2 Providers [ID 4, ID 5] Unavailable) ---');
    console.log('Narrative:', s2.simulationEvent.narrative);
    console.table(
      s2.simulatedAlternatives.map((a) => ({
        SimRank: `#${a.simulated_rank}`,
        BaseRank: `#${a.baseline_rank}`,
        Shift: `+${a.rank_shift}`,
        Provider: a.business_name,
        City: a.city,
        Score: a.match_score,
        DeltaVsBase1: a.score_delta_vs_baseline_top,
        Status: a.status_change,
      }))
    );
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase3Tests().catch((err) => {
  console.error(err);
  process.exit(1);
});
