-- Table: review
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
