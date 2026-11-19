USE business_service_db;

DROP TABLE IF EXISTS demo_deal_audit_log;
DROP TABLE IF EXISTS demo_marketplace_deal;

CREATE TABLE demo_marketplace_deal (
    deal_id          INT PRIMARY KEY AUTO_INCREMENT,
    buyer_id         INT NOT NULL,
    seller_id        INT NOT NULL,
    agreed_price     DECIMAL(10,2) NOT NULL,
    deal_status      VARCHAR(20) NOT NULL DEFAULT 'Pending',
    payment_status   VARCHAR(20) NOT NULL DEFAULT 'Pending',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_demo_deal_buyer  FOREIGN KEY (buyer_id)  REFERENCES business(business_id) ON DELETE RESTRICT,
    CONSTRAINT fk_demo_deal_seller FOREIGN KEY (seller_id) REFERENCES business(business_id) ON DELETE RESTRICT
);

CREATE TABLE demo_deal_audit_log (
    audit_id             INT PRIMARY KEY AUTO_INCREMENT,
    deal_id              INT NOT NULL,
    old_deal_status      VARCHAR(20),
    new_deal_status      VARCHAR(20),
    old_payment_status   VARCHAR(20),
    new_payment_status   VARCHAR(20),
    change_type          VARCHAR(30) NOT NULL,
    changed_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_deal_before_insert;

DELIMITER //

CREATE TRIGGER trg_deal_before_insert
BEFORE INSERT ON demo_marketplace_deal
FOR EACH ROW
BEGIN

    IF NEW.agreed_price < 500.00 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Validation Error: Minimum transaction amount on ServicePath AI is ₹500.00';
    END IF;

    IF NEW.buyer_id = NEW.seller_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Validation Error: Buyer and Seller cannot be the same business entity';
    END IF;
END //

DELIMITER ;

DROP TRIGGER IF EXISTS trg_deal_before_update;

DELIMITER //

CREATE TRIGGER trg_deal_before_update
BEFORE UPDATE ON demo_marketplace_deal
FOR EACH ROW
BEGIN

    IF OLD.deal_status = 'Completed' AND NEW.agreed_price <> OLD.agreed_price THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Business Rule Violation: Agreed price cannot be modified on a Completed deal';
    END IF;

    IF OLD.deal_status = 'Cancelled' AND NEW.deal_status = 'Completed' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid State Transition: Cancelled deals cannot be marked Completed';
    END IF;

    SET NEW.updated_at = CURRENT_TIMESTAMP;
END //

DELIMITER ;

DROP TRIGGER IF EXISTS trg_deal_after_update;

DELIMITER //

CREATE TRIGGER trg_deal_after_update
AFTER UPDATE ON demo_marketplace_deal
FOR EACH ROW
BEGIN

    IF (OLD.deal_status <> NEW.deal_status) OR (OLD.payment_status <> NEW.payment_status) THEN
        INSERT INTO demo_deal_audit_log (
            deal_id,
            old_deal_status,
            new_deal_status,
            old_payment_status,
            new_payment_status,
            change_type
        ) VALUES (
            OLD.deal_id,
            OLD.deal_status,
            NEW.deal_status,
            OLD.payment_status,
            NEW.payment_status,
            'STATUS_CHANGE'
        );
    END IF;
END //

DELIMITER ;

DROP TRIGGER IF EXISTS trg_deal_after_delete;

DELIMITER //

CREATE TRIGGER trg_deal_after_delete
AFTER DELETE ON demo_marketplace_deal
FOR EACH ROW
BEGIN
    INSERT INTO demo_deal_audit_log (
        deal_id,
        old_deal_status,
        new_deal_status,
        old_payment_status,
        new_payment_status,
        change_type
    ) VALUES (
        OLD.deal_id,
        OLD.deal_status,
        'PURGED',
        OLD.payment_status,
        'PURGED',
        'RECORD_DELETED'
    );
END //

DELIMITER ;

INSERT INTO demo_marketplace_deal (buyer_id, seller_id, agreed_price, deal_status, payment_status)
VALUES (1, 4, 45000.00, 'Pending', 'Pending');

SELECT * FROM demo_marketplace_deal;

UPDATE demo_marketplace_deal
   SET deal_status = 'In Progress',
       payment_status = 'Escrowed'
 WHERE deal_id = 1;

SELECT * FROM demo_deal_audit_log;

UPDATE demo_marketplace_deal
   SET deal_status = 'Completed',
       payment_status = 'Released'
 WHERE deal_id = 1;

SELECT * FROM demo_deal_audit_log;

INSERT INTO demo_marketplace_deal (buyer_id, seller_id, agreed_price, deal_status, payment_status)
VALUES (2, 5, 20000.00, 'Pending', 'Pending');

DELETE FROM demo_marketplace_deal WHERE agreed_price = 20000.00;

SELECT * FROM demo_deal_audit_log WHERE change_type = 'RECORD_DELETED';
