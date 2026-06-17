"""
ULTRON Modbus Register Map
==========================
All register addresses below are 0-based PDU addresses (as used internally by
pymodbus and sent on the wire). Add 30001 to convert to the Modbus display
address shown in SCADA/HMI tools (e.g., PDU address 0 → 30001).

Function Code: FC4 — Read Input Registers
All process values are Input Registers (3xxxx).
Holding Registers (4xxxx) are reserved for future configuration writes.
"""

from typing import Any, Dict, List


# ── Primary process value registers (Float32, two registers each) ─────────────
# Each Float32 value occupies two consecutive 16-bit registers.
# The high word is at the lower address; the low word at (address + 1).
# Default byte order: ABCD (big-endian, most common in industrial Modbus).

REG_PRESSURE_H: int = 0    # 30001 — Pressure Float32 high word (bar)
REG_PRESSURE_L: int = 1    # 30002 — Pressure Float32 low word  (bar)
REG_TEMP_H:     int = 2    # 30003 — Temperature Float32 high word (°C)
REG_TEMP_L:     int = 3    # 30004 — Temperature Float32 low word  (°C)

# ── Status / alarm registers (UInt16) ─────────────────────────────────────────
REG_PRESSURE_ALARM: int = 4   # 30005 — 0=Normal, 1=Warning, 2=Critical
REG_TEMP_ALARM:     int = 5   # 30006 — 0=Normal, 1=Warning, 2=Critical
REG_DEVICE_HEALTH:  int = 6   # 30007 — 0=Fault,  1=Healthy
REG_SENSOR_FAULT:   int = 7   # 30008 — 0=None, 1=Pressure, 2=Temp, 3=Both

# ── System registers ──────────────────────────────────────────────────────────
REG_UPTIME_H:  int = 8    # 30009 — System uptime UInt32 high word (seconds)
REG_UPTIME_L:  int = 9    # 30010 — System uptime UInt32 low word  (seconds)
REG_COMM_MODE: int = 10   # 30011 — 1=WS, 2=Modbus TCP, 3=Modbus RTU, 4=TCP+RTU
REG_HEARTBEAT: int = 11   # 30012 — Increments on every register update; wraps at 65535

# ── Compatibility integer registers (optional, configurable) ──────────────────
# Integer representation for PLCs / legacy devices that cannot decode Float32.
# Value = float × 100, e.g. 7.35 bar → 735, 82.45 °C → 8245.
REG_COMPAT_PRESSURE_INT: int = 100   # 30101 — Pressure  × 100 (UInt16)
REG_COMPAT_TEMP_INT:     int = 101   # 30102 — Temperature × 100 (UInt16)

# Total size of the input register block that must be allocated.
# Covers addresses 0–214 (primary 0–11, compat 100–101, identity 200–214).
TOTAL_INPUT_REGISTERS: int = 220

# ── Alarm status enum values ──────────────────────────────────────────────────
ALARM_NORMAL:   int = 0
ALARM_WARNING:  int = 1
ALARM_CRITICAL: int = 2

# ── Device health enum values ─────────────────────────────────────────────────
HEALTH_FAULT:   int = 0
HEALTH_HEALTHY: int = 1

# ── Sensor fault bit-field values ─────────────────────────────────────────────
FAULT_NONE:        int = 0
FAULT_PRESSURE:    int = 1
FAULT_TEMPERATURE: int = 2
FAULT_BOTH:        int = 3

# ── Communication mode enum values ────────────────────────────────────────────
COMM_WEBSOCKET:  int = 1
COMM_MODBUS_TCP: int = 2
COMM_MODBUS_RTU: int = 3
COMM_TCP_RTU:    int = 4


# ── Device identity registers (FC4, 3xxxx) ────────────────────────────────────
# PDU addresses 200-214  →  display addresses 30201-30215
# These are static after startup; a client can read them to confirm ULTRON identity.

# 30201-30206: ASCII device signature "ULTRON EDGE" packed as UInt16 pairs
#   Each register = two ASCII bytes: high_byte + low_byte
#   "UL"=0x554C, "TR"=0x5452, "ON"=0x4F4E, " E"=0x2045, "DG"=0x4447, "E\x00"=0x4500
REG_ID_SIG_0: int = 200   # 30201 — "UL"
REG_ID_SIG_1: int = 201   # 30202 — "TR"
REG_ID_SIG_2: int = 202   # 30203 — "ON"
REG_ID_SIG_3: int = 203   # 30204 — " E"
REG_ID_SIG_4: int = 204   # 30205 — "DG"
REG_ID_SIG_5: int = 205   # 30206 — "E\x00"
# 30207-30210 reserved / zero
REG_SW_MAJOR:  int = 210  # 30211 — Software major version
REG_SW_MINOR:  int = 211  # 30212 — Software minor version
REG_SW_PATCH:  int = 212  # 30213 — Software patch version
REG_DEVICE_TYPE_CODE: int = 213  # 30214 — 1=RPi Gateway, 2=UM Card, 3=TP Card, 4=Wireless Node
REG_PROTO_BITMAP:     int = 214  # 30215 — bit0=WebSocket, bit1=Modbus TCP, bit2=Modbus RTU, bit3=MQTT

# Device type codes
DEVICE_TYPE_RPI_GATEWAY:  int = 1
DEVICE_TYPE_UM_CARD:      int = 2
DEVICE_TYPE_TP_CARD:      int = 3
DEVICE_TYPE_WIRELESS_NODE: int = 4

# Protocol capability bitmap bits
PROTO_BIT_WEBSOCKET:   int = 0x01
PROTO_BIT_MODBUS_TCP:  int = 0x02
PROTO_BIT_MODBUS_RTU:  int = 0x04
PROTO_BIT_MQTT:        int = 0x08

# ASCII signature words for "ULTRON EDGE"
_IDENTITY_SIGNATURE: list = [0x554C, 0x5452, 0x4F4E, 0x2045, 0x4447, 0x4500]


def build_register_documentation() -> Dict[str, Any]:
    """
    Return a structured, human-readable description of the full register map.
    Used by the GET /api/modbus/register-map endpoint.
    """
    registers: List[Dict[str, Any]] = [
        {
            "display_address": "30001-30002",
            "pdu_address": "0-1",
            "name": "Pressure",
            "type": "Float32",
            "unit": "bar",
            "description": "Live pump pressure — two consecutive 16-bit registers, high word first.",
            "example": "7.35 bar → high=0x40EB low=0x851F (ABCD byte order)",
        },
        {
            "display_address": "30003-30004",
            "pdu_address": "2-3",
            "name": "Temperature",
            "type": "Float32",
            "unit": "°C",
            "description": "Live motor/gearbox temperature — high word first.",
            "example": "82.45 °C → high=0x42A4 low=0xE666 (ABCD byte order)",
        },
        {
            "display_address": "30005",
            "pdu_address": "4",
            "name": "Pressure Alarm Status",
            "type": "UInt16",
            "unit": "enum",
            "values": {"0": "Normal", "1": "Warning", "2": "Critical"},
        },
        {
            "display_address": "30006",
            "pdu_address": "5",
            "name": "Temperature Alarm Status",
            "type": "UInt16",
            "unit": "enum",
            "values": {"0": "Normal", "1": "Warning", "2": "Critical"},
        },
        {
            "display_address": "30007",
            "pdu_address": "6",
            "name": "Device Health",
            "type": "UInt16",
            "unit": "enum",
            "values": {"0": "Fault", "1": "Healthy"},
        },
        {
            "display_address": "30008",
            "pdu_address": "7",
            "name": "Sensor Fault",
            "type": "UInt16",
            "unit": "enum",
            "values": {
                "0": "None",
                "1": "Pressure Fault",
                "2": "Temperature Fault",
                "3": "Both Faults",
            },
        },
        {
            "display_address": "30009-30010",
            "pdu_address": "8-9",
            "name": "System Uptime",
            "type": "UInt32",
            "unit": "seconds",
            "description": "Elapsed seconds since server start. High word at 30009.",
        },
        {
            "display_address": "30011",
            "pdu_address": "10",
            "name": "Communication Mode",
            "type": "UInt16",
            "unit": "enum",
            "values": {
                "1": "WebSocket only",
                "2": "Modbus TCP",
                "3": "Modbus RTU",
                "4": "Modbus TCP + RTU",
            },
        },
        {
            "display_address": "30012",
            "pdu_address": "11",
            "name": "Heartbeat Counter",
            "type": "UInt16",
            "unit": "count",
            "description": "Increments every register update cycle. Wraps 0–65535.",
        },
        {
            "display_address": "30101",
            "pdu_address": "100",
            "name": "Pressure (integer ×100)",
            "type": "UInt16",
            "unit": "bar×100",
            "description": "Optional compatibility register. 7.35 bar → 735.",
            "optional": True,
        },
        {
            "display_address": "30102",
            "pdu_address": "101",
            "name": "Temperature (integer ×100)",
            "type": "UInt16",
            "unit": "°C×100",
            "description": "Optional compatibility register. 82.45 °C → 8245.",
            "optional": True,
        },
        {
            "display_address": "30201-30210",
            "pdu_address": "200-209",
            "name": "Device Signature",
            "type": "UInt16[10]",
            "unit": "ASCII",
            "description": (
                "ASCII device signature 'ULTRON EDGE' packed as UInt16 pairs "
                "(high byte = char 1, low byte = char 2). Used for auto-detection. "
                "Registers 30207-30210 are zero-padded."
            ),
        },
        {
            "display_address": "30211",
            "pdu_address": "210",
            "name": "Software Major Version",
            "type": "UInt16",
            "unit": "count",
        },
        {
            "display_address": "30212",
            "pdu_address": "211",
            "name": "Software Minor Version",
            "type": "UInt16",
            "unit": "count",
        },
        {
            "display_address": "30213",
            "pdu_address": "212",
            "name": "Software Patch Version",
            "type": "UInt16",
            "unit": "count",
        },
        {
            "display_address": "30214",
            "pdu_address": "213",
            "name": "Device Type Code",
            "type": "UInt16",
            "unit": "enum",
            "values": {
                "1": "Raspberry Pi Gateway",
                "2": "UM Card (future)",
                "3": "TP Card (future)",
                "4": "Wireless Node (future)",
            },
        },
        {
            "display_address": "30215",
            "pdu_address": "214",
            "name": "Protocol Capability Bitmap",
            "type": "UInt16",
            "unit": "bitmap",
            "description": "bit0=WebSocket, bit1=Modbus TCP, bit2=Modbus RTU, bit3=MQTT",
        },
    ]

    holding_registers = {
        "note": (
            "Holding registers (FC3, 4xxxx) are RESERVED. "
            "They are read-only stubs in the current MVP. "
            "Do NOT use them for sensor measurements."
        ),
        "future_use": [
            {"display_address": "40001", "name": "Pressure Warning Limit",    "type": "Float32", "unit": "bar"},
            {"display_address": "40002", "name": "Pressure Critical Limit",   "type": "Float32", "unit": "bar"},
            {"display_address": "40003", "name": "Temperature Warning Limit", "type": "Float32", "unit": "°C"},
            {"display_address": "40004", "name": "Temperature Critical Limit","type": "Float32", "unit": "°C"},
            {"display_address": "40005", "name": "Sampling Rate",             "type": "UInt16",  "unit": "ms"},
        ],
    }

    return {
        "function_code": 4,
        "function_code_description": "Read Input Registers (FC4) — sensor values are read-only",
        "address_notation": "Display address = PDU address + 30001",
        "float32_encoding": (
            "Two consecutive 16-bit registers; high word at lower address. "
            "Byte order configurable: ABCD (default), CDAB, BADC, DCBA."
        ),
        "normal_operating_ranges": {
            "pressure_bar":    {"min": 6.0,  "max": 8.0},
            "temperature_degc": {"min": 70.0, "max": 90.0},
        },
        "registers": registers,
        "holding_registers": holding_registers,
    }
