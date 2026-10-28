-- ==============================================================================
-- ServicePath AI - DBMS Practical Demonstration
-- ASSIGNMENT 6: Stored Procedures, Parameters, Control Structures & Cursors
-- Target Dialect: MySQL 8.0+ / MySQL Workbench / Dolt 2.4+
-- Database: business_service_db
-- ==============================================================================
--
-- HOW TO RUN IN MYSQL WORKBENCH:
-- 1. Open MySQL Workbench and connect to business_service_db (Port 3307 or 3306).
-- 2. Open this script via File -> Open SQL Script... (Ctrl + O).
-- 3. In MySQL Workbench, select each block and press Ctrl+Shift+Enter to execute.
--    (Workbench requires DELIMITER // to differentiate procedure bodies).
-- 4. Review Result Grid and Action Output.
-- ==============================================================================

USE business_service_db;

-- ------------------------------------------------------------------------------
-- 1. DEMONSTRATION TABLE SETUP (Isolated staging table for cursor operations)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS demo_commission_payout;

CREATE TABLE demo_commission_payout (
    payout_id            INT PRIMARY KEY AUTO_INCREMENT,
    transaction_id       INT NOT NULL,
    seller_business_id   INT NOT NULL,
    agreed_price         DECIMAL(10,2) NOT NULL,
    commission_rate_pct  DECIMAL(4,2) NOT NULL,
    commission_amount    DECIMAL(10,2) NOT NULL,
    net_seller_payout    DECIMAL(10,2) NOT NULL,
    calculated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 2. PROCEDURE 1: Service Request Metric Summary (IN and OUT Parameters)
-- Business Logic: Given a request_id, calculates aggregate metrics of all received
-- proposals (count, min bid, max bid) and fetches buyer information.
-- Demonstrates: IN parameter, multiple OUT parameters, COALESCE, conditional logic.
-- ------------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS sp_get_request_summary;

DELIMITER //

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
    -- Fetch request metadata and buyer name
    SELECT r.title, b.business_name, r.status
      INTO p_title, p_buyer_name, p_status
      FROM request r
      JOIN business b ON b.business_id = r.business_id
     WHERE r.request_id = p_request_id;

    -- Aggregate proposals for this request
    SELECT COUNT(*),
           MIN(proposed_price),
           MAX(proposed_price)
      INTO p_proposal_count, p_lowest_bid, p_highest_bid
      FROM proposal
     WHERE request_id = p_request_id;

    -- Conditional business logic if no bids have arrived yet
    IF p_proposal_count = 0 THEN
        SET p_lowest_bid  = 0.00;
        SET p_highest_bid = 0.00;
    END IF;
END //

DELIMITER ;

-- ------------------------------------------------------------------------------
-- 3. PROCEDURE 2: Provider Tier & Rating Evaluation (Control Flow: IF / ELSEIF / ELSE)
-- Business Logic: Evaluates a provider's historical performance, completed deal volume,
-- and average review rating to assign an automated marketplace partner tier:
--   - 'Platinum Partner' : >= 2 completed deals, >= ₹50,000 revenue, >= 4.5 rating
--   - 'Gold Partner'     : >= 1 completed deal,  >= ₹20,000 revenue, >= 4.0 rating
--   - 'Silver Partner'   : >= 1 completed deal
--   - 'Standard Provider': All new or non-transactional providers
-- Demonstrates: IN parameter, multiple OUT parameters, scalar subqueries, IF-ELSEIF.
-- ------------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS sp_calculate_provider_tier;

DELIMITER //

CREATE PROCEDURE sp_calculate_provider_tier (
    IN  p_provider_id       INT,
    OUT p_provider_name     VARCHAR(100),
    OUT p_completed_deals   INT,
    OUT p_total_revenue     DECIMAL(12,2),
    OUT p_avg_rating        DOUBLE,
    OUT p_tier_status       VARCHAR(30)
)
BEGIN
    -- Initialize defaults
    SET p_completed_deals = 0;
    SET p_total_revenue   = 0.00;
    SET p_avg_rating      = 0.0;
    SET p_tier_status     = 'Standard Provider';

    -- Retrieve provider business name
    SELECT business_name
      INTO p_provider_name
      FROM business
     WHERE business_id = p_provider_id;

    -- Aggregate completed transaction volume
    SELECT COUNT(*),
           SUM(agreed_price)
      INTO p_completed_deals, p_total_revenue
      FROM `transaction`
     WHERE seller_business_id = p_provider_id
       AND status = 'Completed';

    -- Aggregate review rating
    SELECT AVG(rating)
      INTO p_avg_rating
      FROM review
     WHERE reviewed_business_id = p_provider_id;

    IF p_completed_deals IS NULL THEN SET p_completed_deals = 0; END IF;
    IF p_total_revenue IS NULL THEN SET p_total_revenue = 0.00; END IF;
    IF p_avg_rating IS NULL THEN SET p_avg_rating = 0.0; END IF;

    -- Control structure (IF ... ELSEIF ... ELSE)
    IF p_completed_deals >= 2 AND p_total_revenue >= 50000.00 AND p_avg_rating >= 4.5 THEN
        SET p_tier_status = 'Platinum Partner';
    ELSEIF p_completed_deals >= 1 AND p_total_revenue >= 20000.00 AND p_avg_rating >= 4.0 THEN
        SET p_tier_status = 'Gold Partner';
    ELSEIF p_completed_deals >= 1 THEN
        SET p_tier_status = 'Silver Partner';
    ELSE
        SET p_tier_status = 'Standard Provider';
    END IF;
END //

DELIMITER ;

-- ------------------------------------------------------------------------------
-- 4. PROCEDURE 3: Platform Commission Batch Calculation (CURSOR & LOOP)
-- Business Logic: Iterates over all completed marketplace transactions row-by-row
-- using a CURSOR. Computes progressive commission and populates demo_commission_payout:
--   - Deals < ₹30,000         -> 10% commission
--   - Deals ₹30,000 - ₹60,000 -> 8% commission
--   - Deals > ₹60,000         -> 5% commission
-- Demonstrates: DECLARE CURSOR, DECLARE CONTINUE HANDLER FOR NOT FOUND,
--               OPEN, FETCH INTO, LOOP, LEAVE, CLOSE, and batch table population.
-- ------------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS sp_batch_calculate_commission_cursor;

DELIMITER //

CREATE PROCEDURE sp_batch_calculate_commission_cursor (
    OUT p_processed_count    INT,
    OUT p_total_commission   DECIMAL(12,2)
)
BEGIN
    -- Variable declarations
    DECLARE v_done               INT DEFAULT FALSE;
    DECLARE v_tx_id              INT;
    DECLARE v_seller_id          INT;
    DECLARE v_price              DECIMAL(10,2);
    DECLARE v_rate               INT;
    DECLARE v_comm_amt           DECIMAL(10,2);
    DECLARE v_payout             DECIMAL(10,2);

    -- Cursor declaration to select completed transactions
    DECLARE tx_cursor CURSOR FOR
        SELECT transaction_id, seller_business_id, agreed_price
          FROM `transaction`
         WHERE status = 'Completed';

    -- Handler to terminate loop when cursor reaches end of dataset
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    -- Reset demonstration table
    TRUNCATE TABLE demo_commission_payout;

    -- Open cursor
    OPEN tx_cursor;

    -- Cursor loop
    calc_loop: LOOP
        FETCH tx_cursor INTO v_tx_id, v_seller_id, v_price;

        IF v_done THEN
            LEAVE calc_loop;
        END IF;

        -- Tiered commission rate determination
        IF v_price < 30000.00 THEN
            SET v_rate = 10;
        ELSEIF v_price <= 60000.00 THEN
            SET v_rate = 8;
        ELSE
            SET v_rate = 5;
        END IF;

        -- Compute commission and seller payout using explicit decimal casting
        SET v_comm_amt = CAST((v_price * v_rate) / 100 AS DECIMAL(10,2));
        SET v_payout   = CAST(v_price - v_comm_amt AS DECIMAL(10,2));

        -- Record calculated payout in demonstration table
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

    -- Close cursor to release system resources
    CLOSE tx_cursor;

    -- Aggregate summary metrics from the populated demonstration table
    SELECT COUNT(*), COALESCE(SUM(commission_amount), 0.00)
      INTO p_processed_count, p_total_commission
      FROM demo_commission_payout;
END //

DELIMITER ;

-- ==============================================================================
-- 5. VERIFICATION & CALL STATEMENTS (Run these in MySQL Workbench)
-- ==============================================================================

-- Test 1: Call sp_get_request_summary for Request 1001 (has proposals)
CALL sp_get_request_summary(1001, @title, @buyer, @status, @proposals, @min_bid, @max_bid);
SELECT @title AS request_title,
       @buyer AS buyer_name,
       @status AS request_status,
       @proposals AS total_proposals,
       @min_bid AS lowest_bid,
       @max_bid AS highest_bid;

-- Test 2: Call sp_get_request_summary for Request 1005 (unanswered request with 0 proposals)
CALL sp_get_request_summary(1005, @title5, @buyer5, @status5, @proposals5, @min_bid5, @max_bid5);
SELECT @title5 AS request_title,
       @buyer5 AS buyer_name,
       @status5 AS request_status,
       @proposals5 AS total_proposals,
       @min_bid5 AS lowest_bid,
       @max_bid5 AS highest_bid;

-- Test 3: Call sp_calculate_provider_tier for Provider 4 (EduSpark Academy)
CALL sp_calculate_provider_tier(4, @p_name, @p_deals, @p_rev, @p_rating, @p_tier);
SELECT @p_name AS provider,
       @p_deals AS completed_deals,
       @p_rev AS total_revenue,
       @p_rating AS avg_rating,
       @p_tier AS assigned_tier;

-- Test 4: Call sp_batch_calculate_commission_cursor
CALL sp_batch_calculate_commission_cursor(@batch_count, @batch_commission);
SELECT @batch_count AS transactions_processed,
       @batch_commission AS total_platform_commission;

-- Inspect rows generated by the cursor inside the demo table
SELECT payout_id, transaction_id, seller_business_id, agreed_price, commission_rate_pct, commission_amount, net_seller_payout
  FROM demo_commission_payout;

-- ------------------------------------------------------------------------------
-- 6. CLEAN TEARDOWN (Uncomment when ready to drop demonstration objects)
-- ------------------------------------------------------------------------------
-- DROP PROCEDURE IF EXISTS sp_get_request_summary;
-- DROP PROCEDURE IF EXISTS sp_calculate_provider_tier;
-- DROP PROCEDURE IF EXISTS sp_batch_calculate_commission_cursor;
-- DROP TABLE IF EXISTS demo_commission_payout;

