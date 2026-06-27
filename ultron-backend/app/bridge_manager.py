"""
ULTRON - Industrial IoT Monitoring System
Bridge Manager: registers external bridge IP:port endpoints and polls them
for live sensor data. When data arrives from a bridge, it is broadcast to
all connected WebSocket clients via the WebSocketManager.

Architecture:
    Frontend (Settings UI) -> POST /api/bridges/register {url: "http://192.168.1.100:8765"}
    Backend stores the bridge URL and starts polling it every POLL_INTERVAL seconds.
    Each poll: GET {bridge_url}/api/live -> parse JSON -> broadcast via WebSocket.
"""

import asyncio
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.logger import logger


POLL_INTERVAL_S = 1.0
BRIDGE_TIMEOUT_S = 5.0
STALE_AFTER_S = 10.0


class BridgeInfo:
    """Runtime state for a single registered bridge."""

    def __init__(self, url: str, is_push: bool = False) -> None:
        self.id: str = uuid.uuid4().hex[:12]
        self.url: str = url.rstrip("/")
        self.is_push: bool = is_push  # True = bridge pushes data to us (works behind NAT)
        self.status: str = "connecting"  # connecting | connected | error
        self.last_seen: float = 0.0
        self.last_error: Optional[str] = None
        self.registered_at: float = time.time()
        self.poll_count: int = 0
        self.error_count: int = 0
        self.latest_data: Optional[dict] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "url": self.url,
            "isPush": self.is_push,
            "status": self.status,
            "lastSeen": self.last_seen,
            "lastError": self.last_error,
            "registeredAt": self.registered_at,
            "pollCount": self.poll_count,
            "errorCount": self.error_count,
            "hasData": self.latest_data is not None,
        }


def _normalize_bridge_data(raw: dict) -> dict:
    """
    Normalize data from a bridge response into standard ULTRON fields.
    Handles different field naming conventions from various bridge implementations.
    """
    pressure = None
    temperature = None

    # Pressure: try multiple field names
    for key in ("pressureBar", "pressure", "pressure_bar"):
        val = raw.get(key)
        if val is not None:
            try:
                pressure = float(val)
                break
            except (ValueError, TypeError):
                pass

    # If pressure is from percent, convert
    if pressure is None:
        for key in ("pressurePercent", "pressure_percent"):
            val = raw.get(key)
            if val is not None:
                try:
                    pressure = float(val) / 100.0 * 10.0  # full scale 10 bar
                    break
                except (ValueError, TypeError):
                    pass

    # Temperature: try multiple field names
    for key in ("temperatureC", "temperature", "temperature_c"):
        val = raw.get(key)
        if val is not None:
            try:
                temperature = float(val)
                break
            except (ValueError, TypeError):
                pass

    # Nested data structures (some bridges wrap in "data" or "metrics")
    nested = raw.get("data") or raw.get("metrics")
    if isinstance(nested, dict):
        if pressure is None:
            for key in ("pressureBar", "pressure"):
                val = nested.get(key)
                if val is not None:
                    try:
                        pressure = float(val)
                        break
                    except (ValueError, TypeError):
                        pass
        if temperature is None:
            for key in ("temperatureC", "temperature"):
                val = nested.get(key)
                if val is not None:
                    try:
                        temperature = float(val)
                        break
                    except (ValueError, TypeError):
                        pass

    return {
        "pressure": round(pressure, 2) if pressure is not None else 0.0,
        "temperature": round(temperature, 2) if temperature is not None else 0.0,
        "mode": raw.get("mode", "BRIDGE"),
        "fault": raw.get("fault", "UNKNOWN"),
        "connected": raw.get("connected", True),
        "raw": raw,
    }


class BridgeManager:
    """
    Manages registered bridge endpoints and polls them for live sensor data.
    """

    def __init__(self) -> None:
        self._bridges: dict[str, BridgeInfo] = {}
        self._lock = asyncio.Lock()
        self._poll_task: Optional[asyncio.Task] = None
        self._on_data_callback = None
        self._client: Optional[httpx.AsyncClient] = None

    def set_data_callback(self, callback) -> None:
        """Set callback: async fn(pressure, temperature, bridge_info) called on each successful poll."""
        self._on_data_callback = callback

    async def start(self) -> None:
        """Start the polling loop."""
        self._client = httpx.AsyncClient(timeout=BRIDGE_TIMEOUT_S)
        self._poll_task = asyncio.create_task(
            self._poll_loop(), name="ultron-bridge-poller"
        )
        logger.info("BridgeManager started (poll interval=%.1fs)", POLL_INTERVAL_S)

    async def stop(self) -> None:
        """Stop the polling loop and close HTTP client."""
        if self._poll_task:
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
        if self._client:
            await self._client.aclose()
        logger.info("BridgeManager stopped")

    async def register(self, url: str) -> BridgeInfo:
        """Register a new bridge URL. Returns the BridgeInfo."""
        url = url.rstrip("/")

        # Check for duplicate URL
        async with self._lock:
            for bridge in self._bridges.values():
                if bridge.url == url:
                    logger.info("Bridge already registered: %s (id=%s)", url, bridge.id)
                    return bridge

            bridge = BridgeInfo(url)
            self._bridges[bridge.id] = bridge

        logger.info("Bridge registered: %s (id=%s)", url, bridge.id)
        return bridge

    async def ingest(self, source: str, raw: dict) -> BridgeInfo:
        """
        Handle a reading PUSHED by a bridge (push model).

        Unlike register/poll, the bridge initiates an outbound connection to this
        backend, so it works even when the bridge sits behind NAT/firewall on a
        private LAN while the backend runs in the cloud. A virtual bridge entry
        (url = "push://<source>") is created/updated so pushed sources appear in
        the dashboard's bridge list just like polled ones.
        """
        url = f"push://{source}"

        async with self._lock:
            bridge: Optional[BridgeInfo] = None
            for existing in self._bridges.values():
                if existing.url == url:
                    bridge = existing
                    break
            if bridge is None:
                bridge = BridgeInfo(url, is_push=True)
                self._bridges[bridge.id] = bridge
                logger.info("Push bridge registered: %s (id=%s)", url, bridge.id)

        normalized = _normalize_bridge_data(raw)
        bridge.latest_data = normalized
        bridge.status = "connected"
        bridge.last_seen = time.time()
        bridge.poll_count += 1
        bridge.last_error = None

        if self._on_data_callback:
            await self._on_data_callback(
                normalized["pressure"],
                normalized["temperature"],
                bridge,
            )

        return bridge

    async def unregister(self, bridge_id: str) -> bool:
        """Remove a bridge by ID. Returns True if found and removed."""
        async with self._lock:
            bridge = self._bridges.pop(bridge_id, None)
        if bridge:
            logger.info("Bridge unregistered: %s (id=%s)", bridge.url, bridge.id)
            return True
        return False

    async def list_bridges(self) -> list[dict]:
        """Return all registered bridges as dicts."""
        async with self._lock:
            return [b.to_dict() for b in self._bridges.values()]

    @property
    def has_active_bridges(self) -> bool:
        """True if any bridge is currently connected and sending data."""
        return any(
            b.status == "connected" and b.latest_data is not None
            for b in self._bridges.values()
        )

    @property
    def active_bridge_count(self) -> int:
        return sum(1 for b in self._bridges.values() if b.status == "connected")

    async def _poll_loop(self) -> None:
        """Continuously poll all registered bridges."""
        logger.info("Bridge poll loop started")
        while True:
            try:
                async with self._lock:
                    all_bridges = list(self._bridges.values())

                # Only actively poll pull-mode bridges; push bridges deliver
                # their own data via the ingest endpoint.
                pollable = [b for b in all_bridges if not b.is_push]
                if pollable:
                    tasks = [self._poll_one(b) for b in pollable]
                    await asyncio.gather(*tasks, return_exceptions=True)

                # Mark push bridges stale if they stopped pushing.
                now = time.time()
                for b in all_bridges:
                    if b.is_push and b.last_seen > 0 and (now - b.last_seen) > STALE_AFTER_S:
                        b.status = "error"
                        b.last_error = "No data pushed recently"

            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.error("Bridge poll loop error: %s", exc, exc_info=True)

            await asyncio.sleep(POLL_INTERVAL_S)

    async def _poll_one(self, bridge: BridgeInfo) -> None:
        """Poll a single bridge for data."""
        poll_url = bridge.url + "/api/live"
        try:
            resp = await self._client.get(poll_url)
            resp.raise_for_status()
            raw = resp.json()

            normalized = _normalize_bridge_data(raw)
            bridge.latest_data = normalized
            bridge.status = "connected"
            bridge.last_seen = time.time()
            bridge.poll_count += 1
            bridge.last_error = None

            if self._on_data_callback:
                await self._on_data_callback(
                    normalized["pressure"],
                    normalized["temperature"],
                    bridge,
                )

        except httpx.TimeoutException:
            bridge.status = "error"
            bridge.error_count += 1
            bridge.last_error = "Timeout"
            if bridge.error_count % 10 == 1:
                logger.warning("Bridge poll timeout: %s", bridge.url)

        except httpx.HTTPStatusError as exc:
            bridge.status = "error"
            bridge.error_count += 1
            bridge.last_error = f"HTTP {exc.response.status_code}"
            if bridge.error_count % 10 == 1:
                logger.warning("Bridge poll HTTP error: %s -> %s", bridge.url, bridge.last_error)

        except Exception as exc:
            bridge.status = "error"
            bridge.error_count += 1
            bridge.last_error = str(exc)[:200]
            if bridge.error_count % 10 == 1:
                logger.warning("Bridge poll error: %s -> %s", bridge.url, exc)

        # Mark stale bridges
        if bridge.last_seen > 0 and (time.time() - bridge.last_seen) > STALE_AFTER_S:
            bridge.status = "error"
