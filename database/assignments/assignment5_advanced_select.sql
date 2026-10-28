-- ==============================================================================
-- ServicePath AI - Assignment 5: Advanced SELECT, Operators, Aggregates & Subqueries
-- Primary Demonstration Environment: MySQL Workbench (127.0.0.1:3307 / Standard MySQL 8)
-- Version Control & Database Engine: Dolt (MySQL 8.0.31 compatible)
-- ==============================================================================

USE business_service_db;

-- ------------------------------------------------------------------------------
-- 1. Relational & Compound Logical Operators (AND, OR, NOT)
-- Scenario: Find medium or large businesses in Maharashtra with more than 20 employees.
-- ------------------------------------------------------------------------------

SELECT business_id, business_name, industry, city, state, business_size, employees
  FROM business
 WHERE state = 'Maharashtra'
   AND (business_size = 'Large' OR business_size = 'Medium')
   AND NOT (employees < 20)
 ORDER BY employees DESC;

-- ------------------------------------------------------------------------------
-- 2. Range, List, and NULL Handling (BETWEEN, IN, NOT IN, IS NULL)
-- ------------------------------------------------------------------------------

-- 2a. Range check using BETWEEN:
SELECT request_id, title, budget_min, budget_max
  FROM request
 WHERE budget_max BETWEEN 30000.00 AND 80000.00;

-- 2b. List membership using IN & NOT IN:
SELECT service_id, service_name, category, average_price
  FROM service
 WHERE category IN ('IT', 'Marketing')
   AND service_id NOT IN (105);

-- 2c. NULL checks using IS NULL & IS NOT NULL:
SELECT t.transaction_id, t.agreed_price, t.status,
       rv.review_id,
       CASE WHEN rv.review_id IS NULL THEN 'Pending Review' ELSE 'Reviewed' END AS review_status
  FROM `transaction` t
  LEFT JOIN review rv ON rv.transaction_id = t.transaction_id
 WHERE t.status = 'Completed';

-- ------------------------------------------------------------------------------
-- 3. Pattern Matching with Wildcards (LIKE '%', '_')
-- ------------------------------------------------------------------------------

-- 3a. Multiple-character wildcard (%): Businesses containing 'Tech' or 'Solutions':
SELECT business_id, business_name, industry
  FROM business
 WHERE business_name LIKE '%Tech%' OR business_name LIKE '%Solutions%';

-- 3b. Single-character wildcard (_): Mobile numbers with specific prefix patterns:
SELECT business_id, business_name, phone
  FROM business
 WHERE phone LIKE '987650001_';

-- ------------------------------------------------------------------------------
-- 4. Aggregate Functions with GROUP BY and HAVING
-- Scenario: Compute deal analytics per seller; filter only sellers with completed deals.
-- ------------------------------------------------------------------------------

SELECT b.business_id,
       b.business_name,
       COUNT(DISTINCT t.transaction_id) AS total_completed_deals,
       COALESCE(SUM(t.agreed_price), 0) AS total_revenue_earned,
       ROUND(AVG(t.agreed_price), 2)    AS avg_deal_size,
       MIN(t.agreed_price)              AS smallest_deal,
       MAX(t.agreed_price)              AS largest_deal
  FROM business b
  JOIN `transaction` t ON t.seller_business_id = b.business_id
 WHERE t.status = 'Completed'
 GROUP BY b.business_id, b.business_name
HAVING total_completed_deals >= 1
 ORDER BY total_revenue_earned DESC;

-- ------------------------------------------------------------------------------
-- 5. Set Operators: UNION, UNION ALL, INTERSECT, EXCEPT (Verified in MySQL 8 / Dolt)
-- ------------------------------------------------------------------------------

-- 5a. UNION (Distinct combined list of all business cities):
SELECT city FROM business WHERE industry = 'Information Technology'
UNION
SELECT city FROM business WHERE business_size = 'Large';

-- 5b. UNION ALL (Preserves duplicates across sets):
SELECT city, 'IT Industry' AS source FROM business WHERE industry = 'Information Technology'
UNION ALL
SELECT city, 'Large Size'  AS source FROM business WHERE business_size = 'Large';

-- 5c. INTERSECT (Set Intersection):
-- Scenario: Find business IDs that have participated in transactions as BOTH a Buyer AND a Seller.
SELECT buyer_business_id AS active_dual_participant_id FROM `transaction`
INTERSECT
SELECT seller_business_id FROM `transaction`;

-- 5d. EXCEPT (Set Difference / Relational Minus):
-- Scenario: Find business IDs that have acted as Buyers but have NEVER acted as Sellers.
SELECT buyer_business_id AS buyer_only_business_id FROM `transaction`
EXCEPT
SELECT seller_business_id FROM `transaction`;

-- ------------------------------------------------------------------------------
-- 6. Single-Row Functions & CASE Expression
-- ------------------------------------------------------------------------------

SELECT r.request_id,
       UPPER(r.title)                                              AS uppercase_title,
       CONCAT_WS(' - ', b.business_name, UPPER(b.city))            AS client_label,
       COALESCE(r.location_preference, 'Unrestricted / Anywhere')  AS location_policy,
       DATE_FORMAT(r.created_at, '%d %M %Y')                       AS formatted_date,
       DATEDIFF(r.required_by, CURDATE())                          AS days_until_deadline,
       ROUND((r.budget_max - r.budget_min), 2)                     AS budget_spread,
       CASE 
         WHEN r.budget_max >= 80000.00 THEN 'High Value Tier'
         WHEN r.budget_max >= 40000.00 THEN 'Mid Value Tier'
         ELSE 'Economy Tier'
       END AS budget_tier
  FROM request r
  JOIN business b ON b.business_id = r.business_id
 ORDER BY r.budget_max DESC;

-- ------------------------------------------------------------------------------
-- 7. Nested and Correlated Subqueries
-- ------------------------------------------------------------------------------

-- 7a. Nested Non-Correlated Subquery:
-- Find services priced strictly above the average catalog price of all active services:
SELECT service_id, service_name, category, average_price
  FROM service
 WHERE active_status = 1
   AND average_price > (SELECT AVG(average_price) FROM service WHERE active_status = 1)
 ORDER BY average_price DESC;

-- 7b. Correlated Subquery (Evaluated per outer row):
-- Find services priced above the average of THEIR OWN category:
SELECT s1.service_id, s1.service_name, s1.category, s1.average_price,
       (SELECT ROUND(AVG(s2.average_price), 2) FROM service s2 WHERE s2.category = s1.category) AS category_avg
  FROM service s1
 WHERE s1.average_price > (
   SELECT AVG(s2.average_price) 
     FROM service s2 
    WHERE s2.category = s1.category
 );

-- 7c. Correlated Subquery with EXISTS:
-- Find open requests that have received at least one proposal:
SELECT r.request_id, r.title, b.business_name AS buyer_name
  FROM request r
  JOIN business b ON b.business_id = r.business_id
 WHERE r.status = 'Open'
   AND EXISTS (
     SELECT 1 FROM proposal p WHERE p.request_id = r.request_id
   );

-- 7d. Correlated Subquery with NOT EXISTS:
-- Find open requests that have zero submitted proposals:
SELECT r.request_id, r.title, b.business_name AS buyer_name
  FROM request r
  JOIN business b ON b.business_id = r.business_id
 WHERE r.status = 'Open'
   AND NOT EXISTS (
     SELECT 1 FROM proposal p WHERE p.request_id = r.request_id
   );

