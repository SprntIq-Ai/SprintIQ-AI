import os
from typing import List, Union
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "SprintIQ AI"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "sprintiq-ai-super-secret-jwt-key-enterprise-grade-2026"
    JWT_SECRET_KEY: str = "sprintiq-ai-super-secret-jwt-key-enterprise-grade-2026"
    JWT_REFRESH_SECRET: str = "sprintiq-ai-super-secret-refresh-key-enterprise-grade-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    DATABASE_URL: str = "sqlite:///./sprintiq.db"
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 3306
    MYSQL_DATABASE: str = "sprintiq_db"
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = ""

    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = "sprintiq-attachments"

    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

    # Google OAuth (server-side only; never expose GOOGLE_CLIENT_SECRET to the frontend)
    # FRONTEND_URL is the public origin of the SPA. GOOGLE_REDIRECT_URI overrides the
    # default derived value; otherwise the callback URI is {FRONTEND_URL}/auth/google/callback.
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5173/auth/google/callback")

    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = "http://localhost:5173/github/callback"

    # Server-side GitHub integration (GitHub App) — used by the backend to perform
    # real GitHub operations. Never exposed to the frontend.
    GITHUB_APP_ID: str = ""
    GITHUB_APP_PRIVATE_KEY: str = ""  # PEM contents, base64-encoded PEM, or path to a .pem file
    GITHUB_APP_CLIENT_ID: str = ""
    GITHUB_APP_CLIENT_SECRET: str = ""
    GITHUB_APP_INSTALLATION_ID: str = ""
    # Alternative server-side credential: a fine-grained or classic personal access token.
    GITHUB_TOKEN: str = ""

    CORS_ORIGINS: Union[List[str], str] = ["*"]

    @field_validator("CORS_ORIGINS", mode="before")
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                return json.loads(v)
            return [i.strip() for i in v.split(",")]
        return v

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

