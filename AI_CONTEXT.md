# SprintIQ AI Context

## Project Overview
SprintIQ AI is an enterprise-grade AI-powered software engineering project intelligence dashboard and management tool. It features unified Authentication and RBAC across Admin, Manager, and Developer domains.

## Tech Stack
- Frontend: `React 18`, `Vite`, `TypeScript`, `TailwindCSS`
- Backend: `FastAPI`, `SQLAlchemy`, `Python`
- Database: `Supabase` / `PostgreSQL`
- Key Integrations: `Google Gemini AI`, `GitHub API`

## Application Structure
- `frontend/src/pages`: Distinct portal UI trees based on Roles (Admin, Manager, Developer) & Global intelligence dashboards.
- `frontend/src/services/api.ts`: Fully centralized Axios client injecting `VITE_API_URL` to route correctly through the Vite frontend dev proxy.
- `backend/app/api/v1/routers`: All distinct HTTP endpoints correctly mapped. 
- `backend/app/models/domain.py`: SQLAlchemy schema references.

## Key Concepts
- **Authentication**: A single `/auth/login` endpoint coordinates authentication for all user roles. Roles restrict UI components statically on the client and enforce permission natively on the backend via dependencies.
- **System Settings**: Database-driven configurations mapped natively through `adminSettingsService`.
- **AI Integration**: AI components interface centrally through `aiService.ts` mapping sequentially to Gemini REST wrappers internally inside the FastAPI environment.

## Development Constraints
- `VITE_API_URL`: Mapped explicitly via Vite proxy targeting `http://127.0.0.1:8000` (FastAPI IPv4).
- Secrets: No sensitive AI/DB logic natively stored in the UI.

## Local Development Commands
**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
```bash
cd backend
python -m uvicorn main:app --port 8000 --host 127.0.0.1 --reload
```
