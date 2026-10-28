-- ==============================================================================
-- ServicePath AI - Assignment 3: Views, Updatable Views, and Multi-Table Views
-- Primary Demonstration Environment: MySQL Workbench (127.0.0.1:3307 / Standard MySQL 8)
-- Version Control & Database Engine: Dolt (MySQL 8.0.31 compatible)
-- ==============================================================================

USE business_service_db;

-- ------------------------------------------------------------------------------
-- 1. Complex Multi-Table View (3 Tables JOIN + Subquery)
-- Purpose: Provides a joined summary of open service requests, buyer businesses,
--          and service categories, plus a subquery computing live proposal counts.
-- Updatability: Non-updatable (contains INNER JOINs and scalar subqueries).
-- ------------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_request_summary AS
SELECT r.request_id, r.title, r.description, r.status, r.quantity_required,
       r.budget_min, r.budget_max, r.required_by, r.location_preference, r.created_at,
       b.business_id AS buyer_id, b.business_name AS buyer_name, b.city AS buyer_city,
       s.service_id, s.service_name, s.category,
       (SELECT COUNT(*) FROM proposal p WHERE p.request_id = r.request_id) AS proposal_count
  FROM request r
  JOIN business b ON b.business_id = r.business_id
  JOIN service  s ON s.service_id  = r.service_id;

-- Query the multi-table view:
SELECT request_id, title, buyer_name, service_name, budget_min, budget_max, proposal_count
  FROM v_request_summary
 WHERE status = 'Open'
 ORDER BY created_at DESC;

-- ------------------------------------------------------------------------------
-- 2. Multi-Table Summary View with Independent Pre-Aggregated Joins
-- Purpose: Category-level marketplace metrics without Cartesian double-counting.
-- Concepts: View, Derived Tables, DISTINCT Aggregates, ROUND, COALESCE.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_category_summary AS
SELECT cat.category,
       COALESCE(svc.total_services, 0)          AS total_services,
       COALESCE(req.total_requests, 0)          AS total_requests,
       COALESCE(tx.completed_transactions, 0)   AS completed_transactions,
       COALESCE(svc.avg_catalog_price, 0)       AS avg_catalog_price,
       COALESCE(tx.total_traded_volume, 0)      AS total_traded_volume
  FROM (
    SELECT DISTINCT category FROM service
  ) cat
  LEFT JOIN (
    SELECT category,
           COUNT(*)                     AS total_services,
           ROUND(AVG(average_price), 2) AS avg_catalog_price
      FROM service
     WHERE active_status = 1
     GROUP BY category
  ) svc ON svc.category = cat.category
  LEFT JOIN (
    SELECT s.category,
           COUNT(r.request_id) AS total_requests
      FROM service s
      JOIN request r ON r.service_id = s.service_id
     GROUP BY s.category
  ) req ON req.category = cat.category
  LEFT JOIN (
    SELECT s.category,
           COUNT(t.transaction_id)          AS completed_transactions,
           COALESCE(SUM(t.agreed_price), 0) AS total_traded_volume
      FROM service s
      JOIN `transaction` t ON t.service_id = s.service_id
     WHERE t.status = 'Completed'
     GROUP BY s.category
  ) tx ON tx.category = cat.category;

-- Query category performance:
SELECT * FROM v_category_summary ORDER BY total_requests DESC;

-- ------------------------------------------------------------------------------
-- 3. Updatable View with WITH CHECK OPTION
-- Definition: Single base table, no aggregates, includes primary key.
-- Business Logic: Allows viewing and maintaining only currently ACTIVE services.
-- WITH CHECK OPTION guarantees that no operation through this view can produce
-- a row that does not satisfy 'active_status = 1'.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_active_service_catalog AS
SELECT service_id, service_name, category, average_price, complexity, active_status
  FROM service
 WHERE active_status = 1
  WITH CHECK OPTION;

-- Query active services:
SELECT service_id, service_name, category, average_price, active_status
  FROM v_active_service_catalog;

-- ------------------------------------------------------------------------------
-- 4. DML Demonstrations through Updatable View (Run in MySQL Workbench)
-- ------------------------------------------------------------------------------

-- 4a. Permitted UPDATE: Updating average price of an active service
-- In MySQL 8, this successfully updates base table 'service' through the view:
UPDATE v_active_service_catalog
   SET average_price = 65000.00
 WHERE service_id = 101;

-- 4b. Prohibited UPDATE (WITH CHECK OPTION Violation):
-- Attempting to set active_status = 0 through this view is rejected:
-- Expected Error in MySQL: Error Code: 1369. CHECK OPTION failed 'business_service_db.v_active_service_catalog'
-- UPDATE v_active_service_catalog SET active_status = 0 WHERE service_id = 101;

-- ------------------------------------------------------------------------------
-- 5. Engine Compatibility Note: Dolt vs Standard MySQL Workbench
-- ------------------------------------------------------------------------------
-- - Standard MySQL 8 / MySQL Workbench: Supports both DDL and DML (INSERT/UPDATE/DELETE)
--   through updatable views meeting ISO SQL-92 updatability criteria.
-- - Dolt 2.4+: Supports CREATE VIEW ... WITH CHECK OPTION for virtual querying, but
--   currently treats all view write operations as read-only ('table doesn't support UPDATE').
-- ------------------------------------------------------------------------------

