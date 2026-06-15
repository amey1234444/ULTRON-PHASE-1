# DATABASE.md
## ULTRON — Data Storage Documentation

**Purpose:** Document the data storage strategy for ULTRON — current state, planned implementation, and architectural decisions.
**Last Updated:** 2026-06-02
**Audience:** Backend developers, infrastructure engineers

> Cross-references: [SOFTWARE.md](SOFTWARE.md) | [API.md](API.md) | [ROADMAP.md](ROADMAP.md) | [DECISIONS.md](DECISIONS.md)

---

## Current State (Phase 1)

**There is no persistent data storage in Phase 1.**

All sensor readings exist only in memory (Zustand `sensorStore` in the frontend).

| Aspect | Current |
|--------|---------|
| Persistent storage | ❌ None |
| Database | ❌ None |
| Data retention | In-memory only — lost when app closes |
| Max in-memory readings | 1000 (ring buffer in `sensorStore`) |
| Historical queries | ❌ Not possible |
| Export | ❌ Not implemented |

This is acceptable for Phase 1 (demo / proof of concept).

---

## Phase 2 — Planned Storage

Data persistence is required for:
1. Historical trend queries (view data from hours/days ago)
2. Alarm history log (when did alarm occur, when was it acknowledged)
3. Maintenance records
4. Predictive maintenance trend analysis (Phase 3)

### Decision Status

**Storage technology:** Unknown / needs verification

The following options are under evaluation:

---

## Storage Options Analysis

### Option A — SQLite (Local, Embedded)

**Architecture:**
```
Raspberry Pi
└── SQLite database file (.db)
    └── ULTRON backend writes readings every 100ms (or batched)
```

| Property | Detail |
|----------|--------|
| Type | Embedded relational database |
| Location | Raspberry Pi filesystem |
| Schema | Tables: readings, alarms, events |
| Query language | SQL |
| Concurrent access | Single writer; multiple readers OK |
| Write rate | Max ~100 writes/sec sustained |

**Write rate concern:** 10 Hz × 60 s/min × 60 min = 36,000 readings/hour. If writing every reading, this may cause I/O stress on Raspberry Pi SD card. **Solution: batch writes every 1 second instead of every 100 ms.**

**Retention:** Configure rolling delete — keep last N days.

```sql
-- Schema proposal (not yet implemented)
CREATE TABLE readings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT NOT NULL,       -- ISO-8601 UTC
    pressure    REAL NOT NULL,       -- bar
    temperature REAL NOT NULL,       -- °C
    status      TEXT NOT NULL        -- 'healthy', 'warning', 'critical'
);

CREATE TABLE alarms (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    triggered_at  TEXT NOT NULL,
    acknowledged_at TEXT,
    alarm_type    TEXT NOT NULL,     -- 'high_pressure', 'high_temperature', etc.
    severity      TEXT NOT NULL,     -- 'warning', 'critical'
    value         REAL NOT NULL,
    threshold     REAL NOT NULL,
    acknowledged  INTEGER DEFAULT 0
);

CREATE INDEX idx_readings_timestamp ON readings(timestamp);
```

**Recommended:** YES — simple, no additional dependencies, works offline.

---

### Option B — InfluxDB (Time-Series)

**Architecture:**
```
Raspberry Pi
└── InfluxDB (time-series database)
    └── Measurements: sensor_data, alarms
```

| Property | Detail |
|----------|--------|
| Type | Purpose-built time-series database |
| Write rate | Handles millions of points/second |
| Query language | Flux or InfluxQL |
| Retention policies | Built-in — automatic data downsampling |
| Dashboard integration | Grafana (future external dashboard) |

**Advantages:**
- Purpose-built for sensor time-series
- Built-in data downsampling (store 1 s resolution for 7 days, 1 min resolution for 1 year)
- Excellent for Phase 3 FFT/analytics

**Disadvantages:**
- More complex than SQLite
- Requires InfluxDB process running on RPi (memory overhead)
- Harder to backup and migrate

**Recommended for Phase 3+** if FFT analysis and long-term trend analytics are required.

---

### Option C — PostgreSQL (Full Relational)

Not recommended for Raspberry Pi Phase 1 — too heavy. Consider for Phase 5 cloud backend.

---

### Option D — TimescaleDB (PostgreSQL + time-series extensions)

Suitable for Phase 5 cloud deployment. Not for Raspberry Pi.

---

## Recommended Architecture by Phase

| Phase | Storage | Rationale |
|-------|---------|-----------|
| Phase 1 | None (in-memory) | MVP demo — no storage needed |
| Phase 2 | SQLite on RPi | Simple, no deps, handles alarm log + short-term history |
| Phase 3 | InfluxDB on RPi (or SQLite with downsampling) | FFT data needs time-series optimisation |
| Phase 5 | Cloud: TimescaleDB or InfluxDB Cloud | Fleet monitoring, long-term analytics |

---

## Data Retention Strategy (Planned)

When SQLite is implemented:

| Data Type | Retention | Downsampling |
|-----------|-----------|-------------|
| Raw sensor readings (100 ms) | 1 day | No |
| 1-second averages | 30 days | Computed from raw |
| 1-minute averages | 1 year | Computed from 1s |
| Alarm records | Permanent | Never deleted |
| Event log | 1 year | Never downsampled |

Retention cleanup: background task runs daily, deletes old records.

---

## Backup Strategy (Planned)

For Phase 2 SQLite:
- Nightly backup of `.db` file to USB drive or network share
- `sqlite3 backup` command (online hot backup)
- Optional: rsync to remote server via SSH

For Phase 5 cloud:
- Managed database backup (AWS RDS/GCP CloudSQL/InfluxDB Cloud)
- Unknown / needs verification for final cloud provider

---

## Export Strategy (Planned)

Phase 2+:
- `GET /api/sensors/history?from=2026-06-01&to=2026-06-02&format=csv` → CSV download
- `GET /api/alarms/export?format=csv` → Alarm history CSV
- Future: PDF report generation

---

## Cloud Sync (Phase 5 — Future)

When cloud sync is implemented:

```
Raspberry Pi (edge)
└── SQLite / InfluxDB (local buffer — 30 day retention)
        ↓ (periodic sync, MQTT or REST batch upload)
Cloud (Phase 5)
└── TimescaleDB / InfluxDB Cloud
    ├── 1 year retention raw
    └── 5 year retention downsampled
```

- Edge device buffers data locally even when offline
- Syncs to cloud when network available
- De-duplicates on upload using timestamp primary key

---

## Configuration Keys (When Implemented)

These `.env` keys will be added when storage is implemented:

```ini
# Database (Phase 2 — not yet implemented)
DB_TYPE=sqlite               # sqlite | influxdb
DB_PATH=./data/ultron.db     # SQLite path
DB_RETENTION_DAYS=30         # How many days of raw data to keep
DB_BATCH_INTERVAL_S=1        # Write every N seconds (batch)
```
