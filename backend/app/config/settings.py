"""
Previa App — Application Settings
Loads configuration from environment variables using Pydantic Settings.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    # Application
    app_name: str = "Previa App"
    app_version: str = "1.0.0"
    log_level: str = "INFO"
    environment: str = "development"  # development | staging | production

    # LLM Provider (Required — set ANTHROPIC_API_KEY in .env or environment)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/previa.db"
  
    @property
    def sqlalchemy_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    # Demo Account (only used when ENVIRONMENT=development)
    demo_user_email: str = "user@example.com"
    demo_user_password: str = "1234"
    demo_user_role: str = "analyst"

    # CORS
    cors_allowed_origins: str = "http://localhost:3000,http://localhost:3001"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",")]

    # Third-Party APIs (Optional)
    reachcore_api_key: str = ""
    captcha_api_key: str = ""
    news_api_key: str = ""

    # Stripe (Optional — required for paid plans)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_basic_price_id: str = ""
    stripe_premium_price_id: str = ""
    stripe_company_price_id: str = ""

    # Email Notifications (Optional)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    alert_email_to: str = ""

    # JWT Authentication
    jwt_secret_key: str = "CHANGE-ME-generate-with-python-c-import-secrets-secrets-token-urlsafe-64"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 480

    # Sentry (Optional — production error tracking)
    sentry_dsn: str = ""

    # Application Settings
    alert_threshold_critical: int = 80
    alert_threshold_high: int = 60
    data_staleness_warning_days: int = 7
    sat_rate_limit_seconds: float = 1.5
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )


# Global settings instance
settings = Settings()
