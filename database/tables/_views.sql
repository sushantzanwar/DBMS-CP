-- Views (business_view, large_businesses and pune_businesses are placeholder stubs in the source database)
SET @previousSqlMode=@@SQL_MODE;
SET @@SQL_MODE='NO_AUTO_VALUE_ON_ZERO';
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `business_info` AS select `business`.`business_id` AS `business_id`,`business`.`business_name` AS `business_name`,`business`.`industry` AS `industry`,`business`.`city` AS `city`,`business`.`business_size` AS `business_size` from `business` */;
SET @@SQL_MODE=@previousSqlMode;
CREATE OR REPLACE VIEW business_view AS
SELECT business_id, business_name, industry, city, state, business_size
  FROM business;
CREATE OR REPLACE VIEW large_businesses AS
SELECT business_id, business_name, industry, city, state, business_size
  FROM business
 WHERE business_size = 'Large';
CREATE OR REPLACE VIEW pune_businesses AS
SELECT business_id, business_name, industry, city, business_size
  FROM business
 WHERE city = 'Pune';
CREATE VIEW v_business_rating AS
SELECT b.business_id, b.business_name, b.industry, b.city, b.state, b.business_size,
       ROUND(AVG(rv.rating), 2) AS avg_rating,
       COUNT(rv.review_id)      AS review_count
  FROM business b
  LEFT JOIN review rv ON rv.reviewed_business_id = b.business_id
 GROUP BY b.business_id, b.business_name, b.industry, b.city, b.state, b.business_size;
CREATE VIEW v_request_summary AS
SELECT r.request_id, r.title, r.description, r.status, r.quantity_required,
       r.budget_min, r.budget_max, r.required_by, r.location_preference, r.created_at,
       b.business_id AS buyer_id, b.business_name AS buyer_name, b.city AS buyer_city,
       s.service_id, s.service_name, s.category,
       (SELECT COUNT(*) FROM proposal p WHERE p.request_id = r.request_id) AS proposal_count
  FROM request r
  JOIN business b ON b.business_id = r.business_id
  JOIN service  s ON s.service_id  = r.service_id;
CREATE VIEW v_service_catalogue AS
SELECT s.service_id, s.service_name, s.category, s.description, s.average_price,
       s.complexity, s.remote_available,
       (SELECT COUNT(*) FROM request r WHERE r.service_id = s.service_id) AS request_count
  FROM service s
 WHERE s.active_status = 1;
