from __future__ import annotations

import asyncio
import os

import uvicorn
from fastapi import FastAPI

from src.workers.backup_worker import run_backup_loop


def _env(name: str, default: str) -> str:
    v = os.getenv(name)
    if v is None:
        return default
    v = v.strip()
    return v if v else default


def _http_enabled() -> bool:
    # Render/Railway "web service" expects a bound port; keep optional for Docker/local.
    v = _env("WORKER_HTTP_ENABLED", "0").lower()
    return v in {"1", "true", "yes", "on"}


def _create_app() -> FastAPI:
    app = FastAPI()

    @app.get("/")
    async def root():
        return {"success": True, "service": "worker-service", "status": "ok"}

    @app.get("/health")
    async def health():
        return {"success": True, "service": "worker-service", "status": "ok"}

    return app


def main() -> None:
    if not _http_enabled():
        asyncio.run(run_backup_loop())
        return

    port = int(_env("PORT", "10000"))

    async def runner():
        # Run backup loop + HTTP server concurrently
        backup_task = asyncio.create_task(run_backup_loop())
        config = uvicorn.Config(_create_app(), host="0.0.0.0", port=port, log_level=_env("UVICORN_LOG_LEVEL", "info"))
        server = uvicorn.Server(config)
        api_task = asyncio.create_task(server.serve())
        await asyncio.gather(backup_task, api_task)

    asyncio.run(runner())


if __name__ == "__main__":
    main()

