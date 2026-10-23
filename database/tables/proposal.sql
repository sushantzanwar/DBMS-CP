-- Table: proposal
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
