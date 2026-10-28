# ServicePath AI — B2B Service Marketplace & DBMS Capstone

[![Database](https://img.shields.io/badge/Database-Dolt%20%2F%20MySQL%208.0-blue.svg)](https://www.dolthub.com/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2F%20Express-green.svg)](https://nodejs.org/)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2F%20Vite-purple.svg)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-82%2F82%20Passing-brightgreen.svg)]()
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)]()

ServicePath AI is a full-stack B2B service exchange marketplace engineered as an advanced Database Management Systems (DBMS) capstone project. The platform connects enterprise buyers with specialized service providers, orchestrating service catalog discovery, competitive proposal tendering, binding contracts, escrow payment settlements, and multi-criteria performance reviews.

The system is backed by a version-controlled relational database engine (**Dolt**, 100% MySQL 8 protocol compatible), delivering strict ACID compliance, declarative integrity constraints, complex multi-table views, stored procedures with cursors, automated audit triggers, and comprehensive join algorithms.

---

## Architecture Overview

```
+---------------------------------------------------------------------------------+
|                               SERVICEPATH AI ARCHITECTURE                       |
+---------------------------------------------------------------------------------+
|                                                                                 |
|   +----------------------------+             +------------------------------+   |
|   |   React 19 + Vite Client   |  <------->  |   Node.js + Express API      |   |
|   |   (Port 5173 / Production) |   REST/JWT  |   (Port 4000)                |   |
|   +----------------------------+             +--------------+---------------+   |
|                                                             |                   |
|                                                       MySQL2 Protocol           |
|                                                             v                   |
|                                              +------------------------------+   |
|                                              |   Dolt SQL Server (v2.4.0)   |   |
|                                              |   MySQL 8.0.31 Compatible    |   |
|                                              |   Port 3307                  |   |
|                                              |   DB: business_service_db    |   |
|                                              +--------------+---------------+   |
|                                                             |                   |
|                     +---------------------------------------+                   |
|                     |                                                           |
|                     v                                                           |
|   +------------------------------------+                                        |
|   |   RELATIONAL CORE (7 Base Tables)  |   -> business, service, request,       |
|   |                                    |      proposal, transaction, review,    |
|   |                                    |      account                           |
|   +------------------------------------+                                        |
|   |   PERSISTENT PROCEDURES & TRIGGERS |   -> sp_get_request_summary            |
|   |                                    |      sp_calculate_provider_tier        |
|   |                                    |      sp_batch_commission_cursor        |
|   |                                    |      trg_transaction_status_audit      |
|   +------------------------------------+                                        |
|   |   DATABASE VIEWS                   |   -> v_request_summary                 |
|   |                                    |      v_category_summary (safe fan-out) |
|   |                                    |      v_business_rating                 |
|   |                                    |      v_service_catalogue               |
|   |                                    |      v_active_service_catalog (CHECK)  |
|   +------------------------------------+                                        |
+---------------------------------------------------------------------------------+
```

---

## College DBMS Curriculum Alignment Matrix

Every required database concept is implemented with realistic business logic, executable SQL scripts in `database/assignments/`, and automated regression test coverage:

| # | Curriculum Assignment | Topic & Focus Area | Script / Artifact Location | Automated Test Status |
|---|---|---|---|---|
| **1** | **DDL, DML & Constraints** | PK, FK (`CASCADE`), `UNIQUE`, `CHECK`, `DEFAULT`, `ALTER`, `TRUNCATE`, `DROP` | [`database/assignments/assignment1_ddl_dml.sql`](database/assignments/assignment1_ddl_dml.sql) | **PASSED** (Test 1.1–1.7) |
| **2** | **ER Modeling & Normalization** | Crow's foot ER diagram, Workbench reverse engineering, BCNF proofs | [`database/assignments/assignment2_er_diagram.md`](database/assignments/assignment2_er_diagram.md) | **VERIFIED** |
| **3** | **Views & Updatable Views** | Multi-table joins, Cartesian-safe summary, `WITH CHECK OPTION` | [`database/assignments/assignment3_views.sql`](database/assignments/assignment3_views.sql) | **PASSED** (Test 3.1–3.3) |
| **4** | **Comprehensive JOINs** | Equi-join, non-equi (`BETWEEN`, `>`), self-joins, natural join, outer joins, anti-join | [`database/assignments/assignment4_joins.sql`](database/assignments/assignment4_joins.sql) | **PASSED** (Test 4.1–4.8) |
| **5** | **Advanced SELECT & Subqueries** | `LIKE` (`%`, `_`), `GROUP BY/HAVING`, set operators (`INTERSECT`, `EXCEPT`), subqueries | [`database/assignments/assignment5_advanced_select.sql`](database/assignments/assignment5_advanced_select.sql) | **PASSED** (Test 5.1–5.14) |
| **6** | **Stored Procedures & Cursors** | `IN`/`OUT` params, `IF/ELSEIF` control structures, explicit SQL cursor loops | [`database/assignments/assignment6_stored_procedures_mysql.sql`](database/assignments/assignment6_stored_procedures_mysql.sql) | **PASSED** (Test 6.1–6.8) |
| **7** | **Database Triggers** | `BEFORE INSERT` validation, `BEFORE UPDATE` immutability, `AFTER UPDATE` audit log | [`database/assignments/assignment7_triggers_mysql.sql`](database/assignments/assignment7_triggers_mysql.sql) | **PASSED** (Test 7.1–7.13) |
| **8** | **Distributed Databases** | Shared-Nothing, fragmentation, 2PC, CAP theorem, Spanner vs Dolt study | [`database/assignments/assignment8_distributed_databases.md`](database/assignments/assignment8_distributed_databases.md) | **VERIFIED** |

*(Note: Oracle PL/SQL dialect counterparts are maintained separately in `assignment6_stored_procedures_oracle.sql` and `assignment7_triggers_oracle.sql` for comparative viva study).*

---

## Quick Start Guide

### Prerequisites
- **Node.js** (v18+ recommended)
- **Dolt** CLI ([Installation Guide](https://docs.dolthub.com/introduction/installation)) or MySQL 8.0 Server
- **MySQL Workbench** (optional, recommended for visual querying and EER diagrams)

### 1. Database Initialization
From the repository root directory:

```bash
# 1. Start the Dolt SQL server on 127.0.0.1:3307 using the bundled configuration
dolt sql-server --config dolt-server.yaml
```

*If rebuilding the database from scratch on a new machine:*
```bash
mkdir -p business_service_db
cd business_service_db
dolt init
dolt sql < ../database/business_service_db.sql
dolt sql < ../database/phase2.sql
cd ..
```

### 2. Environment Configuration
Create the backend configuration file:
```bash
cp backend/.env.example backend/.env
```
*(The default settings in `.env.example` pre-configure `DB_PORT=3307` and `DB_NAME=business_service_db` for zero-friction setup).*

### 3. Install Dependencies
```bash
npm run install:all
```

### 4. Run the Application
In separate terminals:
```bash
# Terminal 1: Backend API (runs on http://localhost:4000)
cd backend
npm start

# Terminal 2: Frontend Client (runs on http://localhost:5173)
cd frontend
npm run dev
```

---

## Automated Testing & Read-Only Audit

The project features an exhaustive test suite covering REST APIs, business logic, ACID transactions, and all SQL assignment concepts:

```bash
# Execute the full automated test suite (82 checks)
npm test

# Run the strict read-only database catalog audit
npm run audit
```

### Test Suite Breakdown:
- `test_phase1.js` (8/8 passed): Core REST CRUD endpoints, authentication, and profile updates.
- `test_phase2.js` (12/12 passed): Views, multi-table joins, correlated subqueries, parameter safety, and ownership checks.
- `test_e2e_flow.js` (10/10 passed): Complete end-to-end integration flow (Register $\rightarrow$ Request $\rightarrow$ Bid $\rightarrow$ Accept $\rightarrow$ Deal Completion $\rightarrow$ Review $\rightarrow$ Analytics).
- `test_phase_a.js` (32/32 passed): Comprehensive SQL tests for Assignments 1, 3, 4, and 5.
- `test_phase_b.js` (20/20 passed): Parameterized stored procedures, cursor loops, triggers, and persistent audit catalog validation.

---

## MySQL Workbench Demonstration Guide

To demonstrate the project in **MySQL Workbench**:
1. Connect to **`127.0.0.1:3307`** (Username: `root`, Password: *blank*, Schema: `business_service_db`).
2. Open any script from `database/assignments/` (`Ctrl + O`).
3. Execute blocks with `Ctrl + Shift + Enter`.
4. To view the **EER Diagram Canvas**:
   - Navigate to `Database` $\rightarrow$ `Reverse Engineer...` (`Ctrl + R`).
   - Select `business_service_db` to auto-generate the complete schema model with all foreign keys and cardinalities.

---

## Repository Directory Structure

```text
.
├── backend/                              # Express REST API & Database Access Layer
│   ├── src/                              # Server bootstrap, routing, queries, and auth
│   │   ├── actions.js                    # ACID transaction mutations (accept proposal, submit review)
│   │   ├── api.js                        # Route declarations & endpoint handlers
│   │   ├── auth.js                       # Password hashing & JWT token issuance
│   │   ├── db.js                         # MySQL connection pool configuration
│   │   ├── errors.js                     # Centralized HTTP error handling
│   │   ├── queries.js                    # Parameterized SQL query repository
│   │   └── server.js                     # Express application entrypoint
│   ├── test_e2e_flow.js                  # End-to-end marketplace flow test runner
│   ├── test_phase1.js                    # Phase 1 backend integration test runner
│   ├── test_phase2.js                    # Phase 2 views, joins, and security test runner
│   ├── test_phase_a.js                   # Assignments 1, 3, 4, 5 SQL test runner
│   ├── test_phase_b.js                   # Assignments 6 & 7 procedures/triggers test runner
│   ├── audit_verification.js             # Non-destructive catalog & health audit tool
│   ├── .env.example                      # Environment template with placeholders
│   └── package.json                      # Backend dependencies & test scripts
├── database/                             # Database Schemas, Seeds, and Practical Assignments
│   ├── assignments/                      # Practical curriculum demonstration scripts
│   │   ├── assignment1_ddl_dml.sql       # Assignment 1: DDL, DML, Constraints, ALTER, TRUNCATE
│   │   ├── assignment2_er_diagram.md     # Assignment 2: ER Diagram, Cardinality & BCNF Proofs
│   │   ├── assignment3_views.sql         # Assignment 3: Multi-table & Updatable Views
│   │   ├── assignment4_joins.sql         # Assignment 4: Comprehensive JOINs & Anti-Join
│   │   ├── assignment5_advanced_select.sql # Assignment 5: Advanced SELECT, Set Operators & Subqueries
│   │   ├── assignment6_stored_procedures_mysql.sql   # Assignment 6: MySQL Procedures & Cursors
│   │   ├── assignment6_stored_procedures_oracle.sql  # Assignment 6: Oracle PL/SQL Reference
│   │   ├── assignment7_triggers_mysql.sql            # Assignment 7: MySQL Triggers & Audit Trail
│   │   ├── assignment7_triggers_oracle.sql           # Assignment 7: Oracle PL/SQL Reference
│   │   └── assignment8_distributed_databases.md      # Assignment 8: Distributed Database Whitepaper
│   ├── tables/                           # Modular SQL definitions per entity
│   ├── business_service_db.sql           # Complete standalone SQL dump for database rebuild
│   └── phase2.sql                        # Phase 2 schema additions DDL
├── docs/                                 # Technical Documentation & Guides
│   ├── DBMS_QUERIES.md                   # Single source of truth for queries & viva questions
│   └── DEPLOYMENT_RENDER.md              # Cloud deployment guide for Render & Cloud MySQL
├── frontend/                             # React 19 + Vite User Interface
│   ├── src/                              # React components, dashboard, and styling
│   ├── index.html                        # Application single-page HTML entrypoint
│   ├── package.json                      # Frontend dependencies & scripts
│   └── vite.config.js                    # Vite bundler configuration
├── dolt-server.yaml                      # Dolt SQL Server runtime configuration
├── package.json                          # Monorepo task orchestration scripts
├── render.yaml                           # Cloud deployment blueprint
├── view_db.js                            # CLI utility for terminal database inspection
└── README.md                             # Repository master documentation
```

---

## License

This project is licensed under the MIT License — see the repository for details.
