// Every read-only (SELECT) query of the application.
// Each query is tagged with the DBMS concept it demonstrates. See docs/DBMS_QUERIES.md for the full write-up.
import { pool } from './db.js';
import { HttpError } from './errors.js';

// ---------- Database Health & Status ----------
// CONCEPTS: Introspection functions (DATABASE(), VERSION(), NOW()) + scalar subqueries.
export async function getHealth() {
  const [rows] = await pool.query(
    `SELECT 1 AS healthy,
            DATABASE() AS database_name,
            VERSION() AS server_version,
            NOW() AS server_time,
            (SELECT COUNT(*) FROM business) AS businesses_count,
            (SELECT COUNT(*) FROM service) AS services_count,
            (SELECT COUNT(*) FROM request) AS requests_count`
  );
  return { status: 'healthy', database: rows[0] };
}

// ---------- Dashboard ----------
// CONCEPT: SELECT + scalar subqueries + single-row functions (COALESCE, ROUND).
export async function getDashboard(businessId) {
  const [[marketplace]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM business)                                  AS businesses,
            (SELECT COUNT(*) FROM service WHERE active_status = 1)           AS services,
            (SELECT COUNT(*) FROM request WHERE status = 'Open')             AS open_requests,
            (SELECT COUNT(*) FROM \`transaction\`)                           AS transactions,
            (SELECT COALESCE(SUM(agreed_price), 0) FROM \`transaction\`
              WHERE status = 'Completed')                                    AS completed_value,
            (SELECT ROUND(AVG(rating), 2) FROM review)                       AS average_rating`
  );
  const [[mine]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM request  WHERE business_id = ? AND status = 'Open')            AS my_open_requests,
            (SELECT COUNT(*) FROM proposal p JOIN request r ON r.request_id = p.request_id
              WHERE r.business_id = ? AND p.status = 'Submitted')                                AS proposals_to_review,
            (SELECT COUNT(*) FROM proposal WHERE provider_business_id = ? AND status = 'Submitted') AS my_pending_bids,
            (SELECT COUNT(*) FROM \`transaction\`
              WHERE (buyer_business_id = ? OR seller_business_id = ?) AND status = 'Active')     AS my_active_deals`,
    [businessId, businessId, businessId, businessId, businessId]
  );
  // CONCEPT: JOIN through the view v_request_summary + DATE_FORMAT / DATEDIFF date functions.
  const [recent] = await pool.query(
    `SELECT request_id, title, buyer_name, service_name, budget_min, budget_max,
            DATE_FORMAT(created_at, '%d %b %Y') AS posted_on,
            DATEDIFF(required_by, CURDATE())    AS days_left
       FROM v_request_summary
      WHERE status = 'Open'
      ORDER BY created_at DESC, request_id DESC
      LIMIT 5`
  );
  return { marketplace, mine, recent };
}

// ---------- Businesses ----------
// CONCEPTS: view (v_business_rating), single-row functions (CONCAT_WS, UPPER, COALESCE, CONCAT),
//           nested + correlated subquery for the "top rated" filter.
export async function listBusinesses({ search, topRated }) {
  const conditions = [];
  const params = [];
  if (search) {
    // The % signs are added to the VALUE, so user text can never become SQL.
    conditions.push('(v.business_name LIKE ? OR v.industry LIKE ? OR v.city LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (topRated) {
    // Correlated: the inner query runs once per business (it uses v.business_id from the outer query).
    // Nested: the right-hand side is a separate inner query computing the average of ALL ratings.
    conditions.push(
      `(SELECT AVG(rv.rating) FROM review rv WHERE rv.reviewed_business_id = v.business_id)
         > (SELECT AVG(rating) FROM review)`
    );
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT v.business_id, v.business_name, v.industry, v.business_size,
            CONCAT_WS(', ', v.city, v.state)                       AS location,
            UPPER(v.city)                                          AS city_label,
            v.avg_rating, v.review_count,
            COALESCE(CONCAT(v.avg_rating, ' / 5'), 'Not rated yet') AS rating_label
       FROM v_business_rating v
       ${where}
      ORDER BY v.avg_rating IS NULL, v.avg_rating DESC, v.business_name`,
    params
  );
  return rows;
}

// Current authenticated business's own profile.
// CONCEPTS: LEFT JOIN with view v_business_rating + COALESCE for NULL safety.
export async function getMyProfile(businessId) {
  const [rows] = await pool.query(
    `SELECT b.business_id, b.business_name, b.industry, b.city, b.state, b.business_size,
            COALESCE(b.employees, 0)                   AS employees,
            COALESCE(b.revenue_range, 'Not disclosed') AS revenue_range,
            b.business_age,
            COALESCE(b.business_stage, 'Not specified') AS business_stage,
            COALESCE(b.description, '')                AS description,
            b.email,
            COALESCE(b.phone, '')                      AS phone,
            COALESCE(b.website, '')                    AS website,
            v.avg_rating, v.review_count
       FROM business b
       LEFT JOIN v_business_rating v ON v.business_id = b.business_id
      WHERE b.business_id = ?`,
    [businessId]
  );
  if (!rows.length) throw new HttpError(404, 'Business profile not found.');
  return rows[0];
}

// A full business profile: details, rating, services delivered, open requests and reviews received.
export async function getBusinessProfile(id) {
  const [details] = await pool.query(
    `SELECT b.business_id, b.business_name, b.industry, b.business_size,
            CONCAT_WS(', ', b.city, b.state)           AS location,
            COALESCE(b.employees, 0)                   AS employees,
            COALESCE(b.revenue_range, 'Not disclosed') AS revenue_range,
            COALESCE(b.business_stage, 'Not specified') AS business_stage,
            b.business_age,
            COALESCE(b.description, 'No description provided.') AS description,
            COALESCE(b.email, 'Not provided')          AS email,
            COALESCE(b.phone, 'Not provided')          AS phone,
            COALESCE(b.website, 'Not provided')        AS website,
            v.avg_rating, v.review_count
       FROM business b
       JOIN v_business_rating v ON v.business_id = b.business_id
      WHERE b.business_id = ?`,
    [id]
  );
  if (!details.length) throw new HttpError(404, 'Business not found.');

  // CONCEPT: JOIN + GROUP BY - which services this business has delivered as a seller.
  const [servicesDelivered] = await pool.query(
    `SELECT s.service_name, s.category, COUNT(*) AS jobs
       FROM \`transaction\` t
       JOIN service s ON s.service_id = t.service_id
      WHERE t.seller_business_id = ?
      GROUP BY s.service_id, s.service_name, s.category
      ORDER BY jobs DESC`,
    [id]
  );
  const [openRequests] = await pool.query(
    `SELECT request_id, title, service_name, budget_min, budget_max
       FROM v_request_summary WHERE buyer_id = ? AND status = 'Open' ORDER BY created_at DESC`,
    [id]
  );
  const reviews = await listReviews({ reviewedBusinessId: id });
  return { business: details[0], servicesDelivered, openRequests, reviews };
}

// ---------- Services ----------
// CONCEPTS: view (v_service_catalogue); nested subquery; correlated subquery; ROUND / COALESCE / UPPER.
// filter = 'all' | 'above-average' | 'above-category'
export async function listServices(filter) {
  let where = '';
  if (filter === 'above-average') {
    // NESTED: the inner query runs once and returns a single number (the average of all prices).
    where = `WHERE c.average_price > (SELECT AVG(average_price) FROM service WHERE active_status = 1)`;
  } else if (filter === 'above-category') {
    // CORRELATED: the inner query runs per row, using that row's category (c.category).
    where = `WHERE c.average_price > (SELECT AVG(s2.average_price) FROM service s2 WHERE s2.category = c.category)`;
  }
  const [rows] = await pool.query(
    `SELECT c.service_id, c.service_name, UPPER(c.category) AS category_label, c.category,
            c.description, c.complexity, c.remote_available, c.request_count,
            COALESCE(c.average_price, 0) AS average_price,
            (SELECT ROUND(AVG(s2.average_price), 2) FROM service s2 WHERE s2.category = c.category) AS category_average
       FROM v_service_catalogue c
       ${where}
      ORDER BY c.category, c.service_name`
  );
  return rows;
}

// Single service details with usage statistics and category benchmark.
// CONCEPTS: Correlated subquery for category benchmark + scalar subqueries for activity counts.
export async function getService(id) {
  const [rows] = await pool.query(
    `SELECT s.service_id, s.service_name, s.category, UPPER(s.category) AS category_label,
            s.description, s.average_price, s.complexity, s.remote_available, s.active_status,
            (SELECT COUNT(*) FROM request r WHERE r.service_id = s.service_id) AS total_requests,
            (SELECT COUNT(*) FROM \`transaction\` t WHERE t.service_id = s.service_id) AS total_transactions,
            (SELECT ROUND(AVG(s2.average_price), 2) FROM service s2 WHERE s2.category = s.category) AS category_average
       FROM service s
      WHERE s.service_id = ?`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, 'Service not found.');
  return rows[0];
}

// Category level overview and traded volumes.
// CONCEPTS: View consumption (v_category_summary created in Phase 2) + ORDER BY.
export async function getCategorySummary() {
  const [rows] = await pool.query('SELECT * FROM v_category_summary ORDER BY total_requests DESC, category');
  return rows;
}

// ---------- Requests ----------
// CONCEPTS: JOINs (inside the view v_request_summary joining request, business, service),
//           correlated subqueries with EXISTS and NOT EXISTS, nested subqueries, and date functions.
// scope = 'open' | 'mine' | 'all' | 'unbid' | 'my-bids' | 'above-average-budget'
export async function listRequests(businessId, scope) {
  let where = '';
  let params = [];
  if (scope === 'mine') {
    where = 'WHERE buyer_id = ?';
    params = [businessId];
  } else if (scope === 'open') {
    where = "WHERE status = 'Open' AND buyer_id <> ?"; // other businesses' open requests
    params = [businessId];
  } else if (scope === 'unbid') {
    // CORRELATED SUBQUERY with NOT EXISTS (Semi-difference / anti-semi-join):
    // Finds open requests by other businesses where the logged-in provider has NOT submitted a proposal yet.
    where = `WHERE status = 'Open' AND buyer_id <> ?
               AND NOT EXISTS (SELECT 1 FROM proposal p
                                WHERE p.request_id = v_request_summary.request_id
                                  AND p.provider_business_id = ?)`;
    params = [businessId, businessId];
  } else if (scope === 'my-bids') {
    // CORRELATED SUBQUERY with EXISTS:
    // Requests where the current business HAS submitted a proposal.
    where = `WHERE EXISTS (SELECT 1 FROM proposal p
                            WHERE p.request_id = v_request_summary.request_id
                              AND p.provider_business_id = ?)`;
    params = [businessId];
  } else if (scope === 'above-average-budget') {
    // NESTED SUBQUERY: inner query runs once returning the average maximum budget.
    where = `WHERE status = 'Open' AND budget_max > (SELECT AVG(budget_max) FROM request WHERE status = 'Open')`;
  }
  const [rows] = await pool.query(
    `SELECT request_id, title, status, buyer_id, buyer_name, buyer_city, service_id, service_name, category,
            quantity_required, budget_min, budget_max, proposal_count,
            COALESCE(location_preference, 'Anywhere')       AS location_preference,
            DATE_FORMAT(created_at, '%d %b %Y')             AS posted_on,
            DATE_FORMAT(required_by, '%d %b %Y')            AS required_by,
            DATEDIFF(required_by, CURDATE())                AS days_left
       FROM v_request_summary
       ${where}
      ORDER BY created_at DESC, request_id DESC`,
    params
  );
  return rows;
}

export async function getRequest(businessId, id) {
  const [rows] = await pool.query(
    `SELECT request_id, title, description, status, buyer_id, buyer_name, buyer_city, service_id, service_name,
            category, quantity_required, budget_min, budget_max, proposal_count,
            COALESCE(location_preference, 'Anywhere') AS location_preference,
            DATE_FORMAT(created_at, '%d %b %Y')       AS posted_on,
            DATE_FORMAT(required_by, '%d %b %Y')      AS required_by,
            DATEDIFF(required_by, CURDATE())          AS days_left
       FROM v_request_summary WHERE request_id = ?`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, 'Request not found.');
  const request = rows[0];

  // The buyer sees every proposal; a provider only sees their own.
  // CONCEPT: JOIN proposal -> business (the provider who made the offer).
  const [proposals] = await pool.query(
    `SELECT p.proposal_id, p.proposed_price, p.quantity, p.estimated_delivery_duration, p.message, p.status,
            DATE_FORMAT(p.submitted_date, '%d %b %Y') AS submitted_on,
            b.business_id AS provider_id, b.business_name AS provider_name, b.city AS provider_city
       FROM proposal p
       JOIN business b ON b.business_id = p.provider_business_id
      WHERE p.request_id = ? AND (? = ? OR p.provider_business_id = ?)
      ORDER BY p.proposed_price`,
    [id, request.buyer_id, businessId, businessId]
  );
  return { request, proposals };
}

// ---------- Proposals ----------
// CONCEPT: multi-table JOIN (proposal + request + service + business) with a per-row comparison to the budget.
// scope = 'received' (offers on my requests) | 'sent' (offers I made)
export async function listProposals(businessId, scope) {
  const received = scope === 'received';
  const [rows] = await pool.query(
    `SELECT p.proposal_id, p.request_id, r.title AS request_title, s.service_name,
            p.proposed_price, r.budget_min, r.budget_max, p.quantity, p.estimated_delivery_duration,
            p.message, p.status, DATE_FORMAT(p.submitted_date, '%d %b %Y') AS submitted_on,
            r.status AS request_status,
            provider.business_id AS provider_id, provider.business_name AS provider_name,
            buyer.business_id AS buyer_id, buyer.business_name AS buyer_name,
            CASE WHEN p.proposed_price BETWEEN r.budget_min AND r.budget_max THEN 'Within budget'
                 WHEN p.proposed_price < r.budget_min THEN 'Below budget'
                 ELSE 'Above budget' END AS budget_fit
       FROM proposal p
       JOIN request  r        ON r.request_id = p.request_id
       JOIN service  s        ON s.service_id = r.service_id
       JOIN business provider ON provider.business_id = p.provider_business_id
       JOIN business buyer    ON buyer.business_id = r.business_id
      WHERE ${received ? 'r.business_id' : 'p.provider_business_id'} = ?
      ORDER BY p.submitted_date DESC, p.proposal_id DESC`,
    [businessId]
  );
  return rows;
}

// Single proposal details.
// CONCEPTS: 4-table JOIN + CASE statement for budget fit + authorized row-level security.
export async function getProposal(businessId, proposalId) {
  const [rows] = await pool.query(
    `SELECT p.proposal_id, p.request_id, r.title AS request_title, r.status AS request_status,
            s.service_id, s.service_name, s.category,
            p.proposed_price, r.budget_min, r.budget_max, p.quantity, p.estimated_delivery_duration,
            p.message, p.status, DATE_FORMAT(p.submitted_date, '%d %b %Y') AS submitted_on,
            provider.business_id AS provider_id, provider.business_name AS provider_name,
            provider.city AS provider_city,
            buyer.business_id AS buyer_id, buyer.business_name AS buyer_name,
            CASE WHEN p.proposed_price BETWEEN r.budget_min AND r.budget_max THEN 'Within budget'
                 WHEN p.proposed_price < r.budget_min THEN 'Below budget'
                 ELSE 'Above budget' END AS budget_fit
       FROM proposal p
       JOIN request  r        ON r.request_id = p.request_id
       JOIN service  s        ON s.service_id = r.service_id
       JOIN business provider ON provider.business_id = p.provider_business_id
       JOIN business buyer    ON buyer.business_id = r.business_id
      WHERE p.proposal_id = ? AND (p.provider_business_id = ? OR r.business_id = ?)`,
    [proposalId, businessId, businessId]
  );
  if (!rows.length) throw new HttpError(404, 'Proposal not found or access denied.');
  return rows[0];
}

// ---------- Transactions ----------
// CONCEPTS: JOINs (the same business table joined twice, as buyer and as seller), LEFT JOIN, CASE.
export async function listTransactions(businessId) {
  const [rows] = await pool.query(
    `SELECT t.transaction_id, t.request_id, r.title AS request_title, s.service_name,
            buyer.business_name AS buyer_name, seller.business_name AS seller_name,
            t.quantity, t.agreed_price, t.status, t.payment_status,
            DATE_FORMAT(t.start_date, '%d %b %Y')      AS started_on,
            DATE_FORMAT(t.completion_date, '%d %b %Y') AS completed_on,
            CASE WHEN t.buyer_business_id = ? THEN 'Buying' ELSE 'Selling' END AS my_role,
            (rv.review_id IS NOT NULL) AS reviewed
       FROM \`transaction\` t
       JOIN request  r      ON r.request_id = t.request_id
       JOIN service  s      ON s.service_id = t.service_id
       JOIN business buyer  ON buyer.business_id  = t.buyer_business_id
       JOIN business seller ON seller.business_id = t.seller_business_id
       LEFT JOIN review rv  ON rv.transaction_id = t.transaction_id
      WHERE t.buyer_business_id = ? OR t.seller_business_id = ?
      ORDER BY t.transaction_id DESC`,
    [businessId, businessId, businessId]
  );
  return rows;
}

// Single transaction details with buyer, seller, and linked review.
// CONCEPTS: Double table JOIN on business (buyer & seller) + LEFT JOIN on review + access filtering.
export async function getTransaction(businessId, transactionId) {
  const [rows] = await pool.query(
    `SELECT t.transaction_id, t.request_id, r.title AS request_title,
            s.service_id, s.service_name, s.category,
            buyer.business_id AS buyer_id, buyer.business_name AS buyer_name,
            seller.business_id AS seller_id, seller.business_name AS seller_name,
            t.quantity, t.agreed_price, t.status, t.payment_status,
            DATE_FORMAT(t.start_date, '%d %b %Y')      AS started_on,
            DATE_FORMAT(t.completion_date, '%d %b %Y') AS completed_on,
            CASE WHEN t.buyer_business_id = ? THEN 'Buying' ELSE 'Selling' END AS my_role,
            rv.review_id, rv.rating, rv.review_text
       FROM \`transaction\` t
       JOIN request  r      ON r.request_id = t.request_id
       JOIN service  s      ON s.service_id = t.service_id
       JOIN business buyer  ON buyer.business_id  = t.buyer_business_id
       JOIN business seller ON seller.business_id = t.seller_business_id
       LEFT JOIN review rv  ON rv.transaction_id  = t.transaction_id
      WHERE t.transaction_id = ? AND (t.buyer_business_id = ? OR t.seller_business_id = ?)`,
    [businessId, transactionId, businessId, businessId]
  );
  if (!rows.length) throw new HttpError(404, 'Transaction not found or access denied.');
  return rows[0];
}

// ---------- Reviews ----------
// CONCEPT: JOINs (review + reviewer + reviewed business + transaction + service), DATE_FORMAT.
export async function listReviews({ reviewedBusinessId } = {}) {
  const where = reviewedBusinessId ? 'WHERE rv.reviewed_business_id = ?' : '';
  const [rows] = await pool.query(
    `SELECT rv.review_id, rv.rating, rv.quality_rating, rv.timeliness_rating, rv.communication_rating,
            COALESCE(rv.review_text, 'No written feedback.') AS review_text,
            DATE_FORMAT(rv.review_date, '%d %b %Y') AS reviewed_on,
            reviewer.business_name AS reviewer_name,
            reviewed.business_id   AS reviewed_id,
            reviewed.business_name AS reviewed_name,
            s.service_name
       FROM review rv
       JOIN business reviewer ON reviewer.business_id = rv.reviewer_business_id
       JOIN business reviewed ON reviewed.business_id = rv.reviewed_business_id
       JOIN \`transaction\` t   ON t.transaction_id = rv.transaction_id
       JOIN service s         ON s.service_id = t.service_id
       ${where}
      ORDER BY rv.review_date DESC, rv.review_id DESC`,
    reviewedBusinessId ? [reviewedBusinessId] : []
  );
  return rows;
}

// ---------- Phase 2: Advanced JOINs & Analytics Queries ----------

// CONCEPTS: 4-table multi-JOIN (business + transaction + service + review),
//           multiple aggregates (COUNT DISTINCT, SUM, AVG), GROUP BY, HAVING, and multi-column ORDER BY.
export async function getTopProviders({ limit = 10 } = {}) {
  const [rows] = await pool.query(
    `SELECT b.business_id, b.business_name, b.industry, b.city, b.state, b.business_size,
            COUNT(DISTINCT t.transaction_id)                   AS completed_deals,
            COALESCE(SUM(t.agreed_price), 0)                   AS total_revenue,
            COUNT(DISTINCT t.service_id)                       AS distinct_services_offered,
            ROUND(AVG(rv.rating), 2)                           AS avg_rating,
            COUNT(rv.review_id)                                AS total_reviews
       FROM business b
       JOIN \`transaction\` t ON t.seller_business_id = b.business_id
       JOIN service s ON s.service_id = t.service_id
       LEFT JOIN review rv ON rv.transaction_id = t.transaction_id
      WHERE t.status = 'Completed'
      GROUP BY b.business_id, b.business_name, b.industry, b.city, b.state, b.business_size
     HAVING completed_deals > 0
      ORDER BY total_revenue DESC, avg_rating DESC
      LIMIT ?`,
    [Number(limit) || 10]
  );
  return rows;
}

// CONCEPTS: Anti-Join via LEFT JOIN ... WHERE right.PK IS NULL (Relational Difference R - S).
// Finds open requests that have received zero proposals yet.
export async function getUnansweredRequests(businessId) {
  const [rows] = await pool.query(
    `SELECT r.request_id, r.title, r.description, r.status, r.budget_min, r.budget_max,
            DATE_FORMAT(r.created_at, '%d %b %Y')  AS posted_on,
            DATE_FORMAT(r.required_by, '%d %b %Y') AS required_by,
            DATEDIFF(r.required_by, CURDATE())     AS days_left,
            b.business_id AS buyer_id, b.business_name AS buyer_name, b.city AS buyer_city,
            s.service_id, s.service_name, s.category
       FROM request r
       JOIN business b ON b.business_id = r.business_id
       JOIN service s  ON s.service_id  = r.service_id
       LEFT JOIN proposal p ON p.request_id = r.request_id
      WHERE r.status = 'Open'
        AND p.proposal_id IS NULL
        AND r.business_id <> ?
      ORDER BY r.created_at DESC`,
    [businessId]
  );
  return rows;
}

// CONCEPTS: Multi-table JOIN with dynamic multi-criteria filtering and date arithmetic (DATEDIFF).
export async function searchRequests({ category, city, minBudget, maxBudget, maxDaysLeft, keyword, businessId } = {}) {
  const conditions = ["r.status = 'Open'"];
  const params = [];

  if (businessId) {
    conditions.push('r.business_id <> ?');
    params.push(businessId);
  }
  if (category) {
    conditions.push('s.category = ?');
    params.push(category);
  }
  if (city) {
    conditions.push('(b.city LIKE ? OR r.location_preference LIKE ?)');
    params.push(`%${city}%`, `%${city}%`);
  }
  if (minBudget !== undefined && minBudget !== null && minBudget !== '') {
    const num = Number(minBudget);
    if (!Number.isNaN(num)) {
      conditions.push('r.budget_max >= ?');
      params.push(num);
    }
  }
  if (maxBudget !== undefined && maxBudget !== null && maxBudget !== '') {
    const num = Number(maxBudget);
    if (!Number.isNaN(num)) {
      conditions.push('r.budget_min <= ?');
      params.push(num);
    }
  }
  if (maxDaysLeft !== undefined && maxDaysLeft !== null && maxDaysLeft !== '') {
    const num = Number(maxDaysLeft);
    if (!Number.isNaN(num)) {
      conditions.push('DATEDIFF(r.required_by, CURDATE()) <= ? AND DATEDIFF(r.required_by, CURDATE()) >= 0');
      params.push(num);
    }
  }
  if (keyword) {
    conditions.push('(r.title LIKE ? OR r.description LIKE ? OR s.service_name LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT r.request_id, r.title, r.description, r.status, r.quantity_required,
            r.budget_min, r.budget_max,
            COALESCE(r.location_preference, 'Anywhere') AS location_preference,
            DATE_FORMAT(r.created_at, '%d %b %Y')       AS posted_on,
            DATE_FORMAT(r.required_by, '%d %b %Y')      AS required_by,
            DATEDIFF(r.required_by, CURDATE())          AS days_left,
            b.business_id AS buyer_id, b.business_name AS buyer_name, b.city AS buyer_city,
            s.service_id, s.service_name, s.category,
            (SELECT COUNT(*) FROM proposal p WHERE p.request_id = r.request_id) AS proposal_count
       FROM request r
       JOIN business b ON b.business_id = r.business_id
       JOIN service s  ON s.service_id  = r.service_id
       ${whereClause}
      ORDER BY r.created_at DESC`,
    params
  );
  return rows;
}

// CONCEPTS: Foreign key navigation (request -> business -> service) with specific parent entity filtering.
export async function getServiceMatchingRequests(serviceId) {
  const [rows] = await pool.query(
    `SELECT r.request_id, r.title, r.description, r.budget_min, r.budget_max,
            r.status, DATE_FORMAT(r.created_at, '%d %b %Y') AS posted_on,
            DATE_FORMAT(r.required_by, '%d %b %Y') AS required_by,
            DATEDIFF(r.required_by, CURDATE()) AS days_left,
            b.business_id AS buyer_id, b.business_name AS buyer_name, b.city AS buyer_city,
            (SELECT COUNT(*) FROM proposal p WHERE p.request_id = r.request_id) AS proposal_count
       FROM request r
       JOIN business b ON b.business_id = r.business_id
       JOIN service s  ON s.service_id  = r.service_id
      WHERE r.service_id = ? AND r.status = 'Open'
      ORDER BY r.created_at DESC`,
    [serviceId]
  );
  return rows;
}

// CONCEPTS: Dual-role joins on business, conditional aggregation with CASE,
//           temporal grouping via DATE_FORMAT, and multi-aggregate summary.
export async function getFinancialSummary(businessId) {
  const [[totals]] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN t.seller_business_id = ? AND t.status = 'Completed' THEN t.agreed_price ELSE 0 END), 0) AS total_revenue_earned,
            COALESCE(SUM(CASE WHEN t.buyer_business_id = ?  AND t.status = 'Completed' THEN t.agreed_price ELSE 0 END), 0) AS total_amount_spent,
            COUNT(CASE WHEN t.seller_business_id = ? THEN 1 END) AS deals_as_seller,
            COUNT(CASE WHEN t.buyer_business_id = ?  THEN 1 END) AS deals_as_buyer,
            COUNT(CASE WHEN t.status = 'Active'    THEN 1 END)   AS active_deals_count,
            COUNT(CASE WHEN t.status = 'Completed' THEN 1 END)   AS completed_deals_count,
            ROUND(AVG(CASE WHEN t.status = 'Completed' THEN t.agreed_price END), 2) AS avg_completed_deal_value
       FROM \`transaction\` t
      WHERE t.buyer_business_id = ? OR t.seller_business_id = ?`,
    [businessId, businessId, businessId, businessId, businessId, businessId, businessId, businessId]
  );

  const [monthlyTrend] = await pool.query(
    `SELECT DATE_FORMAT(t.completion_date, '%Y-%m') AS \`month\`,
            COUNT(*)                                AS completed_count,
            COALESCE(SUM(CASE WHEN t.seller_business_id = ? THEN t.agreed_price ELSE 0 END), 0) AS revenue_earned,
            COALESCE(SUM(CASE WHEN t.buyer_business_id = ?  THEN t.agreed_price ELSE 0 END), 0) AS amount_spent,
            COALESCE(SUM(t.agreed_price), 0)        AS total_volume
       FROM \`transaction\` t
      WHERE (t.buyer_business_id = ? OR t.seller_business_id = ?)
        AND t.status = 'Completed'
        AND t.completion_date IS NOT NULL
      GROUP BY DATE_FORMAT(t.completion_date, '%Y-%m')
      ORDER BY \`month\` DESC`,
    [businessId, businessId, businessId, businessId]
  );

  return { totals, monthlyTrend };
}
