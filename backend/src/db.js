// Database connection module.
// Credentials come only from environment variables (backend/.env) and never reach the browser.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

// Resolve .env relative to this file so starting from any folder works reliably.
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
dotenv.config({ path: envPath });

// A pool keeps a few connections open and reuses them, which is faster than reconnecting per request.
export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3307,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'business_service_db',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  connectionLimit: 5,
  connectTimeout: 10000,
  dateStrings: true, // return DATE/DATETIME as plain text so the browser does not shift timezones
});

pool.on('connection', () => {
  // Connection allocated from pool
});

// Runs several statements as ONE database transaction: either all succeed (COMMIT) or none do (ROLLBACK).
export async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// None of our tables use AUTO_INCREMENT, so a new id is "largest id so far + 1".
// COALESCE handles an empty table (MAX is NULL there). Call this inside withTransaction.
// The MAX() sits in a scalar subquery because Dolt returns no row at all for a bare MAX() on an empty table.
export async function nextId(connection, table, idColumn) {
  const [rows] = await connection.query(
    'SELECT COALESCE((SELECT MAX(??) FROM ?? FOR UPDATE), 0) + 1 AS next_id',
    [idColumn, table]
  );
  return rows[0].next_id;
}
