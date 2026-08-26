# SprintIQ AI - Production Deployment Guide

This guide details exactly how to deploy SprintIQ AI using Vercel (Frontend), Railway (Backend), and Railway PostgreSQL (Database). This architecture replaces the old Supabase / SQLite configuration with a robust, production-ready PostgreSQL source of truth.

## 1. Architecture Map

```
                 VERCEL
                   │
                   ▼
             React/Vite
             Frontend
                   │
             HTTPS API
                   │
                   ▼
                RAILWAY
           FastAPI Backend
                   │
             DATABASE_URL
                   │
                   ▼
          RAILWAY POSTGRESQL
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
      Users     Projects     Tasks
                   │
                 Sprints
                   │
               Assignments
```

**External Integrations:**
- **Gemini AI**: Configured securely via environment variables on the backend.
- **Google OAuth**: Communicates strictly between Google APIs, the FastAPI backend, and redirect endpoints.
- **GitHub**: Handles real-time engineering analytics without leaking tokens to the frontend.

---

## 2. Railway PostgreSQL Setup

We strongly recommend avoiding SQLite in production because PaaS providers (like Railway) have ephemeral filesystems. You must use Railway PostgreSQL to persist your user accounts, tasks, and configurations.

1. Create a free account at [Railway](https://railway.app).
2. Create a new Project.
3. Click **+ Add Service** and choose **Database -> Add PostgreSQL**.
4. Once the database provisions, click on the **PostgreSQL** service and navigate to **Variables**.
5. Copy the connection string under `DATABASE_URL`.
   - It will look like: `postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/railway`
   - *Keep this URL private. It is your dynamic database connection.*

---

## 3. Environment Variables (Backend)

In Railway, configure the following variables under the FastAPI service's **Variables** tab. Do NOT hard-code these into the repository.

```ini
ENVIRONMENT="production"
PROJECT_NAME="SprintIQ AI"
SECRET_KEY="A_STRONG_RANDOM_SECRET_KEY"

# Database Configuration
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/railway"

# Cors Options
CORS_ORIGINS=["https://your-vercel-domain.vercel.app"]

# External APIs
GEMINI_API_KEY="your-gemini-secure-api-key"
GEMINI_MODEL="gemini-1.5-flash"

# Google Auth
FRONTEND_URL="https://your-vercel-domain.vercel.app"
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="https://your-vercel-domain.vercel.app/auth/google/callback"

# GitHub App/PAT Settings
GITHUB_TOKEN="your-github-token-or-pat"
```

---

## 4. Backend Deployment (Railway)

1. In Railway, click **+ Add Service** -> **GitHub Repo** and connect your repository (`kalyan-blog/SprintIQ-AI`).
2. Navigate to your new backend service -> **Settings** -> **Build & Deploy**.
3. Set the following build / execution flags:
   - **Root Directory:** `/backend`
   - **Build Command:** (Railway detects Python and installs packages from `requirements.txt` automatically)
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Expand **Variables** and paste all required configurations from Step 3. (Ensure `DATABASE_URL` is mapped to the PostgreSQL service).
5. Railway will deploy the backend service and start the FastAPI application, listening dynamically on the designated `$PORT`.

### Automatic Database Initialization & Seeding
Upon application startup, the FastAPI backend automatically executes:
1. **Connection check** on Railway PostgreSQL.
2. **PostgreSQL column adjustments** to ensure backward compatibility.
3. Run **Alembic migrations** programmatically to bring the database schemas to `head`.
4. Tables creation via SQLAlchemy metadata if missing.
5. Create and seed required settings such as `system_settings` and `gemini_enabled`.
6. Seed default roles, system settings, and development accounts.

---

## 5. Frontend Deployment (Vercel)

### Deploying on Vercel
1. Log in to [Vercel](https://vercel.com) and click **Add New -> Project**.
2. Import the `kalyan-blog/SprintIQ-AI` repository.
3. In the Configuration panel, edit the following:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
4. Expand **Environment Variables** and add:
   - `VITE_API_URL` = `https://your-railway-backend-url.railway.app` (do not add a trailing `/api` if Vercel routes are rewritten)
5. Vercel automatically honors the included `vercel.json` file inside the `frontend` directory, routing deeply nested routes (like `/login/manager` or `/manager/dashboard`) strictly to the correct React routes.
6. Click **Deploy**.

---

## 6. Verifying Deployment Integrity

We have prepared two custom API Endpoints explicitly verifying backend functionality:
1. `GET /health` — Verifies the FastAPI service is active.
2. `GET /health/db` — Connects to the Railway PostgreSQL database, executing a safe validation query `SELECT 1` establishing production readiness.

### Data Persistence Test Workflow
Run this end-to-end trace to guarantee production readiness:
1. Navigate to the deployed Dashboard.
2. Sign in as the primary Admin / Manager.
3. Hard refresh the application (CTRL+F5). Make sure the account persists.
4. Navigate to `Projects`, assemble a mock project.
5. Add a `Sprint` into the workflow.
6. Create several tasks assigning workload to developers.
7. Close the browser completely. Reopen inside an entirely disconnected browser instance / incognito.
8. Validate that the Task status tracking properly restored across your backend connection. If they disappear, double check that your `DATABASE_URL` wasn't overridden to SQLite fallback.

---

## 7. Troubleshooting

- **404 On Page Refresh:** Ensure that your `vercel.json` exists locally inside `frontend/` containing regex rewrite rules routing strictly to `/index.html`.
- **CORS Rejected by API:** Ensure your `CORS_ORIGINS` exact domain string matches Vercel perfectly (including the `https://`, dropping trailing `/`).
- **Google OAuth Diverged Error:** Enter your Google Developer Console. Append your deployed Railway backend and Vercel frontend natively allowing precise explicit endpoints inside the `Authorized redirect URIs`.
- **Migration Connection Failures:** Ensure that Alembic migrations run under PostgreSQL and do not use SQLite syntax, verified by conditional dialect wrappers.
