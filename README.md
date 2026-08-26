# SprintIQ AI — AI-Powered Software Engineering Project Intelligence Dashboard

SprintIQ AI is an enterprise-grade AI-powered Software Engineering Project Intelligence Dashboard that helps software companies manage projects, monitor team productivity, track software development, assign tasks, predict delivery risks using Google Gemini AI, and improve engineering efficiency.

---

## 🌟 Key Features Matrix

- **3 Role-Tailored Portals & Distinct Themes**:
  - 👑 **Admin Portal (`/login/admin`)**: Dark Blue Theme — Project governance, manager invitations, user directory, audit activity logs, executive PDF/CSV/Excel reports, global AI risk score.
  - 👔 **Project Manager Portal (`/login/manager`)**: Emerald Green Theme — Assigned projects, sprint planning, developer task allocation, developer invitations, review submission queue (Approve/Reject/Request changes), sprint burndown velocity charts.
  - 💻 **Developer Engine (`/login/developer`)**: Purple Theme — My assigned tasks, interactive task workbench with 0-100% progress sliders, file attachments, comment threads, task submission for manager review, notifications center, Gemini AI assistant chat.
- **Google Gemini 1.5 Risk Intelligence**: Real-time project health scoring, delivery risk prediction, developer workload bottleneck analysis, daily/weekly summaries, and interactive AI chat.
- **Strict Role-Based Authentication (RBAC)**: Dedicated login portals with JWT access tokens, refresh tokens, and strict role authorization guards.
- **Multi-Format Executive Exporter**: PDF (ReportLab), CSV, and Excel (OpenPyXL) report generators.

---

## 📐 Architecture Diagram

```
                 ┌────────────────────────────────────────────────────────┐
                 │                 REACT 19 + VITE FRONTEND               │
                 │   Admin (Dark Blue) | Manager (Emerald) | Dev (Purple)  │
                 └───────────────────────────┬────────────────────────────┘
                                             │ Axios REST API (JWT Bearer)
                                             ▼
                 ┌────────────────────────────────────────────────────────┐
                 │                  FASTAPI PYTHON BACKEND                │
                 │   Routers ──► Services ──► Repositories ──► Models     │
                 └──────────────┬──────────────────────────┬──────────────┘
                                │                          │
                  SQLAlchemy 2.0│                          │ Google Gemini API
                                ▼                          ▼
                 ┌────────────────────────────┐  ┌───────────────────────────┐
                 │    SUPABASE POSTGRESQL     │  │   GOOGLE GEMINI 1.5 AI    │
                 │   & SUPABASE STORAGE       │  │  RISK PREDICTION ENGINE   │
                 └────────────────────────────┘  └───────────────────────────┘
```

---

## 📁 Enterprise Folder Structure

```
SprintIQ AI/
├── schema.sql                     # Supabase PostgreSQL DDL Script
├── README.md                      # Comprehensive Technical Documentation
├── backend/                       # Enterprise Clean Architecture Python Backend
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py            # Current User & Role Authorization Guards
│   │   │   └── v1/routers/        # Role-based API Routers (auth, admin, manager, developer, etc.)
│   │   ├── core/
│   │   │   ├── config.py          # Pydantic Settings (.env configuration)
│   │   │   ├── database.py        # SQLAlchemy engine, sessionmaker & seed data
│   │   │   └── security.py        # JWT generation, Bcrypt password hashing
│   │   ├── models/domain.py       # SQLAlchemy ORM Models (15 normalized tables)
│   │   ├── schemas/pydantic_models.py # Pydantic v2 Request/Response Schemas
│   │   └── services/              # Business logic (ai_service, report_service, notification_service)
│   ├── main.py                    # FastAPI entry point & CORS
│   ├── requirements.txt           # Python dependencies
│   └── .env.example               # Environment variables template
└── frontend/                      # React 19 + TypeScript + Vite + Tailwind CSS
    ├── src/
    │   ├── components/            # UI components, GlassCard, Layouts, Headings, AI Chat Drawer
    │   ├── config/constants.ts    # Role themes (Dark Blue, Emerald Green, Purple)
    │   ├── contexts/              # AuthContext, NotificationContext
    │   ├── pages/                 # Auth portals & Role dashboards
    │   ├── services/api.ts        # Axios API client
    │   ├── types/index.ts         # TypeScript definitions
    │   ├── App.tsx                # React Router setup & Role guards
    │   └── index.css              # Glassmorphism utilities & Tailwind imports
    ├── package.json               # Node.js dependencies
    ├── vite.config.ts             # Vite configuration
    └── tailwind.config.js         # Tailwind role color palettes
```

---

## 🚀 Quick Start & Local Setup

### 1. Backend Setup (FastAPI Python)
```bash
cd backend
python -m venv venv
# On Windows
venv\Scripts\activate  
# Install dependenciesnn
pip install -r requirements.txt
# Run database initialization and server
python main.py
```
*Backend API server runs at `http://localhost:8000` with interactive Swagger docs at `http://localhost:8000/docs`.*

### 2. Frontend Setup (React 19 Vite)
```bash
cd frontend
npm install
npm run dev
```
*Frontend application runs at `http://localhost:5173`.*

---

## 🔑 Default Seed Credentials for Demo

| Portal | Role | Email | Password | Theme |
| :--- | :--- | :--- | :--- | :--- |
| `/login/admin` | Admin | `admin@sprintiq.ai` | `Admin@123` | Dark Blue |
| `/login/manager` | Project Manager | `manager@sprintiq.ai` | `Manager@123` | Emerald Green |
| `/login/developer` | Developer | `dev@sprintiq.ai` | `Dev@123` | Deep Purple |

---

## 🌐 Deployment Guide

### Frontend → Vercel
1. Connect GitHub repository to Vercel.
2. Framework Preset: **Vite**.
3. Root Directory: `./frontend`.
4. Build Command: `npm run build`, Output Directory: `dist`.

### Backend → Render
1. Create a Web Service on Render.
2. Environment: **Python 3.11+**.
3. Root Directory: `./backend`.
4. Build Command: `pip install -r requirements.txt`.
5. Start Command: `uvicorn main:app --host 0.0.0.0 --port 10000`.

### Database → Supabase PostgreSQL
1. Create project on Supabase.
2. Execute `schema.sql` in SQL Editor to create tables, indexes, and extensions.
3. Update `DATABASE_URL` in backend `.env`.
