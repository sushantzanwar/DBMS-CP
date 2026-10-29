CREATE DATABASE IF NOT EXISTS `business_service_db`; USE `business_service_db`; 
SET FOREIGN_KEY_CHECKS=0;
SET UNIQUE_CHECKS=0;
DROP TABLE IF EXISTS `account`;
CREATE TABLE `account` (
  `account_id` int NOT NULL,
  `business_id` int NOT NULL,
  `password_hash` varchar(100) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`account_id`),
  UNIQUE KEY `uq_account_business` (`business_id`),
  CONSTRAINT `account_fk_business` FOREIGN KEY (`business_id`) REFERENCES `business` (`business_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
INSERT INTO `account` (`account_id`,`business_id`,`password_hash`,`created_at`) VALUES (1,6,'$2b$10$VFkAS73FefBWehDcqtwVRu3Bvv4HoCaMJOmVywP0rsIXA1L384Cbe','2026-10-22 00:17:15'), (2,7,'$2b$10$jns.lBS1zKsgmODHA3HH/O5Gq7J3J.5ofyYmzpS6ZCR4DMhma7Z3u','2026-10-22 00:39:08'), (3,8,'$2b$10$kQWm6djetInI9FUkNgO6f.OaIkj2u3Xz11YA14Ac9ntiHaLR18dxK','2026-10-22 00:54:25');
DROP TABLE IF EXISTS `business`;
CREATE TABLE `business` (
  `business_id` int NOT NULL,
  `business_name` varchar(100) NOT NULL,
  `industry` varchar(50) NOT NULL,
  `city` varchar(50) NOT NULL,
  `state` varchar(50) NOT NULL,
  `business_size` varchar(30) DEFAULT NULL,
  `employees` int DEFAULT NULL,
  `revenue_range` varchar(50) DEFAULT NULL,
  `business_age` int DEFAULT NULL,
  `business_stage` varchar(30) DEFAULT NULL,
  `description` text,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `website` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`business_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `phone` (`phone`),
  UNIQUE KEY `website` (`website`),
  CONSTRAINT `business_chk_1` CHECK ((`employees` >= 0)),
  CONSTRAINT `business_chk_2` CHECK ((`business_age` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO `business` (`business_id`,`business_name`,`industry`,`city`,`state`,`business_size`,`employees`,`revenue_range`,`business_age`,`business_stage`,`description`,`email`,`phone`,`website`) VALUES (1,'TechNova Solutions','Information Technology','Mumbai','Maharashtra','Large',55,'50L-1Cr',6,'Growth','Technology solutions and software development company','contact@technova.com','9876500011','www.technova.com'), (2,'GreenLeaf Foods','Food Processing','Mumbai','Maharashtra','Small',18,'10L-50L',4,'Growth','Food processing and packaged food company','hello@greenleaf.com','9876500012','www.greenleaf.com'), (3,'BrightBuild Infra','Construction','Pune','Maharashtra','Large',120,'1Cr-5Cr',10,'Established','Construction and infrastructure company','info@brightbuild.com','9876500013','www.brightbuild.com'), (4,'EduSpark Academy','Education','Pune','Maharashtra','Small',12,'10L-50L',3,'Startup','Digital learning and training organization','contact@eduspark.com','9876500014','www.eduspark.com'), (5,'FinEdge Consulting','Finance','Bengaluru','Karnataka','Medium',35,'50L-1Cr',7,'Growth','Financial consulting and business advisory firm','info@finedge.com','9876500015','www.finedge.com'), (6,'Chandrashan Tiles','Ceramic','Thane','Maharashtra','Medium',NULL,NULL,NULL,NULL,'TimepaSS','sushantzanwar46@gmail.com','9046106777',NULL), (7,'Vala Industries','Estate','Surat','Gujarat','Medium',NULL,NULL,NULL,NULL,'kuch to dhanda hai','vishwasvala@gmail.com','9265876149',NULL), (8,'Satyarth Medicals','Vaccine Distributor','Latur','Maharashtra','Small',NULL,NULL,NULL,NULL,'Providing pedetrician vaccines to hospitals','satyarthmedical@gmail.com','94219453530',NULL);
DROP TABLE IF EXISTS `demo_commission_payout`;
CREATE TABLE `demo_commission_payout` (
  `payout_id` int NOT NULL AUTO_INCREMENT,
  `transaction_id` int NOT NULL,
  `seller_business_id` int NOT NULL,
  `agreed_price` decimal(10,2) NOT NULL,
  `commission_rate_pct` decimal(4,2) NOT NULL,
  `commission_amount` decimal(10,2) NOT NULL,
  `net_seller_payout` decimal(10,2) NOT NULL,
  `calculated_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`payout_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
INSERT INTO `demo_commission_payout` (`payout_id`,`transaction_id`,`seller_business_id`,`agreed_price`,`commission_rate_pct`,`commission_amount`,`net_seller_payout`,`calculated_at`) VALUES (1,3001,4,62000.00,5.00,3100,58900,'2026-10-28 21:32:30'), (2,3004,5,27000.00,10.00,2700,24300,'2026-10-28 21:32:30'), (3,3005,7,5500.00,10.00,550.00,4950.00,'2026-10-28 21:32:30');
DROP TABLE IF EXISTS `proposal`;
CREATE TABLE `proposal` (
  `proposal_id` int NOT NULL,
  `request_id` int NOT NULL,
  `provider_business_id` int NOT NULL,
  `proposed_price` decimal(10,2) NOT NULL,
  `quantity` int DEFAULT NULL,
  `estimated_delivery_duration` int DEFAULT NULL,
  `message` text,
  `status` varchar(30) DEFAULT 'Submitted',
  `submitted_date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`proposal_id`),
  KEY `provider_business_id` (`provider_business_id`),
  UNIQUE KEY `request_id` (`request_id`,`provider_business_id`),
  CONSTRAINT `proposal_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `request` (`request_id`),
  CONSTRAINT `proposal_ibfk_2` FOREIGN KEY (`provider_business_id`) REFERENCES `business` (`business_id`),
  CONSTRAINT `proposal_chk_1` CHECK ((`proposed_price` >= 0)),
  CONSTRAINT `proposal_chk_2` CHECK ((`quantity` > 0)),
  CONSTRAINT `proposal_chk_3` CHECK ((`estimated_delivery_duration` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO `proposal` (`proposal_id`,`request_id`,`provider_business_id`,`proposed_price`,`quantity`,`estimated_delivery_duration`,`message`,`status`,`submitted_date`) VALUES (2001,1001,4,65000.00,1,20,'We can develop a responsive website within 20 days.','Submitted','2026-08-21 23:40:08'), (2002,1002,1,35000.00,1,15,'We provide complete digital marketing services.','Submitted','2026-08-21 23:40:08'), (2003,1003,1,85000.00,1,25,'We can create a customized analytics dashboard.','Submitted','2026-08-21 23:40:08'), (2004,1004,5,28000.00,1,30,'We provide monthly accounting and reporting services.','Submitted','2026-08-21 23:40:08'), (2005,1006,7,5500.00,1,3,'We are best in the market','Accepted','2026-10-22 00:41:37');
DROP TABLE IF EXISTS `request`;
CREATE TABLE `request` (
  `request_id` int NOT NULL,
  `business_id` int NOT NULL,
  `service_id` int NOT NULL,
  `title` varchar(150) NOT NULL,
  `description` text NOT NULL,
  `quantity_required` int DEFAULT NULL,
  `budget_min` decimal(10,2) DEFAULT NULL,
  `budget_max` decimal(10,2) DEFAULT NULL,
  `required_by` date DEFAULT NULL,
  `location_preference` varchar(100) DEFAULT NULL,
  `status` varchar(30) DEFAULT 'Pending',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_id`),
  KEY `business_id` (`business_id`),
  KEY `service_id` (`service_id`),
  CONSTRAINT `request_ibfk_1` FOREIGN KEY (`business_id`) REFERENCES `business` (`business_id`),
  CONSTRAINT `request_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `service` (`service_id`),
  CONSTRAINT `request_chk_1` CHECK ((`quantity_required` > 0)),
  CONSTRAINT `request_chk_2` CHECK ((`budget_min` >= 0)),
  CONSTRAINT `request_chk_3` CHECK ((`budget_max` >= `budget_min`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO `request` (`request_id`,`business_id`,`service_id`,`title`,`description`,`quantity_required`,`budget_min`,`budget_max`,`required_by`,`location_preference`,`status`,`created_at`) VALUES (1001,1,101,'Company Website','Need a responsive website for our company.',1,50000.00,80000.00,'2026-09-15','Pune','Completed','2026-08-21 23:39:58'), (1002,2,102,'Social Media Marketing','Need social media marketing for our new food products.',1,20000.00,40000.00,'2026-09-10','Mumbai','Open','2026-08-21 23:39:58'), (1003,3,103,'Business Dashboard','Need a dashboard for monitoring project performance.',1,60000.00,100000.00,'2026-10-01','Nashik','Open','2026-08-21 23:39:58'), (1004,4,104,'Accounting Support','Need monthly accounting and financial reporting.',1,20000.00,30000.00,'2026-09-30','Pune','Open','2026-08-21 23:39:58'), (1005,5,105,'Branding Package','Need logo and branding material for the company.',1,10000.00,20000.00,'2026-09-20','Bengaluru','Open','2026-08-21 23:39:58'), (1006,6,102,'Social Media Handling','We need a service for creating and reels,photos and posters for uploading on socia media',1,5000.00,60000.00,'2026-10-25','Thane','Completed','2026-10-22 00:35:56'), (1007,7,101,'Designing a website for our brand','with payment interface',1,5500.00,6500.00,'2026-10-30','Gujarat','Open','2026-10-22 00:44:44'), (1008,8,105,'Sample Testing','sample testing',1,5000.00,6000.00,NULL,NULL,'Open','2026-10-28 14:38:04');
DROP TABLE IF EXISTS `review`;
CREATE TABLE `review` (
  `review_id` int NOT NULL,
  `transaction_id` int NOT NULL,
  `reviewer_business_id` int NOT NULL,
  `reviewed_business_id` int NOT NULL,
  `rating` int NOT NULL,
  `review_text` text,
  `quality_rating` int DEFAULT NULL,
  `timeliness_rating` int DEFAULT NULL,
  `communication_rating` int DEFAULT NULL,
  `review_date` date DEFAULT (curdate()),
  PRIMARY KEY (`review_id`),
  KEY `reviewed_business_id` (`reviewed_business_id`),
  KEY `reviewer_business_id` (`reviewer_business_id`),
  UNIQUE KEY `transaction_id` (`transaction_id`),
  CONSTRAINT `review_ibfk_1` FOREIGN KEY (`transaction_id`) REFERENCES `transaction` (`transaction_id`),
  CONSTRAINT `review_ibfk_2` FOREIGN KEY (`reviewer_business_id`) REFERENCES `business` (`business_id`),
  CONSTRAINT `review_ibfk_3` FOREIGN KEY (`reviewed_business_id`) REFERENCES `business` (`business_id`),
  CONSTRAINT `review_chk_1` CHECK ((`rating` BETWEEN 1 AND 5)),
  CONSTRAINT `review_chk_2` CHECK ((`quality_rating` BETWEEN 1 AND 5)),
  CONSTRAINT `review_chk_3` CHECK ((`timeliness_rating` BETWEEN 1 AND 5)),
  CONSTRAINT `review_chk_4` CHECK ((`communication_rating` BETWEEN 1 AND 5)),
  CONSTRAINT `review_chk_5` CHECK ((NOT((`reviewer_business_id` = `reviewed_business_id`))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO `review` (`review_id`,`transaction_id`,`reviewer_business_id`,`reviewed_business_id`,`rating`,`review_text`,`quality_rating`,`timeliness_rating`,`communication_rating`,`review_date`) VALUES (4001,3001,1,4,5,'Excellent website development service.',5,5,5,'2026-08-21'), (4002,3002,2,1,4,'Good marketing service and communication.',4,4,5,'2026-08-21'), (4003,3004,4,5,5,'Very reliable accounting service.',5,5,4,'2026-08-21'), (4004,3005,6,7,5,'Overall a good option to checkout',5,4,3,'2026-10-22');
DROP TABLE IF EXISTS `service`;
CREATE TABLE `service` (
  `service_id` int NOT NULL,
  `service_name` varchar(100) NOT NULL,
  `category` varchar(50) NOT NULL,
  `description` text,
  `average_price` decimal(10,2) DEFAULT NULL,
  `complexity` varchar(30) DEFAULT NULL,
  `remote_available` tinyint(1) DEFAULT '1',
  `active_status` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`service_id`),
  UNIQUE KEY `service_name` (`service_name`),
  CONSTRAINT `service_chk_1` CHECK ((`average_price` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO `service` (`service_id`,`service_name`,`category`,`description`,`average_price`,`complexity`,`remote_available`,`active_status`) VALUES (101,'Web Development','IT','Website and web application development',60000.00,'Medium',1,1), (102,'Digital Marketing','Marketing','Online advertising and social media marketing',30000.00,'Medium',1,1), (103,'Data Analytics','IT','Business data analysis and dashboard development',75000.00,'High',1,1), (104,'Accounting Services','Finance','Accounting and financial record management',25000.00,'Medium',1,1), (105,'Graphic Design','Design','Branding, posters and digital graphics',15000.00,'Low',1,1);
DROP TABLE IF EXISTS `transaction`;
CREATE TABLE `transaction` (
  `transaction_id` int NOT NULL,
  `request_id` int NOT NULL,
  `buyer_business_id` int NOT NULL,
  `seller_business_id` int NOT NULL,
  `service_id` int NOT NULL,
  `quantity` int NOT NULL,
  `agreed_price` decimal(10,2) NOT NULL,
  `start_date` date DEFAULT NULL,
  `completion_date` date DEFAULT NULL,
  `status` varchar(30) DEFAULT 'Active',
  `payment_status` varchar(30) DEFAULT 'Pending',
  PRIMARY KEY (`transaction_id`),
  KEY `buyer_business_id` (`buyer_business_id`),
  KEY `request_id` (`request_id`),
  KEY `seller_business_id` (`seller_business_id`),
  KEY `service_id` (`service_id`),
  CONSTRAINT `transaction_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `request` (`request_id`),
  CONSTRAINT `transaction_ibfk_2` FOREIGN KEY (`buyer_business_id`) REFERENCES `business` (`business_id`),
  CONSTRAINT `transaction_ibfk_3` FOREIGN KEY (`seller_business_id`) REFERENCES `business` (`business_id`),
  CONSTRAINT `transaction_ibfk_4` FOREIGN KEY (`service_id`) REFERENCES `service` (`service_id`),
  CONSTRAINT `transaction_chk_1` CHECK ((`quantity` > 0)),
  CONSTRAINT `transaction_chk_2` CHECK ((`agreed_price` >= 0)),
  CONSTRAINT `transaction_chk_3` CHECK ((NOT((`buyer_business_id` = `seller_business_id`))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO `transaction` (`transaction_id`,`request_id`,`buyer_business_id`,`seller_business_id`,`service_id`,`quantity`,`agreed_price`,`start_date`,`completion_date`,`status`,`payment_status`) VALUES (3001,1001,1,4,101,1,62000.00,'2026-08-25','2026-09-12','Completed','Paid'), (3002,1002,2,1,102,1,32000.00,'2026-08-20','2026-09-05','Active','Paid'), (3003,1003,3,1,103,1,80000.00,'2026-08-28','2026-09-25','Active','Pending'), (3004,1004,4,5,104,1,27000.00,'2026-08-25','2026-09-20','Completed','Paid'), (3005,1006,6,7,102,1,5500.00,'2026-10-22','2026-10-22','Completed','Pending');
DROP TABLE IF EXISTS `transaction_audit_log`;
CREATE TABLE `transaction_audit_log` (
  `audit_id` int NOT NULL AUTO_INCREMENT,
  `transaction_id` int NOT NULL,
  `old_status` varchar(30),
  `new_status` varchar(30),
  `old_payment_status` varchar(30),
  `new_payment_status` varchar(30),
  `agreed_price` decimal(10,2),
  `changed_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
INSERT INTO `transaction_audit_log` (`audit_id`,`transaction_id`,`old_status`,`new_status`,`old_payment_status`,`new_payment_status`,`agreed_price`,`changed_at`) VALUES (1,3006,'Active','Completed','Pending','Pending',75000.00,'2026-10-28 20:18:26'), (2,3006,'Completed','Completed','Pending','Paid',75000.00,'2026-10-28 20:18:26'), (3,3006,'Active','Completed','Pending','Pending',75000.00,'2026-10-28 21:32:10'), (4,3006,'Completed','Completed','Pending','Paid',75000.00,'2026-10-28 21:32:10');
CREATE OR REPLACE VIEW business_info AS
SELECT business_id, business_name, industry, city, business_size
  FROM business;
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
CREATE OR REPLACE VIEW v_active_service_catalog AS
      SELECT service_id, service_name, category, average_price, complexity, active_status
        FROM service
       WHERE active_status = 1
        WITH CHECK OPTION;
CREATE VIEW v_business_rating AS
SELECT b.business_id, b.business_name, b.industry, b.city, b.state, b.business_size,
       ROUND(AVG(rv.rating), 2) AS avg_rating,
       COUNT(rv.review_id)      AS review_count
  FROM business b
  LEFT JOIN review rv ON rv.reviewed_business_id = b.business_id
 GROUP BY b.business_id, b.business_name, b.industry, b.city, b.state, b.business_size;
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
CREATE TRIGGER trg_transaction_status_audit
    AFTER UPDATE ON `transaction`
    FOR EACH ROW
    BEGIN
      IF (OLD.status <> NEW.status) OR (OLD.payment_status <> NEW.payment_status) THEN
        INSERT INTO transaction_audit_log (
          transaction_id,
          old_status,
          new_status,
          old_payment_status,
          new_payment_status,
          agreed_price
        ) VALUES (
          OLD.transaction_id,
          OLD.status,
          NEW.status,
          OLD.payment_status,
          NEW.payment_status,
          NEW.agreed_price
        );
      END IF;
    END;
delimiter END_PROCEDURE
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
      END;
END_PROCEDURE
delimiter ;
delimiter END_PROCEDURE
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
      END;
END_PROCEDURE
delimiter ;
delimiter END_PROCEDURE
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
      END;
END_PROCEDURE
delimiter ;
