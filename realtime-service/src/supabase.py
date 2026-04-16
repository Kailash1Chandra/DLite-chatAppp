from __future__ import annotations

from typing import Any, Dict, Optional

import httpx

from src.settings import SUPABASE_ANON_KEY, SUPABASE_URL, require_supabase


def gotrue_headers(extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    require_supabase()
    headers: Dict[str, str] = {"apikey": SUPABASE_ANON_KEY or "", "content-type": "application/json"}
    if extra:
        headers.update(extra)
    return headers


async def safe_json_dict(r: httpx.Response) -> Dict[str, Any]:
    try:
        parsed = r.json()
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


async def validate_access_token(token: str) -> Optional[Dict[str, Any]]:
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

