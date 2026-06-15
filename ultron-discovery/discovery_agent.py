#!/usr/bin/env python3
"""
ULTRON Standalone Discovery Agent
====================================
Finds ULTRON Edge devices using all four detection methods:

  1. mDNS / Zeroconf   — browses _ultron._tcp.local. on the LAN
  2. HTTP subnet scan  — tries GET /api/device/identity on common Pi IPs
  3. Modbus TCP scan   — tries reading heartbeat register (30012) on port 5020 / 502
  4. Modbus RTU scan   — scans serial ports for ULTRON identity registers

Run on the laptop / engineering workstation — NOT on the Raspberry Pi.

Usage:
    # Auto mode (all methods):
    python discovery_agent.py

    # Limit to specific methods:
    python discovery_agent.py --no-rtu
    python discovery_agent.py --no-modbus-tcp
    python discovery_agent.py --subnet 192.168.2.0/24

    # Extended RTU scan:
    python discovery_agent.py --rtu-timeout 3 --rtu-slaves 1-15

Output:
    JSON list of found devices printed to stdout.
    The tool also writes results to ``ultron_devices.json`` in the current directory.
"""

import argparse
import asyncio
import ipaddress
import json
import logging
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ultron.discovery")

# ── Optional imports ──────────────────────────────────────────────────────────

try:
    import urllib.request
    import urllib.error
    _HTTP_AVAILABLE = True
except ImportError:
    _HTTP_AVAILABLE = False

try:
    from zeroconf import ServiceBrowser, ServiceListener, Zeroconf
    _ZEROCONF_AVAILABLE = True
except ImportError:
    _ZEROCONF_AVAILABLE = False
    log.warning("zeroconf not installed — mDNS discovery disabled. pip install zeroconf")

try:
    from pymodbus.client import ModbusTcpClient
    _MODBUS_TCP_AVAILABLE = True
except ImportError:
    _MODBUS_TCP_AVAILABLE = False
    log.warning("pymodbus not installed — Modbus TCP scan disabled. pip install pymodbus")

try:
    import serial
    import serial.tools.list_ports
    _SERIAL_AVAILABLE = True
except ImportError:
    _SERIAL_AVAILABLE = False
    log.warning("pyserial not installed — RTU scan disabled. pip install pyserial")


# ── Data model ────────────────────────────────────────────────────────────────

@dataclass
class FoundDevice:
    device_name:   str
    ip:            str
    api_port:      int            = 8000
    modbus_port:   int            = 5020
    rtu_port:      Optional[str]  = None
    rtu_baudrate:  Optional[int]  = None
    rtu_slave_id:  Optional[int]  = None
    version:       str            = "unknown"
    protocol:      str            = "unknown"   # mdns | http | modbus_tcp | modbus_rtu
    timestamp:     float          = field(default_factory=time.time)

    @property
    def api_base(self) -> str:
        return f"http://{self.ip}:{self.api_port}"

    @property
    def ws_url(self) -> str:
        return f"ws://{self.ip}:{self.api_port}/ws"


# ── 1. mDNS / Zeroconf ───────────────────────────────────────────────────────

def discover_mdns(timeout: float = 5.0) -> list[FoundDevice]:
    """Browse _ultron._tcp.local. for ULTRON Edge services."""
    if not _ZEROCONF_AVAILABLE:
        return []

    found: list[FoundDevice] = []

    class UltronListener(ServiceListener):
        def add_service(self, zc: Zeroconf, type_: str, name: str) -> None:
            info = zc.get_service_info(type_, name)
            if info is None:
                return
            ip = ".".join(str(b) for b in info.addresses[0]) if info.addresses else "unknown"
            props = {
                k.decode() if isinstance(k, bytes) else k:
                v.decode() if isinstance(v, bytes) else str(v)
                for k, v in (info.properties or {}).items()
            }
            device = FoundDevice(
                device_name = props.get("device_name", name),
                ip          = ip,
                api_port    = info.port,
                modbus_port = int(props.get("modbus_tcp_port", "5020")),
                version     = props.get("version", "unknown"),
                protocol    = "mdns",
            )
            found.append(device)
            log.info("[mDNS] Found: %s at %s:%d", device.device_name, ip, info.port)

        def remove_service(self, *_): pass
        def update_service(self, *_): pass

    zc = Zeroconf()
    listener = UltronListener()
    browser = ServiceBrowser(zc, "_ultron._tcp.local.", listener)  # noqa: F841

    log.info("[mDNS] Browsing for _ultron._tcp.local. (%.0f s)…", timeout)
    time.sleep(timeout)
    zc.close()
    return found


# ── 2. HTTP subnet scan ───────────────────────────────────────────────────────

SUBNET_CANDIDATES = [
    # Common home/office subnets where a Pi is likely assigned
    ("192.168.1", range(1, 31)),
    ("192.168.1", range(100, 121)),
    ("192.168.0", range(1, 31)),
    ("192.168.0", range(100, 121)),
    ("10.0.0",    range(1, 21)),
    ("10.0.1",    range(1, 21)),
    ("172.16.0",  range(1, 21)),
]

API_PORTS = [8000, 8080]


def _http_probe(ip: str, port: int, timeout: float) -> Optional[dict]:
    """Try GET /api/device/identity and return the JSON body or None."""
    if not _HTTP_AVAILABLE:
        return None
    url = f"http://{ip}:{port}/api/device/identity"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            if resp.status != 200:
                return None
            data = json.loads(resp.read())
            if data.get("device_name") == "ULTRON Edge":
                return data
    except Exception:
        pass
    return None


def discover_http(
    extra_subnet: Optional[str] = None,
    timeout: float = 1.5,
) -> list[FoundDevice]:
    """Scan common subnet IP ranges for the ULTRON identity endpoint."""
    candidates: list[tuple[str, int]] = []

    if extra_subnet:
        try:
            net = ipaddress.ip_network(extra_subnet, strict=False)
            for host in net.hosts():
                for port in API_PORTS:
                    candidates.append((str(host), port))
        except ValueError as exc:
            log.warning("Invalid subnet '%s': %s", extra_subnet, exc)

    for prefix, rng in SUBNET_CANDIDATES:
        for i in rng:
            for port in API_PORTS:
                candidates.append((f"{prefix}.{i}", port))

    log.info("[HTTP] Scanning %d addresses (timeout=%.1f s)…", len(candidates), timeout)
    found: list[FoundDevice] = []

    for ip, port in candidates:
        data = _http_probe(ip, port, timeout)
        if data:
            device = FoundDevice(
                device_name = data["device_name"],
                ip          = ip,
                api_port    = port,
                modbus_port = data.get("modbus_tcp_port", 5020),
                version     = data.get("software_version", "unknown"),
                protocol    = "http",
            )
            found.append(device)
            log.info("[HTTP] Found: %s at %s:%d", device.device_name, ip, port)
            break  # Stop after first hit to avoid delay; remove for full scan

    return found


# ── 3. Modbus TCP scan ────────────────────────────────────────────────────────

MODBUS_TCP_PORTS = [5020, 502]
HEARTBEAT_REGISTER = 11   # PDU address 11 = display 30012
IDENTITY_SIG_REG   = 200  # PDU address 200 = display 30201 → "UL" = 0x554C


def _modbus_tcp_probe(ip: str, port: int, timeout: float) -> bool:
    """Return True if the host responds to a Modbus input register read and looks like ULTRON."""
    if not _MODBUS_TCP_AVAILABLE:
        return False
    try:
        client = ModbusTcpClient(ip, port=port, timeout=timeout)
        if not client.connect():
            return False
        # Read heartbeat register (non-zero after first sensor update) + identity signature
        rr = client.read_input_registers(address=IDENTITY_SIG_REG, count=1, slave=1)
        client.close()
        if rr.isError():
            return False
        # Signature word 0x554C = "UL" (first two bytes of "ULTRON EDGE")
        return rr.registers[0] == 0x554C
    except Exception:
        return False


def discover_modbus_tcp(
    ip_list: Optional[list[str]] = None,
    timeout: float = 1.0,
) -> list[FoundDevice]:
    """
    Scan for ULTRON devices via Modbus TCP.
    If ``ip_list`` is not provided, uses the same subnet candidates as the HTTP scan.
    """
    if not _MODBUS_TCP_AVAILABLE:
        return []

    if ip_list is None:
        ip_list = [
            f"{prefix}.{i}"
            for prefix, rng in SUBNET_CANDIDATES
            for i in rng
        ]

    log.info("[Modbus TCP] Scanning %d IPs on ports %s…", len(ip_list), MODBUS_TCP_PORTS)
    found: list[FoundDevice] = []

    for ip in ip_list:
        for port in MODBUS_TCP_PORTS:
            if _modbus_tcp_probe(ip, port, timeout):
                device = FoundDevice(
                    device_name = "ULTRON Edge",
                    ip          = ip,
                    api_port    = 8000,
                    modbus_port = port,
                    protocol    = "modbus_tcp",
                )
                found.append(device)
                log.info("[Modbus TCP] Found ULTRON at %s:%d", ip, port)
                break

    return found


# ── 4. Modbus RTU scan ────────────────────────────────────────────────────────

def _list_serial_ports() -> list[str]:
    """Return available serial port names on the current OS."""
    if not _SERIAL_AVAILABLE:
        return []
    ports = [p.device for p in serial.tools.list_ports.comports()]
    # Add common Pi / USB serial ports that may not appear in comports()
    import sys as _sys
    if _sys.platform.startswith("linux"):
        import glob
        ports += glob.glob("/dev/ttyUSB*")
        ports += glob.glob("/dev/ttyACM*")
        ports += glob.glob("/dev/ttyAMA*")
        ports += glob.glob("/dev/ttyS[0-3]")
    elif _sys.platform == "darwin":
        import glob
        ports += glob.glob("/dev/tty.usbserial*")
        ports += glob.glob("/dev/tty.usbmodem*")
    return sorted(set(ports))


COMMON_BAUDRATES = [9600, 19200, 38400, 115200]
DEFAULT_SLAVE_IDS = range(1, 11)   # 1–10


def _modbus_rtu_probe(
    port: str,
    baudrate: int,
    slave_id: int,
    timeout: float,
) -> bool:
    """Try reading the ULTRON identity signature register over Modbus RTU."""
    if not _SERIAL_AVAILABLE or not _MODBUS_TCP_AVAILABLE:
        return False
    try:
        from pymodbus.client import ModbusSerialClient
        from pymodbus.framer  import FramerType

        client = ModbusSerialClient(
            port=port,
            framer=FramerType.RTU,
            baudrate=baudrate,
            parity="N",
            stopbits=1,
            bytesize=8,
            timeout=timeout,
        )
        if not client.connect():
            return False
        rr = client.read_input_registers(address=IDENTITY_SIG_REG, count=1, slave=slave_id)
        client.close()
        if rr.isError():
            return False
        return rr.registers[0] == 0x554C  # "UL" signature
    except Exception:
        return False


def discover_modbus_rtu(
    slave_ids: range = DEFAULT_SLAVE_IDS,
    timeout: float = 1.5,
    max_slaves_per_port: int = 10,
) -> list[FoundDevice]:
    """
    Scan all available serial ports with common baudrates for ULTRON RTU devices.
    Opens each port briefly and closes it — no aggressive polling.
    """
    if not _SERIAL_AVAILABLE:
        return []

    ports = _list_serial_ports()
    if not ports:
        log.info("[RTU] No serial ports found")
        return []

    log.info("[RTU] Scanning %d port(s): %s", len(ports), ports)
    found: list[FoundDevice] = []

    for port in ports:
        for baud in COMMON_BAUDRATES:
            hit = False
            for sid in slave_ids:
                if _modbus_rtu_probe(port, baud, sid, timeout):
                    device = FoundDevice(
                        device_name  = "ULTRON Edge",
                        ip           = "n/a",
                        api_port     = 0,
                        modbus_port  = 0,
                        rtu_port     = port,
                        rtu_baudrate = baud,
                        rtu_slave_id = sid,
                        protocol     = "modbus_rtu",
                    )
                    found.append(device)
                    log.info(
                        "[RTU] Found ULTRON at %s | baud=%d | slave=%d",
                        port, baud, sid,
                    )
                    hit = True
                    break
            if hit:
                break   # Move to next port once we find a working baud/slave

    return found


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="ULTRON device discovery agent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--no-mdns",       action="store_true", help="Skip mDNS scan")
    parser.add_argument("--no-http",       action="store_true", help="Skip HTTP subnet scan")
    parser.add_argument("--no-modbus-tcp", action="store_true", help="Skip Modbus TCP scan")
    parser.add_argument("--no-rtu",        action="store_true", help="Skip Modbus RTU scan")
    parser.add_argument("--subnet",        default=None,        help="Extra subnet to scan (e.g. 192.168.2.0/24)")
    parser.add_argument("--mdns-timeout",  type=float, default=5.0, help="mDNS browse time (s)")
    parser.add_argument("--http-timeout",  type=float, default=1.5, help="HTTP probe timeout (s)")
    parser.add_argument("--rtu-timeout",   type=float, default=1.5, help="RTU probe timeout (s)")
    parser.add_argument("--rtu-slaves",    default="1-10",           help="RTU slave ID range (e.g. 1-10)")
    parser.add_argument("--output",        default="ultron_devices.json", help="JSON output file")
    args = parser.parse_args()

    # Parse RTU slave ID range
    try:
        lo, hi = (int(x) for x in args.rtu_slaves.split("-"))
        slave_ids = range(lo, hi + 1)
    except Exception:
        slave_ids = DEFAULT_SLAVE_IDS

    all_found: list[FoundDevice] = []
    seen_ips: set[str] = set()

    def add_devices(devices: list[FoundDevice]) -> None:
        for d in devices:
            key = d.rtu_port or d.ip
            if key not in seen_ips:
                seen_ips.add(key)
                all_found.append(d)

    print("\n══════════════════════════════════════════")
    print("  ULTRON Device Discovery Agent")
    print("══════════════════════════════════════════\n")

    if not args.no_mdns:
        add_devices(discover_mdns(timeout=args.mdns_timeout))

    if not args.no_http:
        add_devices(discover_http(extra_subnet=args.subnet, timeout=args.http_timeout))

    if not args.no_modbus_tcp:
        add_devices(discover_modbus_tcp(timeout=args.http_timeout))

    if not args.no_rtu:
        add_devices(discover_modbus_rtu(slave_ids=slave_ids, timeout=args.rtu_timeout))

    # ── Summary ───────────────────────────────────────────────────────────────

    print(f"\n{'═'*44}")
    if all_found:
        print(f"  Found {len(all_found)} ULTRON device(s):\n")
        for d in all_found:
            if d.protocol == "modbus_rtu":
                print(f"  [{d.protocol.upper():12s}] {d.rtu_port} @ {d.rtu_baudrate} baud | slave {d.rtu_slave_id}")
            else:
                print(f"  [{d.protocol.upper():12s}] {d.ip}:{d.api_port}  (Modbus TCP :{d.modbus_port})")
                print(f"                 API  → {d.api_base}")
                print(f"                 WS   → {d.ws_url}")
            print()
    else:
        print("  No ULTRON devices found.")
        print("\n  Tips:")
        print("    • Check that the Pi is powered and connected to the same network.")
        print("    • Verify the backend is running:  uvicorn app.main:app --host 0.0.0.0 --port 8000")
        print("    • For RTU: check the USB serial adapter is connected and drivers installed.")
    print("═" * 44)

    # ── Write JSON output ─────────────────────────────────────────────────────
    result = [asdict(d) for d in all_found]
    result_with_urls = []
    for d, raw in zip(all_found, result):
        raw["api_base"] = d.api_base
        raw["ws_url"]   = d.ws_url
        result_with_urls.append(raw)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result_with_urls, f, indent=2, default=str)
    print(f"\n  Results written to: {args.output}\n")


if __name__ == "__main__":
    main()
