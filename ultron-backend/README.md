# ULTRON — Industrial IoT Monitoring Backend

Real-time pressure and temperature streaming from a **Raspberry Pi 4** via FastAPI + WebSocket.

---

## Architecture

```
Raspberry Pi 4
│
├─ SensorManager          ← reads GPIO / simulates values
│    ├─ PressureSensor    (PSN-001)
│    └─ TemperatureSensor (TSN-001)
│
├─ WebSocketManager       ← broadcasts JSON @ 100 ms to all clients
│
└─ FastAPI (Uvicorn)
     ├─ GET  /health
     ├─ GET  /device
     ├─ GET  /sensors/latest
     └─ WS   /ws
```

---

## Quick Start

### 1. Clone & install

```bash
cd ultron-backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure

```bash
cp .env .env.local
# Edit .env.local — set SIMULATED=false on real hardware
```

### 3. Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Or via the module entry-point:

```bash
python -m app.main
```

---

## API Reference

### `GET /health`

Liveness probe.

```json
{
  "status": "ok",
  "uptime_seconds": 42.3,
  "mode": "simulated",
  "version": "1.0.0"
}
```

### `GET /device`

Static device metadata.

```json
{
  "device_id": "RPi4-ULTRON-001",
  "app_name": "ULTRON",
  "version": "1.0.0",
  "pressure_sensor": "PSN-001",
  "temperature_sensor": "TSN-001",
  "broadcast_interval_ms": 100,
  "mode": "simulated"
}
```

### `GET /sensors/latest`

Latest cached reading (REST snapshot).

```json
{
  "reading": {
    "timestamp": "2026-06-01T10:00:00+00:00",
    "pressure": 7.3,
    "temperature": 82.1,
    "status": "healthy"
  },
  "message": "ok"
}
```

### `WS /ws`

WebSocket stream. Connect with any WebSocket client:

```bash
# wscat (npm install -g wscat)
wscat -c ws://localhost:8000/ws
```

Payload broadcast every 100 ms:

```json
{
  "timestamp": "2026-06-01T10:00:00+00:00",
  "pressure": 7.3,
  "temperature": 82.1,
  "status": "healthy"
}
```

**Status values:**

| Value      | Meaning                                      |
|------------|----------------------------------------------|
| `healthy`  | All readings within normal operating range   |
| `warning`  | Any reading above 80 % of configured maximum |
| `critical` | Any reading above 95 % of configured maximum |
| `offline`  | Sensor not reachable                         |

---

## Hardware Setup (Raspberry Pi 4)

### Enabling hardware mode

```bash
# .env
SIMULATED=false
```

### DS18B20 Temperature Sensor (1-Wire)

```bash
# /boot/config.txt
dtoverlay=w1-gpio
```

Reboot then verify:

```bash
ls /sys/bus/w1/devices/
# 28-xxxxxxxxxxxx  ← your sensor
```

### Pressure Sensor (4–20 mA via ADS1115 ADC)

1. Install Adafruit libs:
   ```bash
   pip install adafruit-circuitpython-ads1x15 adafruit-blinka
   ```
2. Implement `HardwarePressureSensor.read()` in `app/sensor_manager.py` using the ADS1115 driver.

---

## Configuration Reference

| Variable               | Default           | Description                        |
|------------------------|-------------------|------------------------------------|
| `APP_NAME`             | `ULTRON`          | Application name                   |
| `APP_VERSION`          | `1.0.0`           | Semver version string              |
| `DEVICE_ID`            | `RPi4-ULTRON-001` | Unique device identifier           |
| `HOST`                 | `0.0.0.0`         | Bind address                       |
| `PORT`                 | `8000`            | HTTP/WS port                       |
| `BROADCAST_INTERVAL_MS`| `100`             | WebSocket publish rate (ms)        |
| `SIMULATED`            | `true`            | `false` to use real GPIO sensors   |
| `PRESSURE_SENSOR_NAME` | `PSN-001`         | Pressure sensor identifier         |
| `TEMPERATURE_SENSOR_NAME`| `TSN-001`       | Temperature sensor identifier      |
| `PRESSURE_GPIO_PIN`    | `17`              | BCM GPIO pin (hardware mode)       |
| `TEMPERATURE_GPIO_PIN` | `27`              | BCM GPIO pin (hardware mode)       |
| `PRESSURE_MIN/MAX`     | `1.0` / `15.0`    | Operating range in bar             |
| `TEMPERATURE_MIN/MAX`  | `20.0` / `120.0`  | Operating range in °C              |
| `LOG_LEVEL`            | `INFO`            | `DEBUG`, `INFO`, `WARNING`, `ERROR`|
| `LOG_DIR`              | `logs`            | Directory for rotating log files   |
| `LOG_MAX_BYTES`        | `5242880` (5 MB)  | Max log file size before rotation  |
| `LOG_BACKUP_COUNT`     | `7`               | Number of rotated log files kept   |

---

## Project Structure

```
ultron-backend/
├── app/
│   ├── __init__.py
│   ├── main.py              ← FastAPI app, REST + WS endpoints, lifespan
│   ├── config.py            ← Typed settings loaded from .env
│   ├── logger.py            ← Rotating file + console logging
│   ├── models.py            ← Pydantic response schemas
│   ├── sensor_manager.py    ← Sensor abstraction (simulated + hardware)
│   └── websocket_manager.py ← Connection registry + broadcast loop
├── logs/                    ← Created at runtime
├── .env                     ← Environment configuration (do not commit secrets)
├── requirements.txt
└── README.md
```

---

## Deploying as a systemd Service (Raspberry Pi)

```ini
# /etc/systemd/system/ultron.service
[Unit]
Description=ULTRON Industrial IoT Backend
After=network.target

[Service]
User=pi
WorkingDirectory=/home/pi/ultron-backend
EnvironmentFile=/home/pi/ultron-backend/.env
ExecStart=/home/pi/ultron-backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable ultron
sudo systemctl start ultron
sudo journalctl -u ultron -f
```

---

*Built by Oswar Software — ULTRON Phase 1 Demo*
