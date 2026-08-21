# SprintIQ AI - Production Deployment Guide

This guide details exactly how to deploy SprintIQ AI using Vercel (Frontend), Render/Railway (Backend), and Supabase PostgreSQL (Database). This architecture replaces the local SQLite database with a robust, production-ready PostgreSQL source of truth.

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
        RENDER / RAILWAY
          FastAPI Backend
                   │
             DATABASE_URL
                   │
                   ▼
        SUPABASE POSTGRESQL
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

## 2. Supabase PostgreSQL Setup

We strongly recommend avoiding SQLite in production because PaaS providers (like Render) have ephemeral filesystems. You must use Supabase PostgreSQL to persist your user accounts, tasks, and configurations.

1. Create a free account at [Supabase](https://supabase.com).
2. Create a new Organization and Project.
3. Once the database provisions, navigate to **Settings -> Database**.
4. Scroll down to **Connection string** (URI) and copy the **PostgreSQL** string.
   - It will look like: `postgresql://postgres.[YOUR-REFS]:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
   - *Keep this URL private. It is your `DATABASE_URL`.*

### Setting up the Schema
1. Open the Supabase **SQL Editor** from the left dashboard menu.
2. Click **New Query**.
3. Open the `schema.sql` file provided at the root of this repository.
4. Copy its contents and paste them securely into the Supabase SQL Editor.
5. Hit **RUN**.
6. Navigate to the **Table Editor** menu to verify that tables like `profiles`, `projects`, `tasks`, and `sprints` have been successfully created.

---

## 3. Environment Variables (Backend)
Prepare the following variables. Do NOT hard-code these into `config.py`.

```ini
ENVIRONMENT="production"
PROJECT_NAME="SprintIQ AI"
SECRET_KEY="A_STRONG_RANDOM_SECRET_KEY"

# Database Configuration
DATABASE_URL="postgresql://postgres.[YOUR-REFS]:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

# Cors
CORS_ORIGINS=["https://your-vercel-domain.vercel.app"]

# External APIs
GEMINI_API_KEY="your-gemini-secure-api-key"
GEMINI_MODEL="gemini-1.5-flash"

# Google Auth
FRONTEND_URL="https://your-vercel-domain.vercel.app"
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="https://your-vercel-domain.vercel.app/auth/google/callback"
```

---

## 4. Backend Deployment (Render or Railway)

### Deploying on Render (Web Service)
1. In Render, select **New + -> Web Service -> Build and deploy from a Git repository**.
2. Connect your GitHub repository (`kalyan-blog/SprintIQ-AI`).
3. Set the following build flags:
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r backend/requirements.txt`
   - **Start Command:** `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Expand **Environment Variables** and paste all required configurations from Step 3.
5. Click **Deploy Web Service**.

---

## 5. Frontend Deployment (Vercel)

### Deploying on Vercel
1. Log in to [Vercel](https://vercel.com) and click **Add New -> Project**.
2. Import the `kalyan-blog/SprintIQ-AI` repository.
3. In the Configuration panel, edit the following:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
4. Expand **Environment Variables** and add:
   - `VITE_API_URL` = `https://your-render-backend-url.onrender.com/api`
5. Vercel automatically honors the included `vercel.json` file inside the `frontend` directory precisely routing deeply nested React routes (like `/login/manager` or `/manager/dashboard`).
6. Click **Deploy**.

---

## 6. Verifying Deployment Integrity

We have prepared two custom API Endpoints explicitly verifying backend functionality:
1. `GET /api/health` — Verifies the FastAPI service is active.
2. `GET /api/health/db` — Connects to the Supabase endpoint executing a safe database validation query `SELECT 1` establishing production readiness.

### Data Persistence Test Workflow
Run this end-to-end trace to guarantee production readiness:
1. Navigate to the deployed Dashboard.
2. Sign in as the primary Admin / Manager.
3. Hard refresh the application (CTRL+F5). Make sure the account persists.
4. Navigate to `Projects`, assemble a mock project.
5. Add a `Sprint` into the workflow.
6. Create several tasks appending test workloads into existing Developers.
7. Close the browser completely. Reopen inside an entirely disconnected browser instance / incognito.
8. Validate that the Task status tracking properly restored across your backend connection. If they disappear, double check that your `DATABASE_URL` wasn't overridden back to `.db`.

## 7. Troubleshooting

- **404 On Page Refresh:** Ensure that your `vercel.json` exists locally inside `frontend/` containing regex rewrite rules routing strictly to `/index.html`.
- **CORS Rejected by API:** Ensure your `CORS_ORIGINS` exact domain string matches Vercel perfectly (including the `https://`, dropping trailing `/`).
- **Google OAuth Diverged Error:** Enter your Google Developer Console. Append your deployed Render backend and Vercel frontend natively allowing precise explicit endpoints inside the `Authorized redirect URIs`.
