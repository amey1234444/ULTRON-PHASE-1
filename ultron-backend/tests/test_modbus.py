"""
ULTRON — Modbus subsystem unit tests
======================================
All tests are self-contained (no physical hardware required).
pymodbus is not needed for the converter, alarm, or register-map tests.

Run from ultron-backend/:
    pytest tests/test_modbus.py -v
"""

import asyncio
import math
import struct

import pytest

# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _pack_float32_abcd(value: float) -> tuple:
    """Reference encoder using struct directly (ABCD / big-endian)."""
    raw = struct.pack(">f", value)
    high = struct.unpack(">H", raw[0:2])[0]
    low  = struct.unpack(">H", raw[2:4])[0]
    return high, low


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Float32 converters
# ═══════════════════════════════════════════════════════════════════════════════

from app.modbus.converters import (
    float_to_registers,
    registers_to_float,
    registers_to_uint32,
    uint32_to_registers,
)


class TestFloat32ABCD:
    """Big-endian (ABCD) round-trips for typical sensor values."""

    CASES = [7.35, 82.45, 0.0, 6.0, 8.0, 70.0, 90.0, -1.5, 1.0, 100.0]

    @pytest.mark.parametrize("value", CASES)
    def test_roundtrip(self, value):
        high, low = float_to_registers(value, "ABCD")
        result = registers_to_float(high, low, "ABCD")
        assert abs(result - value) < 1e-5, f"ABCD round-trip failed for {value}: got {result}"

    def test_matches_struct_reference(self):
        """float_to_registers(ABCD) must produce identical bytes to struct.pack('>f')."""
        for value in self.CASES:
            expected = _pack_float32_abcd(value)
            actual   = float_to_registers(value, "ABCD")
            assert actual == expected, f"Mismatch for {value}: expected {expected}, got {actual}"

    def test_pressure_example(self):
        """7.35 bar — well-known value used in register map documentation."""
        high, low = float_to_registers(7.35, "ABCD")
        recovered = registers_to_float(high, low, "ABCD")
        assert abs(recovered - 7.35) < 1e-4

    def test_temperature_example(self):
        """82.45 °C — second well-known value from the documentation."""
        high, low = float_to_registers(82.45, "ABCD")
        recovered = registers_to_float(high, low, "ABCD")
        assert abs(recovered - 82.45) < 1e-4


class TestFloat32AllByteOrders:
    """Each byte-order variant must produce a correct round-trip."""

    ORDERS = ["ABCD", "CDAB", "BADC", "DCBA"]

    @pytest.mark.parametrize("order", ORDERS)
    @pytest.mark.parametrize("value", [7.35, 82.45, 0.0, -1.0, 1234.5])
    def test_roundtrip(self, order, value):
        high, low = float_to_registers(value, order)
        result = registers_to_float(high, low, order)
        assert abs(result - value) < 1e-4, (
            f"Round-trip failed: order={order} value={value} got={result}"
        )

    def test_all_orders_produce_different_register_pairs(self):
        """Four byte orders must produce four distinct register pairs for the same value."""
        value = 7.35
        results = {order: float_to_registers(value, order) for order in self.ORDERS}
        assert len(set(results.values())) == 4, (
            f"Expected 4 distinct pairs, got: {results}"
        )

    def test_cdab_word_swap(self):
        """CDAB is a word swap of ABCD: the two 16-bit words should be exchanged."""
        value = 7.35
        h_abcd, l_abcd = float_to_registers(value, "ABCD")
        h_cdab, l_cdab = float_to_registers(value, "CDAB")
        assert h_cdab == l_abcd and l_cdab == h_abcd, (
            f"CDAB should swap the words of ABCD. "
            f"ABCD=({h_abcd:#06x},{l_abcd:#06x}) CDAB=({h_cdab:#06x},{l_cdab:#06x})"
        )

    def test_dcba_is_full_reversal(self):
        """DCBA is the byte-reversed version of ABCD packed bytes."""
        value = 7.35
        raw_abcd = struct.pack(">f", value)
        h_dcba, l_dcba = float_to_registers(value, "DCBA")
        actual_bytes = struct.pack(">HH", h_dcba, l_dcba)
        assert actual_bytes == raw_abcd[::-1], "DCBA should be the full byte reversal of ABCD"


class TestFloat32InvalidByteOrder:
    def test_raises_value_error_for_unknown_order(self):
        with pytest.raises(ValueError, match="Unknown byte order"):
            float_to_registers(7.35, "XYZW")

    def test_registers_to_float_raises_for_unknown_order(self):
        with pytest.raises(ValueError, match="Unknown byte order"):
            registers_to_float(0x40EB, 0x851F, "???")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. UInt32 converters
# ═══════════════════════════════════════════════════════════════════════════════

class TestUInt32Converters:
    CASES = [0, 1, 100, 65535, 65536, 100_000, 0xFFFF_FFFF]

    @pytest.mark.parametrize("value", CASES)
    def test_roundtrip(self, value):
        high, low = uint32_to_registers(value)
        result = registers_to_uint32(high, low)
        assert result == value, f"UInt32 round-trip failed for {value}: got {result}"

    def test_max_value_register_pair(self):
        high, low = uint32_to_registers(0xFFFF_FFFF)
        assert high == 0xFFFF
        assert low  == 0xFFFF

    def test_zero(self):
        assert uint32_to_registers(0) == (0, 0)

    def test_high_word_isolation(self):
        """High word must carry bits 31-16, low word bits 15-0."""
        high, low = uint32_to_registers(0x00010000)
        assert high == 1 and low == 0

        high, low = uint32_to_registers(0x0000FFFF)
        assert high == 0 and low == 0xFFFF

    def test_overflow_is_masked(self):
        """Values > 2^32-1 are silently masked, not raised as errors."""
        high, low = uint32_to_registers(0x1_0000_0000)
        assert registers_to_uint32(high, low) == 0

    def test_uptime_typical(self):
        """Simulate 3600 seconds (1 hour) uptime."""
        high, low = uint32_to_registers(3600)
        assert registers_to_uint32(high, low) == 3600


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Alarm calculations
# ═══════════════════════════════════════════════════════════════════════════════

from app.modbus.alarms import calculate_alarm_status
from app.modbus.register_map import ALARM_CRITICAL, ALARM_NORMAL, ALARM_WARNING

# Thresholds mirror the defaults in .env:
#   PRESSURE_MAX=11.0  → WARNING=8.8, CRITICAL=10.45
#   TEMPERATURE_MAX=115.0 → WARNING=92.0, CRITICAL=109.25
_P_WARN = 8.8
_P_CRIT = 10.45
_T_WARN = 92.0
_T_CRIT = 109.25


class TestAlarmCalculation:
    # ── Pressure ──────────────────────────────────────────────────────────────
    def test_pressure_normal(self):
        assert calculate_alarm_status(7.0, _P_WARN, _P_CRIT) == ALARM_NORMAL

    def test_pressure_at_top_of_normal_band(self):
        assert calculate_alarm_status(8.0, _P_WARN, _P_CRIT) == ALARM_NORMAL

    def test_pressure_warning(self):
        assert calculate_alarm_status(9.0, _P_WARN, _P_CRIT) == ALARM_WARNING

    def test_pressure_at_warning_boundary(self):
        """Exactly at the warning threshold must return WARNING."""
        assert calculate_alarm_status(_P_WARN, _P_WARN, _P_CRIT) == ALARM_WARNING

    def test_pressure_critical(self):
        assert calculate_alarm_status(11.0, _P_WARN, _P_CRIT) == ALARM_CRITICAL

    def test_pressure_at_critical_boundary(self):
        """Exactly at the critical threshold must return CRITICAL."""
        assert calculate_alarm_status(_P_CRIT, _P_WARN, _P_CRIT) == ALARM_CRITICAL

    # ── Temperature ───────────────────────────────────────────────────────────
    def test_temperature_normal(self):
        assert calculate_alarm_status(80.0, _T_WARN, _T_CRIT) == ALARM_NORMAL

    def test_temperature_at_top_of_normal_band(self):
        assert calculate_alarm_status(90.0, _T_WARN, _T_CRIT) == ALARM_NORMAL

    def test_temperature_warning(self):
        assert calculate_alarm_status(95.0, _T_WARN, _T_CRIT) == ALARM_WARNING

    def test_temperature_at_warning_boundary(self):
        assert calculate_alarm_status(_T_WARN, _T_WARN, _T_CRIT) == ALARM_WARNING

    def test_temperature_critical(self):
        assert calculate_alarm_status(110.0, _T_WARN, _T_CRIT) == ALARM_CRITICAL

    def test_temperature_at_critical_boundary(self):
        assert calculate_alarm_status(_T_CRIT, _T_WARN, _T_CRIT) == ALARM_CRITICAL

    # ── Edge cases ────────────────────────────────────────────────────────────
    def test_just_below_warning_is_normal(self):
        assert calculate_alarm_status(_P_WARN - 0.001, _P_WARN, _P_CRIT) == ALARM_NORMAL

    def test_just_above_warning_is_warning(self):
        assert calculate_alarm_status(_P_WARN + 0.001, _P_WARN, _P_CRIT) == ALARM_WARNING

    def test_just_below_critical_is_warning(self):
        assert calculate_alarm_status(_P_CRIT - 0.001, _P_WARN, _P_CRIT) == ALARM_WARNING

    def test_just_above_critical_is_critical(self):
        assert calculate_alarm_status(_P_CRIT + 0.001, _P_WARN, _P_CRIT) == ALARM_CRITICAL


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Register map constants and documentation
# ═══════════════════════════════════════════════════════════════════════════════

from app.modbus.register_map import (
    REG_COMM_MODE,
    REG_COMPAT_PRESSURE_INT,
    REG_COMPAT_TEMP_INT,
    REG_DEVICE_HEALTH,
    REG_HEARTBEAT,
    REG_PRESSURE_ALARM,
    REG_PRESSURE_H,
    REG_PRESSURE_L,
    REG_SENSOR_FAULT,
    REG_TEMP_ALARM,
    REG_TEMP_H,
    REG_TEMP_L,
    REG_UPTIME_H,
    REG_UPTIME_L,
    TOTAL_INPUT_REGISTERS,
    build_register_documentation,
)


class TestRegisterMapConstants:
    def test_pressure_registers_consecutive(self):
        assert REG_PRESSURE_L == REG_PRESSURE_H + 1

    def test_temperature_registers_consecutive(self):
        assert REG_TEMP_L == REG_TEMP_H + 1

    def test_uptime_registers_consecutive(self):
        assert REG_UPTIME_L == REG_UPTIME_H + 1

    def test_primary_registers_in_range_0_to_11(self):
        """All primary registers must fit within PDU addresses 0–11."""
        primaries = [
            REG_PRESSURE_H, REG_PRESSURE_L,
            REG_TEMP_H, REG_TEMP_L,
            REG_PRESSURE_ALARM, REG_TEMP_ALARM,
            REG_DEVICE_HEALTH, REG_SENSOR_FAULT,
            REG_UPTIME_H, REG_UPTIME_L,
            REG_COMM_MODE, REG_HEARTBEAT,
        ]
        for reg in primaries:
            assert 0 <= reg <= 11, f"Primary register {reg} is out of range 0–11"

    def test_compat_registers_at_address_100_101(self):
        assert REG_COMPAT_PRESSURE_INT == 100
        assert REG_COMPAT_TEMP_INT     == 101

    def test_compat_registers_within_total_block(self):
        assert REG_COMPAT_PRESSURE_INT < TOTAL_INPUT_REGISTERS
        assert REG_COMPAT_TEMP_INT     < TOTAL_INPUT_REGISTERS

    def test_total_registers_is_110(self):
        assert TOTAL_INPUT_REGISTERS == 110

    def test_no_address_collisions(self):
        """All register addresses must be unique."""
        all_regs = [
            REG_PRESSURE_H, REG_PRESSURE_L,
            REG_TEMP_H, REG_TEMP_L,
            REG_PRESSURE_ALARM, REG_TEMP_ALARM,
            REG_DEVICE_HEALTH, REG_SENSOR_FAULT,
            REG_UPTIME_H, REG_UPTIME_L,
            REG_COMM_MODE, REG_HEARTBEAT,
            REG_COMPAT_PRESSURE_INT, REG_COMPAT_TEMP_INT,
        ]
        assert len(all_regs) == len(set(all_regs)), "Duplicate register addresses detected"


class TestRegisterDocumentation:
    def setup_method(self):
        self.doc = build_register_documentation()

    def test_returns_dict(self):
        assert isinstance(self.doc, dict)

    def test_function_code_is_4(self):
        assert self.doc["function_code"] == 4

    def test_registers_list_present(self):
        assert "registers" in self.doc
        assert isinstance(self.doc["registers"], list)
        assert len(self.doc["registers"]) > 0

    def test_all_required_display_addresses_present(self):
        display_addresses = {r["display_address"] for r in self.doc["registers"]}
        assert "30001-30002" in display_addresses, "Pressure Float32 missing"
        assert "30003-30004" in display_addresses, "Temperature Float32 missing"
        assert "30005"       in display_addresses, "Pressure Alarm missing"
        assert "30006"       in display_addresses, "Temperature Alarm missing"
        assert "30007"       in display_addresses, "Device Health missing"
        assert "30008"       in display_addresses, "Sensor Fault missing"
        assert "30009-30010" in display_addresses, "Uptime missing"
        assert "30011"       in display_addresses, "Comm Mode missing"
        assert "30012"       in display_addresses, "Heartbeat missing"
        assert "30101"       in display_addresses, "Compat Pressure missing"
        assert "30102"       in display_addresses, "Compat Temperature missing"

    def test_holding_registers_section_present(self):
        assert "holding_registers" in self.doc

    def test_normal_operating_ranges_present(self):
        assert "normal_operating_ranges" in self.doc
        ranges = self.doc["normal_operating_ranges"]
        assert ranges["pressure_bar"]["min"]    == 6.0
        assert ranges["pressure_bar"]["max"]    == 8.0
        assert ranges["temperature_degc"]["min"] == 70.0
        assert ranges["temperature_degc"]["max"] == 90.0


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Compatibility integer registers
# ═══════════════════════════════════════════════════════════════════════════════

class TestCompatibilityRegisters:
    """Verify the ×100 integer encoding used in registers 30101-30102."""

    @pytest.mark.parametrize("pressure, expected", [
        (7.35,  735),
        (6.0,   600),
        (8.0,   800),
        (7.0,   700),
        (7.999, 800),   # rounds up
        (6.001, 600),   # rounds to nearest
        (0.0,   0),
    ])
    def test_pressure_x100(self, pressure, expected):
        actual = int(round(pressure * 100))
        assert actual == expected, f"Pressure {pressure} × 100 → expected {expected}, got {actual}"

    @pytest.mark.parametrize("temperature, expected", [
        (82.45, 8245),
        (70.0,  7000),
        (90.0,  9000),
        (80.0,  8000),
        (72.55, 7255),
        (0.0,   0),
    ])
    def test_temperature_x100(self, temperature, expected):
        actual = int(round(temperature * 100))
        assert actual == expected, f"Temp {temperature} × 100 → expected {expected}, got {actual}"

    def test_compat_value_fits_in_uint16(self):
        """All realistic sensor values should fit in a single 16-bit register."""
        for pressure in [6.0, 7.0, 7.35, 8.0, 8.8, 10.45, 11.0]:
            value = int(round(pressure * 100))
            assert 0 <= value <= 0xFFFF, f"Pressure ×100 overflows UInt16: {value}"

        for temperature in [70.0, 80.0, 82.45, 90.0, 92.0, 109.25, 115.0]:
            value = int(round(temperature * 100))
            assert 0 <= value <= 0xFFFF, f"Temperature ×100 overflows UInt16: {value}"


# ═══════════════════════════════════════════════════════════════════════════════
# 6. Simulated sensor output validation (no hardware needed)
# ═══════════════════════════════════════════════════════════════════════════════

from app.sensor_manager import SimulatedPressureSensor, SimulatedTemperatureSensor


class TestSimulatedPressureSensor:
    """Verify the simulator stays within physical sensor bounds."""

    def setup_method(self):
        self.sensor = SimulatedPressureSensor()

    def _read(self):
        return asyncio.get_event_loop().run_until_complete(self.sensor.read())

    def test_initial_reading_within_physical_bounds(self):
        """First reading must be within 4.0–11.0 bar (the configured physical range)."""
        value = self._read()
        assert 4.0 <= value <= 11.0, f"Initial pressure out of bounds: {value}"

    def test_twenty_readings_within_physical_bounds(self):
        """Twenty consecutive readings must all stay within the physical range."""
        for _ in range(20):
            value = self._read()
            assert 4.0 <= value <= 11.0, f"Pressure out of physical bounds: {value}"

    def test_reading_is_rounded_to_two_decimal_places(self):
        value = self._read()
        assert round(value, 2) == value, f"Pressure not rounded to 2 d.p.: {value}"

    def test_last_value_property_updated(self):
        value = self._read()
        assert self.sensor.last_value == value


class TestSimulatedTemperatureSensor:
    """Verify the temperature simulator stays within physical sensor bounds."""

    def setup_method(self):
        self.sensor = SimulatedTemperatureSensor()

    def _read(self):
        return asyncio.get_event_loop().run_until_complete(self.sensor.read())

    def test_initial_reading_within_physical_bounds(self):
        """First reading must be within 50.0–115.0 °C (the configured physical range)."""
        value = self._read()
        assert 50.0 <= value <= 115.0, f"Initial temperature out of bounds: {value}"

    def test_twenty_readings_within_physical_bounds(self):
        for _ in range(20):
            value = self._read()
            assert 50.0 <= value <= 115.0, f"Temperature out of physical bounds: {value}"

    def test_reading_is_rounded_to_one_decimal_place(self):
        value = self._read()
        assert round(value, 1) == value, f"Temperature not rounded to 1 d.p.: {value}"

    def test_last_value_property_updated(self):
        value = self._read()
        assert self.sensor.last_value == value


# ═══════════════════════════════════════════════════════════════════════════════
# 7. Register update logic (no pymodbus required — uses a mock context)
# ═══════════════════════════════════════════════════════════════════════════════

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from app.models import SensorReading, SystemStatus


class TestRegisterUpdateLogic:
    """
    Verify that ModbusService._write_registers() encodes values correctly
    without requiring a running pymodbus server.
    """

    def _make_reading(self, pressure=7.35, temperature=82.45, status=SystemStatus.HEALTHY):
        return SensorReading(
            timestamp=datetime.now(timezone.utc),
            pressure=pressure,
            temperature=temperature,
            status=status,
        )

    def _capture_register_write(self, pressure=7.35, temperature=82.45, uptime=3600.0):
        """
        Invoke ``_write_registers`` with a mock context and return the register list
        that was passed to ``slave.setValues()``.
        """
        from app.modbus.modbus_service import ModbusService

        service = ModbusService()
        service._compat_enabled = True
        service._byte_order = "ABCD"

        # Mock the pymodbus context so the test does not require pymodbus
        slave_mock = MagicMock()
        context_mock = MagicMock()
        context_mock.__getitem__ = MagicMock(return_value=slave_mock)
        service._context = context_mock

        reading = self._make_reading(pressure, temperature)
        service._write_registers(reading, uptime)

        # Extract the register list from the setValues call
        call_args = slave_mock.setValues.call_args
        assert call_args is not None, "setValues was not called"
        fc, start, regs = call_args[0]
        assert fc    == 4, f"Expected FC=4 (input registers), got {fc}"
        assert start == 0, f"Expected start_address=0, got {start}"
        return regs

    def test_pressure_float32_encoded_correctly(self):
        """Registers 0-1 must decode back to the original pressure value."""
        regs = self._capture_register_write(pressure=7.35)
        from app.modbus.converters import registers_to_float
        from app.modbus.register_map import REG_PRESSURE_H, REG_PRESSURE_L
        recovered = registers_to_float(regs[REG_PRESSURE_H], regs[REG_PRESSURE_L], "ABCD")
        assert abs(recovered - 7.35) < 1e-4, f"Pressure mismatch: {recovered}"

    def test_temperature_float32_encoded_correctly(self):
        """Registers 2-3 must decode back to the original temperature value."""
        regs = self._capture_register_write(temperature=82.45)
        from app.modbus.converters import registers_to_float
        from app.modbus.register_map import REG_TEMP_H, REG_TEMP_L
        recovered = registers_to_float(regs[REG_TEMP_H], regs[REG_TEMP_L], "ABCD")
        assert abs(recovered - 82.45) < 1e-4, f"Temperature mismatch: {recovered}"

    def test_uptime_uint32_encoded_correctly(self):
        """Registers 8-9 must decode back to the original uptime in seconds."""
        uptime = 3600
        regs = self._capture_register_write(uptime=float(uptime))
        from app.modbus.converters import registers_to_uint32
        from app.modbus.register_map import REG_UPTIME_H, REG_UPTIME_L
        recovered = registers_to_uint32(regs[REG_UPTIME_H], regs[REG_UPTIME_L])
        assert recovered == uptime, f"Uptime mismatch: {recovered} != {uptime}"

    def test_device_health_is_healthy(self):
        from app.modbus.register_map import HEALTH_HEALTHY, REG_DEVICE_HEALTH
        regs = self._capture_register_write()
        assert regs[REG_DEVICE_HEALTH] == HEALTH_HEALTHY

    def test_sensor_fault_is_none(self):
        from app.modbus.register_map import FAULT_NONE, REG_SENSOR_FAULT
        regs = self._capture_register_write()
        assert regs[REG_SENSOR_FAULT] == FAULT_NONE

    def test_compat_pressure_integer(self):
        """Register 100 must hold pressure × 100 as an integer (7.35 → 735)."""
        regs = self._capture_register_write(pressure=7.35)
        from app.modbus.register_map import REG_COMPAT_PRESSURE_INT
        assert regs[REG_COMPAT_PRESSURE_INT] == 735, (
            f"Compat pressure register: expected 735, got {regs[REG_COMPAT_PRESSURE_INT]}"
        )

    def test_compat_temperature_integer(self):
        """Register 101 must hold temperature × 100 as an integer (82.45 → 8245)."""
        regs = self._capture_register_write(temperature=82.45)
        from app.modbus.register_map import REG_COMPAT_TEMP_INT
        assert regs[REG_COMPAT_TEMP_INT] == 8245, (
            f"Compat temperature register: expected 8245, got {regs[REG_COMPAT_TEMP_INT]}"
        )

    def test_heartbeat_increments_each_call(self):
        """Heartbeat register must increment by 1 on each call."""
        from app.modbus.modbus_service import ModbusService
        from app.modbus.register_map import REG_HEARTBEAT

        service = ModbusService()
        service._compat_enabled = False
        service._byte_order = "ABCD"

        slave_mock = MagicMock()
        context_mock = MagicMock()
        context_mock.__getitem__ = MagicMock(return_value=slave_mock)
        service._context = context_mock

        reading = self._make_reading()
        service._write_registers(reading, 0.0)
        regs_1 = slave_mock.setValues.call_args[0][2]
        service._write_registers(reading, 1.0)
        regs_2 = slave_mock.setValues.call_args[0][2]

        assert regs_2[REG_HEARTBEAT] == regs_1[REG_HEARTBEAT] + 1, (
            f"Heartbeat did not increment: {regs_1[REG_HEARTBEAT]} → {regs_2[REG_HEARTBEAT]}"
        )

    def test_total_register_count(self):
        """setValues must always be called with exactly TOTAL_INPUT_REGISTERS values."""
        regs = self._capture_register_write()
        assert len(regs) == TOTAL_INPUT_REGISTERS, (
            f"Expected {TOTAL_INPUT_REGISTERS} registers, got {len(regs)}"
        )

    def test_pressure_alarm_normal_for_safe_value(self):
        from app.modbus.register_map import ALARM_NORMAL, REG_PRESSURE_ALARM
        regs = self._capture_register_write(pressure=7.0)
        assert regs[REG_PRESSURE_ALARM] == ALARM_NORMAL

    def test_pressure_alarm_warning_during_spike(self):
        """A pressure value above the warning threshold must set register 30005 = 1."""
        from app.modbus.register_map import ALARM_WARNING, REG_PRESSURE_ALARM
        regs = self._capture_register_write(pressure=9.0)   # 9.0 > 8.8 warning threshold
        assert regs[REG_PRESSURE_ALARM] == ALARM_WARNING

    def test_temperature_alarm_normal_for_safe_value(self):
        from app.modbus.register_map import ALARM_NORMAL, REG_TEMP_ALARM
        regs = self._capture_register_write(temperature=80.0)
        assert regs[REG_TEMP_ALARM] == ALARM_NORMAL

    def test_temperature_alarm_warning_above_threshold(self):
        """Temperature above 92 °C (92% of 115 default) must set register 30006 = 1."""
        from app.modbus.register_map import ALARM_WARNING, REG_TEMP_ALARM
        regs = self._capture_register_write(temperature=93.0)
        assert regs[REG_TEMP_ALARM] == ALARM_WARNING
