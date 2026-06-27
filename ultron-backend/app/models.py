"""
ULTRON - Industrial IoT Monitoring System
Data models: Pydantic schemas for API responses and WebSocket payloads.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SystemStatus(str, Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    OFFLINE = "offline"


class SensorReading(BaseModel):
    """Single sensor data point transmitted over WebSocket and REST."""

    timestamp: datetime = Field(..., description="UTC ISO-8601 timestamp of the reading")
    pressure: float = Field(..., ge=0.0, description="Pressure in bar")
    temperature: float = Field(..., description="Temperature in °C")
    status: SystemStatus = Field(default=SystemStatus.HEALTHY)
    machine_id: Optional[str] = Field(default=None, description="Machine ID the reading belongs to (bridge routing)")
    device_id: Optional[str] = Field(default=None, description="Matched asset node id (bridge routing)")

    model_config = {"json_encoders": {datetime: lambda v: v.isoformat()}}


class HealthResponse(BaseModel):
    status: str
    uptime_seconds: float
    mode: str  # "simulated" | "hardware"
    version: str


class DeviceInfo(BaseModel):
    device_id: str
    app_name: str
    version: str
    pressure_sensor: str
    temperature_sensor: str
    broadcast_interval_ms: int
    mode: str


class SensorSnapshot(BaseModel):
    """Latest cached reading returned by the REST snapshot endpoint."""

    reading: Optional[SensorReading] = None
    message: str = "No reading available yet"


class DeviceIdentityResponse(BaseModel):
    """
    Static device identity payload returned by GET /api/device/identity.
    Used by auto-discovery clients (dashboard, standalone Python agent) to confirm
    they are talking to an ULTRON Edge device and to learn connection parameters.
    """

    device_name:         str
    device_type:         str            # "raspberry_pi_gateway"
    hostname:            str            # "ultron-edge"
    machine_id:          str            # "RAV-01" — the monitored machine
    serial_number:       str            # "Unknown / needs verification"
    software_version:    str
    supported_protocols: list[str]      # ["websocket", "modbus_tcp", ...]
    api_port:            int
    modbus_tcp_port:     int


class ModbusStatusResponse(BaseModel):
    """Runtime status of the Modbus subsystem — returned by GET /api/modbus/status."""

    tcp_enabled:      bool
    tcp_running:      bool
    tcp_host:         str
    tcp_port:         int
    rtu_enabled:      bool
    rtu_running:      bool
    rtu_port:         str
    slave_id:         int
    byte_order:       str
    compat_registers: bool
    register_updates: int
    last_update:      Optional[str] = None


class SensorHistoryItem(BaseModel):
    timestamp: str
    machine_id: str
    pressure: float
    temperature: Optional[float]
    status: str


class SensorHistoryResponse(BaseModel):
    count: int
    total_stored: int
    readings: list[SensorHistoryItem]


class ModeChangeRequest(BaseModel):
    """Request body for POST /api/control/mode."""

    simulated: bool = Field(..., description="true = simulation mode, false = hardware mode")


class ModeChangeResponse(BaseModel):
    """Response from POST /api/control/mode."""

    success:  bool   = Field(..., description="True if the mode was changed successfully")
    mode:     str    = Field(..., description="Active mode after this request: 'simulated' or 'hardware'")
    message:  str    = Field(..., description="Human-readable result message")


# ---------------------------------------------------------------------------
# Bridge registration models
# ---------------------------------------------------------------------------

class BridgeRegisterRequest(BaseModel):
    """Request body for POST /api/bridges/register."""

    url: str = Field(..., description="Bridge URL (e.g. http://192.168.1.100:8765)")


class BridgeRegisterResponse(BaseModel):
    """Response from POST /api/bridges/register."""

    success: bool
    bridge_id: str
    url: str
    message: str


class BridgeListResponse(BaseModel):
    """Response from GET /api/bridges."""

    count: int
    bridges: list[dict]


class BridgeIngestRequest(BaseModel):
    """
    Request body for POST /api/bridges/ingest (push model).

    A bridge running on a private LAN POSTs its readings here so the backend
    receives data without having to reach back into the bridge's network.
    Extra fields (e.g. fault, mode, pressureBar) are preserved and forwarded
    to the same normalization path used for polled bridges.
    """

    model_config = {"extra": "allow"}

    source: Optional[str] = Field(
        default=None,
        description="Stable identifier for this bridge (machine_id, hostname, etc.)",
    )
    machine_id: Optional[str] = Field(
        default=None,
        description="Machine ID used to route this reading to a device binding",
    )
    ip: Optional[str] = Field(
        default=None,
        description="Bridge's own (LAN) IP, matched against the device binding",
    )
    port: Optional[int] = Field(
        default=None,
        description="Bridge's port (informational; stored on the binding)",
    )
    pressure: Optional[float] = None
    temperature: Optional[float] = None


class BridgeIngestResponse(BaseModel):
    """Response from POST /api/bridges/ingest."""

    success: bool
    bridge_id: str
    message: str
