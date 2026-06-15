"""
ULTRON - Industrial IoT Monitoring System
WebSocket Manager: tracks active connections and broadcasts sensor payloads.

Design notes:
  - Connection set is protected by an asyncio.Lock to avoid race conditions
    between concurrent connect/disconnect/broadcast coroutines.
  - Dead connections are removed silently during broadcast; the exception is
    logged but does NOT crash the broadcast loop.
"""

import asyncio
import json
from typing import Set

from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.logger import logger
from app.models import SensorReading


class WebSocketManager:
    def __init__(self) -> None:
        self._connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)
        client = websocket.client
        logger.info("WebSocket connected: %s | active=%d", client, len(self._connections))

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)
        client = websocket.client
        logger.info("WebSocket disconnected: %s | active=%d", client, len(self._connections))

    # ------------------------------------------------------------------
    # Broadcast
    # ------------------------------------------------------------------

    async def broadcast(self, reading: SensorReading) -> None:
        """
        Serialise *reading* and push it to every connected client.
        Clients whose connections have gone stale are removed from the set.
        """
        if not self._connections:
            return

        payload = reading.model_dump_json()

        async with self._lock:
            snapshot = set(self._connections)

        dead: Set[WebSocket] = set()
        for ws in snapshot:
            try:
                if ws.client_state == WebSocketState.CONNECTED:
                    await ws.send_text(payload)
                else:
                    dead.add(ws)
            except Exception as exc:
                logger.warning("Broadcast failed for %s: %s", ws.client, exc)
                dead.add(ws)

        if dead:
            async with self._lock:
                self._connections -= dead
            logger.debug("Removed %d stale WebSocket connection(s)", len(dead))

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def active_connections(self) -> int:
        return len(self._connections)

    # ------------------------------------------------------------------
    # Background broadcast loop
    # ------------------------------------------------------------------

    async def run_broadcast_loop(
        self,
        sensor_read_fn,          # async callable → SensorReading
        interval: float,         # seconds between broadcasts
    ) -> None:
        """
        Continuous loop: read sensors → broadcast → sleep.
        Runs as an asyncio background task for the lifetime of the server.
        Errors in individual reads are logged and skipped; the loop never exits.
        """
        logger.info("Broadcast loop started (interval=%.0f ms)", interval * 1000)
        while True:
            try:
                reading = await sensor_read_fn()
                await self.broadcast(reading)
            except Exception as exc:
                logger.error("Error in broadcast loop: %s", exc, exc_info=True)
            await asyncio.sleep(interval)
