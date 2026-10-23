-- Table: service
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
