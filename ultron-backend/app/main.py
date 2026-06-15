"""
ULTRON - Industrial IoT Monitoring System
Entry point: FastAPI application with REST endpoints, WebSocket streaming,
and Modbus TCP / RTU server support.
"""

import asyncio
import csv
import io
import json
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app.config import settings
from app import database as db
from app.discovery.mdns_advertiser import MDNSAdvertiser
from app.logger import logger
from app.models import (
    DeviceIdentityResponse,
    DeviceInfo,
    HealthResponse,
    ModeChangeRequest,
    ModeChangeResponse,
    ModbusStatusResponse,
    SensorHistoryResponse,
    SensorSnapshot,
)
from app.modbus.modbus_service import ModbusService
from app.modbus.register_map import build_register_documentation
from app.sensor_manager import SensorManager
from app.websocket_manager import WebSocketManager

# ---------------------------------------------------------------------------
# Application-scoped singletons
# ---------------------------------------------------------------------------

sensor_manager  = SensorManager()
ws_manager      = WebSocketManager()
modbus_service  = ModbusService()
mdns_advertiser = MDNSAdvertiser(
    device_name     = settings.discovery.device_name,
    hostname        = settings.discovery.hostname,
    api_port        = settings.server.port,
    modbus_tcp_port = settings.modbus.tcp_port,
    version         = settings.version,
)
_start_time: float = 0.0
_reading_buffer: list = []  # staging area — flushed to SQLite every DB_BATCH_INTERVAL_S


# ---------------------------------------------------------------------------
# Combined sensor loop — read → broadcast WebSocket → update Modbus registers
# ---------------------------------------------------------------------------

async def _sensor_loop(interval: float) -> None:
    """
    Single read-and-distribute loop that:
      1. Reads both sensors concurrently (via SensorManager).
      2. Broadcasts the JSON payload to all WebSocket clients.
      3. Writes all Modbus Input Registers with the new values.

    Runs as a named asyncio.Task for the lifetime of the server.
    Individual read/broadcast/register errors are logged and skipped;
    the loop never exits on its own.
    """
    logger.info("Sensor loop started  (interval=%.0f ms)", interval * 1000)
    while True:
        try:
            reading = await sensor_manager.read()
            await ws_manager.broadcast(reading)
            modbus_service.update_registers(
                reading, uptime_s=time.monotonic() - _start_time
            )
            if settings.db.enabled:
                _reading_buffer.append({
                    "timestamp":   reading.timestamp.isoformat(),
                    "machine_id":  settings.machine_id,
                    "pressure":    reading.pressure,
                    "temperature": reading.temperature,
                    "status":      reading.status.value,
                })
        except Exception as exc:
            logger.error("Sensor loop error: %s", exc, exc_info=True)
        await asyncio.sleep(interval)


# ---------------------------------------------------------------------------
# DB flush loop — drains _reading_buffer to SQLite every batch_interval_s
# ---------------------------------------------------------------------------

async def _db_flush_loop(interval: float) -> None:
    logger.info("DB flush loop started  (interval=%.0f s)", interval)
    while True:
        await asyncio.sleep(interval)
        if not _reading_buffer:
            continue
        batch = _reading_buffer.copy()
        _reading_buffer.clear()
        try:
            written = await asyncio.to_thread(db.flush_readings, batch)
            logger.debug("DB flush: %d readings written", written)
        except Exception as exc:
            logger.error("DB flush error: %s", exc)


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown hooks
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _start_time
    _start_time = time.monotonic()

    logger.info("=" * 64)
    logger.info("  %s v%s  —  starting up", settings.app_name, settings.version)
    logger.info("  Device   : %s", settings.device_id)
    logger.info("  Mode     : %s", "SIMULATED" if settings.server.simulated else "HARDWARE")
    logger.info("  Host     : %s:%d", settings.server.host, settings.server.port)
    logger.info("  Interval : %.0f ms", settings.server.broadcast_interval * 1000)
    logger.info(
        "  Modbus TCP : %s  (port %d)",
        "ENABLED" if settings.modbus.tcp_enabled else "DISABLED",
        settings.modbus.tcp_port,
    )
    logger.info(
        "  Modbus RTU : %s  (%s @ %d baud)",
        "ENABLED" if settings.modbus.rtu_enabled else "DISABLED",
        settings.modbus.rtu_port,
        settings.modbus.rtu_baudrate,
    )
    logger.info(
        "  mDNS       : %s  (%s.local → port %d)",
        "ENABLED" if settings.discovery.mdns_enabled else "DISABLED",
        settings.discovery.hostname,
        settings.server.port,
    )
    logger.info("=" * 64)

    # Initialise SQLite (non-fatal — monitoring still works without it)
    if settings.db.enabled:
        try:
            await asyncio.to_thread(db.init_db, settings.db.path, settings.db.retention_days)
        except Exception as exc:
            logger.error("DB init failed — persistence disabled: %s", exc)

    # Initialise sensor hardware / simulator
    await sensor_manager.initialise()

    # Start Modbus servers (errors are non-fatal)
    await modbus_service.start()

    # Advertise via mDNS so the dashboard auto-discovers this device
    if settings.discovery.mdns_enabled:
        await mdns_advertiser.start_async()

    # Start the combined sensor → WS → Modbus loop
    sensor_task = asyncio.create_task(
        _sensor_loop(interval=settings.server.broadcast_interval),
        name="ultron-sensor-loop",
    )

    # Start the DB flush task (only if DB is enabled)
    db_task = None
    if settings.db.enabled:
        db_task = asyncio.create_task(
            _db_flush_loop(interval=settings.db.batch_interval_s),
            name="ultron-db-flush",
        )

    yield  # ← server is accepting requests

    # ── Shutdown ──────────────────────────────────────────────────────────────
    sensor_task.cancel()
    try:
        await sensor_task
    except asyncio.CancelledError:
        pass

    if db_task is not None:
        db_task.cancel()
        try:
            await db_task
        except asyncio.CancelledError:
            pass
        # Final flush of any buffered readings before closing
        if _reading_buffer:
            await asyncio.to_thread(db.flush_readings, _reading_buffer.copy())
        db.close_db()

    await modbus_service.stop()
    if settings.discovery.mdns_enabled:
        await mdns_advertiser.stop_async()
    logger.info("%s shut down cleanly", settings.app_name)


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title=f"{settings.app_name} Industrial Monitoring API",
    description=(
        "Real-time pressure and temperature monitoring for Raspberry Pi 4. "
        "Streams live data via WebSocket at 10 Hz and exposes process values "
        "over Modbus TCP (port 5020) and optional Modbus RTU."
    ),
    version=settings.version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten to specific origins in production
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# REST endpoints — System
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health() -> HealthResponse:
    """Liveness probe — returns 200 as long as the server is running."""
    return HealthResponse(
        status="ok",
        uptime_seconds=round(time.monotonic() - _start_time, 2),
        mode=sensor_manager.mode,
        version=settings.version,
    )


@app.get("/device", response_model=DeviceInfo, tags=["System"])
async def device_info() -> DeviceInfo:
    """Static device metadata — useful for dashboard identification panels."""
    return DeviceInfo(
        device_id=settings.device_id,
        app_name=settings.app_name,
        version=settings.version,
        pressure_sensor=settings.sensor.pressure_name,
        temperature_sensor=settings.sensor.temperature_name,
        broadcast_interval_ms=int(settings.server.broadcast_interval * 1000),
        mode=sensor_manager.mode,
    )


# ---------------------------------------------------------------------------
# REST endpoint — Device identity (used by auto-discovery)
# ---------------------------------------------------------------------------

@app.get(
    "/api/device/identity",
    response_model=DeviceIdentityResponse,
    tags=["System"],
    summary="Static device identity for auto-discovery",
)
async def device_identity() -> DeviceIdentityResponse:
    """
    Returns static device identity information used by auto-discovery clients
    (dashboard, Python discovery agent, SCADA tools) to confirm this is an
    ULTRON Edge device and to learn which protocols are available.

    This endpoint is intentionally unauthenticated — it is the "handshake" that
    allows clients to discover and identify the device before establishing a
    full connection.
    """
    protocols = ["websocket"]
    if settings.modbus.tcp_enabled:
        protocols.append("modbus_tcp")
    if settings.modbus.rtu_enabled:
        protocols.append("modbus_rtu")

    return DeviceIdentityResponse(
        device_name         = settings.discovery.device_name,
        device_type         = "raspberry_pi_gateway",
        hostname            = settings.discovery.hostname,
        machine_id          = settings.machine_id,
        serial_number       = "Unknown / needs verification",
        software_version    = settings.version,
        supported_protocols = protocols,
        api_port            = settings.server.port,
        modbus_tcp_port     = settings.modbus.tcp_port,
    )


# ---------------------------------------------------------------------------
# REST endpoints — Control
# ---------------------------------------------------------------------------

@app.post(
    "/api/control/mode",
    response_model=ModeChangeResponse,
    tags=["Control"],
    summary="Switch between simulated and hardware sensor mode",
)
async def set_sensor_mode(request: ModeChangeRequest) -> ModeChangeResponse:
    """
    Hot-swap the sensor implementation at runtime without restarting.

    - `simulated: true`  → Use built-in pressure/temperature simulator (always works).
    - `simulated: false` → Use real hardware sensors (requires Pi GPIO/I2C drivers).

    If switching to hardware fails (e.g. running on a non-Pi machine or sensors
    not wired), the server stays in simulation mode and returns `success: false`.
    """
    success, message = await sensor_manager.set_mode(request.simulated)
    return ModeChangeResponse(
        success=success,
        mode=sensor_manager.mode,
        message=message,
    )


# ---------------------------------------------------------------------------
# REST endpoints — Sensors
# ---------------------------------------------------------------------------

@app.get("/sensors/latest", response_model=SensorSnapshot, tags=["Sensors"])
async def latest_sensor_values() -> SensorSnapshot:
    """
    Returns the most recent sensor reading cached by the sensor loop.
    Useful for one-shot REST clients that do not need a WebSocket stream.
    """
    reading = sensor_manager.latest
    if reading is None:
        return SensorSnapshot(message="No reading available yet — server may still be initialising")
    return SensorSnapshot(reading=reading, message="ok")


@app.get(
    "/api/sensors/export",
    tags=["Sensors"],
    summary="Export sensor readings as CSV",
)
async def export_sensors_csv(
    from_ts: Optional[str] = None,
    to_ts:   Optional[str] = None,
    limit:   int           = 100_000,
) -> Response:
    """
    Returns persisted readings as a downloadable CSV file.

    - **from_ts** / **to_ts**: ISO-8601 UTC timestamps for time-range filtering (optional).
    - **limit**: maximum rows (default 100 000, hard-capped at 100 000).
    """
    rows = await asyncio.to_thread(db.query_history, from_ts, to_ts, min(limit, 100_000)) \
        if settings.db.enabled else []
    rows_chrono = list(reversed(rows))  # oldest-first

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=['timestamp', 'machine_id', 'pressure', 'temperature', 'status'])
    writer.writeheader()
    writer.writerows(rows_chrono)

    filename = f"ultron-{settings.machine_id}-export.csv"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get(
    "/api/sensors/history",
    response_model=SensorHistoryResponse,
    tags=["Sensors"],
    summary="Historical sensor readings from SQLite",
)
async def sensor_history(
    from_ts: Optional[str] = None,
    to_ts:   Optional[str] = None,
    limit:   int           = 1000,
) -> SensorHistoryResponse:
    """
    Returns persisted sensor readings from the local SQLite database.

    - **from_ts** / **to_ts**: ISO-8601 UTC timestamps for time-range filtering (optional).
    - **limit**: maximum rows returned (default 1000, max 10 000).

    Example:
        GET /api/sensors/history?from_ts=2026-06-05T00:00:00Z&limit=500
    """
    if not settings.db.enabled:
        return SensorHistoryResponse(count=0, total_stored=0, readings=[])
    rows = await asyncio.to_thread(db.query_history, from_ts, to_ts, limit)
    total = await asyncio.to_thread(db.count_readings)
    return SensorHistoryResponse(count=len(rows), total_stored=total, readings=rows)


# ---------------------------------------------------------------------------
# REST endpoints — Modbus
# ---------------------------------------------------------------------------

@app.get(
    "/api/modbus/status",
    response_model=ModbusStatusResponse,
    tags=["Modbus"],
    summary="Modbus server runtime status",
)
async def modbus_status() -> JSONResponse:
    """
    Returns the current runtime status of the Modbus subsystem:
    which servers are enabled, which are running, the active slave ID,
    total register update count, and the timestamp of the last update.
    """
    return JSONResponse(content=modbus_service.status())


@app.get(
    "/api/modbus/register-map",
    tags=["Modbus"],
    summary="Full Modbus Input Register map documentation",
)
async def modbus_register_map() -> JSONResponse:
    """
    Returns the complete Input Register map (FC4, 3xxxx addresses) with:
    - PDU addresses, display addresses, data types, units, and descriptions
    - Byte order documentation for Float32 encoding
    - Compatibility integer registers
    - Reserved Holding Register (4xxxx) plan for future configuration writes
    """
    return JSONResponse(content=build_register_documentation())


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    ws://host:8000/ws

    Streams sensor readings as JSON objects at the configured broadcast interval.
    The connection is kept alive until the client disconnects or an unrecoverable
    error occurs; reconnection is handled on the client side.

    Payload schema:
        {
          "timestamp":   "2026-06-01T10:00:00+00:00",
          "pressure":    7.3,
          "temperature": 82.1,
          "status":      "healthy"
        }
    """
    await ws_manager.connect(websocket)
    try:
        # Keep the handler alive while the sensor loop pushes data independently.
        # Also handles application-level ping/pong for accurate latency measurement.
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
                try:
                    frame = json.loads(msg)
                    if isinstance(frame, dict) and frame.get("type") == "ping":
                        await websocket.send_text(
                            json.dumps({"type": "pong", "t": frame.get("t")})
                        )
                except Exception:
                    pass
            except asyncio.TimeoutError:
                pass  # no message — normal; just loop
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error("Unexpected WebSocket error: %s", exc, exc_info=True)
    finally:
        await ws_manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# Dev entry-point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.server.host,
        port=settings.server.port,
        reload=False,
        log_level=settings.log.level.lower(),
    )
