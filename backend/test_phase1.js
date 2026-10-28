
// Automated test script for Phase 1 backend implementation.
import http from 'node:http';
import { pool } from './src/db.js';

const PORT = 4001; // Run test server on port 4001
let server;
let baseUrl = `http://127.0.0.1:${PORT}/api`;

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

async function runTests() {
  console.log('--- STARTING PHASE 1 BACKEND TESTS ---');

  let createdBusinessId = null;
  let originalPaymentStatus = null;

  // 1. Start test express server
  const { api } = await import('./src/api.js');
  const express = (await import('express')).default;
  const app = express();
  app.use(express.json());
  app.use('/api', api);
  server = app.listen(PORT);
  console.log(`[PASS] Test server started on port ${PORT}`);

  try {
    // Record original status of transaction 3002 before test modifies it
    const [[origTx]] = await pool.query('SELECT payment_status FROM `transaction` WHERE transaction_id = 3002');
    originalPaymentStatus = origTx ? origTx.payment_status : 'Paid';
    // 2. Test GET /api/health
    console.log('\nTesting 1: Database Health Check (GET /api/health)...');
    const healthRes = await request('/health');
    if (healthRes.status !== 200 || healthRes.data.status !== 'healthy') {
      throw new Error(`Health check failed: ${JSON.stringify(healthRes)}`);
    }
    console.log('[PASS] Health check returned:', healthRes.data.database);

    // 3. Test Business Registration / Login
    console.log('\nTesting 2: Business Registration & Token Issuance...');
    const testEmail = `test_${Date.now()}@biz.com`;
    const testPhone = `987${Math.floor(1000000 + Math.random() * 9000000)}`;
    const testWebsite = `www.apex${Date.now()}.in`;
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: {
        businessName: 'Apex Cloud Innovations',
        industry: 'Information Technology',
        city: 'Pune',
        state: 'Maharashtra',
        businessSize: 'Small',
        email: testEmail,
        phone: testPhone,
        website: testWebsite,
        description: 'Cloud native computing and architectures',
        password: 'Password123'
      }
    });

    if (regRes.status !== 201 || !regRes.data.token) {
      throw new Error(`Registration failed: ${JSON.stringify(regRes)}`);
    }
    const token = regRes.data.token;
    const businessId = regRes.data.user.businessId;
    createdBusinessId = businessId;
    const authHeaders = { Authorization: `Bearer ${token}` };
    console.log(`[PASS] Registered test business ID: ${businessId}`);

    // 4. Test GET /api/profile
    console.log('\nTesting 3: Get Complete Profile (GET /api/profile)...');
    const profileRes = await request('/profile', { headers: authHeaders });
    if (profileRes.status !== 200 || profileRes.data.business_id !== businessId) {
      throw new Error(`Profile fetch failed: ${JSON.stringify(profileRes)}`);
    }
    console.log('[PASS] Fetched profile:', profileRes.data.business_name, profileRes.data.email);

    // 5. Test PUT /api/profile (Update Profile)
    console.log('\nTesting 4: Update Profile (PUT /api/profile)...');
    const updateRes = await request('/profile', {
      method: 'PUT',
      headers: authHeaders,
      body: {
        businessName: 'Apex Cloud Innovations Private Limited',
        industry: 'Information Technology',
        city: 'Pune',
        state: 'Maharashtra',
        businessSize: 'Medium',
        employees: 25,
        revenueRange: '50L-1Cr',
        businessAge: 4,
        businessStage: 'Growth',
        description: 'Enterprise cloud transformation and managed DevOps',
        phone: testPhone,
        website: testWebsite
      }
    });
    if (updateRes.status !== 200) {
      throw new Error(`Profile update failed: ${JSON.stringify(updateRes)}`);
    }
    const updatedProfileRes = await request('/profile', { headers: authHeaders });
    if (updatedProfileRes.data.business_name !== 'Apex Cloud Innovations Private Limited' || updatedProfileRes.data.employees !== 25) {
      throw new Error(`Profile update persistence failed: ${JSON.stringify(updatedProfileRes)}`);
    }
    console.log('[PASS] Profile updated successfully and verified in database.');

    // 6. Test GET /api/services/:id
    console.log('\nTesting 5: Get Service Details (GET /api/services/101)...');
    const serviceRes = await request('/services/101', { headers: authHeaders });
    if (serviceRes.status !== 200 || serviceRes.data.service_id !== 101) {
      throw new Error(`Service fetch failed: ${JSON.stringify(serviceRes)}`);
    }
    console.log('[PASS] Service 101 details:', {
      service_name: serviceRes.data.service_name,
      category: serviceRes.data.category,
      category_average: serviceRes.data.category_average,
      total_requests: serviceRes.data.total_requests
    });

    // 7. Test GET /api/proposals/:id
    console.log('\nTesting 6: Get Proposal Details (GET /api/proposals/2001)...');
    // Proposal 2001 has buyer_business_id = 1 (TechNova) and provider_business_id = 4 (EduSpark)
    // Let's test with a simulated token for business 1
    const jwt = (await import('jsonwebtoken')).default;
    const tokenBiz1 = jwt.sign({ businessId: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const proposalRes = await request('/proposals/2001', { headers: { Authorization: `Bearer ${tokenBiz1}` } });
    if (proposalRes.status !== 200 || proposalRes.data.proposal_id !== 2001) {
      throw new Error(`Proposal fetch failed: ${JSON.stringify(proposalRes)}`);
    }
    console.log('[PASS] Proposal 2001 details:', {
      proposal_id: proposalRes.data.proposal_id,
      request_title: proposalRes.data.request_title,
      proposed_price: proposalRes.data.proposed_price,
      budget_fit: proposalRes.data.budget_fit,
      provider_name: proposalRes.data.provider_name
    });

    // 8. Test GET /api/transactions/:id
    console.log('\nTesting 7: Get Transaction Details (GET /api/transactions/3001)...');
    const txRes = await request('/transactions/3001', { headers: { Authorization: `Bearer ${tokenBiz1}` } });
    if (txRes.status !== 200 || txRes.data.transaction_id !== 3001) {
      throw new Error(`Transaction fetch failed: ${JSON.stringify(txRes)}`);
    }
    console.log('[PASS] Transaction 3001 details:', {
      transaction_id: txRes.data.transaction_id,
      buyer_name: txRes.data.buyer_name,
      seller_name: txRes.data.seller_name,
      agreed_price: txRes.data.agreed_price,
      payment_status: txRes.data.payment_status
    });

    // 9. Test PATCH /api/transactions/:id/payment
    console.log('\nTesting 8: Update Transaction Payment Status (PATCH /api/transactions/3002/payment)...');
    // Transaction 3002 has seller_business_id = 1, status = Active, payment_status = Paid
    const payRes = await request('/transactions/3002/payment', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenBiz1}` },
      body: { paymentStatus: 'Paid' }
    });
    if (payRes.status !== 200) {
      throw new Error(`Transaction payment update failed: ${JSON.stringify(payRes)}`);
    }
    console.log('[PASS] Transaction payment updated successfully:', payRes.data);

    console.log('\n>>> ALL PHASE 1 TESTS COMPLETED SUCCESSFULLY! <<<');
  } finally {
    // Teardown / isolation: restore original data and clean up created test records
    try {
      if (originalPaymentStatus) {
        await pool.query('UPDATE `transaction` SET payment_status = ? WHERE transaction_id = 3002', [originalPaymentStatus]);
      }
      if (createdBusinessId) {
        await pool.query('DELETE FROM account WHERE business_id = ?', [createdBusinessId]);
        await pool.query('DELETE FROM business WHERE business_id = ?', [createdBusinessId]);
        console.log(`[CLEANUP] Deleted temporary test business ID: ${createdBusinessId}`);
      }
    } catch (cleanupErr) {
      console.error('[CLEANUP ERROR]:', cleanupErr.message);
    }
    server.close();
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('[FAIL] Test failed:', err);
  if (server) server.close();
  process.exit(1);
});
