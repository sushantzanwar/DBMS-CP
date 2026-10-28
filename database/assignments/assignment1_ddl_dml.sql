-- ==============================================================================
-- ServicePath AI - Assignment 1: DDL, DML and Data Integrity Constraints
-- Primary Demonstration Environment: MySQL Workbench (127.0.0.1:3307 / Standard MySQL 8)
-- Version Control & Database Engine: Dolt (MySQL 8.0.31 compatible)
-- ==============================================================================

USE business_service_db;

-- ------------------------------------------------------------------------------
-- 1. DDL: CREATE TABLE with Integrity Constraints
-- Demonstrates: PRIMARY KEY, FOREIGN KEY with ON DELETE CASCADE, UNIQUE, CHECK,
--               NOT NULL, and DEFAULT.
-- ------------------------------------------------------------------------------

DROP TABLE IF EXISTS demo_service_vendor;

CREATE TABLE demo_service_vendor (
  vendor_id       INT          NOT NULL,
  business_id     INT          NOT NULL,
  tax_identifier  VARCHAR(20)  NOT NULL,
  years_active    INT          DEFAULT 1,
  hourly_rate     DECIMAL(10,2) NOT NULL,
  is_verified     TINYINT(1)   DEFAULT 0,
  created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,

  -- Primary Key Constraint
  CONSTRAINT pk_demo_vendor PRIMARY KEY (vendor_id),

  -- Foreign Key Constraint (Referential Integrity)
  CONSTRAINT fk_demo_vendor_business FOREIGN KEY (business_id) 
    REFERENCES business (business_id) ON DELETE CASCADE,

  -- Unique Constraint
  CONSTRAINT uq_demo_vendor_tax UNIQUE (tax_identifier),

  -- Check Constraints (Domain Integrity)
  CONSTRAINT chk_demo_vendor_years CHECK (years_active >= 0),
  CONSTRAINT chk_demo_vendor_rate  CHECK (hourly_rate > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------------------
-- 2. DDL: ALTER TABLE
-- Demonstrates: Adding a column with a constraint, modifying data types, and dropping.
-- ------------------------------------------------------------------------------

-- 2a. Add column with check constraint
ALTER TABLE demo_service_vendor 
  ADD COLUMN vendor_tier VARCHAR(10) DEFAULT 'Silver' CHECK (vendor_tier IN ('Silver', 'Gold', 'Platinum'));

-- 2b. Modify existing column
ALTER TABLE demo_service_vendor 
  MODIFY COLUMN vendor_tier VARCHAR(20) DEFAULT 'Silver';

-- 2c. Drop column
ALTER TABLE demo_service_vendor 
  DROP COLUMN vendor_tier;

-- ------------------------------------------------------------------------------
-- 3. DML: INSERT (Valid Data)
-- Demonstrates: Populating rows referencing valid parent records (Business IDs 1, 4, 5).
-- ------------------------------------------------------------------------------

INSERT INTO demo_service_vendor (vendor_id, business_id, tax_identifier, years_active, hourly_rate, is_verified)
VALUES 
  (501, 1, 'GSTIN-MH-001', 5, 2500.00, 1),
  (502, 4, 'GSTIN-MH-004', 3, 1200.00, 1),
  (503, 5, 'GSTIN-KA-005', 7, 3000.00, 1);

-- Verify inserted records
SELECT vendor_id, business_id, tax_identifier, years_active, hourly_rate, is_verified 
  FROM demo_service_vendor 
 ORDER BY vendor_id;

-- ------------------------------------------------------------------------------
-- 4. DML: Integrity Constraint Enforcement Demonstrations (Intentional Violations)
-- ------------------------------------------------------------------------------

-- 4a. CHECK Constraint Violation (hourly_rate <= 0):
-- Expected Error: Check constraint 'chk_demo_vendor_rate' is violated.
-- INSERT INTO demo_service_vendor (vendor_id, business_id, tax_identifier, hourly_rate) VALUES (504, 1, 'GSTIN-FAIL-01', -50.00);

-- 4b. UNIQUE Constraint Violation (Duplicate tax_identifier):
-- Expected Error: Duplicate entry 'GSTIN-MH-001' for key 'uq_demo_vendor_tax'
-- INSERT INTO demo_service_vendor (vendor_id, business_id, tax_identifier, hourly_rate) VALUES (505, 1, 'GSTIN-MH-001', 2000.00);

-- 4c. FOREIGN KEY Violation (Non-existent parent business_id 9999):
-- Expected Error: Cannot add or update a child row: a foreign key constraint fails.
-- INSERT INTO demo_service_vendor (vendor_id, business_id, tax_identifier, hourly_rate) VALUES (506, 9999, 'GSTIN-FAIL-03', 2000.00);

-- ------------------------------------------------------------------------------
-- 5. DML: UPDATE and DELETE
-- Demonstrates: Updating verified status and deleting records.
-- ------------------------------------------------------------------------------

-- 5a. UPDATE
UPDATE demo_service_vendor 
   SET hourly_rate = 2750.00, years_active = 6 
 WHERE vendor_id = 501;

-- 5b. DELETE single row
DELETE FROM demo_service_vendor 
 WHERE vendor_id = 502;

-- Verify after update and delete
SELECT * FROM demo_service_vendor ORDER BY vendor_id;

-- ------------------------------------------------------------------------------
-- 6. DDL: TRUNCATE TABLE vs DROP TABLE
-- Demonstrates: Fast row deletion without schema removal vs total destruction.
-- ------------------------------------------------------------------------------

TRUNCATE TABLE demo_service_vendor;

-- Verify table is empty but schema structure exists
SELECT COUNT(*) AS row_count_after_truncate FROM demo_service_vendor;

-- Final teardown (keeps environment clean)
DROP TABLE IF EXISTS demo_service_vendor;

