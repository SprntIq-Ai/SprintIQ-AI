import os
from typing import List, Union
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "SprintIQ AI"
    ENVIRONMENT: str = "development"

    SECRET_KEY: str = "fallback_secret_key_sprint_iq_ai_production_backup_key_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    DATABASE_URL: str = ""

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"

    # Google OAuth (server-side only; never expose GOOGLE_CLIENT_SECRET to the frontend)
    # FRONTEND_URL is the public origin of the SPA. GOOGLE_REDIRECT_URI overrides the
    # default derived value; otherwise the callback URI is {FRONTEND_URL}/auth/google/callback.
    FRONTEND_URL: str = "http://localhost:5173"
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:5173/auth/google/callback"

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
