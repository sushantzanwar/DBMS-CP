import { pool } from './db.js';
import { HttpError, optionalText, requireInt } from './errors.js';

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

export async function listBusinesses({ search, topRated }) {
  const conditions = [];
  const params = [];
  if (search) {

    conditions.push('(v.business_name LIKE ? OR v.industry LIKE ? OR v.city LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (topRated) {

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

export async function listServices(filter) {
  let where = '';
  if (filter === 'above-average') {

    where = `WHERE c.average_price > (SELECT AVG(average_price) FROM service WHERE active_status = 1)`;
  } else if (filter === 'above-category') {

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

export async function getCategorySummary() {
  const [rows] = await pool.query('SELECT * FROM v_category_summary ORDER BY total_requests DESC, category');
  return rows;
}

export async function listRequests(businessId, scope) {
  let where = '';
  let params = [];
  if (scope === 'mine') {
    where = 'WHERE buyer_id = ?';
    params = [businessId];
  } else if (scope === 'open') {
    where = "WHERE status = 'Open' AND buyer_id <> ?";
    params = [businessId];
  } else if (scope === 'unbid') {

    where = `WHERE status = 'Open' AND buyer_id <> ?
               AND NOT EXISTS (SELECT 1 FROM proposal p
                                WHERE p.request_id = v_request_summary.request_id
                                  AND p.provider_business_id = ?)`;
    params = [businessId, businessId];
  } else if (scope === 'my-bids') {

    where = `WHERE EXISTS (SELECT 1 FROM proposal p
                            WHERE p.request_id = v_request_summary.request_id
                              AND p.provider_business_id = ?)`;
    params = [businessId];
  } else if (scope === 'above-average-budget') {

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

async function queryRankedProviders(requestId, { excludeIds = [], limit = 5 } = {}) {
  const hasExclusions = Array.isArray(excludeIds) && excludeIds.length > 0;
  const exclusionPlaceholders = hasExclusions ? excludeIds.map(() => '?').join(', ') : '';
  const exclusionClause = hasExclusions
    ? `AND b.business_id NOT IN (${exclusionPlaceholders})`
    : '';

  const sql = `
    SELECT
      b.business_id,
      b.business_name,
      b.industry,
      b.city,
      b.state,
      b.business_size,
      vbr.avg_rating,
      vbr.review_count,
      (CASE
        WHEN EXISTS (
          SELECT 1 FROM \`transaction\` t
          WHERE t.seller_business_id = b.business_id
            AND t.service_id = req.service_id
            AND t.status = 'Completed'
        ) THEN 40
        WHEN EXISTS (
          SELECT 1 FROM proposal p
          JOIN request r_hist ON r_hist.request_id = p.request_id
          WHERE p.provider_business_id = b.business_id
            AND r_hist.service_id = req.service_id
        ) THEN 30
        WHEN b.industry = svc.category OR b.industry LIKE CONCAT('%', svc.category, '%') THEN 20
        ELSE 10
      END) AS capability_score,
      (CASE
        WHEN req.location_preference IS NULL OR req.location_preference = '' OR req.location_preference = 'Anywhere' OR req.location_preference = 'Remote' THEN 25
        WHEN LOWER(b.city) = LOWER(req.location_preference) THEN 25
        WHEN LOWER(b.state) = (SELECT LOWER(state) FROM business WHERE business_id = req.business_id) THEN 15
        ELSE 5
      END) AS location_score,
      (CASE
        WHEN vbr.avg_rating IS NOT NULL THEN ROUND((vbr.avg_rating / 5.0) * 20, 1)
        ELSE 10.0
      END) AS reputation_score,
      (CASE
        WHEN (SELECT COUNT(*) FROM \`transaction\` t WHERE t.seller_business_id = b.business_id AND t.status = 'Completed') >= 2 THEN 15
        WHEN (SELECT COUNT(*) FROM \`transaction\` t WHERE t.seller_business_id = b.business_id AND t.status = 'Completed') = 1 THEN 10
        WHEN b.business_size = 'Large' THEN 8
        WHEN b.business_size = 'Medium' THEN 6
        ELSE 4
      END) AS track_record_score,
      ROUND(
        (CASE
          WHEN EXISTS (
            SELECT 1 FROM \`transaction\` t
            WHERE t.seller_business_id = b.business_id
              AND t.service_id = req.service_id
              AND t.status = 'Completed'
          ) THEN 40
          WHEN EXISTS (
            SELECT 1 FROM proposal p
            JOIN request r_hist ON r_hist.request_id = p.request_id
            WHERE p.provider_business_id = b.business_id
              AND r_hist.service_id = req.service_id
          ) THEN 30
          WHEN b.industry = svc.category OR b.industry LIKE CONCAT('%', svc.category, '%') THEN 20
          ELSE 10
        END)
        +
        (CASE
          WHEN req.location_preference IS NULL OR req.location_preference = '' OR req.location_preference = 'Anywhere' OR req.location_preference = 'Remote' THEN 25
          WHEN LOWER(b.city) = LOWER(req.location_preference) THEN 25
          WHEN LOWER(b.state) = (SELECT LOWER(state) FROM business WHERE business_id = req.business_id) THEN 15
          ELSE 5
        END)
        +
        (CASE
          WHEN vbr.avg_rating IS NOT NULL THEN (vbr.avg_rating / 5.0) * 20
          ELSE 10.0
        END)
        +
        (CASE
          WHEN (SELECT COUNT(*) FROM \`transaction\` t WHERE t.seller_business_id = b.business_id AND t.status = 'Completed') >= 2 THEN 15
          WHEN (SELECT COUNT(*) FROM \`transaction\` t WHERE t.seller_business_id = b.business_id AND t.status = 'Completed') = 1 THEN 10
          WHEN b.business_size = 'Large' THEN 8
          WHEN b.business_size = 'Medium' THEN 6
          ELSE 4
        END)
      ) AS match_score,
      (EXISTS (
        SELECT 1 FROM proposal p
        WHERE p.request_id = req.request_id AND p.provider_business_id = b.business_id
      )) AS has_already_bid
    FROM request req
    JOIN service svc ON svc.service_id = req.service_id
    CROSS JOIN business b
    LEFT JOIN v_business_rating vbr ON vbr.business_id = b.business_id
    WHERE req.request_id = ?
      AND b.business_id <> req.business_id
      ${exclusionClause}
    ORDER BY match_score DESC, vbr.avg_rating DESC, b.business_name ASC
    LIMIT ?
  `;

  const params = hasExclusions
    ? [requestId, ...excludeIds, Number(limit) || 5]
    : [requestId, Number(limit) || 5];
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function getRecommendedProvidersForRequest(requestId) {
  const validId = requireInt(requestId, 'Request id');
  const [reqRows] = await pool.query(
    'SELECT request_id, business_id, service_id, location_preference FROM request WHERE request_id = ?',
    [validId]
  );
  if (!reqRows.length) throw new HttpError(404, 'Request not found.');

  return queryRankedProviders(validId, { excludeIds: [], limit: 5 });
}

export async function simulateProviderUnavailability({ requestId, unavailableProviderIds, reason } = {}) {
  const validRequestId = requireInt(requestId, 'Request id');

  const [reqRows] = await pool.query(
    `SELECT r.request_id, r.title, r.status, r.business_id AS buyer_id, b.business_name AS buyer_name,
            b.city AS buyer_city, b.state AS buyer_state,
            s.service_id, s.service_name, s.category,
            COALESCE(r.location_preference, 'Anywhere') AS location_preference,
            r.budget_min, r.budget_max
       FROM request r
       JOIN business b ON b.business_id = r.business_id
       JOIN service s  ON s.service_id  = r.service_id
      WHERE r.request_id = ?`,
    [validRequestId]
  );
  if (!reqRows.length) throw new HttpError(404, 'Request not found.');
  const request = reqRows[0];

  let rawIds = unavailableProviderIds;
  if (typeof rawIds === 'string') {
    rawIds = rawIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (typeof rawIds === 'number') {
    rawIds = [rawIds];
  }

  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    throw new HttpError(400, 'At least one unavailable provider id must be provided for simulation.');
  }
  if (rawIds.length > 20) {
    throw new HttpError(400, 'Too many provider ids specified.');
  }

  const parsedIds = rawIds.map((id) => requireInt(id, 'Unavailable provider id'));
  const uniqueIds = [...new Set(parsedIds)];

  if (uniqueIds.includes(Number(request.buyer_id))) {
    throw new HttpError(400, 'The buyer business cannot be selected as an unavailable service provider.');
  }

  const placeholders = uniqueIds.map(() => '?').join(', ');
  const [unavailableBizRows] = await pool.query(
    `SELECT business_id, business_name, industry, city, state, business_size
       FROM business
      WHERE business_id IN (${placeholders})
      ORDER BY business_id ASC`,
    uniqueIds
  );
  if (unavailableBizRows.length !== uniqueIds.length) {
    throw new HttpError(404, 'One or more specified providers were not found.');
  }

  const eventReason =
    optionalText(reason, 200) || 'Provider capacity overload / temporary market unavailability';

  const fullBaseline = await queryRankedProviders(validRequestId, { excludeIds: [], limit: 50 });
  const baselineTop5 = fullBaseline.slice(0, 5);
  const simulatedTop5 = await queryRankedProviders(validRequestId, { excludeIds: uniqueIds, limit: 5 });

  const baselineRankById = new Map();
  fullBaseline.forEach((row, idx) => {
    baselineRankById.set(Number(row.business_id), idx + 1);
  });

  const baselineTopScore = baselineTop5.length ? Number(baselineTop5[0].match_score) : 0;

  const annotatedBaseline = baselineTop5.map((row, idx) => {
    const isUnavailable = uniqueIds.includes(Number(row.business_id));
    return {
      ...row,
      baseline_rank: idx + 1,
      is_unavailable: isUnavailable,
      availability_status: isUnavailable ? 'Simulated Unavailable' : 'Available',
    };
  });

  const annotatedAlternatives = simulatedTop5.map((row, idx) => {
    const simulatedRank = idx + 1;
    const originalRank = baselineRankById.get(Number(row.business_id)) || null;
    const rankShift = originalRank !== null ? originalRank - simulatedRank : 0;
    const scoreDeltaVsBaselineTop = Number((Number(row.match_score) - baselineTopScore).toFixed(1));

    let statusChange = 'Retained Rank';
    if (originalRank !== null && originalRank > 5) {
      statusChange = 'Newly Promoted into Top 5';
    } else if (rankShift > 0) {
      statusChange = 'Moved Up in Top 5';
    }

    const breakdownText = `Capability ${row.capability_score}/40, Location ${row.location_score}/25, Reputation ${row.reputation_score}/20, Track Record ${row.track_record_score}/15`;
    let explanation;
    if (originalRank !== null && originalRank > 5) {
      explanation = `Entered Top 5 at #${simulatedRank} from standby rank #${originalRank} (${row.match_score}/100: ${breakdownText}).`;
    } else if (rankShift > 0) {
      explanation = `Promoted from #${originalRank} to #${simulatedRank} (+${rankShift} ${rankShift === 1 ? 'spot' : 'spots'}) with ${row.match_score}/100 (${breakdownText}).`;
    } else {
      explanation = `Retained rank #${simulatedRank} with ${row.match_score}/100 (${breakdownText}).`;
    }

    return {
      ...row,
      simulated_rank: simulatedRank,
      baseline_rank: originalRank,
      rank_shift: rankShift,
      status_change: statusChange,
      score_delta_vs_baseline_top: scoreDeltaVsBaselineTop,
      explanation,
    };
  });

  const unavailableDetails = unavailableBizRows.map((b) => ({
    ...b,
    baseline_rank: baselineRankById.get(Number(b.business_id)) || null,
    was_in_baseline_top5: (baselineRankById.get(Number(b.business_id)) || 999) <= 5,
  }));

  const disruptedTop5Count = unavailableDetails.filter((u) => u.was_in_baseline_top5).length;
  const newlyPromoted = annotatedAlternatives.filter((a) => a.baseline_rank > 5);
  const topLeaderChanged =
    baselineTop5[0]?.business_id !== annotatedAlternatives[0]?.business_id;

  let narrative;
  if (annotatedAlternatives.length === 0) {
    narrative = `All ${fullBaseline.length} eligible providers were marked unavailable. No alternative providers remain in the candidate pool.`;
  } else if (disruptedTop5Count === 0) {
    narrative = `Simulated unavailability of ${unavailableDetails.map((u) => u.business_name).join(', ')} (ranked outside the baseline Top 5). The Top 5 recommended providers remain unchanged, led by ${annotatedAlternatives[0].business_name} (${annotatedAlternatives[0].match_score}/100).`;
  } else {
    const promotedNames = newlyPromoted.length
      ? ` Standby ${newlyPromoted.length === 1 ? 'provider' : 'providers'} ${newlyPromoted.map((p) => `${p.business_name} (was #${p.baseline_rank} → now #${p.simulated_rank})`).join(', ')} entered the Top 5 via pre-LIMIT SQL exclusion.`
      : '';
    const leaderText = topLeaderChanged
      ? `Primary recommendation shifted from ${baselineTop5[0].business_name} (${baselineTop5[0].match_score}/100) to ${annotatedAlternatives[0].business_name} (${annotatedAlternatives[0].match_score}/100, delta ${annotatedAlternatives[0].score_delta_vs_baseline_top} pts).`
      : `Primary recommendation ${annotatedAlternatives[0].business_name} (${annotatedAlternatives[0].match_score}/100) remained available at #1.`;
    narrative = `Simulated unavailability of ${disruptedTop5Count} baseline Top-5 ${disruptedTop5Count === 1 ? 'provider' : 'providers'} (${unavailableDetails.filter((u) => u.was_in_baseline_top5).map((u) => `${u.business_name} [#${u.baseline_rank}]`).join(', ')}) due to "${eventReason}". ${leaderText}${promotedNames}`;
  }

  return {
    isEphemeralSimulation: true,
    persistedToDatabase: false,
    request,
    simulationEvent: {
      reason: eventReason,
      unavailableProviderIds: uniqueIds,
      unavailableProviders: unavailableDetails,
      disruptedTop5Count,
      topRecommendationChanged: Boolean(topLeaderChanged),
      totalEligiblePoolSize: fullBaseline.length,
      remainingAvailablePoolSize: Math.max(0, fullBaseline.length - uniqueIds.length),
      narrative,
    },
    baselineTop5: annotatedBaseline,
    simulatedAlternatives: annotatedAlternatives,
  };
}

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

export async function getDemandForecast() {

  const [realMonthly] = await pool.query(
    `SELECT s.category,
            DATE_FORMAT(r.created_at, '%Y-%m') AS \`month\`,
            COUNT(*) AS request_count
       FROM request r
       JOIN service s ON s.service_id = r.service_id
      GROUP BY s.category, DATE_FORMAT(r.created_at, '%Y-%m')
      ORDER BY s.category ASC, \`month\` ASC`
  );

  const totalRealRequests = realMonthly.reduce((sum, r) => sum + Number(r.request_count), 0);
  const distinctRealMonths = new Set(realMonthly.map((r) => r.month)).size;

  const [syntheticMonthly] = await pool.query(
    `SELECT s.category,
            DATE_FORMAT(h.request_date, '%Y-%m') AS \`month\`,
            COUNT(*) AS request_count,
            ROUND(AVG(h.estimated_budget), 2) AS avg_budget
       FROM synthetic_request_history h
       JOIN service s ON s.service_id = h.service_id
      WHERE h.is_synthetic = 1
      GROUP BY s.category, DATE_FORMAT(h.request_date, '%Y-%m')
      ORDER BY s.category ASC, \`month\` ASC`
  );

  const byCategory = {};
  for (const row of syntheticMonthly) {
    if (!byCategory[row.category]) byCategory[row.category] = [];
    byCategory[row.category].push({
      month: row.month,
      requestCount: Number(row.request_count),
      avgBudget: Number(row.avg_budget),
    });
  }

  const categories = Object.keys(byCategory).sort();
  const categoryForecasts = [];

  let allRegAbsErrors = [];
  let allRegSqErrors = [];
  let allNaiveAbsErrors = [];
  let allNaiveSqErrors = [];

  for (let idx = 0; idx < categories.length; idx++) {
    const category = categories[idx];
    const series = byCategory[category];
    const nTotal = series.length;
    const nTrain = Math.floor(nTotal * 0.75);
    const nTest = nTotal - nTrain;

    const trainSet = series.slice(0, nTrain);

    let sumT = 0;
    let sumY = 0;
    for (let i = 0; i < nTrain; i++) {
      const t = i + 1;
      sumT += t;
      sumY += trainSet[i].requestCount;
    }
    const meanT = sumT / nTrain;
    const meanY = sumY / nTrain;

    let num = 0;
    let den = 0;
    for (let i = 0; i < nTrain; i++) {
      const t = i + 1;
      const y = trainSet[i].requestCount;
      num += (t - meanT) * (y - meanY);
      den += (t - meanT) * (t - meanT);
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = meanY - slope * meanT;

    const holdoutComparisons = [];
    let regAbsSum = 0;
    let regSqSum = 0;
    let naiveAbsSum = 0;
    let naiveSqSum = 0;

    for (let i = nTrain; i < nTotal; i++) {
      const t = i + 1;
      const actual = series[i].requestCount;
      const regPred = intercept + slope * t;
      const naivePred = series[i - 1].requestCount;

      const regAbsErr = Math.abs(actual - regPred);
      const regSqErr = (actual - regPred) ** 2;
      const naiveAbsErr = Math.abs(actual - naivePred);
      const naiveSqErr = (actual - naivePred) ** 2;

      regAbsSum += regAbsErr;
      regSqSum += regSqErr;
      naiveAbsSum += naiveAbsErr;
      naiveSqSum += naiveSqErr;

      allRegAbsErrors.push(regAbsErr);
      allRegSqErrors.push(regSqErr);
      allNaiveAbsErrors.push(naiveAbsErr);
      allNaiveSqErrors.push(naiveSqErr);

      holdoutComparisons.push({
        month: series[i].month,
        t,
        actual,
        regressionPredicted: Number(regPred.toFixed(2)),
        naivePredicted: naivePred,
      });
    }

    const regressionMae = Number((regAbsSum / nTest).toFixed(4));
    const regressionRmse = Number(Math.sqrt(regSqSum / nTest).toFixed(4));
    const naiveMae = Number((naiveAbsSum / nTest).toFixed(4));
    const naiveRmse = Number(Math.sqrt(naiveSqSum / nTest).toFixed(4));

    const nextT = nTotal + 1;
    const nextMonthLabel = '2026-11';
    const predictedNextMonth = Number(Math.max(0, intercept + slope * nextT).toFixed(2));
    const lastMonthActual = series[nTotal - 1].requestCount;
    const trendDirection =
      slope > 0.15 ? 'Upward' : slope < -0.15 ? 'Downward' : 'Stable';

    await pool.query(
      `INSERT INTO service_demand_forecast
        (forecast_id, category, forecast_month, predicted_requests, naive_baseline_requests,
         regression_slope, regression_intercept, train_months, test_months,
         regression_mae, regression_rmse, naive_mae, naive_rmse, is_synthetic, evaluated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE
         forecast_month = VALUES(forecast_month),
         predicted_requests = VALUES(predicted_requests),
         naive_baseline_requests = VALUES(naive_baseline_requests),
         regression_slope = VALUES(regression_slope),
         regression_intercept = VALUES(regression_intercept),
         train_months = VALUES(train_months),
         test_months = VALUES(test_months),
         regression_mae = VALUES(regression_mae),
         regression_rmse = VALUES(regression_rmse),
         naive_mae = VALUES(naive_mae),
         naive_rmse = VALUES(naive_rmse),
         evaluated_at = NOW()`,
      [
        idx + 1,
        category,
        nextMonthLabel,
        predictedNextMonth,
        lastMonthActual,
        Number(slope.toFixed(4)),
        Number(intercept.toFixed(4)),
        nTrain,
        nTest,
        regressionMae,
        regressionRmse,
        naiveMae,
        naiveRmse,
      ]
    );

    categoryForecasts.push({
      category,
      forecastMonth: nextMonthLabel,
      lastMonthActual,
      predictedNextMonth,
      predictedNextMonthRounded: Math.round(predictedNextMonth),
      naiveBaselineNextMonth: lastMonthActual,
      trendDirection,
      modelParameters: {
        slope: Number(slope.toFixed(4)),
        intercept: Number(intercept.toFixed(4)),
        trainMonths: nTrain,
        testMonths: nTest,
        trainPeriod: `${series[0].month} to ${series[nTrain - 1].month}`,
        testPeriod: `${series[nTrain].month} to ${series[nTotal - 1].month}`,
      },
      metrics: {
        regressionMae,
        regressionRmse,
        naiveMae,
        naiveRmse,
      },
      history: series,
      holdoutComparisons,
    });
  }

  const totalTestPoints = allRegAbsErrors.length || 1;
  const overallMetrics = {
    totalTestObservations: allRegAbsErrors.length,
    regressionMae: Number(
      (allRegAbsErrors.reduce((a, b) => a + b, 0) / totalTestPoints).toFixed(4)
    ),
    regressionRmse: Number(
      Math.sqrt(allRegSqErrors.reduce((a, b) => a + b, 0) / totalTestPoints).toFixed(4)
    ),
    naiveMae: Number(
      (allNaiveAbsErrors.reduce((a, b) => a + b, 0) / totalTestPoints).toFixed(4)
    ),
    naiveRmse: Number(
      Math.sqrt(allNaiveSqErrors.reduce((a, b) => a + b, 0) / totalTestPoints).toFixed(4)
    ),
  };

  return {
    isSynthetic: true,
    datasetLabel: 'SYNTHETIC_24M_BENCHMARK',
    disclaimer:
      'Experimental Forecast: Trained and evaluated on an isolated 24-month synthetic historical dataset (Nov 2024 – Oct 2026, 993 synthetic requests). Production request records (8 rows) were not modified or mixed.',
    realDataAssessment: {
      supportsForecasting: false,
      totalRealRequests,
      distinctMonths: distinctRealMonths,
      reason:
        'Production request table contains only 8 records across 2 non-contiguous months (2026-08 and 2026-10), which is insufficient for chronological train/test splitting or regression.',
      realBreakdown: realMonthly,
    },
    methodology: {
      aggregationSql: "GROUP BY s.category, DATE_FORMAT(h.request_date, '%Y-%m')",
      totalSyntheticRequests: syntheticMonthly.reduce((acc, r) => acc + Number(r.request_count), 0),
      totalMonths: 24,
      trainMonths: 18,
      testMonths: 6,
      splitStrategy: 'Chronological holdout (Months 1–18 Train: 2024-11 to 2026-04 | Months 19–24 Test: 2026-05 to 2026-10)',
      primaryModel: 'Ordinary Least Squares (OLS) Linear Trend Regression (y = b0 + b1 * t)',
      baselineModel: 'Last-Value Naive Persistence (y_hat_t = y_{t-1})',
    },
    overallMetrics,
    categories: categoryForecasts,
  };
}
