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
