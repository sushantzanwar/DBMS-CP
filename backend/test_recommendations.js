import { getRecommendedProvidersForRequest } from './src/queries.js';
import { pool } from './src/db.js';

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc}`);
    failed++;
  }
}

async function runTests() {
  console.log('--- TESTING SQL-BASED PROVIDER MATCHING ENGINE ---\n');

  try {
    // Test 1: Accuracy on Request 1001 (Web Dev in Pune, Buyer: TechNova in Mumbai)
    console.log('1. Testing Ranking Accuracy for Request 1001...');
    const recs1001 = await getRecommendedProvidersForRequest(1001);
    assert('Returns array of recommendations', Array.isArray(recs1001) && recs1001.length > 0);
    assert('EduSpark Academy (Provider 4) ranked top due to past completed Web Dev delivery', recs1001[0].business_id === 4);
    assert('EduSpark match_score is 95%', recs1001[0].match_score === 95);
    assert('TechNova (Buyer 1) is excluded from recommendation list', !recs1001.some(p => p.business_id === 1));
    assert('Breakdown components sum to match_score', 
      Number(recs1001[0].capability_score) + 
      Number(recs1001[0].location_score) + 
      Number(recs1001[0].reputation_score) + 
      Number(recs1001[0].track_record_score) === recs1001[0].match_score
    );

    // Test 2: Accuracy on Request 1002 (Digital Marketing in Mumbai, Buyer: GreenLeaf)
    console.log('\n2. Testing Ranking Accuracy for Request 1002...');
    const recs1002 = await getRecommendedProvidersForRequest(1002);
    assert('Top match has high score', recs1002[0].match_score >= 75);
    assert('GreenLeaf (Buyer 2) is excluded', !recs1002.some(p => p.business_id === 2));

    // Test 3: Invalid Request ID throws 404
    console.log('\n3. Testing Invalid Request ID...');
    let caught404 = false;
    try {
      await getRecommendedProvidersForRequest(999999);
    } catch (err) {
      caught404 = err.status === 404;
    }
    assert('Non-existent request returns 404 error', caught404);

    // Test 4: String/NaN handling
    console.log('\n4. Testing Edge Cases...');
    let caughtNaN = false;
    try {
      await getRecommendedProvidersForRequest('abc');
    } catch (err) {
      caughtNaN = true;
    }
    assert('Invalid non-numeric input handled safely', caughtNaN);

    console.log(`\n===========================================`);
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`===========================================\n`);
  } finally {
    await pool.end();
  }
}

runTests().catch(console.error);

