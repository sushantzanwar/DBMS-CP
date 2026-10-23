-- Table: business
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
