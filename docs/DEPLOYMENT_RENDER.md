# Deploying ServicePath AI to Render

This guide walks you through deploying the complete **ServicePath AI** application (Backend API + React Frontend + MySQL Database) to **Render** for free.

---

## Architecture on Render

- **Web Service (Single Service)**: Express serves both the backend API (`/api/*`) and the built React frontend (`/*`). This keeps everything on **one single free service** on Render—avoiding CORS issues and staying well within Render's free tier.
- **Database**: Render does not offer a free MySQL tier natively. You can host the MySQL 8 database for free on **[Aiven for MySQL](https://aiven.io/)** or **[TiDB Cloud](https://tidbcloud.com/)** (free forever, 100% MySQL compatible) and connect it to Render.

---

## Step 1: Set Up Free Cloud MySQL

1. Sign up for free at **[Aiven.io](https://aiven.io/)** or **[TiDB Cloud](https://tidbcloud.com/)**.
2. Create a free **MySQL** database instance (choose any nearby region).
3. Once provisioned, note down your connection details:
   - **Host** (e.g. `mysql-xxxx.aivencloud.com`)
   - **Port** (e.g. `12345` or `3306`)
   - **User** (e.g. `avnadmin` or `root`)
   - **Password**
   - **Database Name** (e.g. `defaultdb` or create `business_service_db`)
4. In the web console of Aiven or TiDB Cloud (or via DBeaver / MySQL Workbench connected to your cloud instance):
   - Open the SQL Query editor.
   - Run the contents of `database/business_service_db.sql`.
   - Run `database/phase2.sql`.

---

## Step 2: Push Your Code to GitHub

Make sure your latest code is committed and pushed to your GitHub repository:

```bash
git add .
git commit -m "Configure production build and Render deployment"
git push origin main
```

---

## Step 3: Deploy on Render

### Option A: Using Render Blueprint (`render.yaml`) - Easiest

1. Log in to **[Render.com](https://render.com/)**.
2. Click **New +** $\rightarrow$ **Blueprint**.
3. Connect your GitHub repository (`DBMS CP`).
4. Render will automatically read `render.yaml` and configure the Web Service.
5. In the prompts, enter your Cloud MySQL credentials:
   - `DB_HOST`: your cloud host
   - `DB_PORT`: your cloud port
   - `DB_USER`: your cloud user
   - `DB_PASSWORD`: your cloud password
   - `DB_NAME`: `business_service_db` (or your cloud DB name)
6. Click **Apply**. Render will automatically run `npm run build` and launch `npm start`.

---

### Option B: Manual Web Service Setup

If you prefer manual configuration:

1. In Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository.
3. Configure the settings:
   - **Name**: `servicepath-ai`
   - **Region**: Choose the region closest to your cloud database
   - **Branch**: `main`
   - **Root Directory**: *(leave blank / project root)*
   - **Runtime**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
4. Under **Environment Variables**, add:
   | Key | Value | Notes |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production mode |
   | `JWT_SECRET` | *(click Generate or enter a random string)* | Used to sign auth tokens |
   | `DB_HOST` | `your-cloud-mysql-host` | From Step 1 |
   | `DB_PORT` | `3306` (or your cloud port) | From Step 1 |
   | `DB_USER` | `your-cloud-user` | From Step 1 |
   | `DB_PASSWORD` | `your-cloud-password` | From Step 1 |
   | `DB_NAME` | `business_service_db` | From Step 1 |
   | `DB_SSL` | `true` | Required for cloud databases |

5. Click **Create Web Service**.

---

## Step 4: Verify Your Deployment

Once Render finishes the build (usually takes 1-2 minutes):

1. Open your Render app URL: `https://servicepath-ai.onrender.com`.
2. Check the health status in your browser:
   `https://servicepath-ai.onrender.com/api/health`
   Should return:
   ```json
   {
     "status": "healthy",
     "database": {
       "healthy": 1,
       "database_name": "...",
       "server_version": "...",
       "businesses_count": 10
     }
   }
   ```
3. Test signing up, viewing requests, and posting proposals in the live web app!

