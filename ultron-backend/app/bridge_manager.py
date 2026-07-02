"""
ULTRON - Industrial IoT Monitoring System
Bridge Manager: polls bridge endpoints configured per equipment type.
Each equipment type node can have a bridge_url; this manager polls all
configured bridges and delivers data tagged with equipment_type_id.
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

    def __init__(self, url: str, equipment_type_id: str = "") -> None:
        self.id: str = uuid.uuid4().hex[:12]
        self.url: str = url.rstrip("/")
        self.equipment_type_id: str = equipment_type_id
        self.status: str = "connecting"  # connecting | connected | error
        self.last_seen: float = 0.0
        self.last_error: Optional[str] = None
        self.registered_at: float = time.time()
        self.poll_count: int = 0
        self.error_count: int = 0
        self.latest_data: Optional[dict] = None
        self.machine_id: Optional[str] = None
        self.reported_ip: Optional[str] = None
        self.device_node_id: Optional[str] = None

    @property
    def is_push(self) -> bool:
        return self.url.startswith("push://")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "url": self.url,
            "isPush": self.is_push,
            "equipmentTypeId": self.equipment_type_id,
            "status": self.status,
            "lastSeen": self.last_seen,
            "lastError": self.last_error,
            "registeredAt": self.registered_at,
            "pollCount": self.poll_count,
            "errorCount": self.error_count,
            "hasData": self.latest_data is not None,
            "machineId": self.machine_id,
            "reportedIp": self.reported_ip,
            "deviceNodeId": self.device_node_id,
        }


def _normalize_bridge_data(raw: dict) -> dict:
    """Normalize data from a bridge response into standard ULTRON fields."""
    pressure = None
    temperature = None

    for key in ("pressureBar", "pressure", "pressure_bar"):
        val = raw.get(key)
        if val is not None:
            try:
                pressure = float(val)
                break
            except (ValueError, TypeError):
                pass

    if pressure is None:
        for key in ("pressurePercent", "pressure_percent"):
            val = raw.get(key)
            if val is not None:
                try:
                    pressure = float(val) / 100.0 * 10.0
                    break
                except (ValueError, TypeError):
                    pass

    for key in ("temperatureC", "temperature", "temperature_c"):
        val = raw.get(key)
        if val is not None:
            try:
                temperature = float(val)
                break
            except (ValueError, TypeError):
                pass

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
    """Manages per-equipment-type bridge polling."""

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
        self._client = httpx.AsyncClient(timeout=BRIDGE_TIMEOUT_S)
        self._poll_task = asyncio.create_task(
            self._poll_loop(), name="ultron-bridge-poller"
        )
        logger.info("BridgeManager started (poll interval=%.1fs)", POLL_INTERVAL_S)

    async def stop(self) -> None:
        if self._poll_task:
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
        if self._client:
            await self._client.aclose()
        logger.info("BridgeManager stopped")

    async def register(self, url: str, equipment_type_id: str = "") -> BridgeInfo:
        """Register a new bridge URL, optionally tied to an equipment type."""
        url = url.rstrip("/")
        async with self._lock:
            for bridge in self._bridges.values():
                if bridge.url == url:
                    if equipment_type_id and bridge.equipment_type_id != equipment_type_id:
                        bridge.equipment_type_id = equipment_type_id
                    return bridge
            bridge = BridgeInfo(url, equipment_type_id)
            self._bridges[bridge.id] = bridge
        logger.info("Bridge registered: %s (id=%s, equipment=%s)", url, bridge.id, equipment_type_id)
        return bridge

    async def unregister(self, bridge_id: str) -> bool:
        async with self._lock:
            bridge = self._bridges.pop(bridge_id, None)
        if bridge:
            logger.info("Bridge unregistered: %s (id=%s)", bridge.url, bridge.id)
            return True
        return False

    async def unregister_by_equipment(self, equipment_type_id: str) -> bool:
        """Remove bridge associated with an equipment type."""
        async with self._lock:
            to_remove = [
                bid for bid, b in self._bridges.items()
                if b.equipment_type_id == equipment_type_id
            ]
            for bid in to_remove:
                self._bridges.pop(bid, None)
        return len(to_remove) > 0

    async def list_bridges(self) -> list[dict]:
        async with self._lock:
            return [b.to_dict() for b in self._bridges.values()]

    async def ingest(
        self,
        source_key: str,
        raw: dict,
        machine_id: str = "",
        reported_ip: str = "",
        device_node_id: Optional[str] = None,
    ) -> BridgeInfo:
        """Accept a pushed reading (push model). Creates/reuses a BridgeInfo for the source."""
        async with self._lock:
            # Reuse existing push-bridge or create one keyed by source_key
            bridge = None
            for b in self._bridges.values():
                if b.url == f"push://{source_key}":
                    bridge = b
                    break
            if bridge is None:
                bridge = BridgeInfo(f"push://{source_key}", device_node_id or "")
                bridge.url = f"push://{source_key}"
                self._bridges[bridge.id] = bridge
                logger.info("Push bridge created: %s (id=%s)", source_key, bridge.id)

        normalized = _normalize_bridge_data(raw)
        bridge.latest_data = normalized
        bridge.status = "connected"
        bridge.last_seen = time.time()
        bridge.poll_count += 1
        bridge.last_error = None
        bridge.machine_id = machine_id
        bridge.reported_ip = reported_ip
        bridge.device_node_id = device_node_id
        if device_node_id:
            bridge.equipment_type_id = device_node_id

        if self._on_data_callback:
            await self._on_data_callback(
                normalized["pressure"],
                normalized["temperature"],
                bridge,
            )

        return bridge

    def get_bridge_for_equipment(self, equipment_type_id: str) -> Optional[BridgeInfo]:
        """Get the bridge for a specific equipment type."""
        for b in self._bridges.values():
            if b.equipment_type_id == equipment_type_id:
                return b
        return None

    @property
    def has_active_bridges(self) -> bool:
        return any(
            b.status == "connected" and b.latest_data is not None
            for b in self._bridges.values()
        )

    @property
    def active_bridge_count(self) -> int:
        return sum(1 for b in self._bridges.values() if b.status == "connected")

    async def sync_from_asset_db(self) -> None:
        """Sync bridge registrations from asset hierarchy DB (equipment type bridge_urls)."""
        from app.asset_hierarchy import get_equipment_bridges
        configured = get_equipment_bridges()
        configured_urls = {n["id"]: n["bridge_url"] for n in configured}

        async with self._lock:
            # Remove bridges no longer in config
            to_remove = [
                bid for bid, b in self._bridges.items()
                if b.equipment_type_id and b.equipment_type_id not in configured_urls
            ]
            for bid in to_remove:
                removed = self._bridges.pop(bid)
                logger.info("Bridge auto-removed: %s (equipment %s gone)", removed.url, removed.equipment_type_id)

            # Add/update bridges from config
            existing_by_equip = {
                b.equipment_type_id: b for b in self._bridges.values() if b.equipment_type_id
            }
            for equip_id, url in configured_urls.items():
                if equip_id in existing_by_equip:
                    if existing_by_equip[equip_id].url != url.rstrip("/"):
                        existing_by_equip[equip_id].url = url.rstrip("/")
                        existing_by_equip[equip_id].status = "connecting"
                        existing_by_equip[equip_id].poll_count = 0
                else:
                    bridge = BridgeInfo(url, equip_id)
                    self._bridges[bridge.id] = bridge
                    logger.info("Bridge auto-registered: %s for equipment %s", url, equip_id)

    async def _poll_loop(self) -> None:
        logger.info("Bridge poll loop started")
        sync_counter = 0
        while True:
            try:
                # Sync from DB every 10 cycles (10s)
                sync_counter += 1
                if sync_counter % 10 == 0:
                    await self.sync_from_asset_db()

                async with self._lock:
                    bridges = list(self._bridges.values())

                if bridges:
                    tasks = [self._poll_one(b) for b in bridges]
                    await asyncio.gather(*tasks, return_exceptions=True)

            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.error("Bridge poll loop error: %s", exc, exc_info=True)

            await asyncio.sleep(POLL_INTERVAL_S)

    async def _poll_one(self, bridge: BridgeInfo) -> None:
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

        if bridge.last_seen > 0 and (time.time() - bridge.last_seen) > STALE_AFTER_S:
            bridge.status = "error"
