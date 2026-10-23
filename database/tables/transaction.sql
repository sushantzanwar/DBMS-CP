-- Table: transaction
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
