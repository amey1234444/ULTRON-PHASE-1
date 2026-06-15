"""
ULTRON Modbus RTU Server Wrapper
==================================
Hosts a Modbus RTU slave over a serial RS485 port.

Supported ports
---------------
Linux  : /dev/ttyUSB0, /dev/ttyUSB1, /dev/ttyAMA0, /dev/ttyS0
Windows: COM1, COM2, COM3, COM4

Graceful degradation
--------------------
If the RS485 adapter is not present (port missing, permission denied, pyserial
missing) the server logs a WARNING and returns ``False`` from ``start()``.
All other subsystems — FastAPI, WebSocket, Modbus TCP — continue unaffected.

Isolation design
----------------
Same asyncio.Task pattern as ``ModbusTcpServerWrapper``.
"""

import asyncio
from typing import Optional

from app.logger import logger

try:
    from pymodbus.device import ModbusDeviceIdentification
    from pymodbus.framer import FramerType
    from pymodbus.server import ModbusSerialServer
    _PYMODBUS_AVAILABLE = True
except ImportError:
    _PYMODBUS_AVAILABLE = False


class ModbusRtuServerWrapper:
    """Lifecycle manager for a Modbus RTU serial server running as an asyncio task."""

    def __init__(
        self,
        context,          # pymodbus ModbusServerContext
        port: str,
        baudrate: int,
        parity: str,
        stopbits: int,
        bytesize: int,
    ) -> None:
        self._context = context
        self._port = port
        self._baudrate = baudrate
        self._parity = parity
        self._stopbits = stopbits
        self._bytesize = bytesize
        self._server: Optional[object] = None
        self._task: Optional[asyncio.Task] = None
        self.running: bool = False

    # ── Public API ─────────────────────────────────────────────────────────────

    async def start(self) -> bool:
        """
        Open the serial port and start the Modbus RTU server as an asyncio task.

        Returns:
            True  — server started successfully.
            False — serial hardware unavailable, pymodbus/pyserial missing,
                    or port permission denied.  All other services continue.
        """
        if not _PYMODBUS_AVAILABLE:
            logger.warning(
                "pymodbus / pyserial not installed — Modbus RTU server disabled. "
                "Run: pip install pymodbus pyserial"
            )
            return False

        identity = _build_rtu_identity()

        try:
            self._server = ModbusSerialServer(
                context=self._context,
                framer=FramerType.RTU,
                identity=identity,
                port=self._port,
                baudrate=self._baudrate,
                parity=self._parity,
                stopbits=self._stopbits,
                bytesize=self._bytesize,
            )
            self._task = asyncio.create_task(
                self._run(),
                name="ultron-modbus-rtu",
            )
            self.running = True
            logger.info(
                "Modbus RTU server started  |  port=%s  baud=%d  parity=%s  stop=%d  bits=%d",
                self._port, self._baudrate, self._parity, self._stopbits, self._bytesize,
            )
            return True
        except Exception as exc:
            logger.warning(
                "Modbus RTU server could not start (port=%s): %s  "
                "— RTU disabled; WebSocket and Modbus TCP continue normally.",
                self._port, exc,
            )
            self.running = False
            return False

    async def stop(self) -> None:
        """Gracefully shut down the RTU server and cancel the task."""
        if self._server is not None:
            try:
                await self._server.shutdown()
            except Exception as exc:
                logger.warning("Modbus RTU shutdown warning: %s", exc)

        if self._task is not None and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        self.running = False
        logger.info("Modbus RTU server stopped")

    # ── Internal ───────────────────────────────────────────────────────────────

    async def _run(self) -> None:
        """Run ``serve_forever()`` and handle cancellation / unexpected errors."""
        try:
            await self._server.serve_forever()
        except asyncio.CancelledError:
            logger.info("Modbus RTU server task cancelled")
        except Exception as exc:
            logger.error("Modbus RTU server runtime error: %s", exc, exc_info=True)
        finally:
            self.running = False


# ── Shared helper ─────────────────────────────────────────────────────────────

def _build_rtu_identity():
    return ModbusDeviceIdentification(
        info_name={
            "VendorName":         "Oswar Software",
            "ProductCode":        "ULTRON-RTU",
            "VendorUrl":          "https://oswar.com",
            "ProductName":        "ULTRON Industrial IoT Monitor",
            "ModelName":          "ULTRON-RPi4-001",
            "MajorMinorRevision": "1.0",
        }
    )
