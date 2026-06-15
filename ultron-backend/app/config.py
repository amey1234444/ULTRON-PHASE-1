"""
ULTRON - Industrial IoT Monitoring System
Configuration module: loads all settings from environment variables with sane defaults.
"""

import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class SensorConfig:
    pressure_name: str = field(default_factory=lambda: os.getenv("PRESSURE_SENSOR_NAME", "PSN-001"))
    temperature_name: str = field(default_factory=lambda: os.getenv("TEMPERATURE_SENSOR_NAME", "TSN-001"))
    # GPIO pins — only relevant when running on real hardware
    pressure_gpio_pin: int = field(default_factory=lambda: int(os.getenv("PRESSURE_GPIO_PIN", "17")))
    temperature_gpio_pin: int = field(default_factory=lambda: int(os.getenv("TEMPERATURE_GPIO_PIN", "27")))
    # ADS1115 ADC settings for 4–20 mA pressure sensor
    # pressure_sensor_range_bar: full-scale of the physical transmitter (4 mA = 0 bar, 20 mA = range)
    pressure_sensor_range_bar: float = field(
        default_factory=lambda: float(os.getenv("PRESSURE_SENSOR_RANGE_BAR", "10.0"))
    )
    # pressure_ads1115_channel: 0–3 → AIN0–AIN3 on the ADS1115
    pressure_ads1115_channel: int = field(
        default_factory=lambda: int(os.getenv("PRESSURE_ADS1115_CHANNEL", "0"))
    )
    # pressure_ads1115_address: I2C address (0x48 default; ADDR→GND)
    pressure_ads1115_address: int = field(
        default_factory=lambda: int(os.getenv("PRESSURE_ADS1115_ADDRESS", "0x48"), 0)
    )
    # Simulation bounds
    pressure_min: float = field(default_factory=lambda: float(os.getenv("PRESSURE_MIN", "1.0")))
    pressure_max: float = field(default_factory=lambda: float(os.getenv("PRESSURE_MAX", "15.0")))
    temperature_min: float = field(default_factory=lambda: float(os.getenv("TEMPERATURE_MIN", "20.0")))
    temperature_max: float = field(default_factory=lambda: float(os.getenv("TEMPERATURE_MAX", "120.0")))


@dataclass(frozen=True)
class ServerConfig:
    host: str = field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(os.getenv("PORT", "8000")))
    # Broadcast interval in seconds (default 100 ms)
    broadcast_interval: float = field(
        default_factory=lambda: float(os.getenv("BROADCAST_INTERVAL_MS", "100")) / 1000.0
    )
    # Simulated mode — set SIMULATED=false on real hardware
    simulated: bool = field(
        default_factory=lambda: os.getenv("SIMULATED", "true").lower() in ("true", "1", "yes")
    )


@dataclass(frozen=True)
class LogConfig:
    level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO").upper())
    dir: str = field(default_factory=lambda: os.getenv("LOG_DIR", "logs"))
    max_bytes: int = field(default_factory=lambda: int(os.getenv("LOG_MAX_BYTES", str(5 * 1024 * 1024))))  # 5 MB
    backup_count: int = field(default_factory=lambda: int(os.getenv("LOG_BACKUP_COUNT", "7")))


@dataclass(frozen=True)
class DiscoveryConfig:
    # mDNS / Zeroconf advertisement
    mdns_enabled:    bool = field(
        default_factory=lambda: os.getenv("MDNS_ENABLED", "true").lower() in ("true", "1", "yes")
    )
    device_name:     str  = field(default_factory=lambda: os.getenv("DEVICE_NAME",    "ULTRON Edge"))
    hostname:        str  = field(default_factory=lambda: os.getenv("MDNS_HOSTNAME",  "ultron-edge"))
    service_type:    str  = field(default_factory=lambda: os.getenv("MDNS_SERVICE_TYPE", "_ultron._tcp.local."))


@dataclass(frozen=True)
class ModbusConfig:
    # ── Modbus TCP ────────────────────────────────────────────────────────────
    tcp_enabled: bool = field(
        default_factory=lambda: os.getenv("MODBUS_TCP_ENABLED", "true").lower() in ("true", "1", "yes")
    )
    tcp_host: str = field(default_factory=lambda: os.getenv("MODBUS_TCP_HOST", "0.0.0.0"))
    # Default dev port 5020 — avoids needing root privileges on Linux (502 requires root)
    tcp_port: int = field(default_factory=lambda: int(os.getenv("MODBUS_TCP_PORT", "5020")))

    # ── Modbus RTU ────────────────────────────────────────────────────────────
    rtu_enabled: bool = field(
        default_factory=lambda: os.getenv("MODBUS_RTU_ENABLED", "false").lower() in ("true", "1", "yes")
    )
    # Typical Linux defaults; Windows users set COM1-COM4
    rtu_port: str    = field(default_factory=lambda: os.getenv("MODBUS_RTU_PORT",     "/dev/ttyUSB0"))
    rtu_baudrate: int = field(default_factory=lambda: int(os.getenv("MODBUS_RTU_BAUDRATE", "9600")))
    rtu_parity: str  = field(default_factory=lambda: os.getenv("MODBUS_RTU_PARITY",   "N"))
    rtu_stopbits: int = field(default_factory=lambda: int(os.getenv("MODBUS_RTU_STOPBITS", "1")))
    rtu_bytesize: int = field(default_factory=lambda: int(os.getenv("MODBUS_RTU_BYTESIZE", "8")))
    rtu_slave_id: int = field(default_factory=lambda: int(os.getenv("MODBUS_RTU_SLAVE_ID", "1")))

    # ── Register encoding ─────────────────────────────────────────────────────
    # Float32 byte order: ABCD (big-endian, default) | CDAB | BADC | DCBA
    byte_order: str = field(default_factory=lambda: os.getenv("MODBUS_BYTE_ORDER", "ABCD"))
    # Compatibility integer registers 30101-30102 (value × 100)
    compat_registers: bool = field(
        default_factory=lambda: os.getenv("MODBUS_COMPAT_REGISTERS", "true").lower() in ("true", "1", "yes")
    )


@dataclass(frozen=True)
class DatabaseConfig:
    enabled: bool = field(
        default_factory=lambda: os.getenv("DB_ENABLED", "true").lower() in ("true", "1", "yes")
    )
    path: str = field(default_factory=lambda: os.getenv("DB_PATH", "./data/ultron.db"))
    retention_days: int = field(
        default_factory=lambda: int(os.getenv("DB_RETENTION_DAYS", "30"))
    )
    batch_interval_s: float = field(
        default_factory=lambda: float(os.getenv("DB_BATCH_INTERVAL_S", "1"))
    )


@dataclass(frozen=True)
class AppConfig:
    app_name: str = field(default_factory=lambda: os.getenv("APP_NAME", "ULTRON"))
    version: str = field(default_factory=lambda: os.getenv("APP_VERSION", "1.0.0"))
    device_id: str = field(default_factory=lambda: os.getenv("DEVICE_ID", "RPi4-ULTRON-001"))
    # Machine ID — identifies the monitored physical machine (not the edge device)
    machine_id: str = field(default_factory=lambda: os.getenv("MACHINE_ID", "RAV-01"))
    server:    ServerConfig    = field(default_factory=ServerConfig)
    sensor:    SensorConfig    = field(default_factory=SensorConfig)
    log:       LogConfig       = field(default_factory=LogConfig)
    modbus:    ModbusConfig    = field(default_factory=ModbusConfig)
    discovery: DiscoveryConfig = field(default_factory=DiscoveryConfig)
    db:        DatabaseConfig  = field(default_factory=DatabaseConfig)


# Single shared instance used across the application
settings = AppConfig()
