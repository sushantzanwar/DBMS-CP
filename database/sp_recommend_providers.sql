-- ServicePath AI: Phase 1 Intelligent Provider Recommendation Engine
-- Stored Procedure: sp_recommend_providers
-- Demonstrates: Cross-table JOINs, CASE expressions, scalar subqueries, and non-equi joins.

DROP PROCEDURE IF EXISTS sp_recommend_providers;

DELIMITER $$

CREATE PROCEDURE sp_recommend_providers(IN p_request_id INT)
BEGIN
  SELECT
    b.business_id,
    b.business_name,
    b.industry,
    b.city,
    b.state,
    b.business_size,
    vbr.avg_rating,
    vbr.review_count,
    
    -- 1. Capability / Domain Relevance Score (0 - 40 pts)
    (CASE 
      WHEN EXISTS (
        SELECT 1 FROM `transaction` t 
        WHERE t.seller_business_id = b.business_id 
          AND t.service_id = req.service_id 
          AND t.status = 'Completed'
      ) THEN 40
      WHEN EXISTS (
        SELECT 1 FROM proposal p 
        JOIN request r_hist ON r_hist.request_id = p.request_id 
        WHERE p.provider_business_id = b.business_id 
          AND r_hist.service_id = req.service_id
      ) THEN 30
      WHEN b.industry = svc.category OR b.industry LIKE CONCAT('%', svc.category, '%') THEN 20
      ELSE 10
    END) AS capability_score,

    -- 2. Location Proximity Score (0 - 25 pts)
    (CASE 
      WHEN req.location_preference IS NULL OR req.location_preference = '' 
        OR req.location_preference = 'Anywhere' OR req.location_preference = 'Remote' THEN 25
      WHEN LOWER(b.city) = LOWER(req.location_preference) THEN 25
      WHEN LOWER(b.state) = (SELECT LOWER(state) FROM business WHERE business_id = req.business_id) THEN 15
      ELSE 5
    END) AS location_score,

    -- 3. Reputation & Review Quality Score (0 - 20 pts)
    (CASE 
      WHEN vbr.avg_rating IS NOT NULL THEN ROUND((vbr.avg_rating / 5.0) * 20, 1)
      ELSE 10.0 -- Baseline default for unrated businesses
    END) AS reputation_score,

    -- 4. Track Record & Capacity Score (0 - 15 pts)
    (CASE 
      WHEN (SELECT COUNT(*) FROM `transaction` t WHERE t.seller_business_id = b.business_id AND t.status = 'Completed') >= 2 THEN 15
      WHEN (SELECT COUNT(*) FROM `transaction` t WHERE t.seller_business_id = b.business_id AND t.status = 'Completed') = 1 THEN 10
      WHEN b.business_size = 'Large' THEN 8
      WHEN b.business_size = 'Medium' THEN 6
      ELSE 4
    END) AS track_record_score,

    -- Composite Normalized Match Score (0 - 100%)
    ROUND(
      (CASE 
        WHEN EXISTS (
          SELECT 1 FROM `transaction` t 
          WHERE t.seller_business_id = b.business_id 
            AND t.service_id = req.service_id 
            AND t.status = 'Completed'
        ) THEN 40
        WHEN EXISTS (
          SELECT 1 FROM proposal p 
          JOIN request r_hist ON r_hist.request_id = p.request_id 
          WHERE p.provider_business_id = b.business_id 
            AND r_hist.service_id = req.service_id
        ) THEN 30
        WHEN b.industry = svc.category OR b.industry LIKE CONCAT('%', svc.category, '%') THEN 20
        ELSE 10
      END)
      +
      (CASE 
        WHEN req.location_preference IS NULL OR req.location_preference = '' 
          OR req.location_preference = 'Anywhere' OR req.location_preference = 'Remote' THEN 25
        WHEN LOWER(b.city) = LOWER(req.location_preference) THEN 25
        WHEN LOWER(b.state) = (SELECT LOWER(state) FROM business WHERE business_id = req.business_id) THEN 15
        ELSE 5
      END)
      +
      (CASE 
        WHEN vbr.avg_rating IS NOT NULL THEN (vbr.avg_rating / 5.0) * 20
        ELSE 10.0
      END)
      +
      (CASE 
        WHEN (SELECT COUNT(*) FROM `transaction` t WHERE t.seller_business_id = b.business_id AND t.status = 'Completed') >= 2 THEN 15
        WHEN (SELECT COUNT(*) FROM `transaction` t WHERE t.seller_business_id = b.business_id AND t.status = 'Completed') = 1 THEN 10
        WHEN b.business_size = 'Large' THEN 8
        WHEN b.business_size = 'Medium' THEN 6
        ELSE 4
      END)
    ) AS match_score,

    -- Dynamic Status: whether this provider has already bid on this request
    (EXISTS (
      SELECT 1 FROM proposal p 
      WHERE p.request_id = req.request_id AND p.provider_business_id = b.business_id
    )) AS has_already_bid

  FROM request req
  JOIN service svc ON svc.service_id = req.service_id
  CROSS JOIN business b
  LEFT JOIN v_business_rating vbr ON vbr.business_id = b.business_id
  WHERE req.request_id = p_request_id
    AND b.business_id <> req.business_id -- Exclude self-recommendation
  ORDER BY match_score DESC, vbr.avg_rating DESC, b.business_name ASC
  LIMIT 5;
END $$

DELIMITER ;

