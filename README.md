# ServicePath AI

B2B service marketplace for a DBMS course project.

- `business_service_db/` - your local Dolt database. It is **not stored in this repository** (git-ignored); see "Recreate the database" below
- `database/business_service_db.sql` - the full database as SQL: tables, seed data and views (`database/tables/` has one file per table)
- `database/phase2.sql` - the only schema additions to the original database (`account` table and 3 views)
- `dolt-server.yaml` - runs that database as a local MySQL-compatible server on 127.0.0.1:3307
- `backend/` - Node.js + Express + mysql2 API (port 4000). Settings and secrets live in `backend/.env`
- `frontend/` - React + Vite UI (port 5173)
- `docs/DBMS_QUERIES.md` - every important query, the DBMS concept it shows, and expected output

## Recreate the database (first time on a new computer)

Install [Dolt](https://docs.dolthub.com/introduction/installation), then from this folder:

```
mkdir business_service_db
cd business_service_db
dolt init
dolt sql < ../database/business_service_db.sql
```

The result has 5 businesses, 5 services, 5 requests, 4 proposals, 4 transactions, 3 reviews and an empty `account` table.
Alternative: `dolt clone sidz7777/business_service_db` and then run `database/phase2.sql`.
Create `backend/.env` from `backend/.env.example` (set your own `JWT_SECRET`).

## Run (three terminals, from this folder)

```
# 1. Database
dolt sql-server --config dolt-server.yaml

# 2. Backend (first time: cd backend; npm install; copy .env.example to .env, fill it in, incl. JWT_SECRET)
cd backend
npm start

# 3. Frontend (first time: npm install)
cd frontend
npm run dev
```

Registration rules: unique email, unique 10-digit mobile number (starting 6-9), optional unique website, and a password
of 8+ characters with a letter and a number.

Open http://localhost:5173 and register a business account. The seeded businesses have no login, so
register a new one to try requests and proposals.
