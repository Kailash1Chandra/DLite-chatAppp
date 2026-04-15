from __future__ import annotations

from src.utils.env import env, looks_placeholder

PORT = int(env("PORT", "4000") or "4000")

SUPABASE_URL = env("SUPABASE_URL")
SUPABASE_ANON_KEY = env("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY")

AUTH_JWT_SECRET = env("AUTH_JWT_SECRET") or env("JWT_SECRET") or "dev-only-secret-change-me"
AUTH_MODE = (env("AUTH_MODE") or "auto").strip().lower()


def is_supabase_configured() -> bool:
    # AUTH_MODE:
    # - "auto" (default): use Supabase if configured, otherwise local auth fallback
    # - "local": force local auth (bypass Supabase) — useful when Supabase rate limits block signups
    if AUTH_MODE == "local":
        return False
    return not looks_placeholder(SUPABASE_URL) and not looks_placeholder(SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY)

