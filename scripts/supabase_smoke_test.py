"""
Supabase smoke test for D-Lite schema + keys.

Runs direct HTTP checks against Supabase PostgREST/GoTrue to prove whether:
- required tables exist (public.chats, public.group_members, public.messages, public.users)
- service_role can read/write expected tables
- (optional) a user access token can read messages via RLS

Usage:
  python scripts/supabase_smoke_test.py

Environment variables:
  SUPABASE_URL                required
  SUPABASE_ANON_KEY           required
  SUPABASE_SERVICE_ROLE_KEY   required for write checks
  TEST_USER_ACCESS_TOKEN      optional (if provided, tests RLS read)
  TEST_CHAT_ID                optional (used with TEST_USER_ACCESS_TOKEN to read messages)
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


def _env(name: str, default: str | None = None) -> str | None:
    v = os.getenv(name)
    if v is None:
        return default
    v = v.strip()
    return v if v else default


def _req(method: str, url: str, headers: dict[str, str], body: dict | None = None) -> tuple[int, str]:
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers = {**headers, "content-type": "application/json"}
    r = urllib.request.Request(url, method=method, headers=headers, data=data)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return int(getattr(e, "code", 0) or 0), (e.read().decode("utf-8", errors="replace") if e.fp else str(e))
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"


def _print_check(name: str, ok: bool, detail: str = "") -> None:
    status = "OK" if ok else "FAIL"
    print(f"[{status}] {name}")
    if detail:
        print(detail.strip()[:800])
        print()


def main() -> int:
    supabase_url = _env("SUPABASE_URL")
    anon = _env("SUPABASE_ANON_KEY")
    service = _env("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not anon:
        _print_check("SUPABASE_URL/SUPABASE_ANON_KEY present", False, "Set SUPABASE_URL and SUPABASE_ANON_KEY")
        return 2
    _print_check("SUPABASE_URL/SUPABASE_ANON_KEY present", True)

    base = supabase_url.rstrip("/")
    rest = f"{base}/rest/v1"

    def service_headers() -> dict[str, str]:
        return {"apikey": service or "", "authorization": f"Bearer {service or ''}"}

    def anon_headers() -> dict[str, str]:
        return {"apikey": anon, "authorization": f"Bearer {anon}"}

    # 1) Table existence (service_role read)
    for table in ("users", "chats", "group_members", "messages"):
        url = f"{rest}/{table}?select=*&limit=1"
        code, text = _req("GET", url, headers=service_headers() if service else anon_headers())
        ok = code in (200, 206)
        _print_check(f"Table public.{table} exists (GET {table})", ok, f"HTTP {code}\n{text}")

    # 2) Write checks (require service_role)
    if not service:
        _print_check("SUPABASE_SERVICE_ROLE_KEY present", False, "Set SUPABASE_SERVICE_ROLE_KEY to run write checks.")
        return 3
    _print_check("SUPABASE_SERVICE_ROLE_KEY present", True)

    # Create a throwaway direct chat row (doesn't require any users, but created_by may fail if users missing)
    # We'll omit created_by to keep it schema-safe.
    create_chat_url = f"{rest}/chats"
    code, text = _req(
        "POST",
        create_chat_url,
        headers={**service_headers(), "prefer": "return=representation"},
        body={"type": "direct", "name": f"smoke:{os.getpid()}"},
    )
    ok = code in (200, 201)
    _print_check("Create chat (service_role POST /chats)", ok, f"HTTP {code}\n{text}")
    chat_id = ""
    if ok:
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
                chat_id = str(parsed[0].get("id") or "").strip()
        except Exception:
            pass

    # 3) Optional: user-token RLS read for messages
    user_token = _env("TEST_USER_ACCESS_TOKEN")
    test_chat = _env("TEST_CHAT_ID") or chat_id
    if user_token and test_chat:
        url = f"{rest}/messages?select=id,chat_id,sender_id,content,created_at&chat_id=eq.{urllib.parse.quote(test_chat)}&limit=5"
        code, text = _req("GET", url, headers={"apikey": anon, "authorization": f"Bearer {user_token}"})
        ok = code in (200, 206)
        _print_check("RLS: user token can read messages in chat", ok, f"HTTP {code}\n{text}")
    else:
        _print_check(
            "RLS: user token can read messages in chat (optional)",
            True,
            "Skipped. Set TEST_USER_ACCESS_TOKEN and TEST_CHAT_ID to run this check.",
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

