from __future__ import annotations

from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from src.settings import SUPABASE_URL, require_supabase
from src.supabase import gotrue_headers, safe_json_dict, validate_access_token

router = APIRouter()


def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return authorization.split(" ", 1)[1].strip() or None


def _format_auth_response(data: Dict[str, Any]) -> Dict[str, Any]:
    d = data or {}
    user = d.get("user") or None
    access_token = d.get("access_token") or (d.get("session") or {}).get("access_token")
    refresh_token = d.get("refresh_token") or (d.get("session") or {}).get("refresh_token")
    expires_in = d.get("expires_in") or (d.get("session") or {}).get("expires_in")
    token_type = d.get("token_type") or (d.get("session") or {}).get("token_type")
    return {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "expiresIn": expires_in,
        "tokenType": token_type,
        "user": user,
    }


@router.post("/signup")
async def signup(req: Request):
    require_supabase()
    body = await req.json()
    email = str((body or {}).get("email") or "").strip().lower()
    password = str((body or {}).get("password") or "")
    username = (body or {}).get("username")
    username_norm = str(username).strip() if username is not None else ""

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    payload: Dict[str, Any] = {"email": email, "password": password}
    if username_norm:
        payload["data"] = {"username": username_norm}

    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/signup"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, headers=gotrue_headers(), json=payload)

    if r.status_code >= 400:
        err = await safe_json_dict(r)
        msg = err.get("msg") or err.get("error_description") or err.get("error") or err.get("message") or r.text or "Signup failed"
        status = r.status_code if r.status_code in (400, 401, 403, 409, 422, 429) else 400
        return JSONResponse(status_code=status, content={"success": False, "message": str(msg)})

    return JSONResponse(
        status_code=201,
        content={"success": True, "message": "Signup successful", "data": _format_auth_response(await safe_json_dict(r))},
    )


@router.post("/login")
async def login(req: Request):
    require_supabase()
    body = await req.json()
    email = str((body or {}).get("email") or "").strip().lower()
    password = str((body or {}).get("password") or "")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=password"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, headers=gotrue_headers(), json={"email": email, "password": password})

    if r.status_code >= 400:
        err = await safe_json_dict(r)
        msg = err.get("msg") or err.get("error_description") or err.get("error") or err.get("message") or r.text or "Invalid email or password"
        status = r.status_code if r.status_code in (400, 401, 403, 429) else 401
        return JSONResponse(status_code=status, content={"success": False, "message": str(msg)})

    return JSONResponse(
        status_code=200,
        content={"success": True, "message": "Login successful", "data": _format_auth_response(await safe_json_dict(r))},
    )


@router.post("/otp/request")
async def otp_request(req: Request):
    require_supabase()
    body = await req.json()
    email = str((body or {}).get("email") or "").strip().lower()
    redirect_to = (body or {}).get("redirectTo")
    if not email:
        return JSONResponse(status_code=400, content={"success": False, "message": "email is required"})

    payload: Dict[str, Any] = {"email": email, "create_user": False}
    if redirect_to:
        payload["redirect_to"] = redirect_to

    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/otp"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, headers=gotrue_headers(), json=payload)

    if r.status_code >= 400:
        return JSONResponse(status_code=400, content={"success": False, "message": "OTP request failed"})
    return {"success": True, "message": "OTP sent to your email", "data": {"ok": True}}


@router.post("/otp/verify")
async def otp_verify(req: Request):
    require_supabase()
    body = await req.json()
    email = str((body or {}).get("email") or "").strip().lower()
    token = str((body or {}).get("token") or "").strip()
    if not email or not token:
        return JSONResponse(status_code=400, content={"success": False, "message": "email and token are required"})

    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/verify"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, headers=gotrue_headers(), json={"type": "email", "email": email, "token": token})

    if r.status_code >= 400:
        return JSONResponse(status_code=401, content={"success": False, "message": "Invalid token"})

    return {"success": True, "message": "OTP verified", "data": _format_auth_response(await safe_json_dict(r))}


@router.get("/me")
async def me(authorization: Optional[str] = Header(default=None)):
    token = _extract_bearer(authorization)
    if not token:
        return JSONResponse(status_code=401, content={"success": False, "message": "Missing or invalid authorization header"})
    user = await validate_access_token(token)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "message": "Invalid token"})
    return {"success": True, "message": "Current user fetched successfully", "data": {"user": user}}

