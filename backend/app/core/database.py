from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

db_url = settings.DATABASE_URL
if not db_url:
    import warnings
    warnings.warn("DATABASE_URL is not set. The backend will start but database operations will fail.")
    db_url = "sqlite:///./sprintiq_fallback.db"

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
elif db_url.startswith("mysql://"):
    db_url = db_url.replace("mysql://", "mysql+pymysql://", 1)

# Dynamic fallback check for PostgreSQL in development mode if connection fails (e.g. offline or incorrect credentials)
if db_url.startswith("postgresql"):
    try:
        # Test connecting with a short 3-second timeout
        test_engine = create_engine(db_url, connect_args={"connect_timeout": 3})
        with test_engine.connect() as conn:
            pass
        test_engine.dispose()
    except Exception as e:
        print(f"[Database Warning] PostgreSQL connection failed: {e}")
        if settings.ENVIRONMENT != "production":
            print("[Database System] Development environment detected. Falling back to local SQLite 'sprintiq.db'.")
            db_url = "sqlite:///./sprintiq.db"

connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}

engine_args = {
    "connect_args": connect_args,
    "echo": False
}
if not db_url.startswith("sqlite"):
    engine_args.update({
        "pool_pre_ping": True,
        "pool_recycle": 3600,
        "pool_size": 10,
        "max_overflow": 20
    })

engine = create_engine(db_url, **engine_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_postgresql_compatibilities(db):
    """Audits and alters column types of project_id, profile references, and role references in PostgreSQL
    from VARCHAR to UUID if they have mismatched types, ensuring DDL constraints can be satisfied.
    This runs BEFORE Base.metadata.create_all."""
    if "postgresql" not in engine.dialect.name:
        return
        
    print("[Database Log] Auditing PostgreSQL schema compatibility...")
    columns_to_audit = [
        "project_id", "role_id", "user_id", "developer_id", 
        "created_by", "manager_id", "assigned_developer_id", "reviewed_by", 
        "uploaded_by", "updated_by", "author_id", "generated_by", 
        "added_by", "task_id", "sprint_id", "repository_id", 
        "retrospective_id", "pr_id", "assignee_id", "simulation_id", "release_readiness_id"
    ]
    
    try:
        for col in columns_to_audit:
            query = text(
                "SELECT table_name, data_type FROM information_schema.columns "
                "WHERE column_name = :col_name AND data_type != 'uuid' "
                "AND table_schema = 'public'"
            )
            rows = db.execute(query, {"col_name": col}).all()
            for row in rows:
                table_name = row[0]
                current_type = row[1]
                print(f"[Database Log] Column '{col}' in table '{table_name}' has type '{current_type}'. Changing to UUID.")
                
                # 1. Update empty string values to NULL before casting
                try:
                    db.execute(text(f"UPDATE {table_name} SET {col} = NULL WHERE {col} = ''"))
                except Exception:
                    pass
                
                # 2. Drop foreign key constraint if it exists (standard convention)
                db.execute(text(f"ALTER TABLE {table_name} DROP CONSTRAINT IF EXISTS {table_name}_{col}_fkey"))
                
                # 3. Alter column type cast to uuid
                db.execute(text(f"ALTER TABLE {table_name} ALTER COLUMN {col} TYPE UUID USING {col}::uuid"))
        db.commit()
        print("[Database Log] PostgreSQL schema compatibility audit complete.")
    except Exception as e:
        db.rollback()
        print(f"[Database Log] PostgreSQL schema audit exception: {e}")
        raise e


def ensure_task_review_schema(db):
    """Adds task-review lifecycle columns and backfills legacy COMPLETED tasks so
    they enter the manager review flow (developer submits -> manager approves)."""
    inspector = inspect(engine)
    is_postgres = "postgresql" in engine.dialect.name
    uuid_type = "UUID" if is_postgres else "VARCHAR(36)"
    
    additions = {
        "tasks": [
            ("submitted_at", "TIMESTAMP"),
            ("reviewed_by", uuid_type),
            ("reviewed_at", "TIMESTAMP"),
            ("review_comment", "TEXT"),
        ]
    }
    try:
        existing_tables = set(inspector.get_table_names())
        if "tasks" in existing_tables:
            existing_cols = {c["name"] for c in inspector.get_columns("tasks")}
            for col_name, col_type in additions["tasks"]:
                if col_name in existing_cols:
                    continue
                db.execute(text(f"ALTER TABLE tasks ADD COLUMN {col_name} {col_type}"))
            db.commit()

            # Backfill 1: legacy COMPLETED (previously finished without review) ->
            # REVIEW_PENDING so they enter the manager approval flow.
            db.execute(
                text(
                    "UPDATE tasks SET status = 'REVIEW_PENDING', progress = 100, "
                    "submitted_at = COALESCE(submitted_at, updated_at, CURRENT_TIMESTAMP) "
                    "WHERE status = 'COMPLETED' AND progress >= 100 "
                    "AND reviewed_at IS NULL"
                )
            )
            db.commit()
            # Backfill 2: existing REVIEW_PENDING rows missing a submit timestamp.
            db.execute(
                text(
                    "UPDATE tasks SET submitted_at = COALESCE(submitted_at, updated_at, CURRENT_TIMESTAMP) "
                    "WHERE status = 'REVIEW_PENDING' AND submitted_at IS NULL"
                )
            )
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Task Review Schema Migration Exception]: {e}")
        raise e


def ensure_github_schema(db):
    """Adds columns to pre-existing GitHub tables that predate schema migrations."""
    inspector = inspect(engine)
    is_postgres = "postgresql" in engine.dialect.name
    uuid_type = "UUID" if is_postgres else "VARCHAR(36)"
    
    additions = {
        "github_repositories": [
            ("github_repository_id", "VARCHAR(100)"),
            ("full_name", "VARCHAR(255)"),
            ("clone_url", "TEXT"),
            ("repository_url", "TEXT"),
            ("normalized_url", "TEXT"),
            ("created_at", "TIMESTAMP"),
            ("updated_at", "TIMESTAMP"),
            ("description", "TEXT"),
            ("visibility", "VARCHAR(50) DEFAULT 'private'"),
            ("repo_type", "VARCHAR(50) DEFAULT 'source'"),
            ("sync_status", "VARCHAR(50) DEFAULT 'NOT_CONNECTED'"),
            ("last_sync_error", "TEXT"),
            ("added_by", uuid_type),
        ]
    }
    try:
        existing_tables = set(inspector.get_table_names())
        for table, cols in additions.items():
            if table not in existing_tables:
                continue
            existing_cols = {c["name"] for c in inspector.get_columns(table)}
            for col_name, col_type in cols:
                if col_name in existing_cols:
                    continue
                db.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[GitHub Schema Migration Exception]: {e}")
        raise e

