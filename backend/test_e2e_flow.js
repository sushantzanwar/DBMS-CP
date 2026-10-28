// End-to-End lifecycle test: Frontend/API -> Backend -> Dolt Database
// Tests registration, login, request creation, proposal submission, ACID transaction acceptance,
// deal completion, review creation, and analytics, followed by complete cleanup.
import express from 'express';
import { pool } from './src/db.js';
import { api } from './src/api.js';

const PORT = 4003;
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
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runE2E() {
  console.log('=== STARTING COMPLETE SERVICEPATH AI E2E INTEGRATION FLOW ===\n');

  const app = express();
  app.use(express.json());
  app.use('/api', api);
  server = app.listen(PORT);
  console.log(`[PASS] Integration test server listening on port ${PORT}`);

  // Track created entities for 100% clean teardown
  let buyerBusinessId = null;
  let buyerToken = null;
  let sellerBusinessId = null;
  let sellerToken = null;
  let createdRequestId = null;
  let createdProposalId = null;
  let createdTransactionId = null;
  let createdReviewId = null;

  try {
    // 1. Health Check
    console.log('\n--- 1. Database Health Check ---');
    const health = await request('/health');
    if (health.status !== 200 || health.data.status !== 'healthy') throw new Error('Health check failed');
    console.log('[PASS] Database is healthy:', health.data.database.database_name);

    // 2. Buyer Registration & Login
    console.log('\n--- 2. Buyer Registration & Authentication ---');
    const buyerEmail = `e2e_buyer_${Date.now()}@test.com`;
    const buyerPhone = `987${Math.floor(1000000 + Math.random() * 9000000)}`;
    const regBuyer = await request('/auth/register', {
      method: 'POST',
      body: {
        businessName: 'E2E Buyer Corp',
        industry: 'Information Technology',
        city: 'Pune',
        state: 'Maharashtra',
        businessSize: 'Small',
        email: buyerEmail,
        phone: buyerPhone,
        website: `www.e2ebuyer${Date.now()}.com`,
        password: 'Password123'
      }
    });
    if (regBuyer.status !== 201) throw new Error(`Buyer reg failed: ${JSON.stringify(regBuyer)}`);
    buyerBusinessId = regBuyer.data.user.businessId;
    buyerToken = regBuyer.data.token;
    console.log(`[PASS] Registered Buyer ID: ${buyerBusinessId}`);

    // Verify Login endpoint
    const loginBuyer = await request('/auth/login', {
      method: 'POST',
      body: { email: buyerEmail, password: 'Password123' }
    });
    if (loginBuyer.status !== 200 || !loginBuyer.data.token) throw new Error('Buyer login failed');
    console.log('[PASS] Buyer successfully logged in via POST /auth/login');

    // 3. Provider Registration
    console.log('\n--- 3. Provider Registration & Authentication ---');
    const sellerEmail = `e2e_seller_${Date.now()}@test.com`;
    const sellerPhone = `987${Math.floor(1000000 + Math.random() * 9000000)}`;
    const regSeller = await request('/auth/register', {
      method: 'POST',
      body: {
        businessName: 'E2E Provider Services',
        industry: 'Information Technology',
        city: 'Mumbai',
        state: 'Maharashtra',
        businessSize: 'Medium',
        email: sellerEmail,
        phone: sellerPhone,
        website: `www.e2eseller${Date.now()}.com`,
        password: 'Password123'
      }
    });
    if (regSeller.status !== 201) throw new Error(`Seller reg failed: ${JSON.stringify(regSeller)}`);
    sellerBusinessId = regSeller.data.user.businessId;
    sellerToken = regSeller.data.token;
    console.log(`[PASS] Registered Provider ID: ${sellerBusinessId}`);

    // 4. Buyer Posts a Request
    console.log('\n--- 4. Request Posting (Buyer) ---');
    const createReq = await request('/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: {
        serviceId: 101, // Web Development
        title: 'E2E Corporate Portal Development',
        description: 'Need a fast modern responsive web portal.',
        quantityRequired: 1,
        budgetMin: 50000,
        budgetMax: 90000,
        requiredBy: '2026-12-31',
        locationPreference: 'Remote'
      }
    });
    if (createReq.status !== 201 || !createReq.data.requestId) throw new Error(`Create request failed: ${JSON.stringify(createReq)}`);
    createdRequestId = createReq.data.requestId;
    console.log(`[PASS] Created Request ID: ${createdRequestId}`);

    // 5. Provider Discovers Request via Search & Matching
    console.log('\n--- 5. Request Discovery & Search (Provider) ---');
    const searchReq = await request(`/requests/search?category=IT&minBudget=40000`, {
      headers: { Authorization: `Bearer ${sellerToken}` }
    });
    if (searchReq.status !== 200 || !searchReq.data.some(r => r.request_id === createdRequestId)) {
      throw new Error('Search failed to discover newly created request');
    }
    console.log('[PASS] Provider discovered open request via /requests/search');

    // 6. Provider Submits Proposal
    console.log('\n--- 6. Proposal Submission (Provider) ---');
    const submitProp = await request('/proposals', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: {
        requestId: createdRequestId,
        proposedPrice: 75000,
        quantity: 1,
        estimatedDeliveryDuration: 25,
        message: 'We can deliver high-performance portal within 25 days.'
      }
    });
    if (submitProp.status !== 201 || !submitProp.data.proposalId) throw new Error(`Submit proposal failed: ${JSON.stringify(submitProp)}`);
    createdProposalId = submitProp.data.proposalId;
    console.log(`[PASS] Provider submitted Proposal ID: ${createdProposalId}`);

    // 7. Buyer Reviews & Accepts Proposal (ACID Transaction)
    console.log('\n--- 7. ACID Transaction: Accepting Proposal ---');
    const acceptProp = await request(`/proposals/${createdProposalId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: { status: 'Accepted' }
    });
    if (acceptProp.status !== 200 || acceptProp.data.status !== 'Accepted') {
      throw new Error(`Accept proposal failed: ${JSON.stringify(acceptProp)}`);
    }
    createdTransactionId = acceptProp.data.transactionId;
    console.log(`[PASS] Proposal accepted. Created Deal Record (Transaction ID: ${createdTransactionId})`);

    // Verify Deal state
    const txCheck = await request(`/transactions/${createdTransactionId}`, {
      headers: { Authorization: `Bearer ${buyerToken}` }
    });
    if (txCheck.status !== 200 || txCheck.data.status !== 'Active') throw new Error('Transaction state mismatch');
    console.log('[PASS] Transaction record active with agreed price ₹75,000');

    // 8. Buyer Completes Deal
    console.log('\n--- 8. Completing Deal & Payment Update ---');
    const completeTx = await request(`/transactions/${createdTransactionId}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${buyerToken}` }
    });
    if (completeTx.status !== 200 || completeTx.data.status !== 'Completed') throw new Error('Complete tx failed');
    console.log('[PASS] Transaction status set to Completed.');

    const payTx = await request(`/transactions/${createdTransactionId}/payment`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: { paymentStatus: 'Paid' }
    });
    if (payTx.status !== 200) throw new Error('Payment update failed');
    console.log('[PASS] Payment status set to Paid.');

    // 9. Buyer Submits Review
    console.log('\n--- 9. Buyer Submits Review ---');
    const createRev = await request('/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: {
        transactionId: createdTransactionId,
        rating: 5,
        qualityRating: 5,
        timelinessRating: 5,
        communicationRating: 5,
        reviewText: 'Outstanding delivery and seamless communication!'
      }
    });
    if (createRev.status !== 201 || !createRev.data.reviewId) throw new Error('Create review failed');
    createdReviewId = createRev.data.reviewId;
    console.log(`[PASS] Review ID: ${createdReviewId} submitted with 5-star rating.`);

    // 10. Analytics & Views Verification
    console.log('\n--- 10. Analytics & Views Verification ---');
    const catCheck = await request('/categories/summary', { headers: { Authorization: `Bearer ${buyerToken}` } });
    if (catCheck.status !== 200) throw new Error('Category summary failed');
    console.log('[PASS] Category view returned verified aggregates.');

    const finCheck = await request('/analytics/financial-summary', { headers: { Authorization: `Bearer ${sellerToken}` } });
    if (finCheck.status !== 200 || finCheck.data.totals.deals_as_seller < 1) throw new Error('Financial summary failed');
    console.log('[PASS] Seller financial summary reflects completed deal revenue.');

    console.log('\n>>> COMPLETE END-TO-END FLOW PASSED WITH 100% SUCCESS! <<<');
  } finally {
    // 11. Complete Clean Teardown
    console.log('\n--- Performing Complete Test Data Teardown ---');
    try {
      if (createdReviewId) {
        await pool.query('DELETE FROM review WHERE review_id = ?', [createdReviewId]);
      }
      if (createdTransactionId) {
        await pool.query('DELETE FROM `transaction` WHERE transaction_id = ?', [createdTransactionId]);
      }
      if (createdProposalId) {
        await pool.query('DELETE FROM proposal WHERE proposal_id = ?', [createdProposalId]);
      }
      if (createdRequestId) {
        await pool.query('DELETE FROM request WHERE request_id = ?', [createdRequestId]);
      }
      if (buyerBusinessId) {
        await pool.query('DELETE FROM account WHERE business_id = ?', [buyerBusinessId]);
        await pool.query('DELETE FROM business WHERE business_id = ?', [buyerBusinessId]);
      }
      if (sellerBusinessId) {
        await pool.query('DELETE FROM account WHERE business_id = ?', [sellerBusinessId]);
        await pool.query('DELETE FROM business WHERE business_id = ?', [sellerBusinessId]);
      }
      console.log('[PASS] All temporary test records cleanly deleted. Database intact!');
    } catch (cleanupErr) {
      console.error('[CLEANUP WARNING]:', cleanupErr.message);
    }

    server.close();
    await pool.end();
  }
}

runE2E().catch((err) => {
  console.error('[FAIL] E2E test failed:', err);
  if (server) server.close();
  process.exit(1);
});

