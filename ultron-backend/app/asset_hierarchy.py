"""
ULTRON — Asset Hierarchy CRUD module.
Provides SQLite persistence and FastAPI router for the 6-level asset tree:
Company → Plant → Area → Machine → Equipment → EquipmentType
"""

import sqlite3
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.logger import logger

router = APIRouter(prefix="/api/assets", tags=["Asset Hierarchy"])

_conn: Optional[sqlite3.Connection] = None

# ---------------------------------------------------------------------------
# Schema & seed data
# ---------------------------------------------------------------------------

_SCHEMA = """
CREATE TABLE IF NOT EXISTS asset_nodes (
    id        TEXT PRIMARY KEY,
    parent_id TEXT,
    level     TEXT NOT NULL,
    label     TEXT NOT NULL,
    code      TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    bridge_url TEXT DEFAULT '',
    FOREIGN KEY (parent_id) REFERENCES asset_nodes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_asset_parent ON asset_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_asset_level ON asset_nodes(level);
"""

_MIGRATION_ADD_BRIDGE_URL = """
ALTER TABLE asset_nodes ADD COLUMN bridge_url TEXT DEFAULT '';
"""

_SEED_DATA = [
    # Companies
    ("oswar-software", None, "company", "Oswar Software", "OSWAR", 0),
    ("oswar-test-company", None, "company", "Oswar Test Company", "TEST", 1),
    # Plants
    ("phase-1-demo-plant", "oswar-software", "plant", "Phase 1 Demo Plant", "P1", 0),
    ("training-plant", "oswar-test-company", "plant", "Training Plant", "TRN", 0),
    # Areas
    ("production-area-a", "phase-1-demo-plant", "area", "Production Area A", "AREA-A", 0),
    ("demo-area", "training-plant", "area", "Demo Area", "DEMO", 0),
    # Machines
    ("rav-line-01", "production-area-a", "machine", "RAV Line 01", "RAV-01", 0),
    ("training-machine", "demo-area", "machine", "Training Machine", "TM-01", 0),
    # Equipment
    ("feed-system-01", "rav-line-01", "equipment", "Feed System 01", "FS-01", 0),
    ("training-equipment", "training-machine", "equipment", "Training Equipment", "TE-01", 0),
    # Equipment Types (IDs use parent prefix + type for uniqueness)
    ("motor-fs01", "feed-system-01", "equipmentType", "Motor", "MTR", 0),
    ("pump-fs01", "feed-system-01", "equipmentType", "Pump", "PMP", 1),
    ("fan-fs01", "feed-system-01", "equipmentType", "Fan", "FAN", 2),
    ("rotary-airlock-valve-fs01", "feed-system-01", "equipmentType", "Rotary Airlock Valve", "RAV", 3),
    ("motor-te01", "training-equipment", "equipmentType", "Motor", "MTR", 0),
    ("pump-te01", "training-equipment", "equipmentType", "Pump", "PMP", 1),
    ("fan-te01", "training-equipment", "equipmentType", "Fan", "FAN", 2),
    ("rotary-airlock-valve-te01", "training-equipment", "equipmentType", "Rotary Airlock Valve", "RAV", 3),
]


def init_asset_db(conn: sqlite3.Connection) -> None:
    """Initialize asset hierarchy table and seed if empty."""
    global _conn
    _conn = conn
    _conn.execute("PRAGMA foreign_keys = ON")
    _conn.executescript(_SCHEMA)
    _conn.commit()

    # Migration: add bridge_url column if missing (existing DBs)
    try:
        _conn.execute("SELECT bridge_url FROM asset_nodes LIMIT 1")
    except sqlite3.OperationalError:
        _conn.executescript(_MIGRATION_ADD_BRIDGE_URL)
        _conn.commit()
        logger.info("Migration: added bridge_url column to asset_nodes")

    count = _conn.execute("SELECT COUNT(*) FROM asset_nodes").fetchone()[0]
    if count == 0:
        _conn.executemany(
            "INSERT INTO asset_nodes (id, parent_id, level, label, code, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
            _SEED_DATA,
        )
        _conn.commit()
        logger.info("Asset hierarchy seeded with %d nodes", len(_SEED_DATA))
    else:
        logger.info("Asset hierarchy loaded: %d nodes", count)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class AssetNodeResponse(BaseModel):
    id: str
    parent_id: Optional[str] = None
    level: str
    label: str
    code: str = ""
    sort_order: int = 0
    bridge_url: str = ""


class AssetNodeCreate(BaseModel):
    parent_id: Optional[str] = None
    level: str
    label: str
    code: str = ""


class AssetNodeUpdate(BaseModel):
    label: Optional[str] = None
    code: Optional[str] = None
    bridge_url: Optional[str] = None


class BridgeUrlUpdate(BaseModel):
    bridge_url: str


class AssetTreeNode(BaseModel):
    id: str
    label: str
    code: str = ""
    level: str
    bridge_url: str = ""
    children: list["AssetTreeNode"] = []


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _row_to_dict(row: tuple) -> dict:
    return {
        "id": row[0],
        "parent_id": row[1],
        "level": row[2],
        "label": row[3],
        "code": row[4] or "",
        "sort_order": row[5],
        "bridge_url": row[6] if len(row) > 6 else "",
    }


def _build_tree(nodes: list[dict], parent_id: Optional[str] = None) -> list[dict]:
    """Recursively build tree from flat list."""
    children = [n for n in nodes if n["parent_id"] == parent_id]
    children.sort(key=lambda x: x["sort_order"])
    result = []
    for child in children:
        tree_node = {
            "id": child["id"],
            "label": child["label"],
            "code": child["code"],
            "level": child["level"],
            "bridge_url": child.get("bridge_url", ""),
            "children": _build_tree(nodes, child["id"]),
        }
        result.append(tree_node)
    return result


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[AssetTreeNode])
async def get_asset_tree():
    """Get the full asset hierarchy as a nested tree."""
    if _conn is None:
        raise HTTPException(503, "Database not initialized")
    rows = _conn.execute(
        "SELECT id, parent_id, level, label, code, sort_order, bridge_url FROM asset_nodes ORDER BY sort_order"
    ).fetchall()
    nodes = [_row_to_dict(r) for r in rows]
    return _build_tree(nodes, None)


@router.get("/flat", response_model=list[AssetNodeResponse])
async def get_asset_flat():
    """Get all asset nodes as a flat list."""
    if _conn is None:
        raise HTTPException(503, "Database not initialized")
    rows = _conn.execute(
        "SELECT id, parent_id, level, label, code, sort_order, bridge_url FROM asset_nodes ORDER BY level, sort_order"
    ).fetchall()
    return [_row_to_dict(r) for r in rows]


@router.post("", response_model=AssetNodeResponse, status_code=201)
async def create_asset_node(body: AssetNodeCreate):
    """Create a new asset node."""
    if _conn is None:
        raise HTTPException(503, "Database not initialized")

    # Validate parent exists (if provided)
    if body.parent_id:
        parent = _conn.execute(
            "SELECT id FROM asset_nodes WHERE id = ?", (body.parent_id,)
        ).fetchone()
        if not parent:
            raise HTTPException(404, f"Parent node '{body.parent_id}' not found")

    # Generate unique ID
    node_id = f"{body.level}-{uuid.uuid4().hex[:8]}"

    # Get next sort_order for this parent
    max_order = _conn.execute(
        "SELECT COALESCE(MAX(sort_order), -1) FROM asset_nodes WHERE parent_id IS ?",
        (body.parent_id,),
    ).fetchone()[0]

    _conn.execute(
        "INSERT INTO asset_nodes (id, parent_id, level, label, code, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        (node_id, body.parent_id, body.level, body.label, body.code, max_order + 1),
    )
    _conn.commit()

    return {
        "id": node_id,
        "parent_id": body.parent_id,
        "level": body.level,
        "label": body.label,
        "code": body.code,
        "sort_order": max_order + 1,
    }


@router.put("/{node_id}", response_model=AssetNodeResponse)
async def update_asset_node(node_id: str, body: AssetNodeUpdate):
    """Update an existing asset node's label, code, or bridge_url."""
    if _conn is None:
        raise HTTPException(503, "Database not initialized")

    existing = _conn.execute(
        "SELECT id, parent_id, level, label, code, sort_order, bridge_url FROM asset_nodes WHERE id = ?",
        (node_id,),
    ).fetchone()
    if not existing:
        raise HTTPException(404, f"Node '{node_id}' not found")

    node = _row_to_dict(existing)
    if body.label is not None:
        node["label"] = body.label
    if body.code is not None:
        node["code"] = body.code
    if body.bridge_url is not None:
        node["bridge_url"] = body.bridge_url

    _conn.execute(
        "UPDATE asset_nodes SET label = ?, code = ?, bridge_url = ? WHERE id = ?",
        (node["label"], node["code"], node["bridge_url"], node_id),
    )
    _conn.commit()
    return node


@router.put("/{node_id}/bridge", response_model=AssetNodeResponse)
async def set_bridge_url(node_id: str, body: BridgeUrlUpdate):
    """Set the bridge URL for an equipment type node."""
    if _conn is None:
        raise HTTPException(503, "Database not initialized")

    existing = _conn.execute(
        "SELECT id, parent_id, level, label, code, sort_order, bridge_url FROM asset_nodes WHERE id = ?",
        (node_id,),
    ).fetchone()
    if not existing:
        raise HTTPException(404, f"Node '{node_id}' not found")

    node = _row_to_dict(existing)
    if node["level"] != "equipmentType":
        raise HTTPException(400, "Bridge URL can only be set on equipmentType nodes")

    url = body.bridge_url.strip()
    _conn.execute(
        "UPDATE asset_nodes SET bridge_url = ? WHERE id = ?",
        (url, node_id),
    )
    _conn.commit()
    node["bridge_url"] = url
    return node


@router.delete("/{node_id}/bridge", status_code=200)
async def remove_bridge_url(node_id: str):
    """Remove the bridge URL from an equipment type node."""
    if _conn is None:
        raise HTTPException(503, "Database not initialized")

    existing = _conn.execute(
        "SELECT id FROM asset_nodes WHERE id = ?", (node_id,)
    ).fetchone()
    if not existing:
        raise HTTPException(404, f"Node '{node_id}' not found")

    _conn.execute("UPDATE asset_nodes SET bridge_url = '' WHERE id = ?", (node_id,))
    _conn.commit()
    return {"success": True, "message": "Bridge URL removed"}


def get_equipment_bridges() -> list[dict]:
    """Get all equipment type nodes that have a bridge_url configured."""
    if _conn is None:
        return []
    rows = _conn.execute(
        "SELECT id, parent_id, level, label, code, sort_order, bridge_url "
        "FROM asset_nodes WHERE level = 'equipmentType' AND bridge_url != ''"
    ).fetchall()
    return [_row_to_dict(r) for r in rows]


@router.delete("/{node_id}", status_code=204)
async def delete_asset_node(node_id: str):
    """Delete an asset node and all its descendants."""
    if _conn is None:
        raise HTTPException(503, "Database not initialized")

    existing = _conn.execute(
        "SELECT id FROM asset_nodes WHERE id = ?", (node_id,)
    ).fetchone()
    if not existing:
        raise HTTPException(404, f"Node '{node_id}' not found")

    # Delete recursively (children first due to foreign key)
    _delete_recursive(node_id)
    _conn.commit()
    return None


def _delete_recursive(node_id: str) -> None:
    """Delete a node and all descendants recursively."""
    children = _conn.execute(
        "SELECT id FROM asset_nodes WHERE parent_id = ?", (node_id,)
    ).fetchall()
    for (child_id,) in children:
        _delete_recursive(child_id)
    _conn.execute("DELETE FROM asset_nodes WHERE id = ?", (node_id,))
