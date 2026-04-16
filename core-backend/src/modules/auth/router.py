from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional

import bcrypt
import httpx
import jwt
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from src.modules.auth.config import (
    AUTH_JWT_SECRET,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
    is_supabase_configured,
)
from src.utils.env import looks_placeholder

router = APIRouter()


@dataclass
class LocalUser:
    id: str
    email: str
    username: Optional[str]
    password_hash: str


_local_users_by_email: Dict[str, LocalUser] = {}
_local_users_by_username: Dict[str, LocalUser] = {}


def _hash_password(password: str) -> str:
    pw = password.encode("utf-8")
    hashed = bcrypt.hashpw(pw, bcrypt.gensalt(rounds=10))
    return hashed.decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def _issue_local_tokens(user: LocalUser) -> Dict[str, Any]:
    now = int(time.time())
    expires_in = 3600
    payload = {
        "sub": user.id,
        "email": user.email,
        "user_metadata": {"username": user.username},
        "iss": "d-lite-core-backend",
        "iat": now,
    }
    access_token = jwt.encode({**payload, "exp": now + expires_in}, AUTH_JWT_SECRET, algorithm="HS256")
    refresh_token = jwt.encode(
        {**payload, "typ": "refresh", "exp": now + 60 * 60 * 24 * 30},
        AUTH_JWT_SECRET,
        algorithm="HS256",
    )
    return {
        "session": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": expires_in,
            "token_type": "bearer",
        },
        "user": {
            "id": user.id,
            "email": user.email,
            "user_metadata": {"username": user.username},
        },
    }


def _format_auth_response(auth_data: Dict[str, Any]) -> Dict[str, Any]:
    data = auth_data or {}
    # Local auth stores tokens under `session`.
    session = data.get("session") or {}
    user = data.get("user")

    # Supabase GoTrue responses include token fields at the top-level, not inside `session`.
    access_token = session.get("access_token") or data.get("access_token")
    refresh_token = session.get("refresh_token") or data.get("refresh_token")
    expires_in = session.get("expires_in") or data.get("expires_in")
    token_type = session.get("token_type") or data.get("token_type")
    return {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "expiresIn": expires_in,
        "tokenType": token_type,
        "user": user,
    }


def _supabase_headers(extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    headers = {
        "apikey": SUPABASE_ANON_KEY or "",
        "authorization": f"Bearer {SUPABASE_ANON_KEY or ''}",
        "content-type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


def _supabase_db_headers(extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    # For PostgREST access, prefer service role key (bypasses RLS). Fallback to anon if needed.
    key = (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY or "").strip()
    headers = {
        "apikey": key,
        "authorization": f"Bearer {key}",
        "content-type": "application/json",
        "prefer": "return=representation,resolution=merge-duplicates",
    }
    if extra:
        headers.update(extra)
    return headers


async def _ensure_user_profile_row(*, user_id: str, email: str, username: Optional[str]) -> None:
    # Keep public.users in sync for chat/user search features.
    if looks_placeholder(SUPABASE_URL) or looks_placeholder(SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY):
        return
    if not user_id or not email or not username:
        return
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/users"
    payload = {"id": user_id, "email": email, "username": username}
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.post(url, headers=_supabase_db_headers({"prefer": "resolution=merge-duplicates,return=minimal"}), json=payload)


def _extract_user_identity(auth_json: Dict[str, Any]) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Extract (user_id, email, username) from Supabase auth payloads.

    Supabase responses vary (signup returns {user, session?}; login returns tokens).
    For login we may need a follow-up /auth/v1/user call, so this helper only extracts
    what is already present.
    """
    data = auth_json or {}
    user = data.get("user") or {}
    user_id = user.get("id")
    email = user.get("email")
    meta = user.get("user_metadata") or {}
    username = meta.get("username")
    return user_id, email, username


async def _fetch_supabase_user(*, access_token: str) -> Optional[Dict[str, Any]]:
    if not access_token or looks_placeholder(SUPABASE_URL) or looks_placeholder(SUPABASE_ANON_KEY):
        return None
    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/user"
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(url, headers=_supabase_headers({"authorization": f"Bearer {access_token}"}))
    if r.status_code >= 400:
        return None
    return r.json() or None


@router.post("/signup")
async def signup(req: Request):
    body = await req.json()
    email = str(body.get("email") or "").strip().lower()
    password = str(body.get("password") or "")
    username = body.get("username")
    username_norm = str(username).strip() if username is not None else None

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    if not is_supabase_configured():
        if email in _local_users_by_email:
            return JSONResponse(status_code=409, content={"success": False, "message": "User already registered"})
        if username_norm and username_norm.lower() in _local_users_by_username:
            return JSONResponse(status_code=409, content={"success": False, "message": "Username already taken"})

        user = LocalUser(
            id=str(uuid.uuid4()),
            email=email,
            username=username_norm,
            password_hash=_hash_password(password),
        )
        _local_users_by_email[email] = user
        if username_norm:
            _local_users_by_username[username_norm.lower()] = user

        try:
            await _ensure_user_profile_row(user_id=user.id, email=user.email, username=user.username)
        except Exception:
            pass

        auth_data = _issue_local_tokens(user)
        return JSONResponse(
            status_code=201,
            content={"success": True, "message": "Signup successful", "data": _format_auth_response(auth_data)},
        )

    payload: Dict[str, Any] = {"email": email, "password": password}
    if username_norm:
        payload["data"] = {"username": username_norm}

    if looks_placeholder(SUPABASE_URL) or looks_placeholder(SUPABASE_ANON_KEY):
        return JSONResponse(status_code=503, content={"success": False, "message": "Auth provider is not configured"})

    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/signup"
    timeout = httpx.Timeout(connect=5.0, read=30.0, write=30.0, pool=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            r = await client.post(url, headers=_supabase_headers(), json=payload)
        except httpx.HTTPError:
            user = LocalUser(
                id=str(uuid.uuid4()),
                email=email,
                username=username_norm,
                password_hash=_hash_password(password),
            )
            _local_users_by_email[email] = user
            if username_norm:
                _local_users_by_username[username_norm.lower()] = user
            try:
                await _ensure_user_profile_row(user_id=user.id, email=user.email, username=user.username)
            except Exception:
                pass
            auth_data = _issue_local_tokens(user)
            return JSONResponse(
                status_code=201,
                content={"success": True, "message": "Signup successful", "data": _format_auth_response(auth_data)},
            )

    if r.status_code >= 400:
        msg = None
        if r.headers.get("content-type", "").startswith("application/json"):
            msg = (r.json() or {}).get("msg")
        msg_text = (msg or r.text or "Signup failed") or "Signup failed"

        # Some auth providers validate email with a stricter-than-RFC regex (e.g. reject underscores).
        # To avoid blocking the whole app, fall back to local auth for provider-side validation/limits.
        lowered = msg_text.lower()
        if ("email" in lowered and "invalid" in lowered) or ("rate limit" in lowered):
            if email in _local_users_by_email:
                return JSONResponse(status_code=409, content={"success": False, "message": "User already registered"})
            user = LocalUser(
                id=str(uuid.uuid4()),
                email=email,
                username=username_norm,
                password_hash=_hash_password(password),
            )
            _local_users_by_email[email] = user
            if username_norm:
                _local_users_by_username[username_norm.lower()] = user
            try:
                await _ensure_user_profile_row(user_id=user.id, email=user.email, username=user.username)
            except Exception:
                pass
            auth_data = _issue_local_tokens(user)
            return JSONResponse(
                status_code=201,
                content={"success": True, "message": "Signup successful", "data": _format_auth_response(auth_data)},
            )

        return JSONResponse(status_code=400, content={"success": False, "message": msg_text})

    # Ensure the profile row exists so chat user-search works.
    try:
        auth_json = r.json() or {}
        user_id, sb_email, sb_username = _extract_user_identity(auth_json)
        # Prefer explicit signup username (if provided).
        await _ensure_user_profile_row(user_id=user_id or "", email=(sb_email or email), username=(username_norm or sb_username))
    except Exception:
        pass

    return JSONResponse(
        status_code=201,
        content={"success": True, "message": "Signup successful", "data": _format_auth_response(r.json())},
    )


@router.post("/login")
async def login(req: Request):
    body = await req.json()
    email = str(body.get("email") or "").strip().lower()
    password = str(body.get("password") or "")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    if not is_supabase_configured():
        user = _local_users_by_email.get(email)
        if not user or not _verify_password(password, user.password_hash):
            return JSONResponse(status_code=401, content={"success": False, "message": "Invalid email or password"})
        auth_data = _issue_local_tokens(user)
        return JSONResponse(
            status_code=200,
            content={"success": True, "message": "Login successful", "data": _format_auth_response(auth_data)},
        )

    if looks_placeholder(SUPABASE_URL) or looks_placeholder(SUPABASE_ANON_KEY):
        return JSONResponse(status_code=503, content={"success": False, "message": "Auth provider is not configured"})

    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=password"
    timeout = httpx.Timeout(connect=5.0, read=30.0, write=30.0, pool=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            r = await client.post(url, headers=_supabase_headers(), json={"email": email, "password": password})
        except httpx.HTTPError:
            user = _local_users_by_email.get(email)
            if not user or not _verify_password(password, user.password_hash):
                return JSONResponse(status_code=401, content={"success": False, "message": "Invalid email or password"})
            auth_data = _issue_local_tokens(user)
            return JSONResponse(
                status_code=200,
                content={"success": True, "message": "Login successful", "data": _format_auth_response(auth_data)},
            )

    if r.status_code >= 400:
        err_json: Dict[str, Any] = {}
        if r.headers.get("content-type", "").startswith("application/json"):
            err_json = r.json() or {}
        msg = (
            err_json.get("msg")
            or err_json.get("error_description")
            or err_json.get("error")
            or err_json.get("message")
        )
        msg_text = (msg or r.text or "Invalid email or password") or "Invalid email or password"

        # Same fallback as signup: avoid strict email regex blocking logins for locally-created users.
        lowered = msg_text.lower()
        if ("email" in lowered and "invalid" in lowered) or ("rate limit" in lowered):
            user = _local_users_by_email.get(email)
            if user and _verify_password(password, user.password_hash):
                auth_data = _issue_local_tokens(user)
                return JSONResponse(
                    status_code=200,
                    content={"success": True, "message": "Login successful", "data": _format_auth_response(auth_data)},
                )

        # Preserve provider status/message so frontend can show exact reason
        # (e.g. email not confirmed vs invalid credentials).
        status_code = r.status_code if r.status_code in (400, 401, 403, 429) else 401
        return JSONResponse(status_code=status_code, content={"success": False, "message": msg_text})

    # Ensure the profile row exists so chat user-search works (covers existing accounts too).
    try:
        auth_json = r.json() or {}
        access_token = (auth_json.get("access_token") or (auth_json.get("session") or {}).get("access_token") or "").strip()
        sb_user = await _fetch_supabase_user(access_token=access_token)
        if sb_user:
            user_id = sb_user.get("id") or ""
            sb_email = sb_user.get("email") or ""
            sb_username = ((sb_user.get("user_metadata") or {}).get("username") or "").strip() or None
            if user_id and sb_email and sb_username:
                await _ensure_user_profile_row(user_id=user_id, email=sb_email, username=sb_username)
    except Exception:
        pass

    return JSONResponse(
        status_code=200,
        content={"success": True, "message": "Login successful", "data": _format_auth_response(r.json())},
    )


@router.post("/otp/request")
async def otp_request(req: Request):
    if not is_supabase_configured():
        return JSONResponse(status_code=503, content={"success": False, "message": "OTP is unavailable (Supabase not configured)"})

    body = await req.json()
    email = str(body.get("email") or "").strip()
    redirect_to = body.get("redirectTo")
    if not email:
        return JSONResponse(status_code=400, content={"success": False, "message": "email is required"})

    payload: Dict[str, Any] = {"email": email, "create_user": False}
    if redirect_to:
        payload["redirect_to"] = redirect_to

    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/otp"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, headers=_supabase_headers(), json=payload)
    if r.status_code >= 400:
        return JSONResponse(status_code=400, content={"success": False, "message": "OTP request failed"})
    return {"success": True, "message": "OTP sent to your email", "data": {"ok": True}}


@router.post("/otp/verify")
async def otp_verify(req: Request):
    if not is_supabase_configured():
        return JSONResponse(status_code=503, content={"success": False, "message": "OTP is unavailable (Supabase not configured)"})

    body = await req.json()
    email = str(body.get("email") or "").strip()
    token = str(body.get("token") or "").strip()
    if not email or not token:
        return JSONResponse(status_code=400, content={"success": False, "message": "email and token are required"})

    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/verify"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, headers=_supabase_headers(), json={"type": "email", "email": email, "token": token})
    if r.status_code >= 400:
        return JSONResponse(status_code=401, content={"success": False, "message": "Invalid token"})
    return {"success": True, "message": "OTP verified", "data": _format_auth_response(r.json())}


@router.get("/me")
async def me(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        return JSONResponse(status_code=401, content={"success": False, "message": "Missing or invalid authorization header"})

    token = authorization.split(" ", 1)[1].strip()

    if not is_supabase_configured():
        try:
            payload = jwt.decode(token, AUTH_JWT_SECRET, algorithms=["HS256"])
        except Exception:
            return JSONResponse(status_code=401, content={"success": False, "message": "Invalid token"})
        return {"success": True, "message": "Current user fetched successfully", "data": {"user": payload}}

    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/user"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url, headers=_supabase_headers({"authorization": f"Bearer {token}"}))
    if r.status_code >= 400:
        return JSONResponse(status_code=401, content={"success": False, "message": "Invalid token"})

    return {"success": True, "message": "Current user fetched successfully", "data": {"user": r.json()}}

