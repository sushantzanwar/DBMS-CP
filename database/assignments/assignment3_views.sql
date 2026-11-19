USE business_service_db;

CREATE OR REPLACE VIEW v_request_summary AS
SELECT r.request_id, r.title, r.description, r.status, r.quantity_required,
       r.budget_min, r.budget_max, r.required_by, r.location_preference, r.created_at,
       b.business_id AS buyer_id, b.business_name AS buyer_name, b.city AS buyer_city,
       s.service_id, s.service_name, s.category,
       (SELECT COUNT(*) FROM proposal p WHERE p.request_id = r.request_id) AS proposal_count
  FROM request r
  JOIN business b ON b.business_id = r.business_id
  JOIN service  s ON s.service_id  = r.service_id;

SELECT request_id, title, buyer_name, service_name, budget_min, budget_max, proposal_count
  FROM v_request_summary
 WHERE status = 'Open'
 ORDER BY created_at DESC;

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

SELECT * FROM v_category_summary ORDER BY total_requests DESC;

CREATE OR REPLACE VIEW v_active_service_catalog AS
SELECT service_id, service_name, category, average_price, complexity, active_status
  FROM service
 WHERE active_status = 1
  WITH CHECK OPTION;

SELECT service_id, service_name, category, average_price, active_status
  FROM v_active_service_catalog;

UPDATE v_active_service_catalog
   SET average_price = 65000.00
 WHERE service_id = 101;
