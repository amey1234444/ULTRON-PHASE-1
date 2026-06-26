#!/usr/bin/env python3
"""
ULTRON Bridge Script
====================
Standalone Python script that exposes a REST API + WebSocket server at a
configurable IP:PORT. The ULTRON backend polls this bridge's /api/live
endpoint to fetch real-time sensor data.

Two modes:
  --mode dummy     Generate synthetic pressure/temperature data (for testing)
  --mode hardware  Read from a real STM32 U5 + ENC28J60 HTTP page

Usage:
  # Dummy mode (no hardware needed):
  python ultron_bridge.py --mode dummy --port 8765

  # Hardware mode (STM32 on your LAN):
  python ultron_bridge.py --mode hardware --port 8765 --stm32-url http://192.168.10.50

Then register this bridge in the ULTRON dashboard Settings page:
  http://<your-ip>:8765
"""

import argparse
import asyncio
import math
import random
import re
import time
from datetime import datetime, timezone
from typing import Optional

try:
    import uvicorn
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect
    from fastapi.middleware.cors import CORSMiddleware
except ImportError:
    print("ERROR: Missing dependencies. Install them with:")
    print("  pip install fastapi uvicorn[standard] httpx")
    raise SystemExit(1)

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# CLI Arguments
# ---------------------------------------------------------------------------

parser = argparse.ArgumentParser(
    description="ULTRON Bridge - exposes sensor data for backend polling"
)
parser.add_argument(
    "--mode",
    choices=["dummy", "hardware"],
    default="dummy",
    help="Data source: 'dummy' for synthetic data, 'hardware' for STM32 (default: dummy)",
)
parser.add_argument("--port", type=int, default=8765, help="Port to listen on (default: 8765)")
parser.add_argument("--host", default="0.0.0.0", help="Host to bind to (default: 0.0.0.0)")
parser.add_argument(
    "--stm32-url",
    default="http://192.168.10.50",
    help="STM32 U5 HTTP page URL for hardware mode (default: http://192.168.10.50)",
)
args, _unknown = parser.parse_known_args()


# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------

app = FastAPI(title="ULTRON Bridge", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Sensor Data Providers
# ---------------------------------------------------------------------------

_start_time = time.monotonic()
_poll_count = 0


class DummySensorProvider:
    """Generates realistic-looking synthetic pressure and temperature data."""

    def __init__(self) -> None:
        self._base_pressure = 7.0  # bar
        self._base_temperature = 80.0  # celsius
        self._spike_until = 0.0

    def read(self) -> dict:
        t = time.monotonic() - _start_time

        # Slow sine wave + noise + occasional spikes
        pressure = (
            self._base_pressure
            + 1.0 * math.sin(t * 0.05)
            + 0.3 * math.sin(t * 0.13)
            + random.gauss(0, 0.08)
        )

        temperature = (
            self._base_temperature
            + 5.0 * math.sin(t * 0.03 + 1.0)
            + 2.0 * math.sin(t * 0.11)
            + random.gauss(0, 0.3)
        )

        # Random spike events (~1% chance per read)
        now = time.monotonic()
        if random.random() < 0.01 and now > self._spike_until:
            self._spike_until = now + random.uniform(2.0, 5.0)
        if now < self._spike_until:
            pressure += random.uniform(1.5, 3.0)
            temperature += random.uniform(5.0, 12.0)

        return {
            "pressure": round(max(0, pressure), 2),
            "temperature": round(max(-40, temperature), 2),
            "mode": "DUMMY",
            "fault": "NORMAL",
            "connected": True,
        }


class HardwareSensorProvider:
    """Polls STM32 U5 HTTP page and parses the HTML response."""

    def __init__(self, stm32_url: str) -> None:
        self._url = stm32_url.rstrip("/")
        self._client: Optional[httpx.AsyncClient] = None
        self._last_data: dict = {
            "pressure": 0.0,
            "temperature": 0.0,
            "mode": "HARDWARE",
            "fault": "NO_CONNECTION",
            "connected": False,
        }

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None:
            if httpx is None:
                raise RuntimeError("httpx not installed. Run: pip install httpx")
            self._client = httpx.AsyncClient(timeout=5.0)
        return self._client

    async def read_async(self) -> dict:
        try:
            client = await self._ensure_client()
            resp = await client.get(self._url)
            resp.raise_for_status()
            html = resp.text
            data = self._parse_stm32_page(html)
            self._last_data = data
            return data
        except Exception as exc:
            self._last_data["connected"] = False
            self._last_data["fault"] = f"READ_ERROR: {exc}"
            return self._last_data

    def _parse_stm32_page(self, html: str) -> dict:
        """Parse the STM32 U5 HTTP page (key:value HTML rows)."""
        text = re.sub(r"<[^>]+>", "\n", html)
        rows: dict[str, str] = {}
        for line in text.splitlines():
            line = line.strip()
            if ":" in line:
                key, _, val = line.partition(":")
                rows[key.strip().upper()] = val.strip()

        mode = rows.get("MODE", "UNKNOWN")
        fault = rows.get("FAULT", "UNKNOWN")

        pressure = 0.0
        temperature = 0.0

        # Extract pressure (percent -> bar)
        pressure_str = rows.get("PRESSURE", "")
        pressure_match = re.search(r"[\d.]+", pressure_str)
        if pressure_match:
            pressure_pct = float(pressure_match.group())
            pressure = round((pressure_pct / 100.0) * 10.0, 2)

        # Extract temperature
        temp_str = rows.get("TEMPERATURE", "")
        temp_match = re.search(r"[\d.]+", temp_str)
        if temp_match:
            temperature = round(float(temp_match.group()), 2)

        # Extract resistance (for RTD mode)
        resistance = 0.0
        res_str = rows.get("RESISTANCE", "")
        res_match = re.search(r"[\d.]+", res_str)
        if res_match:
            resistance = round(float(res_match.group()), 2)

        return {
            "pressure": pressure,
            "pressureBar": pressure,
            "temperature": temperature,
            "temperatureC": temperature,
            "resistance": resistance,
            "mode": mode,
            "fault": fault,
            "connected": True,
            "adc12": rows.get("ADC12", "0"),
            "outVolt": rows.get("OUT VOLT", "0"),
            "modbusOk": rows.get("MODBUS OK", "0"),
            "modbusFail": rows.get("MODBUS FAIL", "0"),
            "httpCount": rows.get("HTTP COUNT", "0"),
        }


# Initialize provider based on mode
if args.mode == "hardware":
    _hw_provider = HardwareSensorProvider(args.stm32_url)
    _dummy_provider = None
else:
    _dummy_provider = DummySensorProvider()
    _hw_provider = None

# History buffer
_history: list[dict] = []
MAX_HISTORY = 1000


async def get_sensor_data() -> dict:
    """Get the latest sensor reading from the active provider."""
    global _poll_count
    _poll_count += 1

    if _hw_provider is not None:
        data = await _hw_provider.read_async()
    elif _dummy_provider is not None:
        data = _dummy_provider.read()
    else:
        data = {"pressure": 0.0, "temperature": 0.0, "mode": "NONE", "connected": False}

    data["timestamp"] = datetime.now(timezone.utc).isoformat()
    data["pollCount"] = _poll_count
    data["uptimeS"] = round(time.monotonic() - _start_time, 1)

    # Append to history
    _history.append(data)
    if len(_history) > MAX_HISTORY:
        del _history[: len(_history) - MAX_HISTORY]

    return data


# ---------------------------------------------------------------------------
# REST Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/device/identity")
async def device_identity():
    """Device metadata for ULTRON dashboard auto-discovery."""
    return {
        "device_name": f"ULTRON Bridge ({args.mode.upper()})",
        "device_type": "bridge",
        "machine_id": "BRIDGE-001",
        "hostname": "ultron-bridge",
        "software_version": "1.0.0",
        "supported_protocols": ["websocket", "rest"],
        "api_port": args.port,
        "bridge_mode": args.mode,
    }


@app.get("/api/live")
async def live_data():
    """Latest sensor reading. This is what the ULTRON backend polls."""
    data = await get_sensor_data()
    return {
        "ok": True,
        "connected": data.get("connected", True),
        "activeMode": args.mode.upper(),
        "ip": f"0.0.0.0:{args.port}",
        "apiBase": f"http://0.0.0.0:{args.port}",
        **data,
    }


@app.get("/api/sensors/history")
async def sensor_history():
    """Return recent historical data points."""
    return {
        "count": len(_history),
        "total_stored": len(_history),
        "readings": _history[-500:],
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "mode": args.mode,
        "uptime_s": round(time.monotonic() - _start_time, 1),
        "poll_count": _poll_count,
        "bridge_version": "1.0.0",
    }


# ---------------------------------------------------------------------------
# WebSocket Endpoint
# ---------------------------------------------------------------------------

_ws_clients: list[WebSocket] = []


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Stream sensor data at ~1 Hz via WebSocket."""
    await websocket.accept()
    _ws_clients.append(websocket)
    print(f"[WS] Client connected. Total: {len(_ws_clients)}")
    try:
        while True:
            data = await get_sensor_data()
            await websocket.send_json({
                "type": "sensor_update",
                "data": data,
                "timestamp": data["timestamp"],
                "pressure": data["pressure"],
                "temperature": data["temperature"],
                "status": "healthy" if data.get("fault") == "NORMAL" else "warning",
            })
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        print(f"[WS] Error: {exc}")
    finally:
        if websocket in _ws_clients:
            _ws_clients.remove(websocket)
        print(f"[WS] Client disconnected. Remaining: {len(_ws_clients)}")


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print(f"  ULTRON Bridge v1.0.0")
    print(f"  Mode:     {args.mode.upper()}")
    print(f"  Binding:  {args.host}:{args.port}")
    if args.mode == "hardware":
        print(f"  STM32:    {args.stm32_url}")
    print(f"  Endpoints:")
    print(f"    GET  /api/device/identity")
    print(f"    GET  /api/live")
    print(f"    GET  /api/sensors/history")
    print(f"    GET  /health")
    print(f"    WS   /ws")
    print("=" * 60)
    print()
    print(f"Register this bridge in ULTRON dashboard Settings:")
    print(f"  http://<your-ip>:{args.port}")
    print()

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
