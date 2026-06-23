import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from app.config import DATABASE_URL
from app.models import Base, AppSettings, Company, TelegramSettings, SocialAccount

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate_db()
    _seed_defaults()
    _apply_env_credentials()


def _migrate_db() -> None:
    """Add any new columns that don't exist yet (SQLite doesn't support IF NOT EXISTS on ALTER TABLE)."""
    new_cols = [
        ("bedrock_bearer_enc",  "TEXT DEFAULT ''"),
        ("bedrock_region",      "TEXT DEFAULT 'us-east-1'"),
        ("bedrock_model_id",    "TEXT DEFAULT 'amazon.nova-canvas-v1:0'"),
        ("bedrock_enabled",     "INTEGER DEFAULT 0"),
    ]
    with engine.connect() as conn:
        for col, defn in new_cols:
            try:
                conn.execute(text(f"ALTER TABLE app_settings ADD COLUMN {col} {defn}"))
                conn.commit()
            except Exception:
                pass  # column already exists


def _seed_defaults() -> None:
    """Ensure singleton rows exist for settings / company / telegram."""
    with SessionLocal() as db:
        if not db.get(AppSettings, 1):
            db.add(AppSettings(id=1))
        if not db.get(Company, 1):
            db.add(Company(id=1))
        if not db.get(TelegramSettings, 1):
            db.add(TelegramSettings(id=1))
        for platform in ("facebook", "instagram", "x", "linkedin"):
            if not db.query(SocialAccount).filter_by(platform=platform).first():
                db.add(SocialAccount(platform=platform))
        db.commit()


def _apply_env_credentials() -> None:
    """If AWS_BEARER_TOKEN_BEDROCK env var is set, write it into the DB on first run."""
    from app.encryption import encrypt
    bedrock_token = os.getenv("AWS_BEARER_TOKEN_BEDROCK", "")
    if not bedrock_token:
        return
    with SessionLocal() as db:
        row = db.get(AppSettings, 1)
        if not row.bedrock_bearer_enc:
            row.bedrock_bearer_enc = encrypt(bedrock_token)
            row.bedrock_enabled = True
            db.commit()
            print("[startup] AWS_BEARER_TOKEN_BEDROCK loaded from environment.")
