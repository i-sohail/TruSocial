import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent.parent
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = f"sqlite:///{BASE_DIR}/data.db"
MASTER_KEY_ENV = "MASTER_KEY"
ENV_FILE = BASE_DIR / ".env"

SENTINEL = "••••••••"
