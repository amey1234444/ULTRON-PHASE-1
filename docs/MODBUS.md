# MODBUS.md
## ULTRON — Modbus Protocol Reference

**Purpose:** Single source of truth for Modbus TCP and RTU implementation, register maps, encoding rules, and integration guides.
**Last Updated:** 2026-06-02
**Audience:** PLC programmers, SCADA engineers, software engineers, hardware engineers

> Cross-references: [API.md](API.md) | [PROTOCOLS.md](PROTOCOLS.md) | [HARDWARE.md](HARDWARE.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Connection Details](#2-connection-details)
3. [Address Notation](#3-address-notation)
4. [Input Register Map (FC4)](#4-input-register-map-fc4)
5. [Holding Registers (FC3) — Reserved](#5-holding-registers-fc3--reserved)
6. [Float32 Encoding](#6-float32-encoding)
7. [UInt32 Encoding](#7-uint32-encoding)
8. [Compatibility Integer Registers](#8-compatibility-integer-registers)
9. [Alarm Status Registers](#9-alarm-status-registers)
10. [Device Identity Registers](#10-device-identity-registers)
11. [Sample Requests and Responses](#11-sample-requests-and-responses)
12. [PLC Integration Guide](#12-plc-integration-guide)
13. [SCADA Integration Guide](#13-scada-integration-guide)
14. [Future Expansion](#14-future-expansion)

---

## 1. Overview

ULTRON implements a Modbus slave (server) that exposes all sensor data and device status as Modbus registers.

| Feature | Detail |
|---------|--------|
| Role | Modbus Server (Slave) |
| Function Codes Supported | FC4 (Read Input Registers) — primary |
| Function Codes Reserved | FC3 (Read Holding Registers) — future |
| Register Type | Input Registers (3xxxx) |
| Update Rate | Every 100 ms (same as WebSocket) |
| Slave ID (TCP) | 0 (single-slave, default) |
| Slave ID (RTU) | 1 (configurable) |

### Why Modbus?

ULTRON uses WebSocket as its primary streaming protocol (lower latency, easier integration with desktop apps), but Modbus TCP/RTU is provided for:
- Integration with industrial PLCs (Siemens, Allen-Bradley, Mitsubishi, etc.)
- Integration with SCADA systems (Ignition, WonderWare, Citect, etc.)
- Legacy HMI devices that only support Modbus

---

## 2. Connection Details

### Modbus TCP

| Setting | Value |
|---------|-------|
| Host | `<Raspberry Pi IP>` |
| Port | 5020 (development) / 502 (production — requires root on Linux) |
| Slave ID | 0 |
| Timeout | 5 seconds (recommended client setting) |
| Max connections | No limit enforced in Phase 1 |

### Modbus RTU (RS485)

| Setting | Value |
|---------|-------|
| Serial Port | `/dev/ttyUSB0` (Linux) / `COM1`–`COM4` (Windows) |
| Baud Rate | 9600 |
| Data Bits | 8 |
| Parity | None (N) |
| Stop Bits | 1 |
| Format | 8N1 |
| Slave ID | 1 (configurable in `.env`) |
| RS485 Termination | 120 Ω at each end of the bus |

> Modbus RTU is implemented in software but **not yet tested on physical RS485 hardware**.
> Enable via `.env`: `MODBUS_RTU_ENABLED=true`

---

## 3. Address Notation

Modbus has two address conventions. This document uses both.

| Convention | Example | Used Where |
|-----------|---------|-----------|
| **Display Address** | 30001 | Documentation, SCADA configuration |
| **PDU Address** | 0 | Inside Modbus packets, pymodbus API |
| **Conversion** | Display = PDU + 30001 | — |

When configuring a SCADA system or PLC, use **Display Addresses** (3xxxx format).

```
Display: 30001  →  PDU: 0
Display: 30002  →  PDU: 1
Display: 30005  →  PDU: 4
Display: 30101  →  PDU: 100
Display: 30201  →  PDU: 200
```

---

## 4. Input Register Map (FC4)

Function Code 4 — Read Input Registers (read-only sensor data).

### Primary Process Values

| Display Addr | PDU Addr | Name | Data Type | Unit | Description |
|---|---|---|---|---|---|
| **30001** | 0 | Pressure High Word | UInt16 | — | High 16 bits of P1 Float32 |
| **30002** | 1 | Pressure Low Word | UInt16 | — | Low 16 bits of P1 Float32 |
| **30003** | 2 | Temperature High Word | UInt16 | — | High 16 bits of MT2 Float32 |
| **30004** | 3 | Temperature Low Word | UInt16 | — | Low 16 bits of MT2 Float32 |

**Together 30001–30002 = P1 pressure in bar (Float32, ABCD byte order)**
**Together 30003–30004 = MT2 temperature in °C (Float32, ABCD byte order)**

### Alarm and Status Registers

| Display Addr | PDU Addr | Name | Data Type | Values |
|---|---|---|---|---|
| **30005** | 4 | P1 Pressure Alarm | UInt16 | 0=Normal, 1=Warning, 2=Critical |
| **30006** | 5 | MT2 Temperature Alarm | UInt16 | 0=Normal, 1=Warning, 2=Critical |
| **30007** | 6 | Device Health | UInt16 | 0=Fault, 1=Healthy |
| **30008** | 7 | Sensor Fault | UInt16 | 0=None, 1=Pressure fault, 2=Temp fault, 3=Both |

### System Registers

| Display Addr | PDU Addr | Name | Data Type | Unit | Description |
|---|---|---|---|---|---|
| **30009** | 8 | Uptime High Word | UInt16 | — | High 16 bits of uptime UInt32 |
| **30010** | 9 | Uptime Low Word | UInt16 | — | Low 16 bits of uptime UInt32 (seconds) |
| **30011** | 10 | Communication Mode | UInt16 | enum | 1=WS, 2=TCP, 3=RTU, 4=TCP+RTU |
| **30012** | 11 | Heartbeat Counter | UInt16 | count | Increments every update, wraps at 65535 |

### Compatibility Integer Registers (Optional)

| Display Addr | PDU Addr | Name | Data Type | Unit | Description |
|---|---|---|---|---|---|
| **30101** | 100 | P1 Pressure × 100 | UInt16 | bar×100 | 7.35 bar → 735 |
| **30102** | 101 | MT2 Temperature × 100 | UInt16 | °C×100 | 82.45 °C → 8245 |

Enabled when `MODBUS_COMPAT_REGISTERS=true` (default: true).

### Device Identity Registers

| Display Addr | PDU Addr | Name | Data Type | Description |
|---|---|---|---|---|
| **30201** | 200 | Signature[0] | UInt16 | "UL" (0x554C) |
| **30202** | 201 | Signature[1] | UInt16 | "TR" (0x5452) |
| **30203** | 202 | Signature[2] | UInt16 | "ON" (0x4F4E) |
| **30204** | 203 | Signature[3] | UInt16 | " E" (0x2045) |
| **30205** | 204 | Signature[4] | UInt16 | "DG" (0x4447) |
| **30206** | 205 | Signature[5] | UInt16 | "E\0" (0x4500) |
| **30211** | 210 | SW Major Version | UInt16 | e.g., 1 |
| **30212** | 211 | SW Minor Version | UInt16 | e.g., 0 |
| **30213** | 212 | SW Patch Version | UInt16 | e.g., 0 |
| **30214** | 213 | Device Type Code | UInt16 | 1=RPi Gateway, 2=UM Card, 3=TP Card, 4=Wireless Node |
| **30215** | 214 | Protocol Bitmap | UInt16 | bit0=WS, bit1=TCP, bit2=RTU, bit3=MQTT |

### Complete Register Map Summary

```
30001–30002   P1 Pressure (Float32, bar)
30003–30004   MT2 Temperature (Float32, °C)
30005         P1 Alarm (0/1/2)
30006         MT2 Alarm (0/1/2)
30007         Device Health (0/1)
30008         Sensor Fault (0/1/2/3)
30009–30010   System Uptime (UInt32, seconds)
30011         Communication Mode (enum)
30012         Heartbeat Counter (UInt16)
30013–30100   RESERVED (future sensors Phase 2+)
30101         P1 × 100 (UInt16 compatibility)
30102         MT2 × 100 (UInt16 compatibility)
30103–30200   RESERVED (future compatibility)
30201–30206   Device Signature "ULTRON EDGE" (ASCII)
30207–30210   RESERVED
30211–30215   Software version + device type + protocol bitmap
30216–39999   RESERVED (future expansion)
```

---

## 5. Holding Registers (FC3) — Reserved

Holding Registers (4xxxx) are read-only stubs in Phase 1. Do NOT use for sensor data.

Future use (not yet implemented):

| Display Addr | PDU Addr | Name | Type | Unit |
|---|---|---|---|---|
| **40001** | 0 | Pressure Warning Limit | Float32 | bar |
| **40002** | 1 | Pressure Critical Limit | Float32 | bar |
| **40003** | 2 | Temperature Warning Limit | Float32 | °C |
| **40004** | 3 | Temperature Critical Limit | Float32 | °C |
| **40005** | 4 | Sampling Rate | UInt16 | ms |

> Writing to Holding Registers is not yet implemented. Do not attempt FC6 (Write Single Register) or FC16 (Write Multiple Registers) against this device in Phase 1.

---

## 6. Float32 Encoding

All floating-point process values (pressure, temperature) are stored as **IEEE 754 Float32** in two consecutive 16-bit registers.

### Byte Order

Default: **ABCD** (big-endian, most common in industrial Modbus)

```
Float32 value occupies 4 bytes: A  B  C  D
Register N   = high word = bytes A (MSB) + B
Register N+1 = low  word = bytes C       + D (LSB)
```

Configurable via `.env`: `MODBUS_BYTE_ORDER=ABCD`

Supported options:

| Code | Order | Description |
|------|-------|-------------|
| ABCD | Big-endian | Default — most PLCs (Siemens, etc.) |
| CDAB | Big-endian word swap | Some Allen-Bradley PLCs |
| BADC | Little-endian byte swap | Uncommon |
| DCBA | Little-endian | Uncommon |

> If your PLC reads incorrect Float32 values, try CDAB first (common with Modbus on AB PLCs).

### Worked Example

**Value: 7.35 bar**

```
IEEE 754 representation:
  Sign bit:    0
  Exponent:    10000000 (128 - 127 = 1)
  Mantissa:    11010111000010100111011...
  Hex:         0x 40 EB 85 1F

ABCD byte order:
  Register 30001 (high word) = 0x40EB  ←  bytes A=0x40, B=0xEB
  Register 30002 (low  word) = 0x851F  ←  bytes C=0x85, D=0x1F
```

**Value: 82.45 °C**

```
IEEE 754: 0x 42 A4 E6 66

ABCD byte order:
  Register 30003 = 0x42A4
  Register 30004 = 0xE666
```

### Python Decode Example

```python
import struct

def decode_float32(high_word: int, low_word: int) -> float:
    raw_bytes = struct.pack('>HH', high_word, low_word)  # ABCD = big-endian
    return struct.unpack('>f', raw_bytes)[0]

# Example:
pressure = decode_float32(0x40EB, 0x851F)  # → 7.35
temperature = decode_float32(0x42A4, 0xE666)  # → 82.45
```

---

## 7. UInt32 Encoding

System Uptime is stored as a 32-bit unsigned integer in two 16-bit registers.

```
Register 30009 = high word (most significant 16 bits)
Register 30010 = low  word (least significant 16 bits)

Example: uptime = 3661 seconds (1 hour 1 minute 1 second)
  0x00000E4D
  30009 = 0x0000 (high)
  30010 = 0x0E4D (low)
```

### Python Decode

```python
uptime_s = (high_word << 16) | low_word
```

---

## 8. Compatibility Integer Registers

For PLCs that cannot decode Float32.

| Register | Value | Formula |
|---------|-------|---------|
| 30101 | P1 pressure × 100 | 7.35 bar → 735 |
| 30102 | MT2 temperature × 100 | 82.45 °C → 8245 |

**Read in PLC and divide by 100 to get engineering value.**

Maximum representable values:
- 30101: 65535 / 100 = 655.35 bar (well above pressure range)
- 30102: 65535 / 100 = 655.35 °C (well above temperature range)

---

## 9. Alarm Status Registers

### Alarm Values (30005, 30006)

| Value | Meaning | Pressure Condition | Temperature Condition |
|-------|---------|-------------------|----------------------|
| 0 | Normal | P1 < 8.8 bar | MT2 < 92.0 °C |
| 1 | Warning | P1 ≥ 8.8 bar | MT2 ≥ 92.0 °C |
| 2 | Critical | P1 ≥ 10.45 bar | MT2 ≥ 109.25 °C |

### Device Health (30007)

| Value | Meaning |
|-------|---------|
| 0 | Fault — one or more sensor faults detected |
| 1 | Healthy — all sensors operating normally |

### Sensor Fault (30008)

| Value | Meaning |
|-------|---------|
| 0 | No fault |
| 1 | Pressure sensor fault |
| 2 | Temperature sensor fault |
| 3 | Both sensors faulted |

---

## 10. Device Identity Registers

ULTRON stores a device signature in Modbus registers so clients can confirm they are connected to an ULTRON device (not an unknown Modbus device).

### Signature Registers (30201–30206)

Each register holds two ASCII characters:
```
30201 = 0x554C = 'U' + 'L'
30202 = 0x5452 = 'T' + 'R'
30203 = 0x4F4E = 'O' + 'N'
30204 = 0x2045 = ' ' + 'E'
30205 = 0x4447 = 'D' + 'G'
30206 = 0x4500 = 'E' + NUL
→ "ULTRON EDGE"
```

### Protocol Capability Bitmap (30215)

| Bit | Mask | Protocol |
|-----|------|---------|
| 0 | 0x0001 | WebSocket |
| 1 | 0x0002 | Modbus TCP |
| 2 | 0x0004 | Modbus RTU |
| 3 | 0x0008 | MQTT (future) |

Example: WebSocket + Modbus TCP → 0x0003

---

## 11. Sample Requests and Responses

### Read Pressure and Temperature (Python pymodbus)

```python
from pymodbus.client import ModbusTcpClient

client = ModbusTcpClient('192.168.1.100', port=5020)
client.connect()

# Read 4 registers starting at PDU address 0 (= display 30001-30004)
result = client.read_input_registers(address=0, count=4, slave=0)

if not result.isError():
    high_p, low_p, high_t, low_t = result.registers
    
    import struct
    pressure    = struct.unpack('>f', struct.pack('>HH', high_p, low_p))[0]
    temperature = struct.unpack('>f', struct.pack('>HH', high_t, low_t))[0]
    
    print(f"Pressure:    {pressure:.2f} bar")
    print(f"Temperature: {temperature:.1f} °C")

client.close()
```

### Read All Status Registers

```python
# Read registers 30005–30012 (PDU 4–11)
result = client.read_input_registers(address=4, count=8, slave=0)
if not result.isError():
    alarm_p, alarm_t, health, fault, up_h, up_l, comm, heartbeat = result.registers
    uptime = (up_h << 16) | up_l
    print(f"P1 alarm:     {['Normal','Warning','Critical'][alarm_p]}")
    print(f"MT2 alarm:    {['Normal','Warning','Critical'][alarm_t]}")
    print(f"Health:       {'Healthy' if health else 'Fault'}")
    print(f"Uptime:       {uptime} seconds")
    print(f"Heartbeat:    {heartbeat}")
```

### Read Compatibility Integer Registers

```python
# PDU 100-101 = display 30101-30102
result = client.read_input_registers(address=100, count=2, slave=0)
if not result.isError():
    pressure_int, temp_int = result.registers
    pressure = pressure_int / 100.0
    temperature = temp_int / 100.0
    print(f"Pressure:    {pressure:.2f} bar")
    print(f"Temperature: {temperature:.2f} °C")
```

### Verify Device Identity

```python
# PDU 200-205 = display 30201-30206 = "ULTRON EDGE"
result = client.read_input_registers(address=200, count=6, slave=0)
if not result.isError():
    signature = ''.join(
        chr((r >> 8) & 0xFF) + chr(r & 0xFF)
        for r in result.registers
    ).rstrip('\x00')
    print(f"Device: '{signature}'")  # → 'ULTRON EDGE'
```

---

## 12. PLC Integration Guide

### Siemens TIA Portal (S7-1200 / S7-1500)

1. Create a new Modbus TCP connection block
2. Set IP address to Raspberry Pi IP
3. Set port to 5020 (or 502 for production)
4. Use `MB_CLIENT` function block:
   ```
   MB_DATA_ADDR = 1 (start at register 1 = PDU 0 = display 30001)
   MB_DATA_LEN  = 4 (read 4 registers)
   MB_DATA_PTR  = pointer to REAL array
   MB_MODE      = 4 (FC4 — Read Input Registers)
   ```
5. Decode Float32: TIA Portal `DWORD_TO_REAL` with swap if needed

### Allen-Bradley / Rockwell (Studio 5000)

1. Add MSG instruction with `Modbus TCP` communication
2. Set service code to `FC4 (0x04)`
3. Set element = starting PDU address (0 for pressure)
4. Data type: REAL (Float32) — note: AB PLCs may require CDAB byte order
5. Set `MODBUS_BYTE_ORDER=CDAB` in `.env` if values appear incorrect

### Generic Modbus TCP Client (Any PLC)

| Parameter | Value |
|-----------|-------|
| Function code | 0x04 (FC4) |
| Start address | 0x0000 (PDU 0 = display 30001) |
| Quantity | 4 (for pressure + temperature) |
| Transaction ID | Any |
| Unit ID | 0 |

---

## 13. SCADA Integration Guide

### Ignition (Inductive Automation)

1. Add Modbus TCP device driver
2. Set hostname/IP and port (5020 or 502)
3. Create UDT (User Defined Type) with tags:
   ```
   P1_Pressure:    Holding/Input Register, address 30001, type Float32, ABCD
   MT2_Temperature: Holding/Input Register, address 30003, type Float32, ABCD
   P1_Alarm:       Holding/Input Register, address 30005, type INT
   Device_Health:  Holding/Input Register, address 30007, type INT
   ```
4. Set scan rate to 100 ms (matches ULTRON update rate)

### WonderWare / AVEVA

1. Create Modbus TCP I/O server connection
2. Configure topics for each tag group
3. Use FLOAT data type for 30001/30003 with appropriate byte-swap setting

### General SCADA Rules

- Use display addresses (30001, 30003, etc.) — SCADA software handles the PDU conversion
- Set poll rate to 500 ms or faster (ULTRON updates at 100 ms)
- Monitor heartbeat register (30012) — if it stops incrementing, connection has stalled
- Monitor device health register (30007) — if 0, investigate sensor faults

---

## 14. Future Expansion

### Phase 2 Registers (Reserved)

When bearing temperatures, RPM, and motor current are added:

| Display Addr | Name | Type | Unit | Phase |
|---|---|---|---|---|
| 30013–30014 | BT1 Drive Bearing Temp | Float32 | °C | Phase 2 |
| 30015–30016 | BT2 NDS Bearing Temp | Float32 | °C | Phase 2 |
| 30017–30018 | RPM1 Rotor Speed | Float32 | rpm | Phase 2 |
| 30019 | ZS1 Zero Speed | UInt16 | 0/1 | Phase 2 |
| 30020–30021 | M1 Motor Current | Float32 | A | Phase 2 |
| 30022–30023 | P2 Outlet Pressure | Float32 | bar | Phase 2 |

### Phase 3 Registers (Reserved)

| Display Addr | Name | Type | Unit | Phase |
|---|---|---|---|---|
| 30025–30026 | V1 DS Vibration RMS | Float32 | mm/s | Phase 3 |
| 30027–30028 | V2 NDS Vibration RMS | Float32 | mm/s | Phase 3 |
| 30029–30030 | Machine Health Score | Float32 | % | Phase 3 |

> **Policy:** New registers are always added at the next available address. Existing registers are never renumbered or relocated.
