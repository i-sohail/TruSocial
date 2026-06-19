import os
from cryptography.fernet import Fernet
from app.config import BASE_DIR, ENV_FILE, SENTINEL


def _load_or_create_key() -> bytes:
    """Load master key from .env, generating and saving one if absent."""
    key = os.getenv("MASTER_KEY", "").strip()
    if not key:
        key = Fernet.generate_key().decode()
        with open(ENV_FILE, "a") as f:
            f.write(f"MASTER_KEY={key}\n")
        os.environ["MASTER_KEY"] = key
    return key.encode()


_fernet = Fernet(_load_or_create_key())


def encrypt(value: str) -> str:
    """Encrypt a plain-text string; returns '' for empty input."""
    if not value:
        return ""
    return _fernet.encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    """Decrypt a stored cipher string; returns '' for empty/missing input."""
    if not value:
        return ""
    try:
        return _fernet.decrypt(value.encode()).decode()
    except Exception:
        return ""


def mask(value: str) -> str:
    """Return SENTINEL if a value is stored, '' otherwise."""
    return SENTINEL if value else ""


def is_sentinel(value: str) -> bool:
    """True when the frontend sent back the masked placeholder unchanged."""
    return value == SENTINEL or (bool(value) and "•" in value)
