// Generates database/phase2_demand_forecasting.sql and applies it to the local database.
// Strictly preserves all 7 existing core tables and their records.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../backend/src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlFilePath = path.join(__dirname, 'phase2_demand_forecasting.sql');

const months = [
  '2024-11', '2024-12',
  '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
  '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
  '2026-07', '2026-08', '2026-09', '2026-10',
];

// Deterministic 24-month demand series per category (Nov 2024 - Oct 2026)
const categorySeries = {
  IT: {
    services: [
      { id: 101, baseBudget: 60000 },
      { id: 103, baseBudget: 75000 },
    ],
    counts: [8, 9, 10, 9, 11, 12, 11, 13, 14, 13, 15, 16, 15, 17, 18, 17, 19, 20, 19, 21, 22, 21, 23, 24],
  },
  Marketing: {
    services: [{ id: 102, baseBudget: 30000 }],
    counts: [6, 6, 7, 8, 7, 8, 9, 8, 9, 10, 11, 10, 11, 12, 11, 12, 13, 14, 13, 14, 15, 14, 15, 16],
  },
  Design: {
    services: [{ id: 105, baseBudget: 15000 }],
    counts: [5, 6, 5, 6, 7, 6, 7, 7, 8, 7, 8, 9, 8, 9, 8, 9, 10, 9, 10, 11, 10, 11, 11, 12],
  },
  Finance: {
    services: [{ id: 104, baseBudget: 25000 }],
    counts: [4, 4, 5, 5, 6, 5, 5, 6, 6, 7, 6, 7, 7, 6, 7, 8, 7, 8, 8, 7, 8, 9, 8, 9],
  },
};

const rows = [];
let syntheticId = 1;

for (let mIdx = 0; mIdx < months.length; mIdx++) {
  const ym = months[mIdx];
  for (const [, cfg] of Object.entries(categorySeries)) {
    const count = cfg.counts[mIdx];
    for (let i = 0; i < count; i++) {
      const svc = cfg.services[i % cfg.services.length];
      const day = String(((i * 3 + mIdx) % 27) + 1).padStart(2, '0');
      const requestDate = `${ym}-${day}`;
      // Deterministic budget variation around service base price
      const budgetFactor = 0.9 + ((i + mIdx) % 5) * 0.05;
      const estimatedBudget = (svc.baseBudget * budgetFactor).toFixed(2);
      rows.push(
        `(${syntheticId++}, ${svc.id}, '${requestDate}', ${estimatedBudget}, 1, 'SYNTHETIC_24M_BENCHMARK')`
      );
    }
  }
}

const sqlContent = `-- ============================================================================
-- ServicePath AI — Phase 2: Service Demand Forecasting (Isolated Synthetic Data)
-- ============================================================================
-- NOTE: This script does NOT insert into or alter the production \`request\` table
-- or any of the 7 core marketplace tables. All historical training/evaluation
-- records live in \`synthetic_request_history\` with \`is_synthetic = 1\`.
-- ============================================================================

DROP TABLE IF EXISTS service_demand_forecast;
DROP TABLE IF EXISTS synthetic_request_history;

CREATE TABLE synthetic_request_history (
  synthetic_id INT PRIMARY KEY,
  service_id INT NOT NULL,
  request_date DATE NOT NULL,
  estimated_budget DECIMAL(10, 2) NOT NULL,
  is_synthetic TINYINT(1) NOT NULL DEFAULT 1,
  dataset_label VARCHAR(60) NOT NULL DEFAULT 'SYNTHETIC_24M_BENCHMARK',
  CONSTRAINT fk_synthetic_req_service FOREIGN KEY (service_id) REFERENCES service(service_id)
);

CREATE TABLE service_demand_forecast (
  forecast_id INT PRIMARY KEY,
  category VARCHAR(100) NOT NULL UNIQUE,
  forecast_month VARCHAR(7) NOT NULL,
  predicted_requests DECIMAL(10, 2) NOT NULL,
  naive_baseline_requests DECIMAL(10, 2) NOT NULL,
  regression_slope DECIMAL(10, 4) NOT NULL,
  regression_intercept DECIMAL(10, 4) NOT NULL,
  train_months INT NOT NULL,
  test_months INT NOT NULL,
  regression_mae DECIMAL(10, 4) NOT NULL,
  regression_rmse DECIMAL(10, 4) NOT NULL,
  naive_mae DECIMAL(10, 4) NOT NULL,
  naive_rmse DECIMAL(10, 4) NOT NULL,
  is_synthetic TINYINT(1) NOT NULL DEFAULT 1,
  evaluated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO synthetic_request_history
  (synthetic_id, service_id, request_date, estimated_budget, is_synthetic, dataset_label)
VALUES
  ${rows.join(',\n  ')};
`;

fs.writeFileSync(sqlFilePath, sqlContent, 'utf8');
console.log(`Wrote ${rows.length} synthetic rows to ${sqlFilePath}`);

async function applySql() {
  await pool.query('DROP TABLE IF EXISTS service_demand_forecast');
  await pool.query('DROP TABLE IF EXISTS synthetic_request_history');

  await pool.query(`
    CREATE TABLE synthetic_request_history (
      synthetic_id INT PRIMARY KEY,
      service_id INT NOT NULL,
      request_date DATE NOT NULL,
      estimated_budget DECIMAL(10, 2) NOT NULL,
      is_synthetic TINYINT(1) NOT NULL DEFAULT 1,
      dataset_label VARCHAR(60) NOT NULL DEFAULT 'SYNTHETIC_24M_BENCHMARK',
      CONSTRAINT fk_synthetic_req_service FOREIGN KEY (service_id) REFERENCES service(service_id)
    )
  `);

  await pool.query(`
    CREATE TABLE service_demand_forecast (
      forecast_id INT PRIMARY KEY,
      category VARCHAR(100) NOT NULL UNIQUE,
      forecast_month VARCHAR(7) NOT NULL,
      predicted_requests DECIMAL(10, 2) NOT NULL,
      naive_baseline_requests DECIMAL(10, 2) NOT NULL,
      regression_slope DECIMAL(10, 4) NOT NULL,
      regression_intercept DECIMAL(10, 4) NOT NULL,
      train_months INT NOT NULL,
      test_months INT NOT NULL,
      regression_mae DECIMAL(10, 4) NOT NULL,
      regression_rmse DECIMAL(10, 4) NOT NULL,
      naive_mae DECIMAL(10, 4) NOT NULL,
      naive_rmse DECIMAL(10, 4) NOT NULL,
      is_synthetic TINYINT(1) NOT NULL DEFAULT 1,
      evaluated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert in batches of 250
  for (let i = 0; i < rows.length; i += 250) {
    const chunk = rows.slice(i, i + 250);
    await pool.query(
      `INSERT INTO synthetic_request_history
        (synthetic_id, service_id, request_date, estimated_budget, is_synthetic, dataset_label)
       VALUES ${chunk.join(', ')}`
    );
  }

  const [[countRow]] = await pool.query('SELECT COUNT(*) AS cnt FROM synthetic_request_history');
  const [[realReqRow]] = await pool.query('SELECT COUNT(*) AS cnt FROM request');
  console.log('Applied schema & seed. synthetic_request_history count:', countRow.cnt, '| real request count:', realReqRow.cnt);
  await pool.end();
}

applySql().catch((err) => {
  console.error(err);
  process.exit(1);
});

