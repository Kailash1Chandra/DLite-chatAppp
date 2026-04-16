from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from src.settings import (
    BACKUP_BATCH_SIZE,
    BACKUP_OUTPUT_DIR,
    BACKUP_STATE_FILE,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
    require_supabase,
)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _headers() -> Dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY or "",
        "authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY or ''}",
        "content-type": "application/json",
    }


def _read_state() -> Dict[str, Any]:
    p = Path(BACKUP_STATE_FILE)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}


def _write_state(state: Dict[str, Any]) -> None:
    p = Path(BACKUP_STATE_FILE)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    os.replace(tmp, p)


def _write_backup_file(*, rows: List[Dict[str, Any]], started_at: str) -> str:
    out_dir = Path(BACKUP_OUTPUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = started_at.replace(":", "").replace("-", "")
    fname = out_dir / f"messages_{ts}.json"
    fname.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    return str(fname)


@dataclass
class BackupResult:
    ok: bool
    started_at: str
    ended_at: str
    rows_written: int
    output_file: Optional[str]
    last_synced_at: Optional[str]
    error: Optional[str]


async def fetch_messages(
    client: httpx.AsyncClient,
    *,
    last_synced_at: Optional[str],
    limit: int,
) -> List[Dict[str, Any]]:
    require_supabase()
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/messages"
    params: Dict[str, str] = {
        "select": "id,chat_id,sender_id,content,type,created_at",
        "order": "created_at.asc",
        "limit": str(limit),
    }
    if last_synced_at:
        params["created_at"] = f"gt.{last_synced_at}"
    r = await client.get(url, headers=_headers(), params=params)
    if r.status_code >= 400:
        raise RuntimeError(f"Supabase fetch failed ({r.status_code})")
    try:
        data = r.json()
    except Exception:
        return []
    return data if isinstance(data, list) else []


async def run_backup_once() -> BackupResult:
    started_at = _utc_now_iso()
    try:
        state = _read_state()
        last_synced_at = state.get("last_synced_at")

        all_rows: List[Dict[str, Any]] = []
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                batch = await fetch_messages(client, last_synced_at=last_synced_at, limit=BACKUP_BATCH_SIZE)
                if not batch:
                    break
                all_rows.extend(batch)
                # advance cursor
                last_synced_at = str(batch[-1].get("created_at") or last_synced_at or "").strip() or last_synced_at
                if len(batch) < BACKUP_BATCH_SIZE:
                    break

        output_file = None
        if all_rows:
            output_file = _write_backup_file(rows=all_rows, started_at=started_at)
            _write_state({"last_synced_at": last_synced_at, "updated_at": _utc_now_iso()})

        ended_at = _utc_now_iso()
        return BackupResult(
            ok=True,
            started_at=started_at,
            ended_at=ended_at,
            rows_written=len(all_rows),
            output_file=output_file,
            last_synced_at=last_synced_at,
            error=None,
        )
    except Exception as e:
        ended_at = _utc_now_iso()
        return BackupResult(
            ok=False,
            started_at=started_at,
            ended_at=ended_at,
            rows_written=0,
            output_file=None,
            last_synced_at=None,
            error=str(e),
        )


async def backup_loop(stop_event) -> None:
    """
    Runs forever until stop_event is set.
    """
    require_supabase()
    while not stop_event.is_set():
        await run_backup_once()
        # sleep in small chunks so stop_event is responsive
        remaining = max(5, int(BACKUP_INTERVAL_SECONDS))
        while remaining > 0 and not stop_event.is_set():
            step = min(5, remaining)
            time.sleep(step)
            remaining -= step

