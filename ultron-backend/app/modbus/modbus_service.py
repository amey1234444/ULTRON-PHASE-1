"""
ULTRON Modbus Service
======================
Central orchestrator for the entire Modbus subsystem.

Responsibilities
----------------
1. Own the shared ``ModbusServerContext`` (in-memory register data store).
2. Start and stop the Modbus TCP server (always attempted when tcp_enabled).
3. Start and stop the Modbus RTU server (only when rtu_enabled; failure is
   non-fatal — a warning is logged and all other services continue).
4. Translate every ``SensorReading`` → Modbus register values via the
   converters and alarm calculator modules.
5. Maintain a heartbeat counter and update statistics for the status API.

Integration with the sensor pipeline
-------------------------------------
``main.py`` calls ``modbus_service.update_registers(reading, uptime_s)``
after every sensor read.  This is a pure in-memory operation (no I/O) and
is safe to call from the asyncio event loop.

Startup / shutdown
------------------
``await modbus_service.start()`` is called inside the FastAPI lifespan
context *after* the sensor manager is ready.
``await modbus_service.stop()`` is called on shutdown.
Failures in the Modbus subsystem do NOT raise exceptions to the caller.
"""

from datetime import datetime, timezone
from typing import Optional

from app.config import settings
from app.logger import logger
from app.models import SensorReading
from app.modbus.alarms import pressure_alarm, temperature_alarm
from app.modbus.converters import float_to_registers, uint32_to_registers
from app.modbus.register_map import (
    COMM_MODBUS_RTU,
    COMM_MODBUS_TCP,
    COMM_TCP_RTU,
    COMM_WEBSOCKET,
    DEVICE_TYPE_RPI_GATEWAY,
    FAULT_NONE,
    HEALTH_HEALTHY,
    PROTO_BIT_MODBUS_RTU,
    PROTO_BIT_MODBUS_TCP,
    PROTO_BIT_WEBSOCKET,
    REG_COMM_MODE,
    REG_COMPAT_PRESSURE_INT,
    REG_COMPAT_TEMP_INT,
    REG_DEVICE_HEALTH,
    REG_DEVICE_TYPE_CODE,
    REG_HEARTBEAT,
    REG_ID_SIG_0,
    REG_PRESSURE_ALARM,
    REG_PRESSURE_H,
    REG_PRESSURE_L,
    REG_PROTO_BITMAP,
    REG_SENSOR_FAULT,
    REG_SW_MAJOR,
    REG_SW_MINOR,
    REG_SW_PATCH,
    REG_TEMP_ALARM,
    REG_TEMP_H,
    REG_TEMP_L,
    REG_UPTIME_H,
    REG_UPTIME_L,
    TOTAL_INPUT_REGISTERS,
    _IDENTITY_SIGNATURE,
)

try:
    from pymodbus.datastore import (
        ModbusSequentialDataBlock,
        ModbusServerContext,
        ModbusSlaveContext,
    )
    _PYMODBUS_AVAILABLE = True
except ImportError:
    _PYMODBUS_AVAILABLE = False


class ModbusService:
    """
    Manages Modbus TCP / RTU servers and synchronises the shared register
    context with live sensor readings.

    Designed for single-instance use (one per application).
    """

    def __init__(self) -> None:
        self._context: Optional[object] = None
        self._tcp_server = None
        self._rtu_server = None

        # Per-update state
        self._heartbeat: int = 0
        self._update_count: int = 0
        self._last_update: Optional[datetime] = None

        # Config cache — read once at init so hot-reload does not surprise us
        self._tcp_enabled:    bool = settings.modbus.tcp_enabled
        self._rtu_enabled:    bool = settings.modbus.rtu_enabled
        self._byte_order:     str  = settings.modbus.byte_order
        self._compat_enabled: bool = settings.modbus.compat_registers

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    async def start(self) -> None:
        """
        Initialise the register context and start all enabled Modbus servers.
        Errors are caught and logged; no exception propagates to the caller.
        """
        if not _PYMODBUS_AVAILABLE:
            logger.error(
                "pymodbus is not installed — Modbus subsystem is DISABLED. "
                "Install dependencies with: pip install pymodbus pyserial"
            )
            return

        self._context = self._build_context()
        logger.info(
            "Modbus register context initialised  |  %d input registers",
            TOTAL_INPUT_REGISTERS,
        )

        if self._tcp_enabled:
            from app.modbus.modbus_tcp_server import ModbusTcpServerWrapper
            self._tcp_server = ModbusTcpServerWrapper(
                context=self._context,
                host=settings.modbus.tcp_host,
                port=settings.modbus.tcp_port,
            )
            await self._tcp_server.start()

        if self._rtu_enabled:
            from app.modbus.modbus_rtu_server import ModbusRtuServerWrapper
            self._rtu_server = ModbusRtuServerWrapper(
                context=self._context,
                port=settings.modbus.rtu_port,
                baudrate=settings.modbus.rtu_baudrate,
                parity=settings.modbus.rtu_parity,
                stopbits=settings.modbus.rtu_stopbits,
                bytesize=settings.modbus.rtu_bytesize,
            )
            await self._rtu_server.start()

        # Write static identity registers once — they don't change at runtime
        self._write_identity_registers()

        logger.info(
            "ModbusService ready  |  TCP=%s (port %d)  RTU=%s (%s)  "
            "byte_order=%s  compat=%s",
            self._tcp_enabled,
            settings.modbus.tcp_port,
            self._rtu_enabled,
            settings.modbus.rtu_port,
            self._byte_order,
            self._compat_enabled,
        )

    async def stop(self) -> None:
        """Gracefully stop all running Modbus servers."""
        if self._tcp_server is not None:
            await self._tcp_server.stop()
        if self._rtu_server is not None:
            await self._rtu_server.stop()
        logger.info("ModbusService stopped")

    # ── Register update (called on every sensor reading) ───────────────────────

    def update_registers(self, reading: SensorReading, uptime_s: float) -> None:
        """
        Write all Input Register values derived from a live ``SensorReading``.

        This is a synchronous, non-blocking in-memory operation and is safe
        to call from within the asyncio event loop.
        No-op when pymodbus is not installed or the context is not initialised.
        """
        if self._context is None:
            return
        try:
            self._write_registers(reading, uptime_s)
            self._update_count += 1
            self._last_update = datetime.now(timezone.utc)
        except Exception as exc:
            logger.error(
                "Failed to update Modbus registers: %s", exc, exc_info=True
            )

    def _write_identity_registers(self) -> None:
        """
        Write static device identity registers (30201–30215) once at startup.
        These values never change at runtime and are used by discovery clients to
        confirm they are talking to an ULTRON Edge device.
        """
        if self._context is None:
            return
        try:
            version_parts = settings.version.split(".")
            major = int(version_parts[0]) if len(version_parts) > 0 else 0
            minor = int(version_parts[1]) if len(version_parts) > 1 else 0
            patch = int(version_parts[2]) if len(version_parts) > 2 else 0

            # Protocol capability bitmap
            bitmap = PROTO_BIT_WEBSOCKET
            if self._tcp_enabled and self._tcp_server is not None and self._tcp_server.running:
                bitmap |= PROTO_BIT_MODBUS_TCP
            elif self._tcp_enabled:
                bitmap |= PROTO_BIT_MODBUS_TCP  # enabled even if not yet confirmed running
            if self._rtu_enabled:
                bitmap |= PROTO_BIT_MODBUS_RTU

            identity_values = [0] * (TOTAL_INPUT_REGISTERS - REG_ID_SIG_0)
            for i, word in enumerate(_IDENTITY_SIGNATURE):
                identity_values[i] = word
            identity_values[REG_SW_MAJOR - REG_ID_SIG_0]          = major
            identity_values[REG_SW_MINOR - REG_ID_SIG_0]          = minor
            identity_values[REG_SW_PATCH - REG_ID_SIG_0]          = patch
            identity_values[REG_DEVICE_TYPE_CODE - REG_ID_SIG_0]  = DEVICE_TYPE_RPI_GATEWAY
            identity_values[REG_PROTO_BITMAP - REG_ID_SIG_0]       = bitmap

            slave = self._context[0x00]
            slave.setValues(4, REG_ID_SIG_0, identity_values)
            logger.debug(
                "Identity registers written  |  sig='ULTRON EDGE'  v%d.%d.%d  bitmap=0x%02X",
                major, minor, patch, bitmap,
            )
        except Exception as exc:
            logger.error("Failed to write identity registers: %s", exc, exc_info=True)

    def _write_registers(self, reading: SensorReading, uptime_s: float) -> None:
        """Build the flat register list and commit it to the pymodbus data store."""
        # Encode engineering values
        p_high, p_low = float_to_registers(reading.pressure,    self._byte_order)
        t_high, t_low = float_to_registers(reading.temperature, self._byte_order)
        ut_high, ut_low = uint32_to_registers(max(0, int(uptime_s)))

        # Derive alarm statuses
        p_alarm = pressure_alarm(reading.pressure)
        t_alarm = temperature_alarm(reading.temperature)

        # Increment heartbeat (wraps at 65535)
        self._heartbeat = (self._heartbeat + 1) & 0xFFFF

        # Determine active communication mode
        comm_mode = self._current_comm_mode()

        # Build a flat list indexed by PDU address (0 = register 30001)
        regs = [0] * TOTAL_INPUT_REGISTERS

        regs[REG_PRESSURE_H]     = p_high
        regs[REG_PRESSURE_L]     = p_low
        regs[REG_TEMP_H]         = t_high
        regs[REG_TEMP_L]         = t_low
        regs[REG_PRESSURE_ALARM] = p_alarm
        regs[REG_TEMP_ALARM]     = t_alarm
        regs[REG_DEVICE_HEALTH]  = HEALTH_HEALTHY
        regs[REG_SENSOR_FAULT]   = FAULT_NONE
        regs[REG_UPTIME_H]       = ut_high
        regs[REG_UPTIME_L]       = ut_low
        regs[REG_COMM_MODE]      = comm_mode
        regs[REG_HEARTBEAT]      = self._heartbeat

        if self._compat_enabled:
            regs[REG_COMPAT_PRESSURE_INT] = min(
                0xFFFF, int(round(reading.pressure * 100))
            )
            regs[REG_COMPAT_TEMP_INT] = min(
                0xFFFF, int(round(reading.temperature * 100))
            )

        # Update live protocol bitmap so clients see current transport state
        bitmap = PROTO_BIT_WEBSOCKET
        if self._tcp_server is not None and self._tcp_server.running:
            bitmap |= PROTO_BIT_MODBUS_TCP
        if self._rtu_server is not None and self._rtu_server.running:
            bitmap |= PROTO_BIT_MODBUS_RTU
        regs[REG_PROTO_BITMAP] = bitmap

        # Write entire block in a single call — atomically from pymodbus's view
        slave = self._context[0x00]  # single-slave mode: device_id is irrelevant
        slave.setValues(4, 0, regs)  # FC=4 (input registers), start at PDU address 0

    def _current_comm_mode(self) -> int:
        """Return the COMM_* constant representing currently active transports."""
        tcp_up = self._tcp_server is not None and self._tcp_server.running
        rtu_up = self._rtu_server is not None and self._rtu_server.running
        if tcp_up and rtu_up:
            return COMM_TCP_RTU
        if tcp_up:
            return COMM_MODBUS_TCP
        if rtu_up:
            return COMM_MODBUS_RTU
        return COMM_WEBSOCKET

    # ── Status snapshot (for REST endpoint) ───────────────────────────────────

    def status(self) -> dict:
        """
        Return a status dictionary suitable for the ``GET /api/modbus/status``
        endpoint.  All values are JSON-serialisable.
        """
        return {
            "tcp_enabled":      self._tcp_enabled,
            "tcp_running":      self._tcp_server is not None and self._tcp_server.running,
            "tcp_host":         settings.modbus.tcp_host,
            "tcp_port":         settings.modbus.tcp_port,
            "rtu_enabled":      self._rtu_enabled,
            "rtu_running":      self._rtu_server is not None and self._rtu_server.running,
            "rtu_port":         settings.modbus.rtu_port,
            "slave_id":         settings.modbus.rtu_slave_id,
            "byte_order":       self._byte_order,
            "compat_registers": self._compat_enabled,
            "register_updates": self._update_count,
            "last_update":      (
                self._last_update.isoformat() if self._last_update else None
            ),
        }

    # ── Private: context factory ───────────────────────────────────────────────

    @staticmethod
    def _build_context():
        """
        Create a fresh ``ModbusServerContext`` with zeroed register blocks.

        Input Registers  (FC4, 3xxxx) — TOTAL_INPUT_REGISTERS slots.
        Holding Registers(FC3, 4xxxx) — 10 reserved slots (read-only in MVP).
        Coils / Discrete Inputs       — minimal stubs required by pymodbus.
        """
        slave_ctx = ModbusSlaveContext(
            di=ModbusSequentialDataBlock(0, [0] * 10),
            co=ModbusSequentialDataBlock(0, [0] * 10),
            hr=ModbusSequentialDataBlock(0, [0] * 10),
            ir=ModbusSequentialDataBlock(0, [0] * TOTAL_INPUT_REGISTERS),
        )
        return ModbusServerContext(slaves=slave_ctx, single=True)
