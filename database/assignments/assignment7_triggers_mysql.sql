-- ==============================================================================
-- ServicePath AI - DBMS Practical Demonstration
-- ASSIGNMENT 7: Database Triggers (BEFORE / AFTER, Validation & Audit Logging)
-- Target Dialect: MySQL 8.0+ / MySQL Workbench / Dolt 2.4+
-- Database: business_service_db
-- ==============================================================================
--
-- HOW TO RUN IN MYSQL WORKBENCH:
-- 1. Open MySQL Workbench and connect to business_service_db.
-- 2. Open this script via File -> Open SQL Script... (Ctrl + O).
-- 3. Execute blocks sequentially or with Ctrl+Shift+Enter.
--    (DELIMITER // is used to separate trigger procedural blocks).
-- 4. Review Result Grid and Action Output.
--
-- ISOLATION GUARANTEE:
-- All triggers operate on isolated demonstration tables ('demo_marketplace_deal'
-- and 'demo_deal_audit_log') ensuring zero disruption or corruption to core
-- application tables ('business', 'request', 'proposal', 'transaction').
-- ==============================================================================

USE business_service_db;

-- ------------------------------------------------------------------------------
-- 1. ISOLATED DEMONSTRATION TABLES SETUP
-- ------------------------------------------------------------------------------

DROP TABLE IF EXISTS demo_deal_audit_log;
DROP TABLE IF EXISTS demo_marketplace_deal;

CREATE TABLE demo_marketplace_deal (
    deal_id          INT PRIMARY KEY AUTO_INCREMENT,
    buyer_id         INT NOT NULL,
    seller_id        INT NOT NULL,
    agreed_price     DECIMAL(10,2) NOT NULL,
    deal_status      VARCHAR(20) NOT NULL DEFAULT 'Pending',
    payment_status   VARCHAR(20) NOT NULL DEFAULT 'Pending',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_demo_deal_buyer  FOREIGN KEY (buyer_id)  REFERENCES business(business_id) ON DELETE RESTRICT,
    CONSTRAINT fk_demo_deal_seller FOREIGN KEY (seller_id) REFERENCES business(business_id) ON DELETE RESTRICT
);

CREATE TABLE demo_deal_audit_log (
    audit_id             INT PRIMARY KEY AUTO_INCREMENT,
    deal_id              INT NOT NULL,
    old_deal_status      VARCHAR(20),
    new_deal_status      VARCHAR(20),
    old_payment_status   VARCHAR(20),
    new_payment_status   VARCHAR(20),
    change_type          VARCHAR(30) NOT NULL,
    changed_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 2. TRIGGER 1: BEFORE INSERT - Business Rule Validation & Entity Integrity
-- Business Rules Enforced:
--   a. Minimum marketplace transaction amount is ₹500.00.
--   b. Self-dealing restriction: buyer_id and seller_id cannot be the same business.
-- Demonstrates: BEFORE INSERT, SIGNAL SQLSTATE '45000', custom error message.
-- ------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_deal_before_insert;

DELIMITER //

CREATE TRIGGER trg_deal_before_insert
BEFORE INSERT ON demo_marketplace_deal
FOR EACH ROW
BEGIN
    -- Rule A: Enforce platform minimum transaction value
    IF NEW.agreed_price < 500.00 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Validation Error: Minimum transaction amount on ServicePath AI is ₹500.00';
    END IF;

    -- Rule B: Prevent self-dealing (buyer and seller cannot be identical)
    IF NEW.buyer_id = NEW.seller_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Validation Error: Buyer and Seller cannot be the same business entity';
    END IF;
END //

DELIMITER ;

-- ------------------------------------------------------------------------------
-- 3. TRIGGER 2: BEFORE UPDATE - State Transition & Immutability Enforcement
-- Business Rules Enforced:
--   a. Price Immutability: Once a deal is marked 'Completed', agreed_price cannot be altered.
--   b. Invalid State Transition: A 'Cancelled' deal cannot be transitioned to 'Completed'.
--   c. Automatic timestamp updating (NEW.updated_at = CURRENT_TIMESTAMP).
-- Demonstrates: BEFORE UPDATE, OLD vs NEW value comparison, SIGNAL SQLSTATE.
-- ------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_deal_before_update;

DELIMITER //

CREATE TRIGGER trg_deal_before_update
BEFORE UPDATE ON demo_marketplace_deal
FOR EACH ROW
BEGIN
    -- Rule A: Immutability of agreed price after completion
    IF OLD.deal_status = 'Completed' AND NEW.agreed_price <> OLD.agreed_price THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Business Rule Violation: Agreed price cannot be modified on a Completed deal';
    END IF;

    -- Rule B: Prevent invalid reactivation of cancelled deals
    IF OLD.deal_status = 'Cancelled' AND NEW.deal_status = 'Completed' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid State Transition: Cancelled deals cannot be marked Completed';
    END IF;

    -- Rule C: Auto-maintain updated timestamp
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END //

DELIMITER ;

-- ------------------------------------------------------------------------------
-- 4. TRIGGER 3: AFTER UPDATE - Transaction Lifecycle Audit Log
-- Business Logic: Whenever deal_status or payment_status changes, automatically
-- write an immutable audit record tracking old and new values.
-- Demonstrates: AFTER UPDATE, conditional auditing, INSERT from trigger context.
-- ------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_deal_after_update;

DELIMITER //

CREATE TRIGGER trg_deal_after_update
AFTER UPDATE ON demo_marketplace_deal
FOR EACH ROW
BEGIN
    -- Audit only when state or payment actually changes
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
END //

DELIMITER ;

-- ------------------------------------------------------------------------------
-- 5. TRIGGER 4: AFTER DELETE - Deletion Audit Trail
-- Business Logic: If a deal is removed, record the historical tombstone in the audit log.
-- Demonstrates: AFTER DELETE, accessing OLD values.
-- ------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_deal_after_delete;

DELIMITER //

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
END //

DELIMITER ;

-- ==============================================================================
-- 6. COMPREHENSIVE TEST SUITE (Positive & Negative Test Cases)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- TEST 1: Positive Case - Valid Deal Insert (Triggers BEFORE INSERT successfully)
-- ------------------------------------------------------------------------------
INSERT INTO demo_marketplace_deal (buyer_id, seller_id, agreed_price, deal_status, payment_status)
VALUES (1, 4, 45000.00, 'Pending', 'Pending');

-- Verify inserted deal
SELECT * FROM demo_marketplace_deal;

-- ------------------------------------------------------------------------------
-- TEST 2: Negative Case - Transaction Under Minimum (₹500 Rule)
-- EXPECTED: Fails with Error 45000: Minimum transaction amount on ServicePath AI is ₹500.00
-- ------------------------------------------------------------------------------
-- INSERT INTO demo_marketplace_deal (buyer_id, seller_id, agreed_price)
-- VALUES (1, 4, 250.00);

-- ------------------------------------------------------------------------------
-- TEST 3: Negative Case - Self-Dealing (Buyer ID == Seller ID)
-- EXPECTED: Fails with Error 45000: Buyer and Seller cannot be the same business entity
-- ------------------------------------------------------------------------------
-- INSERT INTO demo_marketplace_deal (buyer_id, seller_id, agreed_price)
-- VALUES (1, 1, 15000.00);

-- ------------------------------------------------------------------------------
-- TEST 4: Positive Case - Status & Payment Update (Triggers AFTER UPDATE audit log)
-- Transition: Pending -> In Progress, Payment: Pending -> Escrowed
-- ------------------------------------------------------------------------------
UPDATE demo_marketplace_deal
   SET deal_status = 'In Progress',
       payment_status = 'Escrowed'
 WHERE deal_id = 1;

-- Check audit log table: 1st audit entry created
SELECT * FROM demo_deal_audit_log;

-- ------------------------------------------------------------------------------
-- TEST 5: Positive Case - Completion of Deal
-- Transition: In Progress -> Completed, Payment: Escrowed -> Released
-- ------------------------------------------------------------------------------
UPDATE demo_marketplace_deal
   SET deal_status = 'Completed',
       payment_status = 'Released'
 WHERE deal_id = 1;

-- Check audit log table: 2nd audit entry created
SELECT * FROM demo_deal_audit_log;

-- ------------------------------------------------------------------------------
-- TEST 6: Negative Case - Modifying Price on a Completed Deal
-- EXPECTED: Fails with Error 45000: Agreed price cannot be modified on a Completed deal
-- ------------------------------------------------------------------------------
-- UPDATE demo_marketplace_deal
--    SET agreed_price = 55000.00
--  WHERE deal_id = 1;

-- ------------------------------------------------------------------------------
-- TEST 7: Positive Case - Record Deletion (Triggers AFTER DELETE audit log)
-- ------------------------------------------------------------------------------
-- Insert temporary deal to delete
INSERT INTO demo_marketplace_deal (buyer_id, seller_id, agreed_price, deal_status, payment_status)
VALUES (2, 5, 20000.00, 'Pending', 'Pending');

DELETE FROM demo_marketplace_deal WHERE agreed_price = 20000.00;

-- Verify deletion audit record
SELECT * FROM demo_deal_audit_log WHERE change_type = 'RECORD_DELETED';

-- ------------------------------------------------------------------------------
-- 7. CLEAN TEARDOWN (Uncomment when ready to drop demonstration objects)
-- ------------------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS trg_deal_before_insert;
-- DROP TRIGGER IF EXISTS trg_deal_before_update;
-- DROP TRIGGER IF EXISTS trg_deal_after_update;
-- DROP TRIGGER IF EXISTS trg_deal_after_delete;
-- DROP TABLE IF EXISTS demo_deal_audit_log;
-- DROP TABLE IF EXISTS demo_marketplace_deal;

