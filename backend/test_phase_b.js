/**
 * ServicePath AI - Phase B Automated Test Runner
 * Assignments 6 & 7: Stored Procedures, Parameters, Cursors, and Triggers
 * Runs against live Dolt / MySQL engine.
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

let passedTests = 0;
let totalTests = 0;

function assert(description, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${description} ${details ? `(${details})` : ''}`);
  } else {
    console.error(`[FAIL] ${description} ${details ? `(${details})` : ''}`);
    throw new Error(`Assertion failed: ${description}`);
  }
}

async function runPhaseBTests() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'business_service_db',
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 5
  });

  console.log('========================================================');
  console.log('   STARTING PHASE B: PROCEDURES & TRIGGERS TEST SUITE   ');
  console.log('========================================================\n');

  try {
    // -------------------------------------------------------------------------
    // ASSIGNMENT 6: STORED PROCEDURES, PARAMETERS & CURSORS
    // -------------------------------------------------------------------------
    console.log('--- TESTING ASSIGNMENT 6: STORED PROCEDURES & CURSORS ---');

    // Setup demonstration table for cursor
    await pool.query('DROP TABLE IF EXISTS demo_commission_payout');
    await pool.query(`
      CREATE TABLE demo_commission_payout (
        payout_id            INT PRIMARY KEY AUTO_INCREMENT,
        transaction_id       INT NOT NULL,
        seller_business_id   INT NOT NULL,
        agreed_price         DECIMAL(10,2) NOT NULL,
        commission_rate_pct  DECIMAL(4,2) NOT NULL,
        commission_amount    DECIMAL(10,2) NOT NULL,
        net_seller_payout    DECIMAL(10,2) NOT NULL,
        calculated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6.1 Create and Test sp_get_request_summary (IN / OUT Parameters)
    await pool.query('DROP PROCEDURE IF EXISTS sp_get_request_summary');
    await pool.query(`
      CREATE PROCEDURE sp_get_request_summary (
        IN  p_request_id       INT,
        OUT p_title            VARCHAR(150),
        OUT p_buyer_name       VARCHAR(100),
        OUT p_status           VARCHAR(20),
        OUT p_proposal_count   INT,
        OUT p_lowest_bid       DECIMAL(10,2),
        OUT p_highest_bid      DECIMAL(10,2)
      )
      BEGIN
        SELECT r.title, b.business_name, r.status
          INTO p_title, p_buyer_name, p_status
          FROM request r
          JOIN business b ON b.business_id = r.business_id
         WHERE r.request_id = p_request_id;

        SELECT COUNT(*),
               MIN(proposed_price),
               MAX(proposed_price)
          INTO p_proposal_count, p_lowest_bid, p_highest_bid
          FROM proposal
         WHERE request_id = p_request_id;

        IF p_proposal_count = 0 THEN
          SET p_lowest_bid  = 0.00;
          SET p_highest_bid = 0.00;
        END IF;
      END
    `);
    assert('6.1 Stored Procedure DDL: sp_get_request_summary created successfully', true);

    // Call with Request 1001 (has proposals)
    await pool.query('CALL sp_get_request_summary(1001, @title, @buyer, @status, @proposals, @min_bid, @max_bid)');
    const [summary1] = await pool.query('SELECT @title AS title, @buyer AS buyer, @status AS status, @proposals AS proposals, @min_bid AS min_bid, @max_bid AS max_bid');
    assert('6.2 Procedure Call: sp_get_request_summary with active proposals',
      summary1[0].buyer === 'TechNova Solutions' &&
      summary1[0].proposals >= 1 &&
      Number(summary1[0].min_bid) > 0,
      `Buyer: ${summary1[0].buyer}, Proposals: ${summary1[0].proposals}, Min Bid: ₹${summary1[0].min_bid}`
    );

    // Call with Request 1005 (unanswered request with 0 proposals)
    await pool.query('CALL sp_get_request_summary(1005, @title5, @buyer5, @status5, @proposals5, @min_bid5, @max_bid5)');
    const [summary5] = await pool.query('SELECT @title5 AS title, @buyer5 AS buyer, @status5 AS status, @proposals5 AS proposals, @min_bid5 AS min_bid, @max_bid5 AS max_bid');
    assert('6.3 Procedure Call: sp_get_request_summary handles zero proposals gracefully',
      summary5[0].proposals === 0 &&
      Number(summary5[0].min_bid) === 0,
      `Title: ${summary5[0].title}, Proposals: ${summary5[0].proposals}`
    );

    // 6.2 Create and Test sp_calculate_provider_tier (Control Structure: IF / ELSEIF / ELSE)
    await pool.query('DROP PROCEDURE IF EXISTS sp_calculate_provider_tier');
    await pool.query(`
      CREATE PROCEDURE sp_calculate_provider_tier (
        IN  p_provider_id       INT,
        OUT p_provider_name     VARCHAR(100),
        OUT p_completed_deals   INT,
        OUT p_total_revenue     DECIMAL(12,2),
        OUT p_avg_rating        DOUBLE,
        OUT p_tier_status       VARCHAR(30)
      )
      BEGIN
        SET p_completed_deals = 0;
        SET p_total_revenue   = 0.00;
        SET p_avg_rating      = 0.0;
        SET p_tier_status     = 'Standard Provider';

        SELECT business_name
          INTO p_provider_name
          FROM business
         WHERE business_id = p_provider_id;

        SELECT COUNT(*),
               SUM(agreed_price)
          INTO p_completed_deals, p_total_revenue
          FROM \`transaction\`
         WHERE seller_business_id = p_provider_id
           AND status = 'Completed';

        SELECT AVG(rating)
          INTO p_avg_rating
          FROM review
         WHERE reviewed_business_id = p_provider_id;

        IF p_completed_deals IS NULL THEN SET p_completed_deals = 0; END IF;
        IF p_total_revenue IS NULL THEN SET p_total_revenue = 0.00; END IF;
        IF p_avg_rating IS NULL THEN SET p_avg_rating = 0.0; END IF;

        IF p_completed_deals >= 2 AND p_total_revenue >= 50000.00 AND p_avg_rating >= 4.5 THEN
          SET p_tier_status = 'Platinum Partner';
        ELSEIF p_completed_deals >= 1 AND p_total_revenue >= 20000.00 AND p_avg_rating >= 4.0 THEN
          SET p_tier_status = 'Gold Partner';
        ELSEIF p_completed_deals >= 1 THEN
          SET p_tier_status = 'Silver Partner';
        ELSE
          SET p_tier_status = 'Standard Provider';
        END IF;
      END
    `);
    assert('6.4 Stored Procedure DDL: sp_calculate_provider_tier created', true);

    await pool.query('CALL sp_calculate_provider_tier(4, @pname, @deals, @rev, @rate, @tier)');
    const [tier4] = await pool.query('SELECT @pname AS provider, @deals AS deals, @rev AS rev, @rate AS rating, @tier AS tier');
    assert('6.5 Procedure Call: Provider tier assigned via conditional branching',
      tier4[0].tier === 'Platinum Partner' || tier4[0].tier === 'Gold Partner',
      `Provider: ${tier4[0].provider}, Tier: ${tier4[0].tier}, Revenue: ₹${tier4[0].rev}, Rating: ${tier4[0].rating}`
    );

    // 6.3 Create and Test sp_batch_calculate_commission_cursor (CURSOR & LOOP)
    await pool.query('DROP PROCEDURE IF EXISTS sp_batch_calculate_commission_cursor');
    await pool.query(`
      CREATE PROCEDURE sp_batch_calculate_commission_cursor (
        OUT p_processed_count    INT,
        OUT p_total_commission   DECIMAL(12,2)
      )
      BEGIN
        DECLARE v_done               INT DEFAULT FALSE;
        DECLARE v_tx_id              INT;
        DECLARE v_seller_id          INT;
        DECLARE v_price              DECIMAL(10,2);
        DECLARE v_rate               INT;
        DECLARE v_comm_amt           DECIMAL(10,2);
        DECLARE v_payout             DECIMAL(10,2);

        DECLARE tx_cursor CURSOR FOR
          SELECT transaction_id, seller_business_id, agreed_price
            FROM \`transaction\`
           WHERE status = 'Completed';

        DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

        TRUNCATE TABLE demo_commission_payout;

        OPEN tx_cursor;

        calc_loop: LOOP
          FETCH tx_cursor INTO v_tx_id, v_seller_id, v_price;

          IF v_done THEN
            LEAVE calc_loop;
          END IF;

          IF v_price < 30000.00 THEN
            SET v_rate = 10;
          ELSEIF v_price <= 60000.00 THEN
            SET v_rate = 8;
          ELSE
            SET v_rate = 5;
          END IF;

          SET v_comm_amt = CAST((v_price * v_rate) / 100 AS DECIMAL(10,2));
          SET v_payout   = CAST(v_price - v_comm_amt AS DECIMAL(10,2));

          INSERT INTO demo_commission_payout (
            transaction_id,
            seller_business_id,
            agreed_price,
            commission_rate_pct,
            commission_amount,
            net_seller_payout
          ) VALUES (
            v_tx_id,
            v_seller_id,
            v_price,
            v_rate,
            v_comm_amt,
            v_payout
          );
        END LOOP calc_loop;

        CLOSE tx_cursor;

        SELECT COUNT(*), COALESCE(SUM(commission_amount), 0.00)
          INTO p_processed_count, p_total_commission
          FROM demo_commission_payout;
      END
    `);
    assert('6.6 Stored Procedure DDL: sp_batch_calculate_commission_cursor created', true);

    await pool.query('CALL sp_batch_calculate_commission_cursor(@cursor_count, @cursor_commission)');
    const [cursorSummary] = await pool.query('SELECT @cursor_count AS count, @cursor_commission AS commission');
    assert('6.7 Procedure Cursor Execution: Cursor iterated through completed deals',
      cursorSummary[0].count > 0 && Number(cursorSummary[0].commission) > 0,
      `Deals Processed: ${cursorSummary[0].count}, Total Platform Commission: ₹${cursorSummary[0].commission}`
    );

    const [payoutRows] = await pool.query('SELECT * FROM demo_commission_payout');
    assert('6.8 Cursor Table Population: Payout staging table populated with calculated records',
      payoutRows.length === cursorSummary[0].count,
      `${payoutRows.length} commission records generated`
    );

    // -------------------------------------------------------------------------
    // ASSIGNMENT 7: TRIGGERS (BEFORE / AFTER, VALIDATION & AUDITING)
    // -------------------------------------------------------------------------
    console.log('\n--- TESTING ASSIGNMENT 7: TRIGGERS ---');

    // Setup demonstration tables
    await pool.query('DROP TABLE IF EXISTS demo_deal_audit_log');
    await pool.query('DROP TABLE IF EXISTS demo_marketplace_deal');

    await pool.query(`
      CREATE TABLE demo_marketplace_deal (
        deal_id          INT PRIMARY KEY AUTO_INCREMENT,
        buyer_id         INT NOT NULL,
        seller_id        INT NOT NULL,
        agreed_price     DECIMAL(10,2) NOT NULL,
        deal_status      VARCHAR(20) NOT NULL DEFAULT 'Pending',
        payment_status   VARCHAR(20) NOT NULL DEFAULT 'Pending',
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE demo_deal_audit_log (
        audit_id             INT PRIMARY KEY AUTO_INCREMENT,
        deal_id              INT NOT NULL,
        old_deal_status      VARCHAR(20),
        new_deal_status      VARCHAR(20),
        old_payment_status   VARCHAR(20),
        new_payment_status   VARCHAR(20),
        change_type          VARCHAR(30) NOT NULL,
        changed_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7.1 Trigger: BEFORE INSERT
    await pool.query('DROP TRIGGER IF EXISTS trg_deal_before_insert');
    await pool.query(`
      CREATE TRIGGER trg_deal_before_insert
      BEFORE INSERT ON demo_marketplace_deal
      FOR EACH ROW
      BEGIN
        IF NEW.agreed_price < 500.00 THEN
          SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Validation Error: Minimum transaction amount on ServicePath AI is ₹500.00';
        END IF;

        IF NEW.buyer_id = NEW.seller_id THEN
          SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Validation Error: Buyer and Seller cannot be the same business entity';
        END IF;
      END
    `);
    assert('7.1 Trigger DDL: BEFORE INSERT trg_deal_before_insert created', true);

    // 7.2 Trigger: BEFORE UPDATE
    await pool.query('DROP TRIGGER IF EXISTS trg_deal_before_update');
    await pool.query(`
      CREATE TRIGGER trg_deal_before_update
      BEFORE UPDATE ON demo_marketplace_deal
      FOR EACH ROW
      BEGIN
        IF OLD.deal_status = 'Completed' AND NEW.agreed_price <> OLD.agreed_price THEN
          SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Business Rule Violation: Agreed price cannot be modified on a Completed deal';
        END IF;

        IF OLD.deal_status = 'Cancelled' AND NEW.deal_status = 'Completed' THEN
          SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid State Transition: Cancelled deals cannot be marked Completed';
        END IF;

        SET NEW.updated_at = CURRENT_TIMESTAMP;
      END
    `);
    assert('7.2 Trigger DDL: BEFORE UPDATE trg_deal_before_update created', true);

    // 7.3 Trigger: AFTER UPDATE
    await pool.query('DROP TRIGGER IF EXISTS trg_deal_after_update');
    await pool.query(`
      CREATE TRIGGER trg_deal_after_update
      AFTER UPDATE ON demo_marketplace_deal
      FOR EACH ROW
      BEGIN
        IF (OLD.deal_status <> NEW.deal_status) OR (OLD.payment_status <> NEW.payment_status) THEN
          INSERT INTO demo_deal_audit_log (
            deal_id,
            old_deal_status,
            new_deal_status,
            old_payment_status,
            new_payment_status,
            change_type
          ) VALUES (
            OLD.deal_id,
            OLD.deal_status,
            NEW.deal_status,
            OLD.payment_status,
            NEW.payment_status,
            'STATUS_CHANGE'
          );
        END IF;
      END
    `);
    assert('7.3 Trigger DDL: AFTER UPDATE trg_deal_after_update created', true);

    // 7.4 Trigger: AFTER DELETE
    await pool.query('DROP TRIGGER IF EXISTS trg_deal_after_delete');
    await pool.query(`
      CREATE TRIGGER trg_deal_after_delete
      AFTER DELETE ON demo_marketplace_deal
      FOR EACH ROW
      BEGIN
        INSERT INTO demo_deal_audit_log (
          deal_id,
          old_deal_status,
          new_deal_status,
          old_payment_status,
          new_payment_status,
          change_type
        ) VALUES (
          OLD.deal_id,
          OLD.deal_status,
          'PURGED',
          OLD.payment_status,
          'PURGED',
          'RECORD_DELETED'
        );
      END
    `);
    assert('7.4 Trigger DDL: AFTER DELETE trg_deal_after_delete created', true);

    // Test 7.5: Positive Insert
    await pool.query(`
      INSERT INTO demo_marketplace_deal (buyer_id, seller_id, agreed_price, deal_status, payment_status)
      VALUES (1, 4, 45000.00, 'Pending', 'Pending')
    `);
    const [insertedDeal] = await pool.query('SELECT * FROM demo_marketplace_deal WHERE deal_id = 1');
    assert('7.5 Positive Case: Valid record passes BEFORE INSERT trigger', insertedDeal.length === 1 && Number(insertedDeal[0].agreed_price) === 45000.00);

    // Test 7.6: Negative Insert - Value below minimum (< ₹500)
    let caughtMinErr = false;
    try {
      await pool.query(`
        INSERT INTO demo_marketplace_deal (buyer_id, seller_id, agreed_price)
        VALUES (1, 4, 250.00)
      `);
    } catch (err) {
      caughtMinErr = err.message.includes('Minimum transaction amount');
    }
    assert('7.7 Negative Case: BEFORE INSERT blocks transaction < ₹500 via SIGNAL SQLSTATE', caughtMinErr);

    // Test 7.7: Negative Insert - Self dealing (buyer_id === seller_id)
    let caughtSelfErr = false;
    try {
      await pool.query(`
        INSERT INTO demo_marketplace_deal (buyer_id, seller_id, agreed_price)
        VALUES (1, 1, 15000.00)
      `);
    } catch (err) {
      caughtSelfErr = err.message.includes('Buyer and Seller cannot be the same');
    }
    assert('7.8 Negative Case: BEFORE INSERT blocks self-dealing (buyer == seller)', caughtSelfErr);

    // Test 7.8: Positive Update triggering AFTER UPDATE audit log
    await pool.query(`
      UPDATE demo_marketplace_deal
         SET deal_status = 'In Progress',
             payment_status = 'Escrowed'
       WHERE deal_id = 1
    `);
    const [auditRows1] = await pool.query('SELECT * FROM demo_deal_audit_log WHERE deal_id = 1');
    assert('7.9 Positive Case: AFTER UPDATE generates audit record on status transition',
      auditRows1.length === 1 &&
      auditRows1[0].old_deal_status === 'Pending' &&
      auditRows1[0].new_deal_status === 'In Progress' &&
      auditRows1[0].new_payment_status === 'Escrowed'
    );

    // Test 7.9: Second Update: Transition to Completed
    await pool.query(`
      UPDATE demo_marketplace_deal
         SET deal_status = 'Completed',
             payment_status = 'Released'
       WHERE deal_id = 1
    `);
    const [auditRows2] = await pool.query('SELECT * FROM demo_deal_audit_log WHERE deal_id = 1');
    assert('7.10 Positive Case: AFTER UPDATE tracks deal completion lifecycle',
      auditRows2.length === 2 &&
      auditRows2[1].new_deal_status === 'Completed' &&
      auditRows2[1].new_payment_status === 'Released'
    );

    // Test 7.10: Negative Update: Attempting to modify agreed_price on Completed deal
    let caughtPriceErr = false;
    try {
      await pool.query(`
        UPDATE demo_marketplace_deal
           SET agreed_price = 55000.00
         WHERE deal_id = 1
      `);
    } catch (err) {
      caughtPriceErr = err.message.includes('Agreed price cannot be modified');
    }
    assert('7.11 Negative Case: BEFORE UPDATE blocks modifying price on completed deal', caughtPriceErr);

    // Test 7.11: Positive Deletion triggering AFTER DELETE tombstone
    await pool.query(`
      INSERT INTO demo_marketplace_deal (buyer_id, seller_id, agreed_price, deal_status, payment_status)
      VALUES (2, 5, 20000.00, 'Pending', 'Pending')
    `);
    await pool.query("DELETE FROM demo_marketplace_deal WHERE agreed_price = 20000.00");
    const [deleteAudit] = await pool.query("SELECT * FROM demo_deal_audit_log WHERE change_type = 'RECORD_DELETED'");
    assert('7.12 Positive Case: AFTER DELETE records tombstone entry in audit log',
      deleteAudit.length === 1 && deleteAudit[0].new_deal_status === 'PURGED'
    );

    // 7.13 Persistent Production Trigger: trg_transaction_status_audit
    const [trgRows] = await pool.query(`
      SELECT trigger_name, event_manipulation, event_object_table
        FROM information_schema.triggers
       WHERE trigger_schema = 'business_service_db'
         AND trigger_name = 'trg_transaction_status_audit'
    `);
    assert('7.13 Persistent Trigger in Catalog: trg_transaction_status_audit registered on transaction',
      trgRows.length === 1 && trgRows[0].EVENT_OBJECT_TABLE.toLowerCase() === 'transaction'
    );

    console.log('\n========================================================');
    console.log(`>>> ALL ${passedTests}/${totalTests} PHASE B PROCEDURES & TRIGGERS TESTS PASSED! <<<`);
    console.log('========================================================\n');
  } finally {
    // Teardown temporary demo objects while preserving permanent schema stored procedures
    try {
      await pool.query('DROP TRIGGER IF EXISTS trg_deal_before_insert');
      await pool.query('DROP TRIGGER IF EXISTS trg_deal_before_update');
      await pool.query('DROP TRIGGER IF EXISTS trg_deal_after_update');
      await pool.query('DROP TRIGGER IF EXISTS trg_deal_after_delete');
      await pool.query('DROP TABLE IF EXISTS demo_deal_audit_log');
      await pool.query('DROP TABLE IF EXISTS demo_marketplace_deal');
      await pool.query('TRUNCATE TABLE demo_commission_payout');
    } catch (_) { }
    await pool.end();
  }
}

runPhaseBTests().catch((err) => {
  console.error('[FAIL] Phase B test suite failed:', err);
  process.exit(1);
});
