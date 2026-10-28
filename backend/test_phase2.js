// Automated test script for Phase 2 backend DBMS features.
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from './src/db.js';
import { api } from './src/api.js';

const PORT = 4002;
let server;
const baseUrl = `http://127.0.0.1:${PORT}/api`;

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function runPhase2Tests() {
  console.log('--- STARTING PHASE 2 DBMS CONCEPTS TEST SUITE ---');

  const app = express();
  app.use(express.json());
  app.use('/api', api);
  server = app.listen(PORT);
  console.log(`[PASS] Phase 2 test server active on port ${PORT}`);

  try {
    const tokenBiz1 = jwt.sign({ businessId: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const authHeaders = { Authorization: `Bearer ${tokenBiz1}` };

    // TEST 1: Database View & Aggregates (v_category_summary)
    console.log('\n--- 1. Testing Database View: v_category_summary (GET /api/categories/summary) ---');
    const catRes = await request('/categories/summary', { headers: authHeaders });
    if (catRes.status !== 200 || !Array.isArray(catRes.data) || !catRes.data.length) {
      throw new Error(`Category summary failed: ${JSON.stringify(catRes)}`);
    }
    console.log(`[PASS] Returned ${catRes.data.length} categories from view:`);
    console.table(catRes.data);

    // TEST 2: 4-Table JOIN + GROUP BY + HAVING (GET /api/analytics/top-providers)
    console.log('\n--- 2. Testing 4-Table JOIN with GROUP BY & HAVING (GET /api/analytics/top-providers) ---');
    const topRes = await request('/analytics/top-providers', { headers: authHeaders });
    if (topRes.status !== 200 || !Array.isArray(topRes.data)) {
      throw new Error(`Top providers query failed: ${JSON.stringify(topRes)}`);
    }
    console.log(`[PASS] Top providers (${topRes.data.length} rows returned):`);
    console.table(topRes.data);

    // TEST 3: Anti-Join (LEFT JOIN ... WHERE right.PK IS NULL) (GET /api/requests/unanswered)
    console.log('\n--- 3. Testing Anti-Join (GET /api/requests/unanswered) ---');
    const unansRes = await request('/requests/unanswered', { headers: authHeaders });
    if (unansRes.status !== 200 || !Array.isArray(unansRes.data)) {
      throw new Error(`Unanswered requests query failed: ${JSON.stringify(unansRes)}`);
    }
    console.log(`[PASS] Found ${unansRes.data.length} unanswered requests using anti-join.`);
    if (unansRes.data.length) {
      console.log('Sample unanswered request:', {
        request_id: unansRes.data[0].request_id,
        title: unansRes.data[0].title,
        buyer_name: unansRes.data[0].buyer_name
      });
    }

    // TEST 4: Correlated Subquery with NOT EXISTS (GET /api/requests?scope=unbid)
    console.log('\n--- 4. Testing Correlated Subquery with NOT EXISTS (GET /api/requests?scope=unbid) ---');
    const unbidRes = await request('/requests?scope=unbid', { headers: authHeaders });
    if (unbidRes.status !== 200 || !Array.isArray(unbidRes.data)) {
      throw new Error(`Unbid requests query failed: ${JSON.stringify(unbidRes)}`);
    }
    console.log(`[PASS] Found ${unbidRes.data.length} open requests where Business 1 has NOT yet submitted a bid.`);

    // TEST 5: Correlated Subquery with EXISTS (GET /api/requests?scope=my-bids)
    console.log('\n--- 5. Testing Correlated Subquery with EXISTS (GET /api/requests?scope=my-bids) ---');
    const myBidsRes = await request('/requests?scope=my-bids', { headers: authHeaders });
    if (myBidsRes.status !== 200 || !Array.isArray(myBidsRes.data)) {
      throw new Error(`My-bids requests query failed: ${JSON.stringify(myBidsRes)}`);
    }
    console.log(`[PASS] Found ${myBidsRes.data.length} requests where Business 1 submitted a proposal.`);

    // TEST 6: Nested Independent Subquery (GET /api/requests?scope=above-average-budget)
    console.log('\n--- 6. Testing Nested Subquery with AVG() (GET /api/requests?scope=above-average-budget) ---');
    const aboveAvgRes = await request('/requests?scope=above-average-budget', { headers: authHeaders });
    if (aboveAvgRes.status !== 200 || !Array.isArray(aboveAvgRes.data)) {
      throw new Error(`Above-average budget requests query failed: ${JSON.stringify(aboveAvgRes)}`);
    }
    console.log(`[PASS] Found ${aboveAvgRes.data.length} requests with budget above average.`);

    // TEST 7: Dynamic Multi-Table Filtering (GET /api/requests/search)
    console.log('\n--- 7. Testing Multi-Criteria Parameterized Search (GET /api/requests/search) ---');
    const searchRes = await request('/requests/search?category=IT&minBudget=50000', { headers: authHeaders });
    if (searchRes.status !== 200 || !Array.isArray(searchRes.data)) {
      throw new Error(`Search requests query failed: ${JSON.stringify(searchRes)}`);
    }
    console.log(`[PASS] Search returned ${searchRes.data.length} matching requests:`);
    if (searchRes.data.length) {
      console.table(searchRes.data.map(r => ({
        id: r.request_id,
        title: r.title,
        category: r.category,
        budget: `${r.budget_min} - ${r.budget_max}`,
        buyer: r.buyer_name,
        days_left: r.days_left
      })));
    }

    // TEST 8: Foreign Key Navigation JOIN (GET /api/services/101/requests)
    console.log('\n--- 8. Testing Service Requests Navigation JOIN (GET /api/services/101/requests) ---');
    const svcReqRes = await request('/services/101/requests', { headers: authHeaders });
    if (svcReqRes.status !== 200 || !Array.isArray(svcReqRes.data)) {
      throw new Error(`Service requests navigation query failed: ${JSON.stringify(svcReqRes)}`);
    }
    console.log(`[PASS] Found ${svcReqRes.data.length} requests demanding Service 101 (Web Development).`);

    // TEST 9: Conditional Aggregation with CASE & Temporal GROUP BY (GET /api/analytics/financial-summary)
    console.log('\n--- 9. Testing Conditional Aggregation with CASE & Monthly Trend (GET /api/analytics/financial-summary) ---');
    const finRes = await request('/analytics/financial-summary', { headers: authHeaders });
    if (finRes.status !== 200 || !finRes.data.totals) {
      throw new Error(`Financial summary query failed: ${JSON.stringify(finRes)}`);
    }
    console.log('[PASS] Lifetime totals with conditional CASE expressions:', finRes.data.totals);
    console.log('[PASS] Monthly completed deals trend:', finRes.data.monthlyTrend);

    // TEST 10: Authentication Verification (unauthenticated request receives 401)
    console.log('\n--- 10. Testing Authentication Verification (No Token -> 401) ---');
    const noAuthRes = await request('/analytics/top-providers');
    if (noAuthRes.status !== 401) {
      throw new Error(`Authentication check failed. Expected 401, got ${noAuthRes.status}`);
    }
    console.log('[PASS] Protected endpoint correctly rejected unauthenticated request with 401.');

    // TEST 11: Ownership Access Control Verification
    console.log('\n--- 11. Testing Ownership Access Control (Unauthorized Business -> 404/Denied) ---');
    // Proposal 2001 is strictly between Buyer 1 (TechNova) and Provider 4 (EduSpark).
    // An unrelated business (e.g. Business 2: GreenLeaf Foods) must NOT be able to view it.
    const tokenBiz2 = jwt.sign({ businessId: 2 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const deniedRes = await request('/proposals/2001', { headers: { Authorization: `Bearer ${tokenBiz2}` } });
    if (deniedRes.status !== 404) {
      throw new Error(`Ownership check failed. Expected 404 access denied, got ${deniedRes.status}`);
    }
    console.log('[PASS] Ownership check correctly blocked unrelated business from viewing private proposal.');

    // TEST 12: Parameter Validation & Edge Case Handling
    console.log('\n--- 12. Testing Parameter Validation & Non-numeric Edge Cases ---');
    const edgeRes = await request('/requests/search?minBudget=invalidText&maxBudget=NaN', { headers: authHeaders });
    if (edgeRes.status !== 200 || !Array.isArray(edgeRes.data)) {
      throw new Error(`Parameter edge case handling failed: ${JSON.stringify(edgeRes)}`);
    }
    console.log('[PASS] Non-numeric budget params safely ignored without SQL error or injection.');

    console.log('\n========================================================');
    console.log('>>> ALL 12 PHASE 2 DBMS & SECURITY TESTS PASSED! <<<');
    console.log('========================================================\n');
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase2Tests().catch((err) => {
  console.error('[FAIL] Phase 2 test suite failed:', err);
  if (server) server.close();
  process.exit(1);
});

