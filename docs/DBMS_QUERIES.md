# ServicePath AI - DBMS concepts and queries

Database: Dolt (MySQL 8 compatible). All SQL lives in `backend/src/queries.js` (SELECT), `backend/src/actions.js`
(INSERT/UPDATE) and `database/phase2.sql` (the new table and views). Expected outputs below were produced from the
original data (5 businesses, 5 services, 5 requests, 4 proposals, 4 transactions, 3 reviews).

## Schema additions (the only change to the database)

| Object | Why |
|---|---|
| table `account` (account_id PK, business_id UNIQUE FK, password_hash) | The original schema stores no credentials. Login uses `business.email` + this hash. |
| view `v_request_summary` | request JOIN business JOIN service, plus the proposal count |
| view `v_service_catalogue` | active services plus how often each was requested |
| view `v_business_rating` | each business with its average rating and review count |

Not touched: `business_view`, `large_businesses`, `pune_businesses`. They exist but are placeholder stubs
(`SELECT 1 AS business_id, 1 AS business_name ...`), so they were not reused.

---

## A. SELECT queries
Used everywhere. Simplest example: the dashboard totals (Dashboard page, `getDashboard`).

```sql
SELECT (SELECT COUNT(*) FROM business) AS businesses,
       (SELECT COUNT(*) FROM service WHERE active_status = 1) AS services,
       (SELECT COUNT(*) FROM request WHERE status = 'Open') AS open_requests,
       (SELECT COALESCE(SUM(agreed_price), 0) FROM `transaction` WHERE status = 'Completed') AS completed_value,
       (SELECT ROUND(AVG(rating), 2) FROM review) AS average_rating
```
1. Purpose: the headline numbers on the dashboard.
2. Tables: business, service, request, transaction, review.
3. Concept: SELECT with aggregate functions (COUNT, SUM, AVG) in scalar subqueries.
4. Why: each number comes from a different table, so one subquery per number is the simplest form.
5. Expected output: businesses 5, services 5, open_requests 4, completed_value 89000, average_rating 4.67.

## B. JOINs

**B1. Request summary (view)** - Requests page, Dashboard.
```sql
CREATE VIEW v_request_summary AS
SELECT r.request_id, r.title, r.status, ..., b.business_name AS buyer_name, s.service_name, s.category,
       (SELECT COUNT(*) FROM proposal p WHERE p.request_id = r.request_id) AS proposal_count
  FROM request r
  JOIN business b ON b.business_id = r.business_id
  JOIN service  s ON s.service_id  = r.service_id;
```
1. Purpose: show a request with who posted it and which service it is for.
2. Tables: request, business, service (+ proposal in the subquery).
3. Concept: INNER JOIN on foreign keys (request.business_id and request.service_id).
4. Why: a request only stores ids; names live in other tables, so a JOIN is required.
5. Expected: 5 rows, e.g. `1001 | TechNova Solutions | Web Development | 1 proposal`.

**B2. Proposals with request, service, provider and buyer** - Proposals page (`listProposals`).
4 JOINs: proposal -> request -> service, and business twice (the provider through `proposal.provider_business_id`,
the buyer through `request.business_id`). A `CASE WHEN p.proposed_price BETWEEN r.budget_min AND r.budget_max`
labels each offer "Within budget / Below budget / Above budget". Expected for the seed data: all four proposals
(65000, 35000, 85000, 28000) fall inside their request budgets, so each reads "Within budget".

**B3. Transactions: the same table joined twice** - Transactions page (`listTransactions`).
```sql
JOIN business buyer  ON buyer.business_id  = t.buyer_business_id
JOIN business seller ON seller.business_id = t.seller_business_id
LEFT JOIN review rv  ON rv.transaction_id  = t.transaction_id
```
Why: a transaction has TWO foreign keys to `business`, so we join it twice with different aliases.
The LEFT JOIN keeps deals that have no review yet (`rv.review_id IS NULL`).

**B4. Reviews** - Reviews page and business profile: review JOIN business (reviewer) JOIN business (reviewed)
JOIN transaction JOIN service - 5 tables, to show "who reviewed whom, for which service".

**B5. Login** - `auth.js`: `account a JOIN business b ON b.business_id = a.business_id WHERE LOWER(b.email) = ?`.

## C. Views
`v_request_summary` (above), `v_service_catalogue`, `v_business_rating`:
```sql
CREATE VIEW v_business_rating AS
SELECT b.business_id, b.business_name, ..., ROUND(AVG(rv.rating), 2) AS avg_rating, COUNT(rv.review_id) AS review_count
  FROM business b LEFT JOIN review rv ON rv.reviewed_business_id = b.business_id
 GROUP BY b.business_id, b.business_name, ...;
```
1. Purpose: save a join/aggregate once and reuse it (Businesses page, profile, filters).
2. Tables: business, review. 3. Concept: view = a stored SELECT (stores no data of its own), GROUP BY, LEFT JOIN.
4. Why: LEFT JOIN so businesses with no reviews still appear (avg_rating NULL, review_count 0).
5. Expected: TechNova 4.00 (1 review), GreenLeaf NULL, BrightBuild NULL, EduSpark 5.00, FinEdge 5.00.

## D. Nested (non-correlated) subquery
`GET /api/services?filter=above-average` (the service list endpoint; the Services page was removed from the UI, the request form still uses it).
```sql
SELECT ... FROM v_service_catalogue c
 WHERE c.average_price > (SELECT AVG(average_price) FROM service WHERE active_status = 1)
```
1. Purpose: find services more expensive than the typical service. 2. Tables: service (via the view).
3. Concept: nested subquery - the inner query runs ONCE and returns one number (41000).
4. Why: the comparison value does not depend on the outer row. 5. Expected: Web Development (60000), Data Analytics (75000).

Also: `(SELECT AVG(rating) FROM review)` inside the top-rated filter (F below).

## E. Correlated subquery
`GET /api/services?filter=above-category` (same endpoint; the Services page was removed from the UI).
```sql
SELECT ... FROM v_service_catalogue c
 WHERE c.average_price > (SELECT AVG(s2.average_price) FROM service s2 WHERE s2.category = c.category)
```
1. Purpose: services priced above the average of THEIR OWN category.
2. Tables: service. 3. Concept: correlated subquery - the inner query uses `c.category` from the outer row, so it runs once per row.
4. Why: "average" differs per category (IT 67500, Finance 25000 ...), so it cannot be computed once.
5. Expected: only Data Analytics (75000 > IT average 67500).

Businesses page, filter "Rated above average" (nested + correlated together):
```sql
WHERE (SELECT AVG(rv.rating) FROM review rv WHERE rv.reviewed_business_id = v.business_id)
        > (SELECT AVG(rating) FROM review)
```
Expected: EduSpark Academy and FinEdge Consulting (both 5.0 vs overall 4.67).

The service cards also show the category average using a correlated scalar subquery in the SELECT list.

## F. Single-row functions (verified on Dolt)
| Function | Where | Example |
|---|---|---|
| `UPPER()` | Services (category pill) | `UPPER(category)` -> `IT`, `MARKETING` |
| `CONCAT_WS()` | Businesses | `CONCAT_WS(', ', city, state)` -> `Pune, Maharashtra` |
| `CONCAT()` + `COALESCE()` | Businesses | `COALESCE(CONCAT(avg_rating, ' / 5'), 'Not rated yet')` |
| `COALESCE()` (NULL handling) | Profile, requests, id generation | `COALESCE(website, 'Not provided')` |
| `ROUND()` | views, dashboard | `ROUND(AVG(rating), 2)` |
| `DATE_FORMAT()` | Requests, reviews | `DATE_FORMAT(created_at, '%d %b %Y')` -> `21 Aug 2026` |
| `DATEDIFF()`, `CURDATE()` | Requests, dashboard | days left until `required_by` (negative = overdue) |
| `LOWER()` | Login | case-insensitive email match |

## G. Transaction handling (ACID)
`setProposalStatus(... 'Accepted')` in `actions.js` runs four statements in ONE database transaction
(`BEGIN ... COMMIT`, `ROLLBACK` on any error): accept the proposal, reject competing proposals, set the request to
"In Progress", insert the deal into `transaction`. All succeed or none do. `SELECT ... FOR UPDATE` locks the rows being read.
The `transaction` table here is a RECORD of a deal. No payment is processed anywhere in the application.

## H. Generating ids
No table uses AUTO_INCREMENT, so `nextId()` computes `COALESCE((SELECT MAX(id) FROM table FOR UPDATE), 0) + 1`
inside the same transaction as the INSERT. The MAX sits in a scalar subquery because Dolt returns no row for a bare
`MAX()` on an empty table (found while testing registration on the empty `account` table).

## Constraints that protect the data (existing, enforced by the database)
`CHECK (budget_max >= budget_min)`, `CHECK (rating BETWEEN 1 AND 5)`, `CHECK (buyer <> seller)`,
`UNIQUE (request_id, provider_business_id)` (one proposal per business per request), `UNIQUE (transaction_id)` on review
(one review per deal), `UNIQUE` email/phone/website on business, and all foreign keys.

---

## I. Phase 2 Features & Advanced DBMS Concepts

### 1. View: `v_category_summary`
Aggregates category demand and financials across `service`, `request`, and `transaction` using independent subquery joins to prevent Cartesian product fan-out.
```sql
CREATE VIEW v_category_summary AS
SELECT cat.category,
       COALESCE(svc.total_services, 0)          AS total_services,
       COALESCE(req.total_requests, 0)          AS total_requests,
       COALESCE(tx.completed_transactions, 0)   AS completed_transactions,
       COALESCE(svc.avg_catalog_price, 0)       AS avg_catalog_price,
       COALESCE(tx.total_traded_volume, 0)      AS total_traded_volume
  FROM (
    SELECT DISTINCT category FROM service
  ) cat
  LEFT JOIN (
    SELECT category,
           COUNT(*)                     AS total_services,
           ROUND(AVG(average_price), 2) AS avg_catalog_price
      FROM service
     WHERE active_status = 1
     GROUP BY category
  ) svc ON svc.category = cat.category
  LEFT JOIN (
    SELECT s.category,
           COUNT(r.request_id) AS total_requests
      FROM service s
      JOIN request r ON r.service_id = s.service_id
     GROUP BY s.category
  ) req ON req.category = cat.category
  LEFT JOIN (
    SELECT s.category,
           COUNT(t.transaction_id)          AS completed_transactions,
           COALESCE(SUM(t.agreed_price), 0) AS total_traded_volume
      FROM service s
      JOIN `transaction` t ON t.service_id = s.service_id
     WHERE t.status = 'Completed'
     GROUP BY s.category
  ) tx ON tx.category = cat.category;
```

### 2. Multi-Table JOIN with GROUP BY & HAVING
`GET /api/analytics/top-providers`: Ranks service providers across 4 tables with `HAVING` filtering aggregated groups.
```sql
SELECT b.business_id, b.business_name, b.industry, b.city,
       COUNT(DISTINCT t.transaction_id) AS completed_deals,
       COALESCE(SUM(t.agreed_price), 0) AS total_revenue,
       COUNT(DISTINCT t.service_id)     AS distinct_services_offered,
       ROUND(AVG(rv.rating), 2)         AS avg_rating
  FROM business b
  JOIN `transaction` t ON t.seller_business_id = b.business_id
  JOIN service s ON s.service_id = t.service_id
  LEFT JOIN review rv ON rv.transaction_id = t.transaction_id
 WHERE t.status = 'Completed'
 GROUP BY b.business_id, b.business_name, b.industry, b.city
HAVING completed_deals > 0
 ORDER BY total_revenue DESC, avg_rating DESC;
```

### 3. Anti-Join (`LEFT JOIN ... WHERE right.PK IS NULL`)
`GET /api/requests/unanswered`: Finds open requests with zero proposals using relational difference ($R - S$).
```sql
SELECT r.request_id, r.title, b.business_name AS buyer_name, s.service_name
  FROM request r
  JOIN business b ON b.business_id = r.business_id
  JOIN service s  ON s.service_id  = r.service_id
  LEFT JOIN proposal p ON p.request_id = r.request_id
 WHERE r.status = 'Open' AND p.proposal_id IS NULL;
```

### 4. Correlated Subqueries with `EXISTS` and `NOT EXISTS`
`GET /api/requests?scope=unbid` and `GET /api/requests?scope=my-bids`:
```sql
-- Unbid requests (NOT EXISTS)
WHERE status = 'Open' AND buyer_id <> ?
  AND NOT EXISTS (SELECT 1 FROM proposal p WHERE p.request_id = v.request_id AND p.provider_business_id = ?)

-- Requests with bids (EXISTS)
WHERE EXISTS (SELECT 1 FROM proposal p WHERE p.request_id = v.request_id AND p.provider_business_id = ?)
```

### 5. Conditional Aggregation with `CASE`
`GET /api/analytics/financial-summary`:
```sql
SELECT COALESCE(SUM(CASE WHEN t.seller_business_id = ? AND t.status = 'Completed' THEN t.agreed_price ELSE 0 END), 0) AS total_revenue_earned,
       COALESCE(SUM(CASE WHEN t.buyer_business_id = ?  AND t.status = 'Completed' THEN t.agreed_price ELSE 0 END), 0) AS total_amount_spent,
       COUNT(CASE WHEN t.status = 'Active' THEN 1 END) AS active_deals
  FROM `transaction` t
 WHERE t.buyer_business_id = ? OR t.seller_business_id = ?;
```

---

## J. Complete Viva Examination Cheat Sheet

| Concept | Demonstrated Where | Why Used & How to Answer in Viva |
|---|---|---|
| **Multi-Table INNER JOIN** | `v_request_summary`, `listProposals`, `searchRequests` | Requests and proposals only store foreign keys (`business_id`, `service_id`). Joining replaces IDs with human-readable business names and service categories. |
| **LEFT OUTER JOIN** | `v_business_rating`, `v_category_summary`, `listTransactions` | Preserves rows from the left table even when there are no matching rows on the right. Businesses with 0 reviews still appear with `avg_rating = NULL` and `review_count = 0`. |
| **Anti-Join (`LEFT JOIN ... WHERE right.PK IS NULL`)** | `getUnansweredRequests` | Computes the relational difference ($R - S$) to find open requests that have received 0 proposals. Safer and faster than `NOT IN` because it avoids `NULL` evaluation issues. |
| **Role-Based Self-Join** | `listTransactions`, `getTransaction` | `transaction` has two foreign keys pointing to `business` (`buyer_business_id` and `seller_business_id`). The query joins the `business` table twice with separate aliases (`buyer` and `seller`). |
| **Correlated Subquery (`EXISTS` / `NOT EXISTS`)** | `listRequests('unbid')`, `listRequests('my-bids')` | References the outer row's `request_id` and short-circuits as soon as a matching proposal is found, allowing providers to filter requests they haven't yet bid on. |
| **Nested Non-Correlated Subquery** | `listServices('above-average')`, `listRequests('above-average-budget')` | The inner query runs once independently (e.g. `(SELECT AVG(average_price) FROM service)`), returning a single benchmark value that filters the outer query. |
| **Aggregate Functions & `COUNT(DISTINCT)`** | `v_category_summary`, `getTopProviders` | `COUNT(DISTINCT t.transaction_id)` prevents overcounting when multiple attributes are aggregated across categories or providers. |
| **`GROUP BY` with `HAVING`** | `getTopProviders` | `WHERE` filters rows before grouping; `HAVING` filters grouped rows after aggregation (`HAVING completed_deals > 0`). |
| **Cartesian Product Prevention** | `v_category_summary` | When a table has two independent 1-to-many relationships (`service` $\rightarrow$ `request` and `service` $\rightarrow$ `transaction`), joining them in one `FROM` clause causes an $M \times N$ fan-out. Pre-aggregating in derived tables before joining prevents duplicate sums. |
| **Single-Row Functions** | Throughout queries | String manipulation (`UPPER`, `LOWER`, `CONCAT_WS`), NULL safety (`COALESCE`), math (`ROUND`), and date calculations (`CURDATE`, `DATE_FORMAT`, `DATEDIFF`). |
| **`CASE` Expressions** | `listProposals`, `getFinancialSummary` | Dynamic categorization (`Within budget` vs `Above budget`) and conditional aggregation (pivot calculations of revenue vs expenses in a single query). |
| **ACID Transactions & Row Locking** | `setProposalStatus('Accepted')` | Executes 4 statements inside `BEGIN ... COMMIT` (`SELECT ... FOR UPDATE`): accept offer, reject competing bids, update request to In Progress, and insert transaction record. Guarantees atomicity. |

---

## K. Phase A Assignment Scripts & MySQL Workbench Execution Guide

All Phase A SQL scripts are located in `database/assignments/`. They are structured to execute sequentially in **MySQL Workbench** against `business_service_db`, with automated test verification in `backend/test_phase_a.js`.

### How to Run in MySQL Workbench
1. Launch **MySQL Workbench**.
2. Connect to the ServicePath database instance:
   - **Hostname**: `127.0.0.1`
   - **Port**: `3307` (Dolt local server) or `3306` (standard MySQL 8)
   - **Username**: `root`
   - **Password**: *(leave blank or supply your root password)*
   - **Default Schema**: `business_service_db`
3. Click `File` -> `Open SQL Script...` (Ctrl+O) and select one of the assignment scripts:
   - `database/assignments/assignment1_ddl_dml.sql`
   - `database/assignments/assignment3_views.sql`
   - `database/assignments/assignment4_joins.sql`
   - `database/assignments/assignment5_advanced_select.sql`
4. Execute individual statements or batches using `Execute (all or selection)` (`Ctrl + Shift + Enter`).
5. Observe the **Result Grid** and **Action Output** pane for execution confirmation and row counts.

---

### Detailed Assignment Breakdown

#### 1. Assignment 1: DDL, DML & Integrity Constraints (`assignment1_ddl_dml.sql`)
- **Key Concepts**:
  - `CREATE TABLE`: Declares Primary Key (`vendor_id`), Foreign Key with referential integrity (`business_id REFERENCES business(business_id) ON DELETE CASCADE`), `UNIQUE` constraint on contact email, `CHECK` constraints (e.g. `rating BETWEEN 0.00 AND 5.00`, `sla_percentage >= 0.00`), `NOT NULL`, and `DEFAULT`.
  - `ALTER TABLE`: Demonstrates schema evolution (`ADD COLUMN escalation_contact`, `MODIFY COLUMN notes`, `DROP COLUMN notes`).
  - `DML Operations`: `INSERT` valid records, testing deliberate violation of `CHECK` and `FK` constraints, `UPDATE` with `WHERE`, `DELETE`, and `TRUNCATE TABLE` (resets table state while preserving DDL definition).
  - Clean Teardown: `DROP TABLE IF EXISTS demo_service_vendor` ensures zero database pollution.
- **Viva Defense Tip**: Explain the difference between `DELETE` (DML, row-by-row, triggers fire, can be rolled back in transaction) and `TRUNCATE` (DDL, deallocates data pages, faster, resets auto-increment, cannot fire row-level triggers).

#### 2. Assignment 3: Database Views & Updatable Views (`assignment3_views.sql`)
- **Key Concepts**:
  - **Multi-Table View**: `v_request_summary` joins `request`, `business`, and `service`, abstracting complex normalization away from application consumers.
  - **Cartesian-Safe Complex View**: `v_category_summary` calculates marketplace catalog metrics without $M \times N$ fan-out by joining derived pre-aggregated subqueries.
  - **Updatable View with `WITH CHECK OPTION`**: `v_active_service_catalog` demonstrates an updatable single-table projection. The `WITH CHECK OPTION` enforces that any `INSERT` or `UPDATE` through the view must satisfy `WHERE active_status = 1`.
- **Engine Portability Note**: Standard MySQL 8 in MySQL Workbench permits DML through `v_active_service_catalog`. Dolt accepts the view definition but disallows view updates with `table doesn't support UPDATE`.

#### 3. Assignment 4: Comprehensive JOINs (`assignment4_joins.sql`)
- **Key Concepts**:
  - **Equi-Join**: Joins `request`, `business`, and `service` on matching equality keys (`r.business_id = b.business_id`).
  - **Non-Equi Join with `BETWEEN`**: Joins `proposal` to `request` where `p.proposed_price BETWEEN r.budget_min AND r.budget_max`.
  - **Non-Equi Self-Join (`>`)**: Identifies catalog price disparities between services in the same category without duplicating comparisons (`s1.average_price > s2.average_price`).
  - **Role-Based Self-Join**: Joins the `business` relation twice to `transaction` (`buyer` and `seller`), modeling dual roles in the B2B marketplace.
  - **Natural Join & Common-Column Trap**: Demonstrates `NATURAL JOIN` using projected relations `(SELECT request_id, title, service_id FROM request) r NATURAL JOIN (SELECT service_id, service_name, category FROM service) s`. Explains why `request NATURAL JOIN service` returns 0 rows due to both tables having a non-matching `description` column.
  - **Outer Joins & Anti-Join**: `LEFT JOIN` (preserving unreviewed businesses), `RIGHT JOIN` (preserving unrequested services), Anti-Join (`LEFT JOIN ... WHERE right.PK IS NULL` for unanswered requests), and Full Outer Join emulation via `UNION`.

#### 4. Assignment 5: Advanced SELECT, Operators & Subqueries (`assignment5_advanced_select.sql`)
- **Key Concepts**:
  - **Relational & Logical Filtering**: `AND`, `OR`, `NOT`, range checks (`BETWEEN`), list membership (`IN`, `NOT IN`), and NULL-safety (`IS NOT NULL`).
  - **Pattern Matching (`LIKE`)**: Multi-character wildcard `%` (`'%Tech%'`) and single-character wildcard `_` (`'987650001_'`).
  - **Aggregation with `GROUP BY` and `HAVING`**: Groups completed deals by seller and filters aggregated groups using `HAVING total_deals >= 1`.
  - **Set Operators**: `UNION` (combines result sets and eliminates duplicates), `UNION ALL` (preserves duplicates), `INTERSECT` (returns businesses acting as both buyers and sellers), and `EXCEPT` (returns buyer-only businesses). Tested natively on Dolt/MySQL 8.0.31.
  - **Single-Row Functions**: String (`UPPER`, `CONCAT_WS`), Math (`ROUND`), Date (`CURDATE`, `DATEDIFF`), and NULL handling (`COALESCE`).
  - **Subqueries**: Independent nested subqueries (`average_price > (SELECT AVG(average_price)...)`) vs. Correlated subqueries using `EXISTS` and `NOT EXISTS` evaluated per candidate row.

---

## L. Phase B: Stored Procedures & Triggers (Assignments 6 & 7)

### 1. Script Organization & Dialects
All Phase B scripts are located in `database/assignments/`:
- `database/assignments/assignment6_stored_procedures_mysql.sql`: MySQL Workbench / Dolt executable.
- `database/assignments/assignment6_stored_procedures_oracle.sql`: Oracle PL/SQL reference implementation.
- `database/assignments/assignment7_triggers_mysql.sql`: MySQL Workbench / Dolt executable.
- `database/assignments/assignment7_triggers_oracle.sql`: Oracle PL/SQL reference implementation.

All automated assertions are executed against the live engine in `backend/test_phase_b.js`.

---

### 2. Assignment 6: Stored Procedures, Parameters, Control Structures & Cursors

#### A. Procedure 1: `sp_get_request_summary` (IN and OUT Parameters)
- **Business Goal**: Aggregates proposal statistics (total proposals, min bid, max bid) and buyer details for any given service request ID.
- **Key Concepts**:
  - `IN p_request_id INT`
  - Multiple `OUT` parameters: `p_title`, `p_buyer_name`, `p_status`, `p_proposal_count`, `p_lowest_bid`, `p_highest_bid`.
  - Conditional fallback: if `p_proposal_count = 0`, sets `lowest_bid` and `highest_bid` to `0.00`.
- **Workbench Execution**:
  ```sql
  CALL sp_get_request_summary(1001, @title, @buyer, @status, @bids, @min_bid, @max_bid);
  SELECT @title AS title, @buyer AS buyer, @bids AS bids, @min_bid AS min_bid, @max_bid AS max_bid;
  ```

#### B. Procedure 2: `sp_calculate_provider_tier` (Control Structures: `IF ... ELSEIF ... ELSE`)
- **Business Goal**: Dynamically calculates provider performance across transactions and reviews, assigning an automated partner tier:
  - `Platinum Partner`: $\ge 2$ completed deals, $\ge ₹50,000$ revenue, and $\ge 4.5$ average rating.
  - `Gold Partner`: $\ge 1$ completed deal, $\ge ₹20,000$ revenue, and $\ge 4.0$ average rating.
  - `Silver Partner`: $\ge 1$ completed deal.
  - `Standard Provider`: New providers or zero completed deals.
- **Workbench Execution**:
  ```sql
  CALL sp_calculate_provider_tier(4, @pname, @deals, @rev, @rating, @tier);
  SELECT @pname AS provider, @deals AS deals, @rev AS revenue, @rating AS rating, @tier AS assigned_tier;
  ```

#### C. Procedure 3: `sp_batch_calculate_commission_cursor` (Cursor, Loop & Handlers)
- **Business Goal**: Iterates row-by-row through all completed transactions using an explicit SQL cursor, calculates tiered platform commission (10%, 8%, or 5%), and stores calculated payouts into an isolated staging table (`demo_commission_payout`).
- **Key Concepts**:
  - `DECLARE cur CURSOR FOR SELECT ...`
  - `DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;`
  - Loop construct: `calc_loop: LOOP ... FETCH ... IF v_done THEN LEAVE calc_loop; END IF; ... END LOOP;`
  - Cursor lifecycle: `OPEN tx_cursor;` $\rightarrow$ `FETCH` $\rightarrow$ `CLOSE tx_cursor;`.
- **Workbench Execution**:
  ```sql
  CALL sp_batch_calculate_commission_cursor(@count, @total_comm);
  SELECT @count AS deals_processed, @total_comm AS platform_commission;
  SELECT * FROM demo_commission_payout;
  ```

---

### 3. Assignment 7: Triggers (Validation & Audit Logging)

Triggers run on isolated demonstration tables (`demo_marketplace_deal` and `demo_deal_audit_log`), guaranteeing that core application tables are never corrupted or blocked.

#### A. Trigger 1: `trg_deal_before_insert` (`BEFORE INSERT`)
- **Business Rules Enforced**:
  1. **Minimum Deal Value**: Enforces that `NEW.agreed_price >= 500.00`.
  2. **Anti-Self-Dealing**: Prevents `NEW.buyer_id = NEW.seller_id`.
- **Exception Mechanism**: `SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '...';`

#### B. Trigger 2: `trg_deal_before_update` (`BEFORE UPDATE`)
- **Business Rules Enforced**:
  1. **Price Immutability**: If `OLD.deal_status = 'Completed'`, attempts to alter `agreed_price` are blocked via `SIGNAL SQLSTATE '45000'`.
  2. **Illegal State Transitions**: Blocks transitioning a `'Cancelled'` deal to `'Completed'`.
  3. **Audit Timestamp**: Auto-updates `NEW.updated_at = CURRENT_TIMESTAMP;`.

#### C. Trigger 3: `trg_deal_after_update` (`AFTER UPDATE`)
- **Business Goal**: Automatically logs state transitions and escrow payment updates into `demo_deal_audit_log` with `old_deal_status`, `new_deal_status`, `old_payment_status`, and `new_payment_status`.

#### D. Trigger 4: `trg_deal_after_delete` (`AFTER DELETE`)
- **Business Goal**: Emits an immutable tombstone record in `demo_deal_audit_log` whenever a deal record is purged.

---

### 4. MySQL Workbench vs. Oracle PL/SQL Comparison Cheat Sheet

| Aspect | MySQL Workbench / Dolt (MySQL 8) | Oracle PL/SQL (11g/12c/19c) |
|---|---|---|
| **Delimiter** | `DELIMITER // ... DELIMITER ;` required in scripts | Uses `/` on a newline to execute PL/SQL blocks |
| **Creation DDL** | `DROP PROCEDURE IF EXISTS name; CREATE PROCEDURE ...` | `CREATE OR REPLACE PROCEDURE name ...` |
| **Variable Binding** | Explicit types: `VARCHAR(100)`, `DECIMAL(10,2)` | Strongly anchored types: `request.title%TYPE`, `cur%ROWTYPE` |
| **Exception Handling** | `SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '...'` | `RAISE_APPLICATION_ERROR(-20001, '...')` |
| **Cursor End Handler** | `DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;` | `EXIT WHEN cur%NOTFOUND;` |
| **Console Output** | `SELECT @var;` or result grids in Workbench | `DBMS_OUTPUT.PUT_LINE('...')` via SQL*Plus / SQL Developer |
| **Trigger Execution Timing** | `BEFORE INSERT`, `BEFORE UPDATE`, `AFTER UPDATE`, `AFTER DELETE` | Can combine: `BEFORE INSERT OR UPDATE FOR EACH ROW` |
| **Column Pseudo-Records** | `NEW.column_name`, `OLD.column_name` | `:NEW.column_name`, `:OLD.column_name` (colon prefix required) |

---

## M. Phase C: ER Modeling & Distributed Databases (Assignments 2 & 8)

### 1. Assignment 2: Entity-Relationship (ER) Diagram & Normalization
- **Primary Document**: `database/assignments/assignment2_er_diagram.md`
- **Scope**:
  - Models all 7 core tables (`business`, `service`, `account`, `request`, `proposal`, `transaction`, `review`).
  - Strict classification of entities (Strong, Weak/Subordinate, Associative) and attributes (Atomic, Primary/Unique Keys, Derived, Multi-valued).
  - Cardinality map: `business` to `account` (1:1), `business` to `request` (1:N), `request` to `proposal` (1:N with unique constraint), `transaction` to `review` (1:1), and role-based self-joins for buyer/seller.
  - Normalization proofs for 1NF, 2NF, 3NF, and BCNF based on mathematical functional dependencies ($X \rightarrow Y$ where $X$ is a superkey).
- **Workbench Generation**:
  - `Database` $\rightarrow$ `Reverse Engineer...` $\rightarrow$ select `business_service_db` $\rightarrow$ generate visual canvas (`.mwb`) $\rightarrow$ `File` $\rightarrow$ `Export as PNG...`.

### 2. Assignment 8: Distributed Database Architecture & Scalability
- **Primary Document**: `database/assignments/assignment8_distributed_databases.md`
- **Scope**:
  - Architectures: Shared-Memory vs. Shared-Disk vs. Shared-Nothing.
  - Fragmentation: Horizontal (sharding by city/region), Vertical (separating sensitive credentials/financials), and Hybrid. Formal correctness rules: Completeness, Reconstruction, Disjointness.
  - Replication: Synchronous vs. Asynchronous; Quorum consensus ($R + W > N$).
  - Distributed Transactions & Two-Phase Commit (2PC): Prepare phase, Commit/Abort phase, the coordinator crash blocking dilemma, CAP/PACELC theorems.
  - Case Study: Partitioning ServicePath AI across Indian geographic zones (West Shard: Mumbai/Pune; South Shard: Bengaluru) and 2PC cross-region deal execution.
  - **Academic Clarification on Dolt**:
    - Dolt is **NOT** a distributed database. It is a single-node relational database that implements Git-like version control semantics using Prolly Trees and decentralized asynchronous pull/push replication (similar to Git and DoltHub). It does not use Paxos, Raft, or 2PC for live distributed transactions.
