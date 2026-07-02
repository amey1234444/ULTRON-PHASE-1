"""
ULTRON - Industrial IoT Monitoring System
Sensor Manager: abstraction layer over optional physical GPIO sensors.

Bridge data is the primary runtime source. If direct hardware sensors are unavailable,
the backend stays online in bridge-only mode and does not generate fake readings.
"""

import asyncio
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional

from app.config import settings
from app.logger import logger
from app.models import SensorReading, SystemStatus


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------

class BaseSensor(ABC):
    """Common interface every sensor implementation must satisfy."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._last_value: float = 0.0

    @abstractmethod
    async def read(self) -> float:
        """Return the latest sensor value (non-blocking)."""

    @property
    def last_value(self) -> float:
        return self._last_value


# ---------------------------------------------------------------------------

class HardwarePressureSensor(BaseSensor):
    """
    4â€“20 mA industrial pressure transmitter read via ADS1115 I2C ADC.

    Wiring (see HARDWARE.md Â§ 5.P1 and Â§ 11):
        24 VDC PSU (+) â†’ sensor (+, 4â€“20 mA out)
        Sensor (â€“)     â†’ 250 Î© shunt â†’ ADS1115 AIN0 (positive)
        Shunt other end â†’ ADS1115 GND = 24 VDC PSU (â€“) = RPi GND
        ADS1115 VDD    â†’ RPi 5 V (Pin 2)
        ADS1115 SDA    â†’ RPi GPIO 2 / I2C SDA (Pin 3)
        ADS1115 SCL    â†’ RPi GPIO 3 / I2C SCL (Pin 5)
        ADS1115 ADDR   â†’ GND â†’ I2C address 0x48

    Signal maths:
        4 mA  Ã— 250 Î© = 1.000 V â†’ 0 bar (sensor lower range)
        20 mA Ã— 250 Î© = 5.000 V â†’ PRESSURE_SENSOR_RANGE_BAR
        Gain TWOTHIRDS (Â±6.144 V) is required; default Â±4.096 V clips at 5 V.

    Install on Pi:  pip install adafruit-circuitpython-ads1x15 adafruit-blinka
    Enable I2C:     sudo raspi-config â†’ Interfaces â†’ I2C â†’ Enable
    """

    def __init__(self) -> None:
        super().__init__(settings.sensor.pressure_name)
        self._sensor_range_bar: float = settings.sensor.pressure_sensor_range_bar
        self._channel = None
        self._setup_hardware()

    def _setup_hardware(self) -> None:
        try:
            import board                          # type: ignore[import]
            import busio                          # type: ignore[import]
            import adafruit_ads1x15.ads1115 as ADS  # type: ignore[import]
            from adafruit_ads1x15.analog_in import AnalogIn  # type: ignore[import]

            i2c = busio.I2C(board.SCL, board.SDA)
            ads = ADS.ADS1115(i2c, address=settings.sensor.pressure_ads1115_address)
            # Â±6.144 V gain â€” mandatory so 5 V (= 20 mA Ã— 250 Î©) does not clip
            ads.gain = 2 / 3
            channel_pin = settings.sensor.pressure_ads1115_channel  # 0â€“3 â†’ AIN0â€“AIN3
            self._channel = AnalogIn(ads, channel_pin)
            logger.info(
                "ADS1115 pressure sensor ready  I2C=0x%02X  AIN%d  range=0â€“%.0f bar",
                settings.sensor.pressure_ads1115_address,
                channel_pin,
                self._sensor_range_bar,
            )
        except ImportError as exc:
            logger.error(
                "adafruit-circuitpython-ads1x15 not installed: %s  "
                "Run: pip install adafruit-circuitpython-ads1x15 adafruit-blinka", exc
            )
            raise
        except Exception as exc:
            logger.error("ADS1115 pressure sensor init failed: %s", exc)
            raise

    async def read(self) -> float:
        # ADS1115 read is blocking I/O; run in thread pool to avoid stalling the event loop
        loop = asyncio.get_event_loop()
        raw = await loop.run_in_executor(None, self._read_raw)
        self._last_value = round(raw, 2)
        return self._last_value

    def _read_raw(self) -> float:
        voltage = self._channel.voltage        # 1.000 V (4 mA) to 5.000 V (20 mA)
        # I (mA) = V / R  â†’  V / 250 Î© Ã— 1000  =  V Ã— 4
        current_ma = voltage * 4.0
        # Clamp to valid 4â€“20 mA span (handles open-circuit or wiring faults)
        current_ma = max(4.0, min(20.0, current_ma))
        # Linear scale: 4 mA = 0 bar, 20 mA = sensor_range bar
        return (current_ma - 4.0) / 16.0 * self._sensor_range_bar


class HardwareTemperatureSensor(BaseSensor):
    """
    Wraps a physical temperature sensor on Raspberry Pi 4.
    Supports 1-Wire DS18B20 out of the box; swap the read logic for I2C/SPI sensors.
    """

    def __init__(self) -> None:
        super().__init__(settings.sensor.temperature_name)
        self._device_file: Optional[str] = None
        self._setup_hardware()

    def _setup_hardware(self) -> None:
        import glob
        import os

        base = "/sys/bus/w1/devices/"
        devices = glob.glob(os.path.join(base, "28-*"))
        if not devices:
            logger.error("No DS18B20 1-Wire device found under %s", base)
            raise RuntimeError("DS18B20 sensor not detected")
        self._device_file = os.path.join(devices[0], "w1_slave")
        logger.info("Temperature sensor mapped to %s", self._device_file)

    async def read(self) -> float:
        # DS18B20 read is blocking I/O; offload to thread pool to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        raw = await loop.run_in_executor(None, self._read_raw)
        self._last_value = round(raw, 1)
        return self._last_value

    def _read_raw(self) -> float:
        with open(self._device_file, "r") as f:  # type: ignore[arg-type]
            lines = f.readlines()
        if lines[0].strip()[-3:] != "YES":
            raise IOError("DS18B20 CRC check failed")
        pos = lines[1].find("t=")
        return float(lines[1][pos + 2:]) / 1000.0


# ---------------------------------------------------------------------------
# Sensor Manager â€” orchestrates reads and determines system status
# ---------------------------------------------------------------------------

class SensorManager:
    """
    Top-level coordinator that:
      - Initialises optional hardware sensors at startup
      - Reads both sensors concurrently
      - Derives a SystemStatus from the current values
      - Exposes the latest SensorReading for REST snapshot and WebSocket broadcast
    """

    # Thresholds for status escalation
    _PRESSURE_WARNING = settings.sensor.pressure_max * 0.80
    _PRESSURE_CRITICAL = settings.sensor.pressure_max * 0.95
    _TEMP_WARNING = settings.sensor.temperature_max * 0.80
    _TEMP_CRITICAL = settings.sensor.temperature_max * 0.95

    def __init__(self) -> None:
        self._pressure_sensor: Optional[BaseSensor] = None
        self._temperature_sensor: Optional[BaseSensor] = None
        self._latest: Optional[SensorReading] = None
        self._initialised = False

    async def initialise(self) -> None:
        """Call once at application startup."""
        logger.info("Starting in bridge-first mode; attempting direct hardware sensors")
        try:
            self._pressure_sensor = HardwarePressureSensor()
            self._temperature_sensor = HardwareTemperatureSensor()
        except Exception as exc:
            self._pressure_sensor = None
            self._temperature_sensor = None
            logger.warning(
                "Direct hardware sensors unavailable; bridge-only mode active: %s", exc
            )

        self._initialised = True
        logger.info(
            "SensorManager ready | mode=%s | pressure=%s | temperature=%s",
            self.mode,
            self._pressure_sensor.name if self._pressure_sensor else "bridge-only",
            self._temperature_sensor.name if self._temperature_sensor else "bridge-only",
        )

    async def read(self) -> SensorReading:
        """Read both sensors concurrently and return a composite SensorReading."""
        if not self._initialised:
            raise RuntimeError("SensorManager.initialise() must be called before read()")
        if self._pressure_sensor is None or self._temperature_sensor is None:
            raise RuntimeError("Direct hardware sensors unavailable; waiting for bridge data")

        pressure, temperature = await asyncio.gather(
            self._pressure_sensor.read(),
            self._temperature_sensor.read(),
        )

        status = self._derive_status(pressure, temperature)

        reading = SensorReading(
            timestamp=datetime.now(timezone.utc),
            pressure=pressure,
            temperature=temperature,
            status=status,
        )
        self._latest = reading
        return reading

    @property
    def latest(self) -> Optional[SensorReading]:
        return self._latest

    @property
    def mode(self) -> str:
        return "hardware" if self._pressure_sensor and self._temperature_sensor else "bridge"

    def _derive_status(self, pressure: float, temperature: float) -> SystemStatus:
        if pressure >= self._PRESSURE_CRITICAL or temperature >= self._TEMP_CRITICAL:
            return SystemStatus.CRITICAL
        if pressure >= self._PRESSURE_WARNING or temperature >= self._TEMP_WARNING:
            return SystemStatus.WARNING
        return SystemStatus.HEALTHY
