import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
dotenv.config({ path: envPath });

function getSslConfig() {
  const isSslEnabled = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';
  if (!isSslEnabled) {
    return undefined;
  }

  let ca;
  const caCert = process.env.DB_CA_CERT || process.env.DB_SSL_CA;
  const caPath = process.env.DB_CA_PATH || process.env.DB_SSL_CA_PATH;

  if (caCert) {
    const raw = caCert.trim().replace(/^["']|["']$/g, '');
    ca = raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
  } else if (caPath) {
    const resolvedPath = path.isAbsolute(caPath)
      ? caPath
      : (fs.existsSync(path.resolve(process.cwd(), caPath))
          ? path.resolve(process.cwd(), caPath)
          : path.resolve(path.dirname(envPath), caPath));
    ca = fs.readFileSync(resolvedPath, 'utf8');
  }

  return {
    ...(ca ? { ca } : {}),
    rejectUnauthorized: true,
  };
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3307,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'business_service_db',
  ssl: getSslConfig(),
  connectionLimit: 5,
  connectTimeout: 10000,
  dateStrings: true,
});

pool.on('connection', () => {

});

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

export async function nextId(connection, table, idColumn) {
  const [rows] = await connection.query(
    'SELECT COALESCE((SELECT MAX(??) FROM ?? FOR UPDATE), 0) + 1 AS next_id',
    [idColumn, table]
  );
  return rows[0].next_id;
}
