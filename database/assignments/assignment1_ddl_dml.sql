USE business_service_db;

DROP TABLE IF EXISTS demo_service_vendor;

CREATE TABLE demo_service_vendor (
  vendor_id       INT          NOT NULL,
  business_id     INT          NOT NULL,
  tax_identifier  VARCHAR(20)  NOT NULL,
  years_active    INT          DEFAULT 1,
  hourly_rate     DECIMAL(10,2) NOT NULL,
  is_verified     TINYINT(1)   DEFAULT 0,
  created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_demo_vendor PRIMARY KEY (vendor_id),

  CONSTRAINT fk_demo_vendor_business FOREIGN KEY (business_id)
    REFERENCES business (business_id) ON DELETE CASCADE,

  CONSTRAINT uq_demo_vendor_tax UNIQUE (tax_identifier),

  CONSTRAINT chk_demo_vendor_years CHECK (years_active >= 0),
  CONSTRAINT chk_demo_vendor_rate  CHECK (hourly_rate > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE demo_service_vendor
  ADD COLUMN vendor_tier VARCHAR(10) DEFAULT 'Silver' CHECK (vendor_tier IN ('Silver', 'Gold', 'Platinum'));

ALTER TABLE demo_service_vendor
  MODIFY COLUMN vendor_tier VARCHAR(20) DEFAULT 'Silver';

ALTER TABLE demo_service_vendor
  DROP COLUMN vendor_tier;

INSERT INTO demo_service_vendor (vendor_id, business_id, tax_identifier, years_active, hourly_rate, is_verified)
VALUES
  (501, 1, 'GSTIN-MH-001', 5, 2500.00, 1),
  (502, 4, 'GSTIN-MH-004', 3, 1200.00, 1),
  (503, 5, 'GSTIN-KA-005', 7, 3000.00, 1);

SELECT vendor_id, business_id, tax_identifier, years_active, hourly_rate, is_verified
  FROM demo_service_vendor
 ORDER BY vendor_id;

UPDATE demo_service_vendor
   SET hourly_rate = 2750.00, years_active = 6
 WHERE vendor_id = 501;

DELETE FROM demo_service_vendor
 WHERE vendor_id = 502;

SELECT * FROM demo_service_vendor ORDER BY vendor_id;

TRUNCATE TABLE demo_service_vendor;

SELECT COUNT(*) AS row_count_after_truncate FROM demo_service_vendor;

DROP TABLE IF EXISTS demo_service_vendor;
