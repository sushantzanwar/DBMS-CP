-- ServicePath AI: business_service_db (tables, seed data and views). Generated with 'dolt dump' from the committed state.
-- Rebuild: in an empty Dolt repo (dolt init), run:  dolt sql < database/business_service_db.sql
-- (MySQL: create and select a database first, then run this file.)
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
INSERT INTO `business` (`business_id`,`business_name`,`industry`,`city`,`state`,`business_size`,`employees`,`revenue_range`,`business_age`,`business_stage`,`description`,`email`,`phone`,`website`) VALUES (1,'TechNova Solutions','Information Technology','Mumbai','Maharashtra','Large',55,'50L-1Cr',6,'Growth','Technology solutions and software development company','contact@technova.com','9876500011','www.technova.com'), (2,'GreenLeaf Foods','Food Processing','Mumbai','Maharashtra','Small',18,'10L-50L',4,'Growth','Food processing and packaged food company','hello@greenleaf.com','9876500012','www.greenleaf.com'), (3,'BrightBuild Infra','Construction','Pune','Maharashtra','Large',120,'1Cr-5Cr',10,'Established','Construction and infrastructure company','info@brightbuild.com','9876500013','www.brightbuild.com'), (4,'EduSpark Academy','Education','Pune','Maharashtra','Small',12,'10L-50L',3,'Startup','Digital learning and training organization','contact@eduspark.com','9876500014','www.eduspark.com'), (5,'FinEdge Consulting','Finance','Bengaluru','Karnataka','Medium',35,'50L-1Cr',7,'Growth','Financial consulting and business advisory firm','info@finedge.com','9876500015','www.finedge.com');
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
INSERT INTO `proposal` (`proposal_id`,`request_id`,`provider_business_id`,`proposed_price`,`quantity`,`estimated_delivery_duration`,`message`,`status`,`submitted_date`) VALUES (2001,1001,4,65000.00,1,20,'We can develop a responsive website within 20 days.','Submitted','2026-08-21 23:40:08'), (2002,1002,1,35000.00,1,15,'We provide complete digital marketing services.','Submitted','2026-08-21 23:40:08'), (2003,1003,1,85000.00,1,25,'We can create a customized analytics dashboard.','Submitted','2026-08-21 23:40:08'), (2004,1004,5,28000.00,1,30,'We provide monthly accounting and reporting services.','Submitted','2026-08-21 23:40:08');
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
INSERT INTO `request` (`request_id`,`business_id`,`service_id`,`title`,`description`,`quantity_required`,`budget_min`,`budget_max`,`required_by`,`location_preference`,`status`,`created_at`) VALUES (1001,1,101,'Company Website','Need a responsive website for our company.',1,50000.00,80000.00,'2026-09-15','Pune','Completed','2026-08-21 23:39:58'), (1002,2,102,'Social Media Marketing','Need social media marketing for our new food products.',1,20000.00,40000.00,'2026-09-10','Mumbai','Open','2026-08-21 23:39:58'), (1003,3,103,'Business Dashboard','Need a dashboard for monitoring project performance.',1,60000.00,100000.00,'2026-10-01','Nashik','Open','2026-08-21 23:39:58'), (1004,4,104,'Accounting Support','Need monthly accounting and financial reporting.',1,20000.00,30000.00,'2026-09-30','Pune','Open','2026-08-21 23:39:58'), (1005,5,105,'Branding Package','Need logo and branding material for the company.',1,10000.00,20000.00,'2026-09-20','Bengaluru','Open','2026-08-21 23:39:58');
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
INSERT INTO `review` (`review_id`,`transaction_id`,`reviewer_business_id`,`reviewed_business_id`,`rating`,`review_text`,`quality_rating`,`timeliness_rating`,`communication_rating`,`review_date`) VALUES (4001,3001,1,4,5,'Excellent website development service.',5,5,5,'2026-08-21'), (4002,3002,2,1,4,'Good marketing service and communication.',4,4,5,'2026-08-21'), (4003,3004,4,5,5,'Very reliable accounting service.',5,5,4,'2026-08-21');
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
INSERT INTO `transaction` (`transaction_id`,`request_id`,`buyer_business_id`,`seller_business_id`,`service_id`,`quantity`,`agreed_price`,`start_date`,`completion_date`,`status`,`payment_status`) VALUES (3001,1001,1,4,101,1,62000.00,'2026-08-25','2026-09-12','Completed','Paid'), (3002,1002,2,1,102,1,32000.00,'2026-08-20','2026-09-05','Active','Paid'), (3003,1003,3,1,103,1,80000.00,'2026-08-28','2026-09-25','Active','Pending'), (3004,1004,4,5,104,1,27000.00,'2026-08-25','2026-09-20','Completed','Paid');
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
