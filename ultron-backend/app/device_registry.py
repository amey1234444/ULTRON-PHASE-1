"""
ULTRON — Device registry / bridge binding module.

Maps an asset node ("device") to a bridge identity (machine_id + ip + port) so
that readings pushed by a bridge can be routed to a *specific* device on the
dashboard.

Routing rule (strict): an incoming reading is matched to a device binding only
when BOTH the reported `machine_id` AND `ip` equal the values stored for that
device. The bridge reports its own ip in the payload (it knows its LAN address),
so matching keeps working even when the backend is in the cloud and the bridge
is behind NAT — the raw TCP source IP (which a proxy/NAT rewrites) is recorded
separately for information only.
"""

import sqlite3
import time
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.logger import logger

router = APIRouter(prefix="/api/devices", tags=["Device Registry"])

_conn: Optional[sqlite3.Connection] = None

# Runtime status keyed by node_id (most recent matched reading per device).
_runtime: dict[str, dict] = {}
# Recently seen incoming sources keyed by "machine_id@ip" (matched or not).
# Helps the user configure bindings by showing what is actually arriving.
_incoming: dict[str, dict] = {}
_MAX_INCOMING = 50


_SCHEMA = """
CREATE TABLE IF NOT EXISTS device_bindings (
    node_id    TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL,
    ip         TEXT NOT NULL DEFAULT '',
    port       INTEGER NOT NULL DEFAULT 8765,
    updated_at REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_binding_match ON device_bindings(machine_id, ip);
"""


def init_device_db(conn: sqlite3.Connection) -> None:
    """Initialize the device_bindings table."""
    global _conn
    _conn = conn
    _conn.executescript(_SCHEMA)
    _conn.commit()
    count = _conn.execute("SELECT COUNT(*) FROM device_bindings").fetchone()[0]
    logger.info("Device registry loaded: %d binding(s)", count)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class DeviceBindingRequest(BaseModel):
    machine_id: str
    ip: str = ""
    port: int = 8765


class DeviceBindingResponse(BaseModel):
    node_id: str
    machine_id: str
    ip: str
    port: int
    updated_at: float
    # Runtime status (not persisted)
    connected: bool = False
    last_seen: float = 0.0
    last_source_ip: Optional[str] = None
    pressure: Optional[float] = None
    temperature: Optional[float] = None


class IncomingSource(BaseModel):
    machine_id: str
    ip: str
    source_ip: Optional[str] = None
    last_seen: float
    matched_node_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# A device is considered "connected" if it pushed within this many seconds.
CONNECTED_WINDOW_S = 10.0


def _binding_row_to_dict(row: tuple) -> dict:
    node_id, machine_id, ip, port, updated_at = row
    rt = _runtime.get(node_id, {})
    last_seen = rt.get("last_seen", 0.0)
    connected = bool(last_seen) and (time.time() - last_seen) <= CONNECTED_WINDOW_S
    return {
        "node_id": node_id,
        "machine_id": machine_id,
        "ip": ip,
        "port": port,
        "updated_at": updated_at,
        "connected": connected,
        "last_seen": last_seen,
        "last_source_ip": rt.get("source_ip"),
        "pressure": rt.get("pressure"),
        "temperature": rt.get("temperature"),
    }


def match(machine_id: str, ip: str) -> Optional[dict]:
    """Return the device binding whose machine_id AND ip both match, else None."""
    if _conn is None:
        return None
    row = _conn.execute(
        "SELECT node_id, machine_id, ip, port, updated_at FROM device_bindings "
        "WHERE machine_id = ? AND ip = ? LIMIT 1",
        (machine_id, ip),
    ).fetchone()
    return _binding_row_to_dict(row) if row else None


def record_incoming(
    machine_id: str,
    reported_ip: str,
    source_ip: Optional[str],
    matched_node_id: Optional[str],
    pressure: Optional[float] = None,
    temperature: Optional[float] = None,
) -> None:
    """Record runtime status for an incoming reading (matched or not)."""
    now = time.time()
    key = f"{machine_id}@{reported_ip}"
    _incoming[key] = {
        "machine_id": machine_id,
        "ip": reported_ip,
        "source_ip": source_ip,
        "last_seen": now,
        "matched_node_id": matched_node_id,
    }
    # Bound the dict size — drop oldest entries.
    if len(_incoming) > _MAX_INCOMING:
        oldest = sorted(_incoming.items(), key=lambda kv: kv[1]["last_seen"])
        for k, _ in oldest[: len(_incoming) - _MAX_INCOMING]:
            _incoming.pop(k, None)

    if matched_node_id:
        _runtime[matched_node_id] = {
            "last_seen": now,
            "source_ip": source_ip,
            "pressure": pressure,
            "temperature": temperature,
        }


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

@router.get("/bindings", response_model=list[DeviceBindingResponse])
async def list_bindings():
    if _conn is None:
        raise HTTPException(503, "Database not initialized")
    rows = _conn.execute(
        "SELECT node_id, machine_id, ip, port, updated_at FROM device_bindings"
    ).fetchall()
    return [_binding_row_to_dict(r) for r in rows]


@router.get("/bindings/{node_id}", response_model=DeviceBindingResponse)
async def get_binding(node_id: str):
    if _conn is None:
        raise HTTPException(503, "Database not initialized")
    row = _conn.execute(
        "SELECT node_id, machine_id, ip, port, updated_at FROM device_bindings WHERE node_id = ?",
        (node_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, f"No binding for node '{node_id}'")
    return _binding_row_to_dict(row)


@router.put("/bindings/{node_id}", response_model=DeviceBindingResponse)
async def upsert_binding(node_id: str, body: DeviceBindingRequest):
    if _conn is None:
        raise HTTPException(503, "Database not initialized")
    machine_id = body.machine_id.strip()
    if not machine_id:
        raise HTTPException(400, "machine_id is required")
    ip = body.ip.strip()
    now = time.time()
    _conn.execute(
        "INSERT INTO device_bindings (node_id, machine_id, ip, port, updated_at) "
        "VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(node_id) DO UPDATE SET "
        "machine_id = excluded.machine_id, ip = excluded.ip, "
        "port = excluded.port, updated_at = excluded.updated_at",
        (node_id, machine_id, ip, body.port, now),
    )
    _conn.commit()
    logger.info("Device binding saved: node=%s machine_id=%s ip=%s", node_id, machine_id, ip)
    row = _conn.execute(
        "SELECT node_id, machine_id, ip, port, updated_at FROM device_bindings WHERE node_id = ?",
        (node_id,),
    ).fetchone()
    return _binding_row_to_dict(row)


@router.delete("/bindings/{node_id}", status_code=204)
async def delete_binding(node_id: str):
    if _conn is None:
        raise HTTPException(503, "Database not initialized")
    _conn.execute("DELETE FROM device_bindings WHERE node_id = ?", (node_id,))
    _conn.commit()
    _runtime.pop(node_id, None)
    return None


@router.get("/incoming", response_model=list[IncomingSource])
async def list_incoming():
    """Recently-seen bridge sources (matched or not) — useful for setup."""
    return sorted(_incoming.values(), key=lambda v: v["last_seen"], reverse=True)
