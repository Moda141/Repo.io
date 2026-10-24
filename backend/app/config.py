from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MDM_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://mdm:mdm@postgres:5432/mdm"
    redis_url: str = "redis://redis:6379/0"
    jwt_secret: str = "dev-only-secret-change-me-in-production-0123456789"  # >= 32 bytes
    # Encrypts connection secrets (passwords) stored for services. Any string; hashed to a Fernet key.
    secret_key: str = "dev-only-secret-key-change-me"
    # Login Configuration defaults mirror OpenMetadata (3 attempts, 30s block, 3600s JWT)
    max_login_fail_attempts: int = 3
    access_block_time_seconds: int = 30
    jwt_expiry_seconds: int = 3600
    admin_email: str = "admin@example.com"
    admin_password: str = "admin123"  # development only; override via MDM_ADMIN_PASSWORD
    demo_seed: bool = True
    cors_origins: str = "*"

    # --- ingestion (M1) ---
    # "kafka": producers publish to Kafka and the ingest-writer service consumes.
    # "inline": same envelope, applied in-process (small deployments, tests, no broker needed).
    ingest_bus: str = "inline"
    kafka_bootstrap: str = "kafka:9092"
    kafka_group_id: str = "ingest-writer"
    import_dir: str = "/data/imports"  # root folder for the CSV connector (and the dev-only SQLite connector)
    allow_sqlite_connector: bool = False  # SQLite exposes server files; keep off outside dev/tests
    allow_insecure_http: bool = False  # OData over plain http (dev only)
    # Safety valve for delete detection on full snapshots: never mark more than this share of active
    # records deleted in one run (guards against a truncated extract). Only applies from min_delete_guard rows.
    max_delete_ratio: float = 0.5
    min_delete_guard: int = 20


settings = Settings()
