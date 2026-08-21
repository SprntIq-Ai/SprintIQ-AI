# SprintIQ Architecture

## Frontend
**Stack:** React 18, Vite, TailwindCSS, TypeScript
**Routing:** React Router v6
**State/Services:** Axios, Context API (Auth, Notifications, Theme)
**Key Pages:**
- Admin: Dashboard, Project Intelligence, Settings, Global AI Insights
- Manager: Workbench, Sprint Planner, Team Velocity, Project Calendar
- Developer: Focus Mode, Assigned Tasks, AI Assistant
- Shared: Login (Admin/Manager/Dev unified), Project Reports

## Backend
**Stack:** Python, FastAPI, SQLAlchemy, Uvicorn
**Authentication:** Custom JWT-based RBAC authentication mapping directly to `profiles` and `roles`.
**Routes:**
- `/auth/login`: Handles all initial access tokens globally for all roles.
- `/admin`, `/manager`, `/developer`: Feature-specific logic endpoints tightly bound by role checking guards.
- `/ai`: Wraps all requests bound for Google Gemini integration.
- `/github`: Integrates GitHub commit/PR data globally.
- `/settings`: Exposes configuration values defined globally in DB.

## AI Engine
**Model:** Google Gemini (1.5 Flash / Pro).
**Modules:**
- Code analysis and PR health summaries.
- Chat Assistant (context-aware).
- Sprint Planning and Task Generator engines.
- AI Risk Engine and Analytics scoring dashboard.

## Database (PostgreSQL/Supabase)
**Core Tables:**
- `profiles`: All system users (Auth).
- `projects`: High-level organizational units.
- `sprints`: Epics/intervals belonging to Projects.
- `tasks`: Tickets belonging to Sprints.
- `system_settings`: Global configurations dictating UI behaviors.
- `ai_history`: Telemetry mapped to model prompts.
