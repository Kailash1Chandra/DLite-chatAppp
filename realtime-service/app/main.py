from __future__ import annotations

import os
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from src.sockets.server import create_socket_app


def _parse_origins(value: str) -> list[str] | str:
    v = (value or "").strip()
    if not v or v == "*":
        return "*"
    return [o.strip() for o in v.split(",") if o.strip()]


app = FastAPI()

cors_origins = _parse_origins(os.getenv("SOCKET_IO_CORS_ORIGINS", "*"))
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if isinstance(cors_origins, list) else ["*"],
    allow_credentials=(cors_origins != "*"),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"success": True, "service": "realtime-service", "message": "D-Lite realtime is running"}


@app.get("/health")
async def health():
    return {"success": True, "service": "realtime-service", "status": "ok"}


@app.get("/health/integration")
async def health_integration():
    """
    Safe deploy checklist for Socket.IO + Supabase token validation (no secret values).
    Frontend NEXT_PUBLIC_CHAT_SOCKET_URL should point to this service origin (https, no /socket.io path).
    """
    from src.settings import SUPABASE_ANON_KEY, SUPABASE_URL

    rest_host = ""
    if SUPABASE_URL:
        try:
            rest_host = urlparse(SUPABASE_URL).netloc or ""
        except Exception:
            rest_host = ""
    sio_raw = (os.getenv("SOCKET_IO_CORS_ORIGINS") or "").strip()
    if sio_raw in ("", "*"):
        sio_summary = {"mode": "wildcard"}
    else:
        parts = [o.strip() for o in sio_raw.split(",") if o.strip()]
        sio_summary = {"mode": "origins", "count": len(parts)}

    return {
        "success": True,
        "service": "realtime-service",
        "supabase": {
            "restApiHost": rest_host,
            "hasUrl": bool(SUPABASE_URL),
            "hasAnonKey": bool(SUPABASE_ANON_KEY),
            "tokenValidationOk": bool(SUPABASE_URL and SUPABASE_ANON_KEY),
        },
        "socketIoCors": sio_summary,
    }


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)


# Serve Socket.IO at `/socket.io` alongside the FastAPI routes.
# (Do NOT mount under `/socket.io`, Socket.IO already uses that path.)
app = create_socket_app(cors_allowed_origins=cors_origins, other_asgi_app=app)

