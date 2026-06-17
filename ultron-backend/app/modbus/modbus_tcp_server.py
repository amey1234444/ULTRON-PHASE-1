"""
ULTRON Modbus TCP Server Wrapper
=================================
Hosts a Modbus TCP slave on a configurable host:port.

The server shares a ``ModbusServerContext`` with ``ModbusService``, so register
values written by the service are immediately visible to connected clients
(PLCs, SCADA, HMIs, Modbus Poll, QModMaster).

Isolation design
----------------
- Runs as a named ``asyncio.Task``; errors inside the task are logged and
  caught without propagating to FastAPI or WebSocket subsystems.
- If pymodbus is not installed the class logs an error and ``start()``
  returns ``False``; no exception is raised to the caller.
- ``stop()`` cancels the task and calls ``server.shutdown()`` gracefully.
"""

import asyncio
from typing import Optional

from app.logger import logger

try:
    from pymodbus.device import ModbusDeviceIdentification
    from pymodbus.server import ModbusTcpServer
    _PYMODBUS_AVAILABLE = True
except ImportError:
    _PYMODBUS_AVAILABLE = False


class ModbusTcpServerWrapper:
    """Lifecycle manager for a Modbus TCP server running as an asyncio task."""

    def __init__(
        self,
        context,     # pymodbus ModbusServerContext
        host: str,
        port: int,
    ) -> None:
        self._context = context
        self._host = host
        self._port = port
        self._server: Optional[object] = None
        self._task: Optional[asyncio.Task] = None
        self.running: bool = False

    # ── Public API ─────────────────────────────────────────────────────────────

    async def start(self) -> bool:
        """
        Bind and start the Modbus TCP server as a background asyncio task.

        Returns:
            True  — server started and task is running.
            False — pymodbus unavailable or bind failed.
        """
        if not _PYMODBUS_AVAILABLE:
            logger.error(
                "pymodbus is not installed — Modbus TCP server cannot start. "
                "Run: pip install pymodbus"
            )
            return False

        identity = _build_identity()

        try:
            self._server = ModbusTcpServer(
                context=self._context,
                identity=identity,
                address=(self._host, self._port),
            )
            self._task = asyncio.create_task(
                self._run(),
                name="ultron-modbus-tcp",
            )
            self.running = True
            logger.info(
                "Modbus TCP server started  |  address=%s:%d",
                self._host, self._port,
            )
            return True
        except Exception as exc:
            logger.error(
                "Modbus TCP server failed to start: %s", exc, exc_info=True
            )
            self.running = False
            return False

    async def stop(self) -> None:
        """Gracefully shut down the Modbus TCP server and cancel the task."""
        if self._server is not None:
            try:
                await self._server.shutdown()
            except Exception as exc:
                logger.warning("Modbus TCP shutdown warning: %s", exc)

        if self._task is not None and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        self.running = False
        logger.info("Modbus TCP server stopped")

    # ── Internal ───────────────────────────────────────────────────────────────

    async def _run(self) -> None:
        """Run ``serve_forever()`` and handle cancellation / unexpected errors."""
        try:
            await self._server.serve_forever()
        except asyncio.CancelledError:
            logger.info("Modbus TCP server task cancelled")
        except Exception as exc:
            logger.error("Modbus TCP server runtime error: %s", exc, exc_info=True)
        finally:
            self.running = False


# ── Shared helper ─────────────────────────────────────────────────────────────

def _build_identity():
    """Return a ``ModbusDeviceIdentification`` with ULTRON vendor information."""
    return ModbusDeviceIdentification(
        info_name={
            "VendorName":         "Oswar Software",
            "ProductCode":        "ULTRON",
            "VendorUrl":          "https://oswar.com",
            "ProductName":        "ULTRON Industrial IoT Monitor",
            "ModelName":          "ULTRON-RPi4-001",
            "MajorMinorRevision": "1.0",
        }
    )
