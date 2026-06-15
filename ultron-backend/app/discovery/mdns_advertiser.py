"""
ULTRON mDNS / Zeroconf Advertiser
====================================
Announces the ULTRON Edge device on the local network so that laptops,
SCADA systems, and the dashboard can discover it automatically without
requiring manual IP entry.

Advertisement details
---------------------
  Service type : _ultron._tcp.local.
  Service name : ULTRON Edge._ultron._tcp.local.
  Hostname     : ultron-edge.local.
  Port         : API port (default 8000)

TXT records (visible to any mDNS browser):
  device_name      — "ULTRON Edge"
  api_port         — "8000"
  modbus_tcp_port  — "5020"
  version          — "1.0.0"
  device_type      — "raspberry_pi_gateway"

Graceful degradation
--------------------
If the ``zeroconf`` package is not installed, or if the network interface
is unavailable, a WARNING is logged and all other services continue.
Hostname-based discovery (``ultron-edge.local``) still works on Pi 4 via
avahi-daemon even when this Python advertiser is disabled.

Platform note
-------------
zeroconf uses a background thread internally.  ``start()`` is synchronous
(blocking just long enough to register the service) but must be called from
a thread, not directly from an asyncio coroutine.  Use ``start_async()``
when calling from the FastAPI lifespan to run in a thread executor.
"""

import asyncio
import socket
from typing import Optional

from app.logger import logger

try:
    from zeroconf import ServiceInfo, Zeroconf
    _ZEROCONF_AVAILABLE = True
except ImportError:
    _ZEROCONF_AVAILABLE = False


class MDNSAdvertiser:
    """Registers and unregisters an mDNS service record for this ULTRON device."""

    SERVICE_TYPE = "_ultron._tcp.local."

    def __init__(
        self,
        device_name:     str,
        hostname:        str,
        api_port:        int,
        modbus_tcp_port: int,
        version:         str,
    ) -> None:
        self._device_name     = device_name
        self._hostname        = hostname
        self._api_port        = api_port
        self._modbus_tcp_port = modbus_tcp_port
        self._version         = version
        self._zeroconf: Optional[object]     = None
        self._info:     Optional[ServiceInfo] = None
        self.running: bool = False

    # ── Public API ─────────────────────────────────────────────────────────────

    def start(self) -> bool:
        """
        Synchronously register the mDNS service.

        Returns True if advertising started, False if zeroconf is unavailable
        or the network interface could not be found.
        Call this from a thread executor (see ``start_async``).
        """
        if not _ZEROCONF_AVAILABLE:
            logger.warning(
                "zeroconf package not installed — mDNS advertisement disabled. "
                "Install with: pip install zeroconf  "
                "Manual discovery via IP address still works."
            )
            return False

        try:
            local_ip = self._get_local_ip()
            service_name = f"{self._device_name}.{self.SERVICE_TYPE}"

            self._info = ServiceInfo(
                type_=self.SERVICE_TYPE,
                name=service_name,
                addresses=[socket.inet_aton(local_ip)],
                port=self._api_port,
                properties={
                    b"device_name":     self._device_name.encode(),
                    b"api_port":        str(self._api_port).encode(),
                    b"modbus_tcp_port": str(self._modbus_tcp_port).encode(),
                    b"version":         self._version.encode(),
                    b"device_type":     b"raspberry_pi_gateway",
                },
                server=f"{self._hostname}.local.",
            )

            self._zeroconf = Zeroconf()
            self._zeroconf.register_service(self._info)
            self.running = True

            logger.info(
                "mDNS: '%s' advertised at %s  |  "
                "hostname=%s.local  api=%d  modbus_tcp=%d",
                self._device_name, local_ip,
                self._hostname, self._api_port, self._modbus_tcp_port,
            )
            return True

        except Exception as exc:
            logger.warning(
                "mDNS advertisement failed: %s  — "
                "Clients can still discover the device by IP or hostname.",
                exc,
            )
            self.running = False
            return False

    async def start_async(self) -> bool:
        """Run ``start()`` in a thread executor so it does not block the event loop."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.start)

    def stop(self) -> None:
        """Unregister the mDNS service and close the Zeroconf instance."""
        if self._zeroconf is not None:
            try:
                if self._info is not None:
                    self._zeroconf.unregister_service(self._info)
                self._zeroconf.close()
            except Exception as exc:
                logger.warning("mDNS shutdown warning: %s", exc)
        self.running = False
        logger.info("mDNS advertiser stopped")

    async def stop_async(self) -> None:
        """Run ``stop()`` in a thread executor."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self.stop)

    # ── Private helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _get_local_ip() -> str:
        """
        Best-effort attempt to find the primary non-loopback IPv4 address.
        Uses a UDP connect trick — no actual packet is sent.
        Falls back to 127.0.0.1 if all interfaces are loopback.
        """
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(("8.8.8.8", 80))
                return s.getsockname()[0]
        except Exception:
            return "127.0.0.1"
