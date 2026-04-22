from __future__ import annotations

import os
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from src.routers.auth import router as auth_router
from src.routers.chat import router as chat_router


def _parse_origins(value: str) -> list[str]:
    v = (value or "").strip()
    if not v or v == "*":
        return ["*"]
    return [o.strip() for o in v.split(",") if o.strip()]


app = FastAPI()

# IMPORTANT:
# - When behind a proxy (Render), errors may be returned without CORS headers unless middleware is configured broadly.
# - Set `CORS_ORIGINS` on the server to include your frontend, e.g.:
#   CORS_ORIGINS="https://frontend-dlite.vercel.app,http://localhost:3000"
cors_origins = _parse_origins(os.getenv("CORS_ORIGINS", "http://localhost:3000,https://frontend-dlite.vercel.app"))
if "https://frontend-dlite.vercel.app" not in cors_origins and "*" not in cors_origins:
    cors_origins.append("https://frontend-dlite.vercel.app")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    # Keep credentials enabled unless wildcard origin is used.
    allow_credentials=("*" not in cors_origins),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "success": True,
        "service": "core-backend",
        "message": "D-Lite core backend is running",
        "routes": {"auth": "/auth", "chat": "/chat"},
    }


@app.get("/health")
async def health():
    return {"success": True, "service": "core-backend", "status": "ok"}


@app.get("/health/integration")
async def health_integration():
    """
    Safe deploy checklist: which integration env vars are present (no secret values).
    Pair with frontend Vercel: NEXT_PUBLIC_API_BASE_URL should point to this service.
    """
    from src.settings import (
        CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET,
        CLOUDINARY_CLOUD_NAME,
        SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_URL,
    )

    rest_host = ""
    if SUPABASE_URL:
        try:
            rest_host = urlparse(SUPABASE_URL).netloc or ""
        except Exception:
            rest_host = ""
    cors_raw = (os.getenv("CORS_ORIGINS") or "").strip()
    if cors_raw == "*":
        cors_summary = {"mode": "wildcard"}
    elif not cors_raw:
        cors_summary = {"mode": "default", "hint": "CORS_ORIGINS unset; using localhost:3000 only in code default"}
    else:
        parts = [o.strip() for o in cors_raw.split(",") if o.strip()]
        cors_summary = {"mode": "origins", "count": len(parts)}

    return {
        "success": True,
        "service": "core-backend",
        "supabase": {
            "restApiHost": rest_host,
            "hasUrl": bool(SUPABASE_URL),
            "hasAnonKey": bool(SUPABASE_ANON_KEY),
            "hasServiceRoleKey": bool(SUPABASE_SERVICE_ROLE_KEY),
            "authProxyOk": bool(SUPABASE_URL and SUPABASE_ANON_KEY),
        },
        "cloudinary": {
            "mediaUploadOk": bool(CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET),
        },
        "cors": cors_summary,
    }


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)


app.include_router(auth_router, prefix="/auth")
app.include_router(chat_router, prefix="/chat")

