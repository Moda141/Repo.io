from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MDM_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://mdm:mdm@postgres:5432/mdm"
    redis_url: str = "redis://redis:6379/0"
    jwt_secret: str = "dev-only-secret-change-me-in-production-0123456789"  # >= 32 bytes
    # Login Configuration defaults mirror OpenMetadata (3 attempts, 30s block, 3600s JWT)
    max_login_fail_attempts: int = 3
    access_block_time_seconds: int = 30
    jwt_expiry_seconds: int = 3600
    admin_email: str = "admin@example.com"
    admin_password: str = "admin123"  # development only; override via MDM_ADMIN_PASSWORD
    demo_seed: bool = True
    cors_origins: str = "*"


settings = Settings()
