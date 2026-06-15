"""
ULTRON - Industrial IoT Monitoring System
Sensor Manager: abstraction layer over physical GPIO sensors and a built-in simulator.

Physical sensor classes wrap RPi.GPIO / Adafruit libraries and are imported lazily
so the server starts cleanly on non-Pi hardware (simulated mode).
"""

import asyncio
import math
import random
import time
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
# Simulated sensors — realistic industrial machine behaviour
# ---------------------------------------------------------------------------

class SimulatedPressureSensor(BaseSensor):
    """
    Industrial pump pressure simulator — operating band 6–8 bar.

    Signal layers (all superimposed):
      1. Slow pump cycle      sin(45 s period)   — main load oscillation
      2. Valve pulsation      sin( 5 s period)   — high-frequency flutter
      3. Gaussian noise       σ = 0.04 bar       — measurement noise
      4. EMA (α = 0.35)                          — sensor inertia
      5. Spike events         bell-curve profile — occasional pressure surges
                              Avg ~1 per 50 s; peak +0.8–3.0 bar above base.
                              Surges above 8.8 bar trigger WARNING,
                              above 10.5 bar trigger CRITICAL.
    """

    # Normal operating centre and oscillation amplitude
    _BAND_MID: float = 7.0
    _BAND_HALF: float = 0.85   # slow cycle half-amplitude (bar)
    _RIPPLE: float = 0.15      # fast ripple half-amplitude (bar)
    _NOISE_STD: float = 0.04

    # EMA smoothing factor (higher = less smoothing / more responsive)
    _ALPHA: float = 0.35

    # Spike parameters
    _SPIKE_PROB: float = 0.002         # per reading ≈ 1 event per 50 s at 10 Hz
    _SPIKE_STEPS_MIN: int = 6          # 0.6 s at 10 Hz
    _SPIKE_STEPS_MAX: int = 18         # 1.8 s at 10 Hz
    _SPIKE_AMP_MIN: float = 0.8        # bar above instantaneous base (triggers WARNING)
    _SPIKE_AMP_MAX: float = 3.0        # bar above instantaneous base (triggers CRITICAL)

    def __init__(self) -> None:
        super().__init__(settings.sensor.pressure_name)
        self._t0 = time.monotonic()
        self._smoothed: float = self._BAND_MID
        self._spike_active: bool = False
        self._spike_step: int = 0
        self._spike_total: int = 0
        self._spike_amp: float = 0.0

    async def read(self) -> float:
        elapsed = time.monotonic() - self._t0

        # Composite base: slow pump cycle + valve pulsation ripple + noise
        base = (
            self._BAND_MID
            + self._BAND_HALF * math.sin(2 * math.pi * elapsed / 45.0)
            + self._RIPPLE   * math.sin(2 * math.pi * elapsed / 5.0)
            + random.gauss(0.0, self._NOISE_STD)
        )

        # Smooth base via exponential moving average (sensor inertia)
        self._smoothed = self._ALPHA * base + (1.0 - self._ALPHA) * self._smoothed

        # Spike overlay added directly to the smoothed output (not re-filtered)
        spike_offset = 0.0
        if self._spike_active:
            progress = self._spike_step / self._spike_total
            # Bell-curve envelope: smooth rise and fall
            spike_offset = self._spike_amp * math.sin(math.pi * progress)
            self._spike_step += 1
            if self._spike_step >= self._spike_total:
                self._spike_active = False
        elif random.random() < self._SPIKE_PROB:
            self._spike_total = random.randint(self._SPIKE_STEPS_MIN, self._SPIKE_STEPS_MAX)
            self._spike_step = 0
            self._spike_amp = random.uniform(self._SPIKE_AMP_MIN, self._SPIKE_AMP_MAX)
            self._spike_active = True
            logger.debug(
                "Pressure spike: +%.2f bar over %d steps (%.1f s)",
                self._spike_amp, self._spike_total, self._spike_total / 10.0,
            )

        value = max(
            settings.sensor.pressure_min,
            min(settings.sensor.pressure_max, self._smoothed + spike_offset),
        )
        self._last_value = round(value, 2)
        return self._last_value


class SimulatedTemperatureSensor(BaseSensor):
    """
    Industrial motor / gearbox temperature simulator — operating band 70–90 °C.

    Signal layers:
      1. Thermal cycle        sin(80 s period)   — heat build-up under load then cooling
      2. Load ripple          sin(12 s period)   — workload variations
      3. Gaussian noise       σ = 0.25 °C        — sensor noise
      4. EMA (α = 0.18)                          — strong thermal inertia
      5. Overheat spike events bell-curve profile — occasional overloads
                              Avg ~1 per 65 s; peak +5–20 °C above base.
                              Above 92 °C triggers WARNING,
                              above 109 °C triggers CRITICAL.
    """

    _BAND_MID: float = 80.0
    _BAND_HALF: float = 7.5    # thermal cycle half-amplitude (°C)
    _RIPPLE: float = 1.2       # load ripple half-amplitude (°C)
    _NOISE_STD: float = 0.25

    # Stronger smoothing reflects slow thermal response
    _ALPHA: float = 0.18

    _SPIKE_PROB: float = 0.0015        # per reading ≈ 1 event per 67 s at 10 Hz
    _SPIKE_STEPS_MIN: int = 20         # 2.0 s at 10 Hz
    _SPIKE_STEPS_MAX: int = 50         # 5.0 s at 10 Hz
    _SPIKE_AMP_MIN: float = 5.0        # °C above base (may trigger WARNING)
    _SPIKE_AMP_MAX: float = 22.0       # °C above base (may trigger CRITICAL)

    def __init__(self) -> None:
        super().__init__(settings.sensor.temperature_name)
        self._t0 = time.monotonic()
        self._smoothed: float = self._BAND_MID
        self._spike_active: bool = False
        self._spike_step: int = 0
        self._spike_total: int = 0
        self._spike_amp: float = 0.0

    async def read(self) -> float:
        elapsed = time.monotonic() - self._t0

        # Composite base: thermal cycle + load ripple + noise
        base = (
            self._BAND_MID
            + self._BAND_HALF * math.sin(2 * math.pi * elapsed / 80.0)
            + self._RIPPLE   * math.sin(2 * math.pi * elapsed / 12.0)
            + random.gauss(0.0, self._NOISE_STD)
        )

        # Smooth base via EMA (thermal inertia — temperature changes slowly)
        self._smoothed = self._ALPHA * base + (1.0 - self._ALPHA) * self._smoothed

        # Overheat spike overlay (added directly to output, not re-filtered)
        spike_offset = 0.0
        if self._spike_active:
            progress = self._spike_step / self._spike_total
            spike_offset = self._spike_amp * math.sin(math.pi * progress)
            self._spike_step += 1
            if self._spike_step >= self._spike_total:
                self._spike_active = False
        elif random.random() < self._SPIKE_PROB:
            self._spike_total = random.randint(self._SPIKE_STEPS_MIN, self._SPIKE_STEPS_MAX)
            self._spike_step = 0
            self._spike_amp = random.uniform(self._SPIKE_AMP_MIN, self._SPIKE_AMP_MAX)
            self._spike_active = True
            logger.debug(
                "Temperature spike: +%.1f °C over %d steps (%.1f s)",
                self._spike_amp, self._spike_total, self._spike_total / 10.0,
            )

        value = max(
            settings.sensor.temperature_min,
            min(settings.sensor.temperature_max, self._smoothed + spike_offset),
        )
        self._last_value = round(value, 1)
        return self._last_value


# ---------------------------------------------------------------------------
# Hardware sensors — real GPIO / I2C / SPI implementations
# ---------------------------------------------------------------------------

class HardwarePressureSensor(BaseSensor):
    """
    4–20 mA industrial pressure transmitter read via ADS1115 I2C ADC.

    Wiring (see HARDWARE.md § 5.P1 and § 11):
        24 VDC PSU (+) → sensor (+, 4–20 mA out)
        Sensor (–)     → 250 Ω shunt → ADS1115 AIN0 (positive)
        Shunt other end → ADS1115 GND = 24 VDC PSU (–) = RPi GND
        ADS1115 VDD    → RPi 5 V (Pin 2)
        ADS1115 SDA    → RPi GPIO 2 / I2C SDA (Pin 3)
        ADS1115 SCL    → RPi GPIO 3 / I2C SCL (Pin 5)
        ADS1115 ADDR   → GND → I2C address 0x48

    Signal maths:
        4 mA  × 250 Ω = 1.000 V → 0 bar (sensor lower range)
        20 mA × 250 Ω = 5.000 V → PRESSURE_SENSOR_RANGE_BAR
        Gain TWOTHIRDS (±6.144 V) is required; default ±4.096 V clips at 5 V.

    Install on Pi:  pip install adafruit-circuitpython-ads1x15 adafruit-blinka
    Enable I2C:     sudo raspi-config → Interfaces → I2C → Enable
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
            # ±6.144 V gain — mandatory so 5 V (= 20 mA × 250 Ω) does not clip
            ads.gain = 2 / 3
            channel_pin = settings.sensor.pressure_ads1115_channel  # 0–3 → AIN0–AIN3
            self._channel = AnalogIn(ads, channel_pin)
            logger.info(
                "ADS1115 pressure sensor ready  I2C=0x%02X  AIN%d  range=0–%.0f bar",
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
        # I (mA) = V / R  →  V / 250 Ω × 1000  =  V × 4
        current_ma = voltage * 4.0
        # Clamp to valid 4–20 mA span (handles open-circuit or wiring faults)
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
# Sensor Manager — orchestrates reads and determines system status
# ---------------------------------------------------------------------------

class SensorManager:
    """
    Top-level coordinator that:
      - Selects simulated or hardware sensors at startup
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
        self._simulated = settings.server.simulated
        self._pressure_sensor: BaseSensor
        self._temperature_sensor: BaseSensor
        self._latest: Optional[SensorReading] = None
        self._initialised = False

    async def initialise(self) -> None:
        """Call once at application startup."""
        if self._simulated:
            logger.info("Starting in SIMULATED sensor mode")
            self._pressure_sensor    = SimulatedPressureSensor()
            self._temperature_sensor = SimulatedTemperatureSensor()
        else:
            logger.info("Starting in HARDWARE sensor mode")
            try:
                self._pressure_sensor    = HardwarePressureSensor()
                self._temperature_sensor = HardwareTemperatureSensor()
            except Exception as exc:
                # Hardware unavailable (sensors not wired, I2C disabled, etc.).
                # Fall back to simulation so the server stays healthy and the
                # operator can see live-ish data while hardware is being commissioned.
                logger.warning(
                    "Hardware sensor init failed — falling back to SIMULATED mode: %s", exc
                )
                self._simulated          = True
                self._pressure_sensor    = SimulatedPressureSensor()
                self._temperature_sensor = SimulatedTemperatureSensor()

        self._initialised = True
        logger.info(
            "SensorManager ready | mode=%s | pressure=%s | temperature=%s",
            self.mode,
            self._pressure_sensor.name,
            self._temperature_sensor.name,
        )

    async def read(self) -> SensorReading:
        """Read both sensors concurrently and return a composite SensorReading."""
        if not self._initialised:
            raise RuntimeError("SensorManager.initialise() must be called before read()")

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
        return "simulated" if self._simulated else "hardware"

    async def set_mode(self, simulated: bool) -> tuple[bool, str]:
        """
        Hot-swap sensor implementations at runtime without restarting the server.

        Switching to simulation always succeeds.
        Switching to hardware fails gracefully if the drivers are unavailable
        (e.g. running on a non-Pi machine), keeping the current mode unchanged.

        Returns:
            (success, message) — callers should surface the message to the user.
        """
        if simulated == self._simulated:
            return True, f"Already in {self.mode} mode"

        if simulated:
            self._pressure_sensor    = SimulatedPressureSensor()
            self._temperature_sensor = SimulatedTemperatureSensor()
            self._simulated = True
            logger.info("SensorManager: switched to SIMULATED mode")
            return True, "Switched to simulation mode"

        # Switching to hardware — initialisation may fail on non-Pi hardware
        try:
            pressure_sensor    = HardwarePressureSensor()
            temperature_sensor = HardwareTemperatureSensor()
        except Exception as exc:
            logger.warning("Hardware sensor init failed, staying in simulated mode: %s", exc)
            return False, f"Hardware sensors unavailable: {exc}"

        self._pressure_sensor    = pressure_sensor
        self._temperature_sensor = temperature_sensor
        self._simulated = False
        logger.info("SensorManager: switched to HARDWARE mode")
        return True, "Switched to hardware mode"

    def _derive_status(self, pressure: float, temperature: float) -> SystemStatus:
        if pressure >= self._PRESSURE_CRITICAL or temperature >= self._TEMP_CRITICAL:
            return SystemStatus.CRITICAL
        if pressure >= self._PRESSURE_WARNING or temperature >= self._TEMP_WARNING:
            return SystemStatus.WARNING
        return SystemStatus.HEALTHY
