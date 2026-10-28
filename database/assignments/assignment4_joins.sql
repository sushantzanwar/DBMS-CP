-- ==============================================================================
-- ServicePath AI - Assignment 4: Comprehensive JOIN Demonstrations
-- Primary Demonstration Environment: MySQL Workbench (127.0.0.1:3307 / Standard MySQL 8)
-- Version Control & Database Engine: Dolt (MySQL 8.0.31 compatible)
-- ==============================================================================

USE business_service_db;

-- ------------------------------------------------------------------------------
-- 1. EQUI-JOIN (Equality Operator '=')
-- Purpose: Standard relational navigation linking child foreign keys to parent primary keys.
-- Scenario: Find every service request with the buyer business name and requested service.
-- ------------------------------------------------------------------------------

SELECT r.request_id,
       r.title,
       b.business_name AS buyer_name,
       b.city          AS buyer_city,
       s.service_name,
       s.category
  FROM request r
  JOIN business b ON b.business_id = r.business_id
  JOIN service  s ON s.service_id  = r.service_id
 ORDER BY r.request_id;

-- ------------------------------------------------------------------------------
-- 2. NON-EQUI JOIN (Condition using 'BETWEEN', '<', '>', or '<>')
-- ------------------------------------------------------------------------------

-- 2a. Non-Equi Join using BETWEEN:
-- Purpose: Match proposals where the proposed price falls strictly within the buyer's budget range.
SELECT p.proposal_id,
       r.title               AS request_title,
       p.proposed_price,
       r.budget_min,
       r.budget_max,
       provider.business_name AS provider_name
  FROM proposal p
  JOIN request r 
    ON p.request_id = r.request_id
   AND p.proposed_price BETWEEN r.budget_min AND r.budget_max
  JOIN business provider 
    ON provider.business_id = p.provider_business_id
 ORDER BY p.proposal_id;

-- 2b. Non-Equi Join using '<' (Bargain offers below buyer's minimum budget):
SELECT p.proposal_id,
       r.title        AS request_title,
       p.proposed_price,
       r.budget_min   AS buyer_budget_min,
       (r.budget_min - p.proposed_price) AS buyer_savings
  FROM proposal p
  JOIN request r 
    ON p.request_id = r.request_id
   AND p.proposed_price < r.budget_min;

-- 2c. Non-Equi Self-Join on Service using '>':
-- Purpose: Compare catalog services within the same category to identify tiered pricing.
SELECT s1.category,
       s1.service_name  AS higher_tier_service,
       s1.average_price AS higher_price,
       s2.service_name  AS standard_tier_service,
       s2.average_price AS standard_price,
       (s1.average_price - s2.average_price) AS price_difference
  FROM service s1
  JOIN service s2 
    ON s1.category = s2.category 
   AND s1.average_price > s2.average_price
 ORDER BY s1.category;

-- ------------------------------------------------------------------------------
-- 3. SELF-JOIN (Table Joined to Itself)
-- Scenario: In the 'transaction' table, both 'buyer_business_id' and 'seller_business_id'
--           reference 'business(business_id)'. We join the business table twice using
--           aliases 'buyer' and 'seller' to display both parties in the same row.
-- ------------------------------------------------------------------------------

SELECT t.transaction_id,
       r.title                AS deal_title,
       buyer.business_name    AS buyer_business,
       buyer.city             AS buyer_city,
       seller.business_name   AS seller_business,
       seller.city            AS seller_city,
       s.service_name,
       t.agreed_price,
       t.status               AS deal_status
  FROM `transaction` t
  JOIN request  r      ON r.request_id      = t.request_id
  JOIN service  s      ON s.service_id      = t.service_id
  JOIN business buyer  ON buyer.business_id  = t.buyer_business_id
  JOIN business seller ON seller.business_id = t.seller_business_id
 ORDER BY t.transaction_id;

-- ------------------------------------------------------------------------------
-- 4. NATURAL JOIN (and the Classic Common-Column Trap)
-- Relational Concept: NATURAL JOIN automatically creates an equi-join on ALL columns 
-- that share the same name across both relations.
-- WARNING / VIVA QUESTION: Why does 'request NATURAL JOIN service' produce 0 rows?
-- Both tables share 'service_id' AND 'description'! The natural join implicitly enforces:
--   request.service_id = service.service_id AND request.description = service.description
-- Because user request descriptions differ from catalog descriptions, it yields 0 rows.
-- Proper Demonstration: When projected on the intended join attribute 'service_id':
-- ------------------------------------------------------------------------------

SELECT r.request_id,
       r.title,
       r.service_id,
       s.service_name,
       s.category
  FROM (SELECT request_id, title, service_id FROM request) r
  NATURAL JOIN (SELECT service_id, service_name, category FROM service) s
 LIMIT 5;

-- ------------------------------------------------------------------------------
-- 5. OUTER JOINS (Left, Right, Full, and Anti-Join)
-- ------------------------------------------------------------------------------

-- 5a. LEFT OUTER JOIN:
-- Purpose: Keep all businesses, even if they have received zero reviews.
SELECT b.business_id,
       b.business_name,
       b.city,
       rv.review_id,
       rv.rating,
       COALESCE(rv.review_text, 'No reviews yet') AS feedback
  FROM business b
  LEFT JOIN review rv ON rv.reviewed_business_id = b.business_id
 ORDER BY b.business_id;

-- 5b. RIGHT OUTER JOIN:
-- Purpose: Inverts the join direction; keeps all rows from the right table.
SELECT rv.review_id,
       rv.rating,
       b.business_id,
       b.business_name AS reviewed_business
  FROM review rv
 RIGHT JOIN business b ON b.business_id = rv.reviewed_business_id
 ORDER BY b.business_id;

-- 5c. ANTI-JOIN (LEFT JOIN ... WHERE right.PK IS NULL):
-- Purpose: Relational Set Difference (A - B). Finds open requests that have received 0 proposals.
SELECT r.request_id,
       r.title,
       r.budget_min,
       r.budget_max,
       b.business_name AS buyer_name
  FROM request r
  JOIN business b ON b.business_id = r.business_id
  LEFT JOIN proposal p ON p.request_id = r.request_id
 WHERE r.status = 'Open' 
   AND p.proposal_id IS NULL;

-- 5d. FULL OUTER JOIN Emulation (via UNION of LEFT and RIGHT JOIN):
-- Standard MySQL and Dolt do not support 'FULL OUTER JOIN' directly; it is emulated via UNION:
SELECT b.business_id, b.business_name, r.request_id, r.title
  FROM business b
  LEFT JOIN request r ON r.business_id = b.business_id
 UNION
SELECT b.business_id, b.business_name, r.request_id, r.title
  FROM business b
 RIGHT JOIN request r ON r.business_id = b.business_id
 ORDER BY business_id, request_id;
