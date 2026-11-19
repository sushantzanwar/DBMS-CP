USE business_service_db;

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

    SELECT r.title, b.business_name, r.status
      INTO p_title, p_buyer_name, p_status
      FROM request r
      JOIN business b ON b.business_id = r.business_id
     WHERE r.request_id = p_request_id;

    SELECT COUNT(*),
           MIN(proposed_price),
           MAX(proposed_price)
      INTO p_proposal_count, p_lowest_bid, p_highest_bid
      FROM proposal
     WHERE request_id = p_request_id;

    IF p_proposal_count = 0 THEN
        SET p_lowest_bid  = 0.00;
        SET p_highest_bid = 0.00;
    END IF;
END //

DELIMITER ;

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

    SET p_completed_deals = 0;
    SET p_total_revenue   = 0.00;
    SET p_avg_rating      = 0.0;
    SET p_tier_status     = 'Standard Provider';

    SELECT business_name
      INTO p_provider_name
      FROM business
     WHERE business_id = p_provider_id;

    SELECT COUNT(*),
           SUM(agreed_price)
      INTO p_completed_deals, p_total_revenue
      FROM `transaction`
     WHERE seller_business_id = p_provider_id
       AND status = 'Completed';

    SELECT AVG(rating)
      INTO p_avg_rating
      FROM review
     WHERE reviewed_business_id = p_provider_id;

    IF p_completed_deals IS NULL THEN SET p_completed_deals = 0; END IF;
    IF p_total_revenue IS NULL THEN SET p_total_revenue = 0.00; END IF;
    IF p_avg_rating IS NULL THEN SET p_avg_rating = 0.0; END IF;

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

DROP PROCEDURE IF EXISTS sp_batch_calculate_commission_cursor;

DELIMITER //

CREATE PROCEDURE sp_batch_calculate_commission_cursor (
    OUT p_processed_count    INT,
    OUT p_total_commission   DECIMAL(12,2)
)
BEGIN

    DECLARE v_done               INT DEFAULT FALSE;
    DECLARE v_tx_id              INT;
    DECLARE v_seller_id          INT;
    DECLARE v_price              DECIMAL(10,2);
    DECLARE v_rate               INT;
    DECLARE v_comm_amt           DECIMAL(10,2);
    DECLARE v_payout             DECIMAL(10,2);

    DECLARE tx_cursor CURSOR FOR
        SELECT transaction_id, seller_business_id, agreed_price
          FROM `transaction`
         WHERE status = 'Completed';

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    TRUNCATE TABLE demo_commission_payout;

    OPEN tx_cursor;

    calc_loop: LOOP
        FETCH tx_cursor INTO v_tx_id, v_seller_id, v_price;

        IF v_done THEN
            LEAVE calc_loop;
        END IF;

        IF v_price < 30000.00 THEN
            SET v_rate = 10;
        ELSEIF v_price <= 60000.00 THEN
            SET v_rate = 8;
        ELSE
            SET v_rate = 5;
        END IF;

        SET v_comm_amt = CAST((v_price * v_rate) / 100 AS DECIMAL(10,2));
        SET v_payout   = CAST(v_price - v_comm_amt AS DECIMAL(10,2));

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

    CLOSE tx_cursor;

    SELECT COUNT(*), COALESCE(SUM(commission_amount), 0.00)
      INTO p_processed_count, p_total_commission
      FROM demo_commission_payout;
END //

DELIMITER ;

CALL sp_get_request_summary(1001, @title, @buyer, @status, @proposals, @min_bid, @max_bid);
SELECT @title AS request_title,
       @buyer AS buyer_name,
       @status AS request_status,
       @proposals AS total_proposals,
       @min_bid AS lowest_bid,
       @max_bid AS highest_bid;

CALL sp_get_request_summary(1005, @title5, @buyer5, @status5, @proposals5, @min_bid5, @max_bid5);
SELECT @title5 AS request_title,
       @buyer5 AS buyer_name,
       @status5 AS request_status,
       @proposals5 AS total_proposals,
       @min_bid5 AS lowest_bid,
       @max_bid5 AS highest_bid;

CALL sp_calculate_provider_tier(4, @p_name, @p_deals, @p_rev, @p_rating, @p_tier);
SELECT @p_name AS provider,
       @p_deals AS completed_deals,
       @p_rev AS total_revenue,
       @p_rating AS avg_rating,
       @p_tier AS assigned_tier;

CALL sp_batch_calculate_commission_cursor(@batch_count, @batch_commission);
SELECT @batch_count AS transactions_processed,
       @batch_commission AS total_platform_commission;

SELECT payout_id, transaction_id, seller_business_id, agreed_price, commission_rate_pct, commission_amount, net_seller_payout
  FROM demo_commission_payout;
