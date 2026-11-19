SET SERVEROUTPUT ON SIZE 1000000;

CREATE OR REPLACE PROCEDURE sp_get_request_summary (
    p_request_id       IN  NUMBER,
    p_title            OUT VARCHAR2,
    p_buyer_name       OUT VARCHAR2,
    p_status           OUT VARCHAR2,
    p_proposal_count   OUT NUMBER,
    p_lowest_bid       OUT NUMBER,
    p_highest_bid      OUT NUMBER
)
IS
BEGIN

    SELECT r.title, b.business_name, r.status
      INTO p_title, p_buyer_name, p_status
      FROM request r
      JOIN business b ON b.business_id = r.business_id
     WHERE r.request_id = p_request_id;

    SELECT COUNT(*),
           NVL(MIN(proposed_price), 0),
           NVL(MAX(proposed_price), 0)
      INTO p_proposal_count, p_lowest_bid, p_highest_bid
      FROM proposal
     WHERE request_id = p_request_id;

    IF p_proposal_count = 0 THEN
        p_lowest_bid  := 0;
        p_highest_bid := 0;
    END IF;

EXCEPTION
    WHEN NO_DATA_FOUND THEN
        p_title          := 'NOT FOUND';
        p_buyer_name     := 'N/A';
        p_status         := 'UNKNOWN';
        p_proposal_count := 0;
        p_lowest_bid     := 0;
        p_highest_bid    := 0;
        DBMS_OUTPUT.PUT_LINE('Warning: Request ID ' || p_request_id || ' does not exist.');
END sp_get_request_summary;
/

CREATE OR REPLACE PROCEDURE sp_calculate_provider_tier (
    p_provider_id       IN  NUMBER,
    p_provider_name     OUT VARCHAR2,
    p_completed_deals   OUT NUMBER,
    p_total_revenue     OUT NUMBER,
    p_avg_rating        OUT NUMBER,
    p_tier_status       OUT VARCHAR2
)
IS
BEGIN
    p_completed_deals := 0;
    p_total_revenue   := 0;
    p_avg_rating      := 0;
    p_tier_status     := 'Standard Provider';

    SELECT business_name
      INTO p_provider_name
      FROM business
     WHERE business_id = p_provider_id;

    SELECT COUNT(*),
           NVL(SUM(agreed_price), 0)
      INTO p_completed_deals, p_total_revenue
      FROM "TRANSACTION"
     WHERE seller_business_id = p_provider_id
       AND status = 'Completed';

    SELECT NVL(ROUND(AVG(rating), 2), 0)
      INTO p_avg_rating
      FROM review
     WHERE reviewed_business_id = p_provider_id;

    IF p_completed_deals >= 2 AND p_total_revenue >= 50000 AND p_avg_rating >= 4.50 THEN
        p_tier_status := 'Platinum Partner';
    ELSIF p_completed_deals >= 1 AND p_total_revenue >= 20000 AND p_avg_rating >= 4.00 THEN
        p_tier_status := 'Gold Partner';
    ELSIF p_completed_deals >= 1 THEN
        p_tier_status := 'Silver Partner';
    ELSE
        p_tier_status := 'Standard Provider';
    END IF;

EXCEPTION
    WHEN NO_DATA_FOUND THEN
        p_provider_name := 'UNKNOWN PROVIDER';
        p_tier_status   := 'N/A';
END sp_calculate_provider_tier;
/

CREATE OR REPLACE PROCEDURE sp_batch_commission_cursor (
    p_processed_count  OUT NUMBER,
    p_total_commission OUT NUMBER
)
IS

    CURSOR cur_completed_tx IS
        SELECT transaction_id, seller_business_id, agreed_price
          FROM "TRANSACTION"
         WHERE status = 'Completed';

    v_tx_rec cur_completed_tx%ROWTYPE;

    v_rate      NUMBER(4,2);
    v_comm_amt  NUMBER(10,2);
BEGIN
    p_processed_count  := 0;
    p_total_commission := 0;

    OPEN cur_completed_tx;

    LOOP
        FETCH cur_completed_tx INTO v_tx_rec;
        EXIT WHEN cur_completed_tx%NOTFOUND;

        IF v_tx_rec.agreed_price < 30000 THEN
            v_rate := 10.00;
        ELSIF v_tx_rec.agreed_price <= 60000 THEN
            v_rate := 8.00;
        ELSE
            v_rate := 5.00;
        END IF;

        v_comm_amt := ROUND(v_tx_rec.agreed_price * (v_rate / 100), 2);

        p_processed_count  := p_processed_count + 1;
        p_total_commission := p_total_commission + v_comm_amt;

        DBMS_OUTPUT.PUT_LINE('Processed TX #' || v_tx_rec.transaction_id ||
                             ' | Price: ' || v_tx_rec.agreed_price ||
                             ' | Rate: ' || v_rate || '%' ||
                             ' | Comm: ' || v_comm_amt);
    END LOOP;

    CLOSE cur_completed_tx;
END sp_batch_commission_cursor;
/

DECLARE
    v_title        VARCHAR2(150);
    v_buyer        VARCHAR2(100);
    v_status       VARCHAR2(20);
    v_proposals    NUMBER;
    v_min_bid      NUMBER;
    v_max_bid      NUMBER;

    v_pname        VARCHAR2(100);
    v_deals        NUMBER;
    v_rev          NUMBER;
    v_rate         NUMBER;
    v_tier         VARCHAR2(30);

    v_count        NUMBER;
    v_tot_comm     NUMBER;
BEGIN
    DBMS_OUTPUT.PUT_LINE('=== TESTING ORACLE PL/SQL PROCEDURES ===');

    sp_get_request_summary(1001, v_title, v_buyer, v_status, v_proposals, v_min_bid, v_max_bid);
    DBMS_OUTPUT.PUT_LINE('Request 1001: ' || v_title || ' | Buyer: ' || v_buyer || ' | Bids: ' || v_proposals);

    sp_calculate_provider_tier(4, v_pname, v_deals, v_rev, v_rate, v_tier);
    DBMS_OUTPUT.PUT_LINE('Provider 4: ' || v_pname || ' | Revenue: ' || v_rev || ' | Tier: ' || v_tier);

    sp_batch_commission_cursor(v_count, v_tot_comm);
    DBMS_OUTPUT.PUT_LINE('Total Commission Processed: ' || v_tot_comm || ' across ' || v_count || ' transactions.');
END;
/
