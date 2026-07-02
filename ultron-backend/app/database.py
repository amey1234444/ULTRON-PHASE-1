"""
ULTRON — SQLite persistence layer.
Batched writes every DB_BATCH_INTERVAL_S seconds (default 1 s) to limit SD-card/disk I/O.
sqlite3 is stdlib — no extra pip dependency.
"""

import sqlite3
from pathlib import Path
from typing import Optional

from app.logger import logger

_conn: Optional[sqlite3.Connection] = None


def init_db(path: str, retention_days: int) -> None:
    global _conn
    db_path = Path(path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    _conn = sqlite3.connect(str(db_path), check_same_thread=False)
    _conn.execute("PRAGMA journal_mode=WAL")
    _conn.execute("PRAGMA synchronous=NORMAL")
    _conn.executescript("""
        CREATE TABLE IF NOT EXISTS readings (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp   TEXT    NOT NULL,
            machine_id  TEXT    NOT NULL,
            pressure    REAL    NOT NULL,
            temperature REAL,
            status      TEXT    NOT NULL,
            source      TEXT    NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(timestamp);

        CREATE TABLE IF NOT EXISTS alarms (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            triggered_at    TEXT    NOT NULL,
            alarm_type      TEXT    NOT NULL,
            severity        TEXT    NOT NULL,
            value           REAL    NOT NULL,
            threshold       REAL    NOT NULL,
            acknowledged    INTEGER NOT NULL DEFAULT 0,
            acknowledged_at TEXT
        );
    """)
    try:
        _conn.execute("ALTER TABLE readings ADD COLUMN source TEXT NOT NULL DEFAULT ''")
        logger.info("Migration: added source column to readings")
    except sqlite3.OperationalError:
        pass
    _conn.commit()
    _purge_old(retention_days)
    logger.info("SQLite ready: %s  (retention=%d days)", db_path.resolve(), retention_days)


def _purge_old(retention_days: int) -> None:
    if _conn is None or retention_days <= 0:
        return
    deleted = _conn.execute(
        "DELETE FROM readings WHERE timestamp < datetime('now', ?)",
        (f"-{retention_days} days",),
    ).rowcount
    _conn.commit()
    if deleted:
        logger.info("Purged %d readings older than %d days", deleted, retention_days)


def flush_readings(batch: list) -> int:
    """Insert a batch of reading dicts. Runs inside asyncio.to_thread."""
    if not batch or _conn is None:
        return 0
    _conn.executemany(
        "INSERT INTO readings (timestamp, machine_id, pressure, temperature, status, source) "
        "VALUES (:timestamp, :machine_id, :pressure, :temperature, :status, :source)",
        batch,
    )
    _conn.commit()
    return len(batch)


def query_history(
    from_ts: Optional[str],
    to_ts: Optional[str],
    limit: int,
) -> list:
    """Return readings newest-first. Runs inside asyncio.to_thread."""
    if _conn is None:
        return []
    clauses: list = ["source = 'bridge'"]
    params: list = []
    if from_ts:
        clauses.append("timestamp >= ?")
        params.append(from_ts)
    if to_ts:
        clauses.append("timestamp <= ?")
        params.append(to_ts)
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    params.append(min(limit, 10_000))
    rows = _conn.execute(
        f"SELECT timestamp, machine_id, pressure, temperature, status, source "
        f"FROM readings {where} ORDER BY timestamp DESC LIMIT ?",
        params,
    ).fetchall()
    return [
        {
            "timestamp": r[0],
            "machine_id": r[1],
            "pressure": r[2],
            "temperature": r[3],
            "status": r[4],
            "source": r[5],
        }
        for r in rows
    ]


def count_readings() -> int:
    if _conn is None:
        return 0
    return _conn.execute("SELECT COUNT(*) FROM readings WHERE source = 'bridge'").fetchone()[0]


def close_db() -> None:
    global _conn
    if _conn:
        _conn.close()
        _conn = None
        logger.info("SQLite closed")
