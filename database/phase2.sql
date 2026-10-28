-- Phase 2 additions. Nothing existing is altered or dropped.

-- Login credentials. A business logs in with business.email + this password hash.
CREATE TABLE account (
  account_id    INT          NOT NULL,
  business_id   INT          NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id),
  UNIQUE KEY uq_account_business (business_id),
  CONSTRAINT account_fk_business FOREIGN KEY (business_id) REFERENCES business (business_id)
);

-- Each request with its buyer, requested service and number of proposals received.
CREATE VIEW v_request_summary AS
SELECT r.request_id, r.title, r.description, r.status, r.quantity_required,
       r.budget_min, r.budget_max, r.required_by, r.location_preference, r.created_at,
       b.business_id AS buyer_id, b.business_name AS buyer_name, b.city AS buyer_city,
       s.service_id, s.service_name, s.category,
       (SELECT COUNT(*) FROM proposal p WHERE p.request_id = r.request_id) AS proposal_count
  FROM request r
  JOIN business b ON b.business_id = r.business_id
  JOIN service  s ON s.service_id  = r.service_id;

-- Active services with how often each has been requested.
CREATE VIEW v_service_catalogue AS
SELECT s.service_id, s.service_name, s.category, s.description, s.average_price,
       s.complexity, s.remote_available,
       (SELECT COUNT(*) FROM request r WHERE r.service_id = s.service_id) AS request_count
  FROM service s
 WHERE s.active_status = 1;

-- Each business with its average received rating and review count (0 reviews -> NULL rating).
CREATE VIEW v_business_rating AS
SELECT b.business_id, b.business_name, b.industry, b.city, b.state, b.business_size,
       ROUND(AVG(rv.rating), 2) AS avg_rating,
       COUNT(rv.review_id)      AS review_count
  FROM business b
  LEFT JOIN review rv ON rv.reviewed_business_id = b.business_id
 GROUP BY b.business_id, b.business_name, b.industry, b.city, b.state, b.business_size;

-- Category demand and financial metrics (independent aggregations prevent Cartesian product / double counting).
CREATE VIEW v_category_summary AS
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
