-- Table: request
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
