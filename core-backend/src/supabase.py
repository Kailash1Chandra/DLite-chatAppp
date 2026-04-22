from __future__ import annotations

from typing import Any, Dict, Optional

import httpx

from src.settings import SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, require_supabase


def gotrue_headers(extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    require_supabase()
    headers: Dict[str, str] = {"apikey": SUPABASE_ANON_KEY or "", "content-type": "application/json"}
    if extra:
        headers.update(extra)
    return headers


def postgrest_headers(*, use_service_role: bool, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    require_supabase()
    key = (SUPABASE_SERVICE_ROLE_KEY if use_service_role else SUPABASE_ANON_KEY) or ""
    headers: Dict[str, str] = {"apikey": key, "authorization": f"Bearer {key}", "content-type": "application/json"}
    if extra:
        headers.update(extra)
    return headers


def postgrest_user_headers(access_token: str, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """
    PostgREST as the signed-in user: anon API key + user's JWT.
    RLS in Supabase applies; use when service_role is missing or misconfigured.
    """
    require_supabase()
    tok = (access_token or "").strip()
    if not tok:
        raise ValueError("access_token is required")
    headers: Dict[str, str] = {
        "apikey": SUPABASE_ANON_KEY or "",
        "authorization": f"Bearer {tok}",
        "content-type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


async def safe_json_dict(r: httpx.Response) -> Dict[str, Any]:
    try:
        parsed = r.json()
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


async def safe_json_list(r: httpx.Response) -> list:
    try:
        parsed = r.json()
    except Exception:
        return []
    return parsed if isinstance(parsed, list) else []


async def validate_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Validate a Supabase access token by calling GoTrue `/auth/v1/user`.
    Returns user dict if valid, else None.
    """
    require_supabase()
    if not token:
        return None
    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/user"
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(url, headers=gotrue_headers({"authorization": f"Bearer {token}"}))
    if r.status_code >= 400:
        return None
    data = await safe_json_dict(r)
    return data or None

