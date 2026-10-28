// Everything that changes data (INSERT / UPDATE). Each action checks WHO is asking (businessId comes from the
// login token, never from the request body) and checks the business rules before touching the database.
// A "transaction" here is only a database RECORD of a deal. No money moves anywhere in this application.
import { withTransaction, nextId } from './db.js';
import { HttpError, requireText, optionalText, requireInt, requireMoney } from './errors.js';
import { normalizePhone, WEBSITE_PATTERN } from './auth.js';

function validDate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, 'Enter a valid date.');
  }
  return value;
}

// ---------- Business Profile ----------
// CONCEPTS: UPDATE with WHERE business_id = ? + uniqueness verification against other rows.
export async function updateProfile(businessId, body) {
  const name = requireText(body.businessName, 'Business name', 100);
  const industry = requireText(body.industry, 'Industry', 50);
  const city = requireText(body.city, 'City', 50);
  const state = requireText(body.state, 'State', 50);
  const size = optionalText(body.businessSize, 30);
  const employees = body.employees !== undefined && body.employees !== null && body.employees !== ''
    ? requireInt(body.employees, 'Employees', { min: 0 })
    : null;
  const revenueRange = optionalText(body.revenueRange, 50);
  const businessAge = body.businessAge !== undefined && body.businessAge !== null && body.businessAge !== ''
    ? requireInt(body.businessAge, 'Business age', { min: 0 })
    : null;
  const businessStage = optionalText(body.businessStage, 30);
  const description = optionalText(body.description, 2000);
  const phone = body.phone ? normalizePhone(body.phone) : null;
  const website = optionalText(body.website, 150);
  if (website && !WEBSITE_PATTERN.test(website)) {
    throw new HttpError(400, 'Enter a valid website address.');
  }

  return withTransaction(async (connection) => {
    if (phone || website) {
      const [taken] = await connection.query(
        `SELECT (? IS NOT NULL AND phone = ?)   AS phone_taken,
                (? IS NOT NULL AND website = ?) AS website_taken
           FROM business
          WHERE business_id <> ? AND ((? IS NOT NULL AND phone = ?) OR (? IS NOT NULL AND website = ?))`,
        [phone, phone, website, website, businessId, phone, phone, website, website]
      );
      if (taken.some((r) => r.phone_taken)) {
        throw new HttpError(409, 'This phone number is already registered to another business.');
      }
      if (taken.some((r) => r.website_taken)) {
        throw new HttpError(409, 'This website is already registered to another business.');
      }
    }

    await connection.query(
      `UPDATE business
          SET business_name = ?, industry = ?, city = ?, state = ?, business_size = ?,
              employees = ?, revenue_range = ?, business_age = ?, business_stage = ?,
              description = ?, phone = ?, website = ?
        WHERE business_id = ?`,
      [name, industry, city, state, size, employees, revenueRange, businessAge, businessStage, description, phone, website, businessId]
    );

    return { businessId, message: 'Profile updated successfully.' };
  });
}

// ---------- Requests ----------
export async function createRequest(businessId, body) {
  const serviceId = requireInt(body.serviceId, 'Service');
  const title = requireText(body.title, 'Title', 150);
  const description = requireText(body.description, 'Description', 2000);
  const quantity = requireInt(body.quantityRequired ?? 1, 'Quantity');
  const budgetMin = requireMoney(body.budgetMin, 'Minimum budget');
  const budgetMax = requireMoney(body.budgetMax, 'Maximum budget');
  if (budgetMax < budgetMin) throw new HttpError(400, 'Maximum budget cannot be lower than the minimum budget.');
  const requiredBy = validDate(body.requiredBy);
  if (requiredBy && requiredBy < new Date().toISOString().slice(0, 10)) {
    throw new HttpError(400, 'The required-by date cannot be in the past.');
  }
  const location = optionalText(body.locationPreference, 100);

  return withTransaction(async (connection) => {
    const [services] = await connection.query('SELECT service_id FROM service WHERE service_id = ? AND active_status = 1', [serviceId]);
    if (!services.length) throw new HttpError(400, 'Please choose an available service.');
    const requestId = await nextId(connection, 'request', 'request_id');
    await connection.query(
      `INSERT INTO request (request_id, business_id, service_id, title, description, quantity_required,
                            budget_min, budget_max, required_by, location_preference, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open')`,
      [requestId, businessId, serviceId, title, description, quantity, budgetMin, budgetMax, requiredBy, location]
    );
    return { requestId };
  });
}

// Owner can cancel an open request or re-open a cancelled one.
export async function setRequestStatus(businessId, requestId, status) {
  if (!['Open', 'Cancelled'].includes(status)) throw new HttpError(400, 'Status must be Open or Cancelled.');
  return withTransaction(async (connection) => {
    const [rows] = await connection.query('SELECT business_id, status FROM request WHERE request_id = ? FOR UPDATE', [requestId]);
    if (!rows.length) throw new HttpError(404, 'Request not found.');
    if (rows[0].business_id !== businessId) throw new HttpError(403, 'Only the business that posted this request can change it.');
    if (!['Open', 'Cancelled'].includes(rows[0].status)) {
      throw new HttpError(409, `A request that is ${rows[0].status} can no longer be changed.`);
    }
    await connection.query('UPDATE request SET status = ? WHERE request_id = ?', [status, requestId]);
    return { requestId, status };
  });
}

// ---------- Proposals ----------
export async function createProposal(businessId, body) {
  const requestId = requireInt(body.requestId, 'Request');
  const price = requireMoney(body.proposedPrice, 'Proposed price');
  const quantity = requireInt(body.quantity ?? 1, 'Quantity');
  const days = requireInt(body.estimatedDeliveryDuration, 'Delivery time (days)', { max: 3650 });
  const message = optionalText(body.message, 2000);

  return withTransaction(async (connection) => {
    const [rows] = await connection.query('SELECT business_id, status FROM request WHERE request_id = ?', [requestId]);
    if (!rows.length) throw new HttpError(404, 'Request not found.');
    if (rows[0].business_id === businessId) throw new HttpError(400, 'You cannot send a proposal for your own request.');
    if (rows[0].status !== 'Open') throw new HttpError(409, 'This request is no longer open for proposals.');
    const proposalId = await nextId(connection, 'proposal', 'proposal_id');
    // The database also enforces one proposal per business per request (UNIQUE key) -> a duplicate gives a 409.
    await connection.query(
      `INSERT INTO proposal (proposal_id, request_id, provider_business_id, proposed_price, quantity,
                             estimated_delivery_duration, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Submitted')`,
      [proposalId, requestId, businessId, price, quantity, days, message]
    );
    return { proposalId };
  });
}

// status = 'Accepted' | 'Rejected' (by the request owner) or 'Withdrawn' (by the provider).
// Accepting is the interesting case: four changes happen in ONE database transaction.
export async function setProposalStatus(businessId, proposalId, status) {
  if (!['Accepted', 'Rejected', 'Withdrawn'].includes(status)) throw new HttpError(400, 'Invalid status.');
  return withTransaction(async (connection) => {
    const [rows] = await connection.query(
      `SELECT p.proposal_id, p.request_id, p.provider_business_id, p.proposed_price, p.quantity, p.status,
              r.business_id AS buyer_id, r.service_id, r.quantity_required, r.status AS request_status
         FROM proposal p JOIN request r ON r.request_id = p.request_id
        WHERE p.proposal_id = ? FOR UPDATE`,
      [proposalId]
    );
    if (!rows.length) throw new HttpError(404, 'Proposal not found.');
    const p = rows[0];
    if (p.status !== 'Submitted') throw new HttpError(409, `This proposal is already ${p.status}.`);

    if (status === 'Withdrawn') {
      if (p.provider_business_id !== businessId) throw new HttpError(403, 'Only the provider can withdraw a proposal.');
      await connection.query("UPDATE proposal SET status = 'Withdrawn' WHERE proposal_id = ?", [proposalId]);
      return { proposalId, status };
    }

    if (p.buyer_id !== businessId) throw new HttpError(403, 'Only the business that posted the request can respond to proposals.');
    if (p.request_status !== 'Open') throw new HttpError(409, 'This request is no longer open.');

    if (status === 'Rejected') {
      await connection.query("UPDATE proposal SET status = 'Rejected' WHERE proposal_id = ?", [proposalId]);
      return { proposalId, status };
    }

    // Accepted: (1) accept this proposal, (2) reject the other offers, (3) mark the request In Progress,
    // (4) record the deal in the transaction table. If any step fails, ROLLBACK undoes all of them.
    await connection.query("UPDATE proposal SET status = 'Accepted' WHERE proposal_id = ?", [proposalId]);
    await connection.query(
      "UPDATE proposal SET status = 'Rejected' WHERE request_id = ? AND proposal_id <> ? AND status = 'Submitted'",
      [p.request_id, proposalId]
    );
    await connection.query("UPDATE request SET status = 'In Progress' WHERE request_id = ?", [p.request_id]);
    const transactionId = await nextId(connection, 'transaction', 'transaction_id');
    await connection.query(
      `INSERT INTO \`transaction\` (transaction_id, request_id, buyer_business_id, seller_business_id, service_id,
                                    quantity, agreed_price, start_date, status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), 'Active', 'Pending')`,
      [transactionId, p.request_id, p.buyer_id, p.provider_business_id, p.service_id,
       p.quantity ?? p.quantity_required ?? 1, p.proposed_price]
    );
    return { proposalId, status, transactionId };
  });
}

// ---------- Transactions ----------
// The buyer confirms the work is finished. This updates records only; it does not process a payment.
export async function completeTransaction(businessId, transactionId) {
  return withTransaction(async (connection) => {
    const [rows] = await connection.query(
      'SELECT buyer_business_id, request_id, status FROM `transaction` WHERE transaction_id = ? FOR UPDATE',
      [transactionId]
    );
    if (!rows.length) throw new HttpError(404, 'Transaction not found.');
    if (rows[0].buyer_business_id !== businessId) throw new HttpError(403, 'Only the buyer can mark a deal as completed.');
    if (rows[0].status !== 'Active') throw new HttpError(409, `This deal is already ${rows[0].status}.`);
    await connection.query("UPDATE `transaction` SET status = 'Completed', completion_date = CURDATE() WHERE transaction_id = ?", [transactionId]);
    await connection.query("UPDATE request SET status = 'Completed' WHERE request_id = ?", [rows[0].request_id]);
    return { transactionId, status: 'Completed' };
  });
}

// Payment status update.
// CONCEPTS: UPDATE with state check and transaction lock (FOR UPDATE).
export async function setTransactionPaymentStatus(businessId, transactionId, paymentStatus) {
  if (!['Pending', 'Paid', 'Refunded'].includes(paymentStatus)) {
    throw new HttpError(400, "Payment status must be 'Pending', 'Paid', or 'Refunded'.");
  }
  return withTransaction(async (connection) => {
    const [rows] = await connection.query(
      'SELECT buyer_business_id, seller_business_id, status, payment_status FROM `transaction` WHERE transaction_id = ? FOR UPDATE',
      [transactionId]
    );
    if (!rows.length) throw new HttpError(404, 'Transaction not found.');
    if (rows[0].buyer_business_id !== businessId && rows[0].seller_business_id !== businessId) {
      throw new HttpError(403, 'Only parties in this transaction can update payment status.');
    }
    await connection.query(
      'UPDATE `transaction` SET payment_status = ? WHERE transaction_id = ?',
      [paymentStatus, transactionId]
    );
    return { transactionId, paymentStatus };
  });
}

// ---------- Reviews ----------
export async function createReview(businessId, body) {
  const transactionId = requireInt(body.transactionId, 'Transaction');
  const rating = requireInt(body.rating, 'Overall rating', { min: 1, max: 5 });
  const optionalRating = (value, label) => (value === undefined || value === '' || value === null ? null : requireInt(value, label, { min: 1, max: 5 }));
  const quality = optionalRating(body.qualityRating, 'Quality rating');
  const timeliness = optionalRating(body.timelinessRating, 'Timeliness rating');
  const communication = optionalRating(body.communicationRating, 'Communication rating');
  const text = optionalText(body.reviewText, 2000);

  return withTransaction(async (connection) => {
    const [rows] = await connection.query(
      'SELECT buyer_business_id, seller_business_id, status FROM `transaction` WHERE transaction_id = ? FOR UPDATE',
      [transactionId]
    );
    if (!rows.length) throw new HttpError(404, 'Transaction not found.');
    if (rows[0].buyer_business_id !== businessId) throw new HttpError(403, 'Only the buyer can review this deal.');
    if (rows[0].status !== 'Completed') throw new HttpError(409, 'You can review a deal only after it is completed.');
    const [existing] = await connection.query('SELECT review_id FROM review WHERE transaction_id = ?', [transactionId]);
    if (existing.length) throw new HttpError(409, 'This deal has already been reviewed.');
    const reviewId = await nextId(connection, 'review', 'review_id');
    await connection.query(
      `INSERT INTO review (review_id, transaction_id, reviewer_business_id, reviewed_business_id, rating,
                           review_text, quality_rating, timeliness_rating, communication_rating)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reviewId, transactionId, businessId, rows[0].seller_business_id, rating, text, quality, timeliness, communication]
    );
    return { reviewId };
  });
}

