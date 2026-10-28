// Automated test suite for Phase A (Assignments 1, 3, 4, 5).
// Verifies all queries against the actual Dolt/MySQL engine.
import { pool } from './src/db.js';

async function runPhaseATests() {
  console.log('========================================================');
  console.log('   STARTING PHASE A ASSIGNMENTS COMPREHENSIVE TEST SUITE');
  console.log('========================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(name, condition, details = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS] ${name} ${details ? '(' + details + ')' : ''}`);
    } else {
      console.error(`[FAIL] ${name} ${details ? ': ' + details : ''}`);
      throw new Error(`Test assertion failed: ${name}`);
    }
  }

  try {
    // ------------------------------------------------------------------------
    // ASSIGNMENT 1: DDL, DML & CONSTRAINTS
    // ------------------------------------------------------------------------
    console.log('\n--- TESTING ASSIGNMENT 1: DDL, DML & CONSTRAINTS ---');

    // 1.1 CREATE TABLE with constraints
    await pool.query(`
      CREATE TABLE IF NOT EXISTS demo_service_vendor (
        vendor_id       INT           NOT NULL,
        business_id     INT           NOT NULL,
        tax_identifier  VARCHAR(20)   NOT NULL,
        years_active    INT           DEFAULT 1,
        hourly_rate     DECIMAL(10,2) NOT NULL,
        is_verified     TINYINT(1)    DEFAULT 0,
        CONSTRAINT pk_demo_vendor PRIMARY KEY (vendor_id),
        CONSTRAINT fk_demo_vendor_business FOREIGN KEY (business_id) REFERENCES business (business_id) ON DELETE CASCADE,
        CONSTRAINT uq_demo_vendor_tax UNIQUE (tax_identifier),
        CONSTRAINT chk_demo_vendor_years CHECK (years_active >= 0),
        CONSTRAINT chk_demo_vendor_rate  CHECK (hourly_rate > 0)
      )
    `);
    assert('1.1 DDL CREATE TABLE with PK, FK, UNIQUE, CHECK constraints', true);

    // 1.2 ALTER TABLE: Add and Drop Column
    await pool.query(`ALTER TABLE demo_service_vendor ADD COLUMN vendor_tier VARCHAR(10) DEFAULT 'Silver'`);
    await pool.query(`ALTER TABLE demo_service_vendor DROP COLUMN vendor_tier`);
    assert('1.2 DDL ALTER TABLE ADD and DROP column', true);

    // 1.3 DML INSERT
    await pool.query(`
      INSERT INTO demo_service_vendor (vendor_id, business_id, tax_identifier, years_active, hourly_rate, is_verified)
      VALUES (501, 1, 'GSTIN-MH-001', 5, 2500.00, 1),
             (502, 4, 'GSTIN-MH-004', 3, 1200.00, 1)
    `);
    const [insertedRows] = await pool.query('SELECT * FROM demo_service_vendor');
    assert('1.3 DML INSERT rows with valid foreign keys', insertedRows.length === 2, `2 rows inserted`);

    // 1.4 DML UPDATE and DELETE
    await pool.query('UPDATE demo_service_vendor SET hourly_rate = 2750.00 WHERE vendor_id = 501');
    const [[updatedRow]] = await pool.query('SELECT hourly_rate FROM demo_service_vendor WHERE vendor_id = 501');
    assert('1.4 DML UPDATE row', Number(updatedRow.hourly_rate) === 2750.00);

    await pool.query('DELETE FROM demo_service_vendor WHERE vendor_id = 502');
    const [rowsAfterDelete] = await pool.query('SELECT * FROM demo_service_vendor');
    assert('1.5 DML DELETE row', rowsAfterDelete.length === 1);

    // 1.6 DDL TRUNCATE TABLE
    await pool.query('TRUNCATE TABLE demo_service_vendor');
    const [[truncateCount]] = await pool.query('SELECT COUNT(*) AS c FROM demo_service_vendor');
    assert('1.6 DDL TRUNCATE TABLE resets rows', truncateCount.c === 0);

    // 1.7 Clean Teardown
    await pool.query('DROP TABLE IF EXISTS demo_service_vendor');
    assert('1.7 DDL DROP TABLE teardown', true);

    // ------------------------------------------------------------------------
    // ASSIGNMENT 3: VIEWS (MULTI-TABLE & UPDATABLE)
    // ------------------------------------------------------------------------
    console.log('\n--- TESTING ASSIGNMENT 3: VIEWS ---');

    // 3.1 Multi-Table View (v_request_summary)
    const [reqSummary] = await pool.query('SELECT * FROM v_request_summary LIMIT 3');
    assert('3.1 Multi-Table View: v_request_summary', reqSummary.length > 0, `${reqSummary.length} rows returned`);

    // 3.2 Complex Pre-Aggregated View (v_category_summary)
    const [catSummary] = await pool.query('SELECT * FROM v_category_summary');
    assert('3.2 Complex View: v_category_summary without fan-out', catSummary.length === 4, `4 categories verified`);

    // 3.3 Create View with WITH CHECK OPTION
    await pool.query(`
      CREATE OR REPLACE VIEW v_active_service_catalog AS
      SELECT service_id, service_name, category, average_price, complexity, active_status
        FROM service
       WHERE active_status = 1
        WITH CHECK OPTION
    `);
    const [activeServices] = await pool.query('SELECT * FROM v_active_service_catalog');
    assert('3.3 View with WITH CHECK OPTION: v_active_service_catalog', activeServices.length === 5, `5 active services`);

    // ------------------------------------------------------------------------
    // ASSIGNMENT 4: COMPREHENSIVE JOINS
    // ------------------------------------------------------------------------
    console.log('\n--- TESTING ASSIGNMENT 4: COMPREHENSIVE JOINS ---');

    // 4.1 Equi-Join
    const [equiJoin] = await pool.query(`
      SELECT r.request_id, r.title, b.business_name, s.service_name
        FROM request r
        JOIN business b ON b.business_id = r.business_id
        JOIN service  s ON s.service_id  = r.service_id
    `);
    assert('4.1 Equi-Join (request + business + service)', equiJoin.length > 0, `${equiJoin.length} joined rows`);

    // 4.2 Non-Equi Join (BETWEEN)
    const [nonEquiBetween] = await pool.query(`
      SELECT p.proposal_id, p.proposed_price, r.budget_min, r.budget_max
        FROM proposal p
        JOIN request r ON p.request_id = r.request_id AND p.proposed_price BETWEEN r.budget_min AND r.budget_max
    `);
    assert('4.2 Non-Equi Join using BETWEEN', nonEquiBetween.length > 0, `${nonEquiBetween.length} matching bids`);

    // 4.3 Non-Equi Self-Join (>)
    const [nonEquiSelf] = await pool.query(`
      SELECT s1.service_name AS higher, s2.service_name AS lower, (s1.average_price - s2.average_price) AS diff
        FROM service s1
        JOIN service s2 ON s1.category = s2.category AND s1.average_price > s2.average_price
    `);
    assert('4.3 Non-Equi Self-Join on price disparity (>)', nonEquiSelf.length > 0, `Disparity: ₹${nonEquiSelf[0].diff}`);

    // 4.4 Self-Join (Role-based: buyer and seller)
    const [selfJoin] = await pool.query(`
      SELECT t.transaction_id, buyer.business_name AS buyer, seller.business_name AS seller
        FROM \`transaction\` t
        JOIN business buyer  ON buyer.business_id  = t.buyer_business_id
        JOIN business seller ON seller.business_id = t.seller_business_id
    `);
    assert('4.4 Role-Based Self-Join on transaction parties', selfJoin.length > 0, `${selfJoin.length} transactions`);

    // 4.5 Natural Join (using projected common key service_id to prevent description column collision)
    const [natJoin] = await pool.query(`
      SELECT r.request_id, r.title, r.service_id, s.service_name
        FROM (SELECT request_id, title, service_id FROM request) r
        NATURAL JOIN (SELECT service_id, service_name, category FROM service) s
    `);
    assert('4.5 Natural Join on matching column (service_id)', natJoin.length > 0, `${natJoin.length} rows`);

    // 4.6 Outer Joins (Left, Right, Full Outer Emulation, Anti-Join)
    const [leftJoin] = await pool.query(`
      SELECT b.business_id, b.business_name, rv.review_id
        FROM business b LEFT JOIN review rv ON rv.reviewed_business_id = b.business_id
    `);
    assert('4.6 Left Outer Join (all businesses preserved)', leftJoin.length >= 8);

    const [antiJoin] = await pool.query(`
      SELECT r.request_id, r.title
        FROM request r LEFT JOIN proposal p ON p.request_id = r.request_id
       WHERE r.status = 'Open' AND p.proposal_id IS NULL
    `);
    assert('4.7 Anti-Join for unanswered requests (Set Difference)', antiJoin.length > 0, `${antiJoin.length} unanswered`);

    const [fullOuter] = await pool.query(`
      SELECT b.business_id, r.request_id FROM business b LEFT JOIN request r ON r.business_id = b.business_id
      UNION
      SELECT b.business_id, r.request_id FROM business b RIGHT JOIN request r ON r.business_id = b.business_id
    `);
    assert('4.8 Full Outer Join Emulation via UNION', fullOuter.length > 0, `${fullOuter.length} combined rows`);

    // ------------------------------------------------------------------------
    // ASSIGNMENT 5: ADVANCED SELECT, OPERATORS, SET OPS & SUBQUERIES
    // ------------------------------------------------------------------------
    console.log('\n--- TESTING ASSIGNMENT 5: ADVANCED SELECT & SET OPERATORS ---');

    // 5.1 Relational & Logical Operators (AND, OR, NOT)
    const [relOps] = await pool.query(`
      SELECT business_id, business_name FROM business
       WHERE state = 'Maharashtra' AND (business_size = 'Large' OR business_size = 'Medium')
         AND NOT (employees < 20)
    `);
    assert('5.1 Relational & Compound Logical Operators', relOps.length > 0, `${relOps.length} businesses`);

    // 5.2 Range and Membership (BETWEEN, IN, NOT IN, IS NULL)
    const [rangeOps] = await pool.query(`
      SELECT request_id, budget_max FROM request WHERE budget_max BETWEEN 30000.00 AND 80000.00
    `);
    assert('5.2 Range Operator: BETWEEN', rangeOps.length > 0, `${rangeOps.length} requests in budget`);

    const [inOps] = await pool.query(`
      SELECT service_id FROM service WHERE category IN ('IT', 'Marketing') AND service_id NOT IN (105)
    `);
    assert('5.3 List Membership Operators: IN and NOT IN', inOps.length > 0, `${inOps.length} services`);

    // 5.3 Pattern Matching (LIKE with % and _)
    const [likePercent] = await pool.query(`
      SELECT business_id, business_name FROM business WHERE business_name LIKE '%Tech%'
    `);
    assert('5.4 Pattern Matching: LIKE with multi-character wildcard (%)', likePercent.length > 0);

    const [likeUnderscore] = await pool.query(`
      SELECT business_id, phone FROM business WHERE phone LIKE '987650001_'
    `);
    assert('5.5 Pattern Matching: LIKE with single-character wildcard (_)', likeUnderscore.length > 0, `${likeUnderscore.length} matching phones`);

    // 5.4 Aggregate Functions with GROUP BY and HAVING
    const [grpHaving] = await pool.query(`
      SELECT b.business_id, b.business_name,
             COUNT(DISTINCT t.transaction_id) AS total_deals,
             COALESCE(SUM(t.agreed_price), 0) AS total_revenue
        FROM business b
        JOIN \`transaction\` t ON t.seller_business_id = b.business_id
       WHERE t.status = 'Completed'
       GROUP BY b.business_id, b.business_name
      HAVING total_deals >= 1
    `);
    assert('5.6 Aggregate Functions with GROUP BY & HAVING', grpHaving.length > 0, `${grpHaving.length} qualified sellers`);

    // 5.5 Set Operators: UNION, UNION ALL, INTERSECT, EXCEPT
    const [unionRows] = await pool.query(`
      SELECT city FROM business WHERE industry = 'Information Technology'
      UNION
      SELECT city FROM business WHERE business_size = 'Large'
    `);
    assert('5.7 Set Operator: UNION (Distinct)', unionRows.length > 0, `${unionRows.length} distinct cities`);

    const [unionAllRows] = await pool.query(`
      SELECT city FROM business WHERE industry = 'Information Technology'
      UNION ALL
      SELECT city FROM business WHERE business_size = 'Large'
    `);
    assert('5.8 Set Operator: UNION ALL (Preserves duplicates)', unionAllRows.length >= unionRows.length);

    const [intersectRows] = await pool.query(`
      SELECT buyer_business_id AS dual_role_business_id FROM \`transaction\`
      INTERSECT
      SELECT seller_business_id FROM \`transaction\`
    `);
    assert('5.9 Set Operator: INTERSECT (Dual buyer & seller businesses)', intersectRows.length > 0, `ID: ${intersectRows[0].dual_role_business_id}`);

    const [exceptRows] = await pool.query(`
      SELECT buyer_business_id AS buyer_only_id FROM \`transaction\`
      EXCEPT
      SELECT seller_business_id FROM \`transaction\`
    `);
    assert('5.10 Set Operator: EXCEPT (Buyer-only businesses)', exceptRows.length > 0, `${exceptRows.length} businesses`);

    // 5.6 Single-Row Functions
    const [functionsRow] = await pool.query(`
      SELECT UPPER('technova') AS upper_case,
             CONCAT_WS(', ', 'Pune', 'MH') AS concat_str,
             COALESCE(NULL, 'Default') AS coalesce_val,
             ROUND(4.666, 2) AS rounded_val,
             DATEDIFF(CURDATE(), CURDATE()) AS diff_val
    `);
    assert('5.11 Single-Row Functions (UPPER, CONCAT_WS, COALESCE, ROUND, DATEDIFF)',
      functionsRow[0].upper_case === 'TECHNOVA' &&
      Number(functionsRow[0].rounded_val) === 4.67 &&
      functionsRow[0].coalesce_val === 'Default' &&
      Number(functionsRow[0].diff_val) === 0
    );

    // 5.7 Subqueries (Nested & Correlated with EXISTS / NOT EXISTS)
    const [nestedSub] = await pool.query(`
      SELECT service_id, service_name, average_price FROM service
       WHERE active_status = 1 AND average_price > (SELECT AVG(average_price) FROM service WHERE active_status = 1)
    `);
    assert('5.12 Nested Independent Subquery with AVG()', nestedSub.length > 0, `${nestedSub.length} above average`);

    const [corrExists] = await pool.query(`
      SELECT r.request_id FROM request r
       WHERE r.status = 'Open' AND EXISTS (SELECT 1 FROM proposal p WHERE p.request_id = r.request_id)
    `);
    assert('5.13 Correlated Subquery with EXISTS', corrExists.length > 0, `${corrExists.length} requests with proposals`);

    const [corrNotExists] = await pool.query(`
      SELECT r.request_id FROM request r
       WHERE r.status = 'Open' AND NOT EXISTS (SELECT 1 FROM proposal p WHERE p.request_id = r.request_id)
    `);
    assert('5.14 Correlated Subquery with NOT EXISTS', corrNotExists.length > 0, `${corrNotExists.length} requests without proposals`);

    console.log('\n========================================================');
    console.log(`>>> ALL ${passedTests}/${totalTests} PHASE A SQL & DBMS TESTS PASSED! <<<`);
    console.log('========================================================\n');
  } finally {
    // Teardown view and staging table to ensure zero database pollution
    try {
      await pool.query('DROP TABLE IF EXISTS demo_service_vendor');
    } catch (_) {}
    await pool.end();
  }
}

runPhaseATests().catch((err) => {
  console.error('[FAIL] Phase A test suite failed:', err);
  process.exit(1);
});
