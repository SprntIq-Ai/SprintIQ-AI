import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from datetime import datetime, date, timedelta
import uuid

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal, ensure_postgresql_compatibilities
from app.core.security import get_password_hash
from app.services.ai_service import GeminiError
from app.models.domain import (
    Role, Profile, Project, ProjectMember, Sprint, Task, Notification, ActivityLog
)
from app.api.v1.routers import (
    auth, admin, manager, developer, projects, tasks, sprints, ai, reports, notifications, analytics, developer_features, search, intelligence, github_router, simulations, users, settings as set_router
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise-grade AI-powered Software Engineering Project Intelligence Dashboard",
    version="1.0.0"
)

# CORS setup
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://sprint-iq-ai.vercel.app"
]

if settings.FRONTEND_URL:
    u = settings.FRONTEND_URL.strip()
    if u and u != "*":
        origins.append(u)

if settings.CORS_ORIGINS:
    c_list = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]
    for c in c_list:
        c = c.strip()
        if c and c != "*":
            origins.append(c)

# Remove duplicates while preserving order
seen_origins = set()
unique_origins = []
for o in origins:
    normalized = o.rstrip('/')
    if normalized not in seen_origins:
        seen_origins.add(normalized)
        unique_origins.append(normalized)

app.add_middleware(
    CORSMiddleware,
    allow_origins=unique_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Mount API routers
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(manager.router, prefix="/api")
app.include_router(developer.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(sprints.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(developer_features.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(intelligence.router, prefix="/api")
app.include_router(github_router.router, prefix="/api")
app.include_router(simulations.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(set_router.router, prefix="/api")


@app.exception_handler(GeminiError)
async def gemini_error_handler(request, exc: GeminiError):
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    import traceback
    tb = traceback.format_exc()
    print(f"[Unhandled Exception]:\n{tb}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "traceback": tb.splitlines()
        }
    )



@app.get("/")
def read_root():
    return {
        "message": "SprintIQ AI API",
        "status": "running"
    }


@app.get("/health")
@app.get("/api/health")
def health_check():
    return {
        "status": "ok"
    }


@app.get("/api/temp-debug")
def temp_debug():
    import os
    from sqlalchemy import text, inspect
    from app.models.domain import Profile, Role, SystemSetting
    
    db = SessionLocal()
    report = {}
    
    # 1. Environment Info
    report["env"] = {
        "DATABASE_URL_SET": bool(settings.DATABASE_URL),
        "SECRET_KEY_SET": bool(settings.SECRET_KEY),
        "SECRET_KEY_VAL_LEN": len(settings.SECRET_KEY) if settings.SECRET_KEY else 0,
        "JWT_ALGORITHM": settings.ALGORITHM,
        "ENVIRONMENT": settings.ENVIRONMENT,
    }
    
    # 2. Database Connection and Tables Check
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        report["db"] = {
            "connected": True,
            "dialect": engine.dialect.name,
            "tables": tables
        }
    except Exception as e:
        import traceback
        report["db"] = {
            "connected": False,
            "error": str(e),
            "traceback": traceback.format_exc().splitlines()
        }
        db.close()
        return report

    # 3. Tables Row Counts and Content Check
    try:
        profile_count = db.query(Profile).count()
        role_count = db.query(Role).count()
        setting_count = db.query(SystemSetting).count()
        
        report["counts"] = {
            "profiles": profile_count,
            "roles": role_count,
            "system_settings": setting_count
        }
        
        # Look for dev and manager
        dev = db.query(Profile).filter(Profile.email == "dev@sprintiq.ai").first()
        mgr = db.query(Profile).filter(Profile.email == "manager@sprintiq.ai").first()
        
        report["seed_users"] = {
            "dev_exists": bool(dev),
            "dev_status": dev.status if dev else None,
            "dev_role_id": dev.role_id if dev else None,
            "dev_pw_hash": dev.password_hash[:10] + "..." if dev and dev.password_hash else None,
            "mgr_exists": bool(mgr),
            "mgr_status": mgr.status if mgr else None,
            "mgr_role_id": mgr.role_id if mgr else None,
            "mgr_pw_hash": mgr.password_hash[:10] + "..." if mgr and mgr.password_hash else None,
        }
    except Exception as e:
        import traceback
        report["data_error"] = {
            "error": str(e),
            "traceback": traceback.format_exc().splitlines()
        }
        
    db.close()
    return report



@app.get("/health/db")
@app.get("/api/health/db")
def health_check_db():
    db = SessionLocal()
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "database": "connected"
        }
    except Exception as e:
        return JSONResponse(status_code=503, content={
            "status": "error",
            "database": "disconnected",
            "detail": str(e) if settings.ENVIRONMENT == "development" else "Database unavailable"
        })
    finally:
        db.close()


def run_seed_demo_data(db: Session):
    """Seeds default roles, profiles, projects, sprints, and tasks if they don't exist."""
    from app.models.domain import Role, Profile, Project, ProjectMember, Sprint, Task, Notification
    
    # 1. Seed Roles
    roles_data = [
        ("admin", "Full system governance and global analytics"),
        ("manager", "Project management, sprint control, task assignment"),
        ("developer", "Developer task execution and progress tracking")
    ]
    role_map = {}
    for r_name, r_desc in roles_data:
        role = db.query(Role).filter(Role.name == r_name).first()
        if not role:
            role = Role(name=r_name, description=r_desc)
            db.add(role)
            db.flush()
        role_map[r_name] = role
    
    db.commit()
    
    # 2. Seed Admin User
    admin_user = db.query(Profile).filter(Profile.email == "admin@sprintiq.ai").first()
    if not admin_user:
        admin_user = Profile(
            email="admin@sprintiq.ai",
            password_hash=get_password_hash("Admin@123"),
            full_name="Alex Vance (Admin)",
            phone="+1 (555) 019-2834",
            role_id=role_map["admin"].id,
            status="ACTIVE",
            bio="Chief Technology Officer & Lead System Administrator"
        )
        db.add(admin_user)
        db.flush()
    
    # 3. Seed Manager User
    manager_user = db.query(Profile).filter(Profile.email == "manager@sprintiq.ai").first()
    if not manager_user:
        manager_user = Profile(
            email="manager@sprintiq.ai",
            password_hash=get_password_hash("Manager@123"),
            full_name="Sarah Jenkins (PM)",
            phone="+1 (555) 18-9921",
            role_id=role_map["manager"].id,
            status="ACTIVE",
            bio="Senior Engineering Project Manager"
        )
        db.add(manager_user)
        db.flush()
    
    # 4. Seed Developer User
    dev_user = db.query(Profile).filter(Profile.email == "dev@sprintiq.ai").first()
    if not dev_user:
        dev_user = Profile(
            email="dev@sprintiq.ai",
            password_hash=get_password_hash("Dev@123"),
            full_name="Michael Chen (Dev)",
            phone="+1 (555) 17-3344",
            role_id=role_map["developer"].id,
            status="ACTIVE",
            bio="Senior Full Stack Software Engineer"
        )
        db.add(dev_user)
        db.flush()
    
    # 5. Seed 5 Additional Project Managers
    manager_seeds = [
        ("Sarah Jenkins", "sarah@sprintiq.ai", "+1 (555) 100-0001"),
        ("David Anderson", "david@sprintiq.ai", "+1 (555) 100-0002"),
        ("Priya Sharma", "priya@sprintiq.ai", "+1 (555) 100-0003"),
        ("Daniel Wilson", "daniel@sprintiq.ai", "+1 (555) 100-0004"),
        ("Emily Carter", "emily@sprintiq.ai", "+1 (555) 100-0005"),
    ]
    for mgr_name, mgr_email, mgr_phone in manager_seeds:
        existing_mgr = db.query(Profile).filter(Profile.email == mgr_email).first()
        if existing_mgr:
            continue
        db.add(Profile(
            email=mgr_email,
            password_hash=get_password_hash("Manager@123"),
            full_name=mgr_name,
            phone=mgr_phone,
            role_id=role_map["manager"].id,
            status="ACTIVE",
            bio="Project Manager"
        ))
        db.flush()
    
    # 6. Seed 15 Additional Developers
    developer_seeds = [
        ("Michael Chen", "michael@sprintiq.ai", "+1 (555) 200-0001"),
        ("Arjun Kumar", "arjun@sprintiq.ai", "+1 (555) 200-0002"),
        ("Rahul Mehta", "rahul@sprintiq.ai", "+1 (555) 200-0003"),
        ("Ananya Patel", "ananya@sprintiq.ai", "+1 (555) 200-0004"),
        ("Kevin Thomas", "kevin@sprintiq.ai", "+1 (555) 200-0005"),
        ("Riya Sharma", "riya@sprintiq.ai", "+1 (555) 200-0006"),
        ("Daniel Kim", "daniel.kim@sprintiq.ai", "+1 (555) 200-0007"),
        ("Vikram Singh", "vikram@sprintiq.ai", "+1 (555) 200-0008"),
        ("Sneha Reddy", "sneha@sprintiq.ai", "+1 (555) 200-0009"),
        ("Alex Martin", "alex@sprintiq.ai", "+1 (555) 200-0010"),
        ("Karthik Raj", "karthik@sprintiq.ai", "+1 (555) 200-0011"),
        ("Neha Gupta", "neha@sprintiq.ai", "+1 (555) 200-0012"),
        ("Jason Lee", "jason@sprintiq.ai", "+1 (555) 200-0013"),
        ("Divya Nair", "divya@sprintiq.ai", "+1 (555) 200-0014"),
        ("Aditya Rao", "aditya@sprintiq.ai", "+1 (555) 200-0015"),
    ]
    for dev_name, dev_email, dev_phone in developer_seeds:
        existing_dev = db.query(Profile).filter(Profile.email == dev_email).first()
        if existing_dev:
            continue
        db.add(Profile(
            email=dev_email,
            password_hash=get_password_hash("Dev@123"),
            full_name=dev_name,
            phone=dev_phone,
            role_id=role_map["developer"].id,
            status="ACTIVE",
            bio="Software Engineer"
        ))
        db.flush()
    
    db.commit()
    
    # 7. Seed Sample Project
    project = db.query(Project).filter(Project.key == "SIQ").first()
    if not project:
        project = Project(
            name="SprintIQ AI SaaS Platform",
            key="SIQ",
            description="Enterprise Project Intelligence Dashboard with Gemini Risk AI",
            status="ACTIVE",
            start_date=date.today() - timedelta(days=14),
            target_date=date.today() + timedelta(days=45),
            created_by=admin_user.id,
            manager_id=manager_user.id,
            ai_risk_score=18.5,
            health_status="HEALTHY"
        )
        db.add(project)
        db.flush()
        
        # Add Manager & Developer memberships
        db.add(ProjectMember(project_id=project.id, user_id=manager_user.id, role_in_project="MANAGER", team="Management"))
        db.add(ProjectMember(project_id=project.id, user_id=dev_user.id, role_in_project="DEVELOPER", team="Frontend Core"))
        
        # Seed Sprint
        sprint = Sprint(
            project_id=project.id,
            name="Sprint 1 - Core Intelligence",
            goal="Deliver AI Risk Prediction Engine and Role Portals",
            start_date=date.today() - timedelta(days=7),
            end_date=date.today() + timedelta(days=7),
            status="ACTIVE"
        )
        db.add(sprint)
        db.flush()
        
        # Seed Tasks
        t1 = Task(
            title="Integrate Google Gemini 1.5 API for Sprint Risk Scoring",
            description="Connect FastAPI backend service to Gemini API REST endpoints with intelligent fallback mechanism.",
            priority="HIGH",
            status="IN_PROGRESS",
            progress=65,
            sprint_id=sprint.id,
            project_id=project.id,
            estimated_hours=16.0,
            story_points=8,
            start_date=date.today() - timedelta(days=3),
            due_date=date.today() + timedelta(days=2),
            assigned_developer_id=dev_user.id,
            created_by=manager_user.id
        )
        t2 = Task(
            title="Build Role-Based Theme Engine for Admin, PM, and Dev",
            description="Create glassmorphism Tailwind styling with Dark Blue (Admin), Emerald (PM), and Purple (Dev) palettes.",
            priority="MEDIUM",
            status="REVIEW_PENDING",
            progress=100,
            sprint_id=sprint.id,
            project_id=project.id,
            estimated_hours=12.0,
            story_points=5,
            start_date=date.today() - timedelta(days=5),
            due_date=date.today() - timedelta(days=1),
            assigned_developer_id=dev_user.id,
            created_by=manager_user.id,
            submitted_at=datetime.utcnow()
        )
        t3 = Task(
            title="Implement PDF, CSV, and Excel Report Exporter",
            description="Create ReportLab and OpenPyXL exporters for executive sprint and developer performance metrics.",
            priority="MEDIUM",
            status="REVIEW_PENDING",
            progress=100,
            sprint_id=sprint.id,
            project_id=project.id,
            estimated_hours=10.0,
            story_points=5,
            start_date=date.today() - timedelta(days=4),
            due_date=date.today() + timedelta(days=1),
            assigned_developer_id=dev_user.id,
            created_by=manager_user.id,
            submitted_at=datetime.utcnow()
        )
        db.add_all([t1, t2, t3])
        
        # Seed Notification
        db.add(Notification(
            user_id=dev_user.id,
            title="Welcome to SprintIQ AI!",
            message="You have 3 assigned tasks in Sprint 1 - Core Intelligence.",
            type="INFO",
            link="/developer/tasks"
        ))
        
        db.commit()


@app.on_event("startup")
def on_startup():
    """Database initialization following proper order:
    1. Database connection check
    2. Schema compatibility audit (PostgreSQL type corrections)
    3. Table creation via SQL Alchemy
    4. Schema migrations/additions (GitHub & Task Review Columns)
    5. Seed default system settings
    6. Seed demo users & data
    """
    print("[Database] Startup database initialization started")
    
    # 1. Connection check
    print("[Database] Testing database connection...")
    db = SessionLocal()
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        print("[Database] Connection successful")
    except Exception as e:
        print(f"[Database Error] Database connection failed: {e}")
        db.close()
        raise e
        
    try:
        # 2. Schema compatibility audit (for PostgreSQL)
        print("[Database] Auditing PostgreSQL schema types...")
        ensure_postgresql_compatibilities(db)

        # 3. Tables alignment with custom additions
        print("[Database] Ensuring github schema additions...")
        from app.core.database import ensure_github_schema
        ensure_github_schema(db)
        # Note: ensure_task_review_schema is intentionally disabled to strictly prevent
        # automatic production data modification (data mutation backfills) on startup.
        
        # 4. Table creation
        print("[Database] Creating missing tables via SQLAlchemy...")
        Base.metadata.create_all(bind=engine)
        print("[Database] Table mapping updated successfully")
        
        # 5. Run migrations (Alembic)
        print("[Database] Running Alembic migrations...")
        import alembic.config
        import alembic.command
        alembic_cfg = alembic.config.Config("alembic.ini")
        alembic.command.upgrade(alembic_cfg, "head")
        print("[Database] Alembic migrations completed successfully")
        
        # 5. Seed default system settings
        print("[Database] Seeding default system settings...")
        from app.models.domain import SystemSetting
        default_settings = [
            ("gemini_enabled", "true", "boolean", "Gemini AI"),
            ("gemini_model", "gemini-1.5-flash", "string", "Gemini AI"),
            ("gemini_temperature", "0.7", "number", "Gemini AI"),
            ("gemini_max_tokens", "2048", "number", "Gemini AI"),
            ("ai_response_mode", "concise", "string", "Gemini AI"),
            ("ai_project_context", "all_accessible", "string", "Gemini AI"),
            ("ai_fallback_enabled", "true", "boolean", "Gemini AI"),
            ("strict_role_verification", "true", "boolean", "Security & Authorization"),
            ("jwt_token_lifetime", "480", "number", "Security & Authorization"),
            ("password_hashing_rounds", "12", "number", "Security & Authorization"),
            ("session_timeout", "120", "number", "Security & Authorization"),
            ("max_login_attempts", "5", "number", "Security & Authorization"),
            ("account_lockout_duration", "15", "number", "Security & Authorization"),
            ("captcha_enabled", "false", "boolean", "Security & Authorization"),
            ("google_login_enabled", "true", "boolean", "Security & Authorization"),
            ("allow_admin_create_managers", "true", "boolean", "User Account Policies"),
            ("allow_managers_create_developers", "true", "boolean", "User Account Policies"),
            ("require_email_verification", "false", "boolean", "User Account Policies"),
            ("allow_account_disable", "true", "boolean", "User Account Policies"),
            ("default_account_status", "ACTIVE", "string", "User Account Policies"),
            ("min_password_length", "8", "number", "User Account Policies"),
            ("allow_project_deletion", "false", "boolean", "Project Settings"),
            ("require_project_manager", "true", "boolean", "Project Settings"),
            ("allow_mult_devs_task", "true", "boolean", "Project Settings"),
            ("require_task_verification", "true", "boolean", "Project Settings"),
            ("auto_archive_verified", "false", "boolean", "Project Settings"),
            ("allow_project_creation", "true", "boolean", "Project Settings"),
            ("ai_copilot_enabled", "true", "boolean", "AI Copilot"),
            ("github_integration_enabled", "true", "boolean", "GitHub Settings"),
            ("repo_sync_enabled", "true", "boolean", "GitHub Settings"),
            ("sync_interval", "60", "number", "GitHub Settings"),
            ("webhook_enabled", "true", "boolean", "GitHub Settings"),
            ("notify_in_app", "true", "boolean", "Notification Settings"),
            ("notify_task_assign", "true", "boolean", "Notification Settings"),
            ("notify_project_assign", "true", "boolean", "Notification Settings"),
            ("notify_verification", "true", "boolean", "Notification Settings"),
            ("notify_github", "false", "boolean", "Notification Settings"),
            ("notify_risk", "true", "boolean", "Notification Settings"),
        ]
        
        for skey, sval, stype, scat in default_settings:
            existing_sett = db.query(SystemSetting).filter(SystemSetting.setting_key == skey).first()
            if not existing_sett:
                db.add(SystemSetting(
                    setting_key=skey,
                    setting_value=sval,
                    setting_type=stype,
                    category=scat,
                    description=skey.replace("_", " ").title()
                ))
        db.commit()
        print("[Database] System settings seeded successfully")
        
        # 6. Seed demo users & data
        print("[Database] Seeding roles, demo users and entities...")
        run_seed_demo_data(db)
        print("[Database] Seeding complete")
        
        # 7. Verification check
        print("[Database] Verifying all required tables exist...")
        inspector = inspect(engine)
        required_tables = ["projects", "tasks", "system_settings", "ml_predictions"]
        existing_tables = set(inspector.get_table_names())
        for table in required_tables:
            if table not in existing_tables:
                raise ValueError(f"Table '{table}' does not exist after backend initialization!")
        print("[Database] All required database tables verified successfully")

    except Exception as e:
        db.rollback()
        print(f"[Database Error] Database schema initialization failed: {e}")
        import traceback
        traceback.print_exc()
        raise e
    finally:
        db.close()
        print("[Database] Startup database initialization completed successfully")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=(settings.ENVIRONMENT == "development"))
