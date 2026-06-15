"""
ULTRON Modbus Alarm Calculator
================================
Derives per-sensor Modbus alarm status integers from live process values
and configured engineering thresholds.

Thresholds use the same percentage-of-max rules as SensorManager so that
the Modbus alarm registers always agree with the WebSocket status field.
"""

from app.config import settings
from app.modbus.register_map import ALARM_CRITICAL, ALARM_NORMAL, ALARM_WARNING


def calculate_alarm_status(
    value: float,
    warning_threshold: float,
    critical_threshold: float,
) -> int:
    """
    Return the Modbus alarm status integer for a single process value.

    Args:
        value: Current sensor reading in engineering units.
        warning_threshold: Value at or above which WARNING (1) is returned.
        critical_threshold: Value at or above which CRITICAL (2) is returned.

    Returns:
        ALARM_CRITICAL (2), ALARM_WARNING (1), or ALARM_NORMAL (0).
    """
    if value >= critical_threshold:
        return ALARM_CRITICAL
    if value >= warning_threshold:
        return ALARM_WARNING
    return ALARM_NORMAL


def pressure_alarm(pressure: float) -> int:
    """
    Compute alarm status for pressure using the thresholds from settings.

    WARNING  = PRESSURE_MAX × 0.80   (→ 8.8 bar with default PRESSURE_MAX=11.0)
    CRITICAL = PRESSURE_MAX × 0.95   (→ 10.45 bar)
    """
    warning  = settings.sensor.pressure_max * 0.80
    critical = settings.sensor.pressure_max * 0.95
    return calculate_alarm_status(pressure, warning, critical)


def temperature_alarm(temperature: float) -> int:
    """
    Compute alarm status for temperature using the thresholds from settings.

    WARNING  = TEMPERATURE_MAX × 0.80   (→ 92.0 °C with default TEMPERATURE_MAX=115.0)
    CRITICAL = TEMPERATURE_MAX × 0.95   (→ 109.25 °C)
    """
    warning  = settings.sensor.temperature_max * 0.80
    critical = settings.sensor.temperature_max * 0.95
    return calculate_alarm_status(temperature, warning, critical)
