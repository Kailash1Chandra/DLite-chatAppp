from __future__ import annotations

from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse

from src.settings import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, require_supabase
from src.supabase import postgrest_headers, safe_json_list, validate_access_token

router = APIRouter()


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return authorization.split(" ", 1)[1].strip() or None


async def _require_user(authorization: Optional[str]) -> tuple[Optional[dict], Optional[str]]:
    token = _extract_bearer_token(authorization)
    if not token:
        return None, None
    user = await validate_access_token(token)
    return user, token


@router.get("/users/search")
async def search_users(username: str = "", exclude: str = "", authorization: Optional[str] = Header(default=None)):
    require_supabase()
    user, access_token = await _require_user(authorization)
    if not user or not access_token:
        return JSONResponse(status_code=401, content={"success": False, "message": "Invalid token"})

    term = (username or "").strip()
    if not term:
        return {"success": True, "users": []}

    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/users"
    params: Dict[str, str] = {
        "select": "id,username,avatar_url",
        "username": f"ilike.*{term}*",
        "order": "username.asc",
        "limit": "15",
    }
    if exclude:
        params["id"] = f"neq.{exclude}"

    # Use anon key + user access token so RLS is enforced.
    headers = {"apikey": postgrest_headers(use_service_role=False).get("apikey", ""), "authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(url, headers=headers, params=params)
    if r.status_code >= 400:
        return JSONResponse(status_code=503, content={"success": False, "message": "User search is unavailable"})
    return {"success": True, "users": await safe_json_list(r)}


@router.get("/groups/my")
async def list_my_groups(authorization: Optional[str] = Header(default=None)):
    require_supabase()
    user, access_token = await _require_user(authorization)
    if not user or not access_token:
        return JSONResponse(status_code=401, content={"success": False, "message": "Invalid token"})

    uid = str(user.get("id") or "").strip()
    if not uid:
        return JSONResponse(status_code=401, content={"success": False, "message": "Invalid token"})

    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/group_members"
    params = {
        "select": "chat_id,chats!inner(id,name,type),role",
        "user_id": f"eq.{uid}",
        "chats.type": "eq.group",
        "limit": "100",
    }
    headers = {"apikey": postgrest_headers(use_service_role=False).get("apikey", ""), "authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url, headers=headers, params=params)
    if r.status_code >= 400:
        return JSONResponse(status_code=503, content={"success": False, "message": "Groups are unavailable"})

    rows = await safe_json_list(r)
    groups = []
    for row in rows:
        chat = (row or {}).get("chats") or {}
        if not chat:
            continue
        groups.append({"id": chat.get("id"), "name": chat.get("name") or chat.get("id"), "role": row.get("role")})
    return {"success": True, "groups": groups}


@router.post("/groups/ensure")
async def ensure_group(req: Request, authorization: Optional[str] = Header(default=None)):
    require_supabase()
    user, access_token = await _require_user(authorization)
    if not user or not access_token:
        return JSONResponse(status_code=401, content={"success": False, "message": "Invalid token"})

    uid = str(user.get("id") or "").strip()
    if not uid:
        return JSONResponse(status_code=401, content={"success": False, "message": "Invalid token"})

    body = await req.json()
    group_key = str((body or {}).get("groupKey") or (body or {}).get("groupId") or "").strip()
    if not group_key:
        return JSONResponse(status_code=400, content={"success": False, "message": "groupKey is required"})

    if not SUPABASE_SERVICE_ROLE_KEY:
        return JSONResponse(status_code=503, content={"success": False, "message": "SUPABASE_SERVICE_ROLE_KEY is required for group writes"})

    chats_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/chats"
    gm_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/group_members"

    async with httpx.AsyncClient(timeout=20.0) as client:
        # Find existing group chat
        r_find = await client.get(
            chats_url,
            headers=postgrest_headers(use_service_role=True),
            params={"select": "id,name,type", "type": "eq.group", "name": f"eq.{group_key}", "limit": "1"},
        )
        if r_find.status_code >= 400:
            return JSONResponse(status_code=503, content={"success": False, "message": "Chat storage is unavailable"})
        items = await safe_json_list(r_find)
        chat = items[0] if items else None

        if not chat:
            r_create = await client.post(
                chats_url,
                headers=postgrest_headers(use_service_role=True, extra={"prefer": "return=representation"}),
                json={"type": "group", "name": group_key, "created_by": uid},
            )
            if r_create.status_code >= 400:
                return JSONResponse(status_code=503, content={"success": False, "message": "Could not create group"})
            created = await safe_json_list(r_create)
            chat = created[0] if created else None

        chat_id = (chat or {}).get("id")
        if not chat_id:
            return JSONResponse(status_code=503, content={"success": False, "message": "Could not open group"})

        r_member = await client.post(
            gm_url,
            headers=postgrest_headers(use_service_role=True, extra={"prefer": "resolution=merge-duplicates,return=minimal"}),
            json={"chat_id": chat_id, "user_id": uid, "role": "owner"},
        )
        if r_member.status_code not in (201, 204, 409):
            return JSONResponse(status_code=503, content={"success": False, "message": "Could not join group"})

    return {"success": True, "group": {"id": chat_id, "name": (chat or {}).get("name") or group_key}}


@router.get("/messages/{chat_id}")
async def get_messages(chat_id: str, authorization: Optional[str] = Header(default=None)):
    require_supabase()
    user, access_token = await _require_user(authorization)
    if not user or not access_token:
        return JSONResponse(status_code=401, content={"success": False, "message": "Invalid token"})

    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/messages"
    params = {
        "select": "id,chat_id,sender_id,content,type,created_at",
        "chat_id": f"eq.{chat_id}",
        "order": "created_at.asc",
        "limit": "200",
    }
    headers = {"apikey": postgrest_headers(use_service_role=False).get("apikey", ""), "authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url, headers=headers, params=params)
    if r.status_code >= 400:
        return JSONResponse(status_code=503, content={"success": False, "message": "Chat storage is unavailable"})
    return {"success": True, "chatId": chat_id, "messages": await safe_json_list(r)}

