// Registration, login and the middleware that protects every other route.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, withTransaction, nextId } from './db.js';
import { HttpError, requireText, optionalText } from './errors.js';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET is missing. Add it to backend/.env');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[6-9]\d{9}$/; // 10-digit Indian mobile number
const WEBSITE_PATTERN = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i;

// Accepts "98765 00015", "98765-00015" or "+91 9876500015" and returns the plain 10 digits.
function normalizePhone(value) {
  const digits = (typeof value === 'string' ? value : '').replace(/[\s-]/g, '').replace(/^(\+91|0)/, '');
  if (!PHONE_PATTERN.test(digits)) {
    throw new HttpError(400, 'Enter a valid 10-digit mobile number (it must start with 6, 7, 8 or 9).');
  }
  return digits;
}

function issueToken(businessId) {
  return jwt.sign({ businessId }, SECRET, { expiresIn: '8h' });
}

// Creates the business profile AND its login in one transaction, so we never get half a registration.
export async function register(body) {
  const business = {
    name: requireText(body.businessName, 'Business name', 100),
    industry: requireText(body.industry, 'Industry', 50),
    city: requireText(body.city, 'City', 50),
    state: requireText(body.state, 'State', 50),
    size: optionalText(body.businessSize, 30),
    email: requireText(body.email, 'Email', 100).toLowerCase(),
    phone: normalizePhone(body.phone),
    website: optionalText(body.website, 150),
    description: optionalText(body.description, 2000),
  };
  if (business.name.length < 2) throw new HttpError(400, 'Business name must be at least 2 characters.');
  if (!EMAIL_PATTERN.test(business.email)) throw new HttpError(400, 'Enter a valid email address.');
  if (business.website && !WEBSITE_PATTERN.test(business.website)) {
    throw new HttpError(400, 'Enter a valid website address, for example www.example.com.');
  }
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, 'Password must be 8 to 72 characters and contain at least one letter and one number.');
  }

  // Never store the password itself, only a salted hash of it.
  const passwordHash = await bcrypt.hash(password, 10);

  const businessId = await withTransaction(async (connection) => {
    // Friendly duplicate checks. The UNIQUE keys on business (email, phone, website) still guard against races.
    const [taken] = await connection.query(
      `SELECT LOWER(email) = ?               AS email_taken,
              phone = ?                      AS phone_taken,
              (? IS NOT NULL AND website = ?) AS website_taken
         FROM business
        WHERE LOWER(email) = ? OR phone = ? OR (? IS NOT NULL AND website = ?)`,
      [business.email, business.phone, business.website, business.website,
       business.email, business.phone, business.website, business.website]
    );
    if (taken.some((row) => row.email_taken)) throw new HttpError(409, 'This email is already registered. Try signing in instead.');
    if (taken.some((row) => row.phone_taken)) throw new HttpError(409, 'This phone number is already registered to another business.');
    if (taken.some((row) => row.website_taken)) throw new HttpError(409, 'This website is already registered to another business.');
    const id = await nextId(connection, 'business', 'business_id');
    const accountId = await nextId(connection, 'account', 'account_id');
    await connection.query(
      `INSERT INTO business (business_id, business_name, industry, city, state, business_size,
                             email, phone, website, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, business.name, business.industry, business.city, business.state, business.size,
       business.email, business.phone, business.website, business.description]
    );
    await connection.query(
      'INSERT INTO account (account_id, business_id, password_hash) VALUES (?, ?, ?)',
      [accountId, id, passwordHash]
    );
    return id;
  });

  return { token: issueToken(businessId), user: await getCurrentUser(businessId) };
}

export async function login(body) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  // The login email is the business's email, so we JOIN account to business.
  const [rows] = await pool.query(
    `SELECT a.business_id, a.password_hash
       FROM account a
       JOIN business b ON b.business_id = a.business_id
      WHERE LOWER(b.email) = ?`,
    [email]
  );
  // Same message for "no such email" and "wrong password" so nobody can probe which emails exist.
  const ok = rows.length > 0 && (await bcrypt.compare(password, rows[0].password_hash));
  if (!ok) throw new HttpError(401, 'Incorrect email or password.');

  return { token: issueToken(rows[0].business_id), user: await getCurrentUser(rows[0].business_id) };
}

export async function getCurrentUser(businessId) {
  const [rows] = await pool.query(
    'SELECT business_id AS businessId, business_name AS businessName, city, industry FROM business WHERE business_id = ?',
    [businessId]
  );
  if (!rows.length) throw new HttpError(401, 'Please sign in again.');
  return rows[0];
}

// Express middleware: reads "Authorization: Bearer <token>" and sets req.businessId.
export function requireLogin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    req.businessId = jwt.verify(token, SECRET).businessId;
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in to continue.' });
  }
}
