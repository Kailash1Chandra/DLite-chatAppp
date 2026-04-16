from __future__ import annotations

import os


def _env(name: str, default: str | None = None) -> str | None:
    v = os.getenv(name)
    if v is None:
        return default
    v = v.strip()
    return v if v else default


SUPABASE_URL = _env("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = _env("SUPABASE_SERVICE_ROLE_KEY")

BACKUP_INTERVAL_SECONDS = int(_env("BACKUP_INTERVAL_SECONDS", "300") or "300")
BACKUP_BATCH_SIZE = int(_env("BACKUP_BATCH_SIZE", "500") or "500")
BACKUP_OUTPUT_DIR = _env("BACKUP_OUTPUT_DIR", "/data") or "/data"
BACKUP_STATE_FILE = _env("BACKUP_STATE_FILE", "/data/state.json") or "/data/state.json"

# Render-style deployment: enable HTTP endpoints + background loop in same process
WORKER_HTTP_ENABLED = (_env("WORKER_HTTP_ENABLED", "1") or "1").strip() in ("1", "true", "yes", "on")


def require_supabase() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for worker-service")

