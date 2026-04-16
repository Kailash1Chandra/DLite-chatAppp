from __future__ import annotations

import asyncio

from fastapi import FastAPI

from src.backup import run_backup_once
from src.settings import (
    BACKUP_BATCH_SIZE,
    BACKUP_INTERVAL_SECONDS,
    BACKUP_OUTPUT_DIR,
    BACKUP_STATE_FILE,
    WORKER_HTTP_ENABLED,
    require_supabase,
)


app = FastAPI()

_stop_event: asyncio.Event | None = None
_task: asyncio.Task | None = None
_last_result = None


@app.on_event("startup")
async def _startup():
    require_supabase()

    global _stop_event, _task
    _stop_event = asyncio.Event()

    async def loop():
        global _last_result
        while not _stop_event.is_set():
            _last_result = await run_backup_once()
            try:
                await asyncio.wait_for(_stop_event.wait(), timeout=max(5, BACKUP_INTERVAL_SECONDS))
            except asyncio.TimeoutError:
                continue

    # Always run the loop. If HTTP is disabled, you can still run this container as a worker.
    _task = asyncio.create_task(loop())


@app.on_event("shutdown")
async def _shutdown():
    global _stop_event, _task
    if _stop_event:
        _stop_event.set()
    if _task:
        try:
            await _task
        except Exception:
            pass


@app.get("/health")
async def health():
    if not WORKER_HTTP_ENABLED:
        return {"success": True, "service": "worker-service", "status": "ok", "http": "disabled"}
    return {"success": True, "service": "worker-service", "status": "ok"}


@app.get("/status")
async def status():
    return {
        "success": True,
        "service": "worker-service",
        "backup": {
            "intervalSeconds": BACKUP_INTERVAL_SECONDS,
            "batchSize": BACKUP_BATCH_SIZE,
            "outputDir": BACKUP_OUTPUT_DIR,
            "stateFile": BACKUP_STATE_FILE,
            "lastResult": _last_result.__dict__ if _last_result else None,
        },
    }

